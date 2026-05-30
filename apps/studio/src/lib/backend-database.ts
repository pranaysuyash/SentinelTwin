import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  Workspace,
  SceneRecord,
  Draft,
  Report,
  User,
  WorkspaceMember,
  UserRole,
  AuditLog,
  Comment,
  SyncConflictState,
} from "@sentineltwin/core";

export class BackendDatabase {
  private dataDir: string;

  constructor() {
    const cwd = process.cwd();
    const studioRoot = existsSync(join(cwd, "apps", "studio")) ? join(cwd, "apps", "studio") : cwd;
    this.dataDir = join(studioRoot, ".sentineltwin-backend");
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

  public authorizeWorkspace(userId: string, workspaceId: string): { user: User, member: WorkspaceMember } {
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
}

export const db = new BackendDatabase();
