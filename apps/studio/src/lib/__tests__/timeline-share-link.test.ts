import { describe, expect, test } from "bun:test";

import {
  applyTimelineShareLinkState,
  buildTimelineShareLink,
  parseTimelineShareLink,
} from "@/lib/timeline-share-link";

describe("timeline share link", () => {
  test("builds and parses a checkpoint share URL with branch and provenance focus", () => {
    const url = buildTimelineShareLink(
      "https://sentineltwin.local/studio",
      "?project=retail&existing=keep",
      {
        provenanceNodeId: "node_12",
        provenanceEdgeId: "edge_7",
        timelineEventId: "event_99",
        timelineTimestamp: 1_725_000_000_000,
        timelineQuery: "branch:published after:2026-05-29",
        timelineBranch: "published",
      },
      "#timeline",
    );

    expect(url).toBe(
      "https://sentineltwin.local/studio?project=retail&existing=keep&provenanceNode=node_12&provenanceEdge=edge_7&timelineEventId=event_99&timelineTimestamp=1725000000000&timelineQuery=branch%3Apublished+after%3A2026-05-29&timelineBranch=published#timeline",
    );

    const parsed = parseTimelineShareLink(new URL(url).search);
    expect(parsed).toEqual({
      timestamp: 1_725_000_000_000,
      query: "branch:published after:2026-05-29",
      branchLabel: "published",
      eventId: "event_99",
      provenanceNodeId: "node_12",
      provenanceEdgeId: "edge_7",
      source: "launcher",
    });
  });

  test("drops share fields when state is empty", () => {
    const params = new URLSearchParams("keep=1&provenanceNode=old");
    applyTimelineShareLinkState(params, {
      provenanceNodeId: null,
      provenanceEdgeId: null,
      timelineEventId: null,
      timelineTimestamp: null,
      timelineQuery: "   ",
      timelineBranch: "",
    });

    expect(params.toString()).toBe("keep=1");
  });
});
