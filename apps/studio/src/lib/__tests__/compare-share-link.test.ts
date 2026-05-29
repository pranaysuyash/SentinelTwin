import { describe, expect, test } from "bun:test";

import { applyCompareShareLinkState, buildCompareShareLink, parseCompareShareLink } from "@/lib/compare-share-link";

describe("compare share link", () => {
  test("builds and parses compare snapshot routing state", () => {
    const url = buildCompareShareLink(
      "https://sentineltwin.local/studio",
      "?project=retail&studio=1",
      {
        compareSnapshotAId: "snap_a",
        compareSnapshotBId: "snap_b",
        compareMode: "report",
      },
      "#report",
    );

    expect(url).toBe(
      "https://sentineltwin.local/studio?project=retail&studio=1&compareSnapshotA=snap_a&compareSnapshotB=snap_b&compareMode=report#report",
    );

    const parsed = parseCompareShareLink(new URL(url).search);
    expect(parsed).toEqual({
      snapshotAId: "snap_a",
      snapshotBId: "snap_b",
      mode: "report",
    });
  });

  test("drops compare state when empty", () => {
    const params = new URLSearchParams("keep=1&compareSnapshotA=old");
    applyCompareShareLinkState(params, {
      compareSnapshotAId: null,
      compareSnapshotBId: null,
      compareMode: null,
    });

    expect(params.toString()).toBe("keep=1");
  });
});
