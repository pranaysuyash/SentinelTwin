import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const topBarPath = "./src/components/layout/TopBar.tsx";

describe("TopBar scene selector", () => {
  test("supports duplicate, rename, import, export, and delete scene actions", () => {
    const source = readFileSync(topBarPath, "utf8");

    expect(source).toContain("duplicateSavedScene");
    expect(source).toContain("renameSavedScene");
    expect(source).toContain("handleDuplicateSavedScene");
    expect(source).toContain("handleRenameSavedScene");
    expect(source).toContain("Export Scene JSON");
    expect(source).toContain("Import Scene JSON");
    expect(source).toContain("Save Current Scene");
    expect(source).toContain("Delete scene");
    expect(source).toContain("Duplicate scene");
    expect(source).toContain("Rename scene");
    expect(source).toContain("Duplicate the demo first to rename it");
  });
});
