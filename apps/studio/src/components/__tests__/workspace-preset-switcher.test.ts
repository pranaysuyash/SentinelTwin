import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const switcherPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../dock/WorkspacePresetSwitcher.tsx");

describe("WorkspacePresetSwitcher", () => {
  test("uses stable selectors instead of an object-literal snapshot", () => {
    const source = readFileSync(switcherPath, "utf8");

    expect(source).toContain('const workspacePreset = useStudioStore((s) => s.workspacePreset);');
    expect(source).toContain('const rightPanelMode = useStudioStore((s) => s.rightPanelMode);');
    expect(source).toContain('const current = useMemo(() => ({');
    expect(source).toContain('const active = PRESETS.find((entry) => entry.id === workspacePreset) ?? PRESETS[0]!');
    expect(source).toContain("Hide panels for uninterrupted site review.");
    expect(source).not.toContain('const current = useStudioStore((s) => ({');
  });
});
