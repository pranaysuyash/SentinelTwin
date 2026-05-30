import { describe, expect, test } from "bun:test";

import { shareLinkOrCopy, type ShareNavigator } from "@/lib/share-link";

describe("shareLinkOrCopy", () => {
  test("uses native share when available", async () => {
    const shared: Array<{ title: string; text: string; url: string }> = [];
    const copied: string[] = [];
    const navigatorLike: ShareNavigator = {
      canShare: () => true,
      share: async (payload) => {
        shared.push(payload);
      },
      clipboard: {
        writeText: async (text) => {
          copied.push(text);
        },
      },
    };

    const status = await shareLinkOrCopy({
      title: "SentinelTwin compare handoff",
      text: "Open the compare view.",
      url: "https://example.com/compare",
    }, navigatorLike);

    expect(status).toBe("shared");
    expect(shared).toHaveLength(1);
    expect(copied).toHaveLength(0);
  });

  test("falls back to clipboard copy when share is unavailable", async () => {
    const copied: string[] = [];
    const navigatorLike: ShareNavigator = {
      clipboard: {
        writeText: async (text) => {
          copied.push(text);
        },
      },
    };

    const status = await shareLinkOrCopy({
      title: "SentinelTwin archive handoff",
      text: "Open the archive link.",
      url: "https://example.com/archive",
    }, navigatorLike);

    expect(status).toBe("copied");
    expect(copied).toEqual(["https://example.com/archive"]);
  });
});
