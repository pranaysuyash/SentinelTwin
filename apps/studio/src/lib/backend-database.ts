import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  AuditLog,
  Comment,
  Draft,
  OwnershipTransferEvent,
  Report,
  SceneRecord,
  SyncConflictState,
  User,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
  createWorkspaceInvite,
  createOwnershipTransferEvent,
  acceptOwnershipTransfer,
  cancelOwnershipTransfer,
  isWorkspaceInviteExpired,
} from "@sentineltwin/core";

export { createWorkspaceInvite, createOwnershipTransferEvent, acceptOwnershipTransfer, cancelOwnershipTransfer, isWorkspaceInviteExpired };
export type { UserRole } from "@sentineltwin/core";

export interface SceneReconciliationResult {
  result: SceneRecord;
  conflict?: SyncConflictState;
  status: "applied" | "conflict_pending" | "noop";
}

export interface RemoteSyncSummary {
  synchedCount: number;
  conflictCount: number;
  noopCount: number;
  conflicts: SyncConflictState[];
}

export class BackendDatabase {
  private dataDir: string;

  constructor(customDataDir?: string) {
    if (customDataDir) {
      this.dataDir = customDataDir;
    } else {
      const cwd = process.cwd();
      const studioRoot = existsSync(join(cwd, "apps", "studio")) ? join(cwd, "apps", "studio") : cwd;
      this.dataDir = join(studioRoot, ".sentineltwin-backend");
    }
    mkdirSync(this.dataDir, { recursive: true });

    this.initCollection("users");
    this.initCollection("workspaces");
    this.initCollection("members");
    this.initCollection("scenes");
    this.initCollection("drafts");
    this.initCollection("reports");
    this.initCollection("audit_logs");
    this.initCollection("comments");
    this.initCollection("conflicts");
    this.initCollection("invites");
    this.initCollection("ownership_transfers");
  }

  private initCollection(name: string) {
    const path = join(this.dataDir, `${name}.json`);
    if (!existsSync(path)) {
      writeFileSync(path, JSON.stringify([]));
    }
  }

  private readCollection<T>(name: string): T[] {
    const path = join(this.dataDir, `${name}.json`);
    try {
      return JSON.parse(readFileSync(path, "utf8")) as T[];
    } catch {
      return [];
    }
  }

  private writeCollection<T>(name: string, data: T[]) {
    const path = join(this.dataDir, `${name}.json`);
    writeFileSync(path, JSON.stringify(data, null, 2));
  }

  public authenticateUser(authId: string): User | null {
    const users = this.readCollection<User>("users");
    return users.find(u => u.authId === authId) || null;
  }

  public authorizeWorkspace(userId: string, workspaceId: string): { user: User; member: WorkspaceMember } {
    const users = this.readCollection<User>("users");
    const members = this.readCollection<WorkspaceMember>("members");

    const user = users.find(u => u.id === userId);
    if (!user) throw new Error("Unauthorized: User not found");

    const member = members.find(m => m.userId === userId && m.workspaceId === workspaceId);
    if (!member) throw new Error("Forbidden: User is not a member of this workspace");

    return { user, member };
  }

  public getWorkspace(id: string): Workspace | undefined {
    return this.readCollection<Workspace>("workspaces").find(w => w.id === id);
  }

  public getSceneRecord(id: string): SceneRecord | undefined {
    return this.readCollection<SceneRecord>("scenes").find(s => s.id === id);
  }

  public saveSceneRecord(record: SceneRecord) {
    const scenes = this.readCollection<SceneRecord>("scenes");
    const existingIndex = scenes.findIndex(s => s.id === record.id);
    if (existingIndex >= 0) scenes[existingIndex] = record;
    else scenes.push(record);
    this.writeCollection("scenes", scenes);
  }

  /**
   * Reconciles an incoming SceneRecord against server persistence.
   * If incoming version <= existing version and contents differ, detects and registers a conflict.
   */
  public reconcileSceneRecord(incoming: SceneRecord, actorId = "system", workspaceId?: string): SceneReconciliationResult {
    const existing = this.getSceneRecord(incoming.id);
    const now = Date.now();

    if (!existing) {
      this.saveSceneRecord(incoming);
      if (workspaceId) {
        this.addAuditLog({
          id: `audit_${Math.random().toString(36).substring(2, 11)}_${now}`,
          workspaceId,
          actorId,
          action: "scene_record.created",
          targetType: "scene_record",
          targetId: incoming.id,
          details: `Created scene record ${incoming.name} (v${incoming.version})`,
          timestamp: now,
        });
      }
      return { result: incoming, status: "applied" };
    }

    // Identical version and data -> noop
    if (existing.version === incoming.version && existing.updatedAt >= incoming.updatedAt) {
      return { result: existing, status: "noop" };
    }

    // Incoming version is strictly newer -> forward progression
    if (incoming.version > existing.version) {
      this.saveSceneRecord(incoming);
      if (workspaceId) {
        this.addAuditLog({
          id: `audit_${Math.random().toString(36).substring(2, 11)}_${now}`,
          workspaceId,
          actorId,
          action: "scene_record.updated",
          targetType: "scene_record",
          targetId: incoming.id,
          details: `Updated scene record ${incoming.name} from v${existing.version} to v${incoming.version}`,
          timestamp: now,
        });
      }
      return { result: incoming, status: "applied" };
    }

    // Version conflict detected (incoming version <= existing version with newer or divergent mutation)
    const conflict: SyncConflictState = {
      entityType: "SceneRecord",
      entityId: incoming.id,
      serverVersion: existing.version,
      clientVersion: incoming.version,
      conflictDetectedAt: now,
      resolutionStatus: "pending",
    };
    this.registerConflict(conflict);

    if (workspaceId) {
      this.addAuditLog({
        id: `audit_${Math.random().toString(36).substring(2, 11)}_${now}`,
        workspaceId,
        actorId,
        action: "scene_record.conflict_detected",
        targetType: "scene_record",
        targetId: incoming.id,
        details: `Conflict detected on scene ${incoming.name}: server v${existing.version} vs incoming v${incoming.version}`,
        timestamp: now,
      });
    }

    return { result: existing, conflict, status: "conflict_pending" };
  }

  /**
   * Synchronizes a batch of remote scene records against local storage.
   */
  public syncRemoteDirectory(workspaceId: string, remoteScenes: SceneRecord[], actorId = "system"): RemoteSyncSummary {
    let synchedCount = 0;
    let conflictCount = 0;
    let noopCount = 0;
    const conflicts: SyncConflictState[] = [];

    for (const remote of remoteScenes) {
      const res = this.reconcileSceneRecord(remote, actorId, workspaceId);
      if (res.status === "applied") synchedCount++;
      else if (res.status === "noop") noopCount++;
      else if (res.status === "conflict_pending" && res.conflict) {
        conflictCount++;
        conflicts.push(res.conflict);
      }
    }

    return { synchedCount, conflictCount, noopCount, conflicts };
  }

  public getPendingConflicts(entityId?: string): SyncConflictState[] {
    const conflicts = this.readCollection<SyncConflictState>("conflicts");
    return conflicts.filter(c => c.resolutionStatus === "pending" && (!entityId || c.entityId === entityId));
  }

  public resolveConflict(entityId: string, resolution: "server_wins" | "client_wins", incomingRecord?: SceneRecord): SyncConflictState | undefined {
    const conflicts = this.readCollection<SyncConflictState>("conflicts");
    const index = conflicts.findIndex(c => c.entityId === entityId && c.resolutionStatus === "pending");
    if (index === -1) return undefined;

    const conflict = conflicts[index];
    conflict.resolutionStatus = "resolved";
    conflicts[index] = conflict;
    this.writeCollection("conflicts", conflicts);

    if (resolution === "client_wins" && incomingRecord) {
      const existing = this.getSceneRecord(entityId);
      const nextVersion = existing ? Math.max(existing.version, incomingRecord.version) + 1 : incomingRecord.version;
      const promoted: SceneRecord = { ...incomingRecord, version: nextVersion, updatedAt: Date.now() };
      this.saveSceneRecord(promoted);
    }

    return conflict;
  }

  public addAuditLog(log: AuditLog) {
    const logs = this.readCollection<AuditLog>("audit_logs");
    logs.push(log);
    this.writeCollection("audit_logs", logs);
  }

  public addComment(comment: Comment) {
    const comments = this.readCollection<Comment>("comments");
    comments.push(comment);
    this.writeCollection("comments", comments);
  }

  public getComments(targetId: string): Comment[] {
    return this.readCollection<Comment>("comments").filter(c => c.targetId === targetId);
  }

  public registerConflict(conflict: SyncConflictState) {
    const conflicts = this.readCollection<SyncConflictState>("conflicts");
    conflicts.push(conflict);
    this.writeCollection("conflicts", conflicts);
  }

  public createInvite(invite: WorkspaceInvite) {
    const invites = this.readCollection<WorkspaceInvite>("invites");
    invites.push(invite);
    this.writeCollection("invites", invites);
  }

  public getInvite(id: string): WorkspaceInvite | undefined {
    return this.readCollection<WorkspaceInvite>("invites").find(i => i.id === id);
  }

  public getInviteByEmail(workspaceId: string, email: string): WorkspaceInvite | undefined {
    return this.readCollection<WorkspaceInvite>("invites")
      .find(i => i.workspaceId === workspaceId && i.inviteeEmail === email);
  }

  public updateInvite(invite: WorkspaceInvite): WorkspaceInvite | undefined {
    const invites = this.readCollection<WorkspaceInvite>("invites");
    const index = invites.findIndex(i => i.id === invite.id);
    if (index === -1) return undefined;
    invites[index] = invite;
    this.writeCollection("invites", invites);
    return invite;
  }

  public listInvitesForWorkspace(workspaceId: string): WorkspaceInvite[] {
    return this.readCollection<WorkspaceInvite>("invites").filter(i => i.workspaceId === workspaceId);
  }

  public createOwnershipTransfer(event: OwnershipTransferEvent) {
    const events = this.readCollection<OwnershipTransferEvent>("ownership_transfers");
    events.push(event);
    this.writeCollection("ownership_transfers", events);
  }

  public getOwnershipTransfer(id: string): OwnershipTransferEvent | undefined {
    return this.readCollection<OwnershipTransferEvent>("ownership_transfers").find(e => e.id === id);
  }

  public getActiveOwnershipTransferForWorkspace(workspaceId: string): OwnershipTransferEvent | undefined {
    return this.readCollection<OwnershipTransferEvent>("ownership_transfers")
      .find(e => e.workspaceId === workspaceId && e.status === "requested");
  }

  public updateOwnershipTransfer(event: OwnershipTransferEvent): OwnershipTransferEvent | undefined {
    const events = this.readCollection<OwnershipTransferEvent>("ownership_transfers");
    const index = events.findIndex(e => e.id === event.id);
    if (index === -1) return undefined;
    events[index] = event;
    this.writeCollection("ownership_transfers", events);
    return event;
  }
}

export const db = new BackendDatabase();
