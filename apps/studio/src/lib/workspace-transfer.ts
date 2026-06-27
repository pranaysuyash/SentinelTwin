import type { WorkspaceBackendContract, WorkspaceMember, WorkspaceRole } from "@/lib/workspace-backend-contract";

export type WorkspaceTransferRequest = {
  workspaceId: string;
  targetUserId: string;
  targetEmail: string;
  targetDisplayName: string;
  requestedBy: string;
  requestedAt: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  completedAt: number | null;
};

export type RemoteWorkspaceEntry = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  memberCount: number;
  lastModifiedAt: number;
  isRemote: boolean;
  remoteUrl: string | null;
};

export function createWorkspaceTransfer(
  workspaceId: string,
  targetUserId: string,
  targetEmail: string,
  targetDisplayName: string,
  requestedBy: string,
): WorkspaceTransferRequest {
  return {
    workspaceId,
    targetUserId,
    targetEmail,
    targetDisplayName,
    requestedBy,
    requestedAt: Date.now(),
    status: "pending",
    completedAt: null,
  };
}

export function acceptWorkspaceTransfer(
  transfer: WorkspaceTransferRequest,
  contract: WorkspaceBackendContract,
): { transfer: WorkspaceTransferRequest; contract: WorkspaceBackendContract } {
  const updatedMembers: WorkspaceMember[] = contract.members.map((m) =>
    m.userId === transfer.requestedBy ? { ...m, role: "admin" as WorkspaceRole } : m,
  );
  const newMember: WorkspaceMember = {
    userId: transfer.targetUserId,
    email: transfer.targetEmail,
    displayName: transfer.targetDisplayName,
    role: "owner",
    invitedAt: transfer.requestedAt,
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  return {
    transfer: { ...transfer, status: "accepted", completedAt: Date.now() },
    contract: { ...contract, ownerId: transfer.targetUserId, members: [...updatedMembers, newMember], updatedAt: Date.now() },
  };
}

export function buildRemoteWorkspaceCatalog(
  localWorkspaces: WorkspaceBackendContract[],
  remoteWorkspaces: RemoteWorkspaceEntry[],
): RemoteWorkspaceEntry[] {
  const localEntries: RemoteWorkspaceEntry[] = localWorkspaces.map((w) => ({
    id: w.id,
    name: w.name,
    ownerId: w.ownerId,
    ownerName: w.members.find((m) => m.role === "owner")?.displayName ?? "Unknown",
    memberCount: w.members.length,
    lastModifiedAt: w.updatedAt,
    isRemote: false,
    remoteUrl: null,
  }));
  return [...localEntries, ...remoteWorkspaces].sort((a, b) => b.lastModifiedAt - a.lastModifiedAt);
}
