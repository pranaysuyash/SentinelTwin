import type { SecurityScene } from "@/schema/security-scene";

// ─── Saved project persistence ───────────────────────────────────────────────

export type ProjectMetadata = {
  folder: string;
  tags: string[];
  pinned: boolean;
  workspaceOrganization: string;
  workspaceOwner: string;
  workspaceVisibility: "private" | "shared" | "published";
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
};

export type SavedProjectRecord = {
  scene: SecurityScene;
} & ProjectMetadata;

// ─── Timeline focus ──────────────────────────────────────────────────────────

export type TimelineFocusRequest = {
  timestamp: number;
  query?: string | null;
  branchLabel?: string | null;
  eventId?: string | null;
  provenanceNodeId?: string | null;
  provenanceEdgeId?: string | null;
  source?: "launcher" | "scene" | "debug" | "report";
};

// ─── Archive handoff ─────────────────────────────────────────────────────────

export type { ArchiveHandoffRequest } from "@/lib/archive-handoff-link";
export type ArchiveHandoffState = import("@/lib/archive-handoff-link").ArchiveHandoffRequest | null;
export type ArchiveRestoreContext = {
  archiveExportedAt?: string;
  archiveRestoreBranch?: "draft" | "recovered" | "published";
};

// ─── Storage keys ────────────────────────────────────────────────────────────

export const OPERATIONAL_EVIDENCE_STORAGE_KEY = "sentineltwin_operational_evidence_v1";
