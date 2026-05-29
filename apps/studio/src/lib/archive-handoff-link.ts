import { normalizeOperationalEvidenceArchive, type OperationalEvidenceArchive } from "@/lib/operational-evidence-archive";

export type ArchiveRestoreBranch = "draft" | "recovered" | "published";

export type ArchiveHandoffLinkState = {
  archive: OperationalEvidenceArchive | null;
  restoreBranch?: ArchiveRestoreBranch | null;
};

export type ArchiveHandoffRequest = {
  archive: OperationalEvidenceArchive;
  restoreBranch: ArchiveRestoreBranch;
  source?: "launcher" | "scene" | "debug" | "report";
};

export type ParsedArchiveHandoffLink = ArchiveHandoffRequest;

export function applyArchiveHandoffLinkState(params: URLSearchParams, state: ArchiveHandoffLinkState) {
  if (state.archive) {
    params.set("archivePayload", JSON.stringify(state.archive));
  } else {
    params.delete("archivePayload");
  }

  if (state.restoreBranch === "draft" || state.restoreBranch === "recovered" || state.restoreBranch === "published") {
    params.set("archiveRestoreBranch", state.restoreBranch);
  } else {
    params.delete("archiveRestoreBranch");
  }
}

export function buildArchiveHandoffLink(baseUrl: string, currentSearch: string, state: ArchiveHandoffLinkState, hash = "") {
  const params = new URLSearchParams(currentSearch);
  applyArchiveHandoffLinkState(params, state);
  const search = params.toString();
  return `${baseUrl}${search ? `?${search}` : ""}${hash}`;
}

export function parseArchiveHandoffLink(search: string): ParsedArchiveHandoffLink | null {
  const params = new URLSearchParams(search);
  const archivePayload = params.get("archivePayload");
  if (!archivePayload) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(archivePayload);
  } catch {
    return null;
  }

  const archive = normalizeOperationalEvidenceArchive(parsed);
  if (!archive) return null;

  const restoreBranchParam = params.get("archiveRestoreBranch");
  const restoreBranch: ArchiveRestoreBranch =
    restoreBranchParam === "recovered" || restoreBranchParam === "published" ? restoreBranchParam : "draft";

  return {
    archive,
    restoreBranch,
    source: "launcher",
  };
}
