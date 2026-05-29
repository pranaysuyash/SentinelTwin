export type TimelineShareLinkState = {
  provenanceNodeId?: string | null;
  provenanceEdgeId?: string | null;
  timelineEventId?: string | null;
  timelineTimestamp?: number | null;
  timelineQuery?: string | null;
  timelineBranch?: string | null;
};

export type ParsedTimelineShareLink = {
  timestamp: number;
  query: string | null;
  branchLabel: string | null;
  eventId: string | null;
  provenanceNodeId: string | null;
  provenanceEdgeId: string | null;
  source: "launcher";
};

export function applyTimelineShareLinkState(params: URLSearchParams, state: TimelineShareLinkState) {
  if (state.provenanceNodeId) {
    params.set("provenanceNode", state.provenanceNodeId);
  } else {
    params.delete("provenanceNode");
  }

  if (state.provenanceEdgeId) {
    params.set("provenanceEdge", state.provenanceEdgeId);
  } else {
    params.delete("provenanceEdge");
  }

  if (state.timelineEventId) {
    params.set("timelineEventId", state.timelineEventId);
  } else {
    params.delete("timelineEventId");
  }

  if (typeof state.timelineTimestamp === "number" && !Number.isNaN(state.timelineTimestamp)) {
    params.set("timelineTimestamp", String(state.timelineTimestamp));
  } else {
    params.delete("timelineTimestamp");
  }

  if (state.timelineQuery?.trim()) {
    params.set("timelineQuery", state.timelineQuery.trim());
  } else {
    params.delete("timelineQuery");
  }

  if (state.timelineBranch?.trim()) {
    params.set("timelineBranch", state.timelineBranch.trim());
  } else {
    params.delete("timelineBranch");
  }
}

export function buildTimelineShareLink(baseUrl: string, currentSearch: string, state: TimelineShareLinkState, hash = "") {
  const params = new URLSearchParams(currentSearch);
  applyTimelineShareLinkState(params, state);
  const search = params.toString();
  return `${baseUrl}${search ? `?${search}` : ""}${hash}`;
}

export function parseTimelineShareLink(search: string): ParsedTimelineShareLink | null {
  const params = new URLSearchParams(search);
  const timestampParam = params.get("timelineTimestamp");
  const timestamp = timestampParam ? Number(timestampParam) : null;
  if (!timestamp || Number.isNaN(timestamp)) return null;
  return {
    timestamp,
    query: params.get("timelineQuery"),
    branchLabel: params.get("timelineBranch"),
    eventId: params.get("timelineEventId"),
    provenanceNodeId: params.get("provenanceNode"),
    provenanceEdgeId: params.get("provenanceEdge"),
    source: "launcher",
  };
}
