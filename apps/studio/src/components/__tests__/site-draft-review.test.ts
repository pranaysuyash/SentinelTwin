import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const reviewPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../site-intake/SiteDraftReview.tsx");

describe("SiteDraftReview", () => {
  test("renders a real draft-scene preview component instead of placeholder copy", () => {
    const source = readFileSync(reviewPath, "utf8");
    expect(source).toContain("DraftSceneMiniPreview");
    expect(source).not.toContain("Scene canvas preview");
  });
});
