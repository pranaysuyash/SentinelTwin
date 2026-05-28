import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const commandBarPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/command-bar/CommandBar.tsx";

describe("CommandBar", () => {
  test("surfaces the offline-first residency banner and mode chip", () => {
    const source = readFileSync(commandBarPath, "utf8");

    expect(source).toContain('const { status, executeCommand, dismissError, applyCandidate, mode } = useAiCommand();');
    expect(source).toContain('{mode.label}');
    expect(source).toContain('{mode.providerLabel}');
    expect(source).toContain('{mode.cloudAvailable ? "Cloud-backed available" : "Local-only"}');
    expect(source).toContain("recognized scene edits run locally. ");
    expect(source).toContain("Offline-first: recognized scene edits run locally. Cloud-backed parsing and fix proposals use a configured API key.");
  });
});
