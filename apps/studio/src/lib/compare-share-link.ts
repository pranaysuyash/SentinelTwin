export type CompareShareLinkState = {
  compareSnapshotAId?: string | null;
  compareSnapshotBId?: string | null;
  compareMode?: "beforeafter" | "report" | null;
};

export type ParsedCompareShareLink = {
  snapshotAId: string;
  snapshotBId: string;
  mode: "beforeafter" | "report";
};

export function applyCompareShareLinkState(params: URLSearchParams, state: CompareShareLinkState) {
  if (state.compareSnapshotAId) {
    params.set("compareSnapshotA", state.compareSnapshotAId);
  } else {
    params.delete("compareSnapshotA");
  }

  if (state.compareSnapshotBId) {
    params.set("compareSnapshotB", state.compareSnapshotBId);
  } else {
    params.delete("compareSnapshotB");
  }

  if (state.compareMode === "beforeafter" || state.compareMode === "report") {
    params.set("compareMode", state.compareMode);
  } else {
    params.delete("compareMode");
  }
}

export function buildCompareShareLink(baseUrl: string, currentSearch: string, state: CompareShareLinkState, hash = "") {
  const params = new URLSearchParams(currentSearch);
  applyCompareShareLinkState(params, state);
  const search = params.toString();
  return `${baseUrl}${search ? `?${search}` : ""}${hash}`;
}

export function parseCompareShareLink(search: string): ParsedCompareShareLink | null {
  const params = new URLSearchParams(search);
  const snapshotAId = params.get("compareSnapshotA");
  const snapshotBId = params.get("compareSnapshotB");
  const modeParam = params.get("compareMode");
  if (!snapshotAId || !snapshotBId) return null;
  return {
    snapshotAId,
    snapshotBId,
    mode: modeParam === "report" ? "report" : "beforeafter",
  };
}
