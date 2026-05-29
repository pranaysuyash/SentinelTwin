import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pagePath = join(import.meta.dir, "../page.tsx");

describe("Studio page share-link bootstrap", () => {
  test("restores timeline and compare share links into the studio shell", () => {
    const source = readFileSync(pagePath, "utf8");

    expect(source).toContain("parseCompareShareLink");
    expect(source).toContain("parseArchiveHandoffLink");
    expect(source).toContain("setArchiveHandoffRequest");
    expect(source).toContain("setCompareReportSelection");
    expect(source).toContain("compareRequest.mode === \"report\"");
    expect(source).toContain("setWorkspacePreset(\"compare\")");
    expect(source).toContain("setWorkspacePreset(\"report\")");
    expect(source).toContain("setWorkspacePreset(\"debug\")");
    expect(source).toContain("setBottomTab(\"beforeafter\")");
    expect(source).toContain("setBottomTab(\"report\")");
    expect(source).toContain("setBottomTab(\"debug\")");
    expect(source).toContain("setEnterStudio(true)");
    expect(source).toContain("setTimelineFocusRequest(focusRequest)");
    expect(source).toContain("setWorkspacePreset(\"coverage\")");
    expect(source).toContain("setBottomTab(\"timeline\")");
  });
});
