import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

const dockPanelPath = join(import.meta.dir, "../..", "components/dock/DockPanel.tsx");
const dockRailPath = join(import.meta.dir, "../..", "components/dock/DockRail.tsx");

describe("Dock panels", () => {
  test("keep the collapsed rails compact so the canvas gets more room", () => {
    const panelSource = readFileSync(dockPanelPath, "utf8");
    const railSource = readFileSync(dockRailPath, "utf8");

    expect(panelSource).toContain('height: "28px"');
    expect(panelSource).toContain('width: "28px"');
    expect(railSource).toContain('isBottom ? "flex-row border-t px-1.5 py-1" : "flex-col border-r px-1 py-1"');
    expect(railSource).toContain('isBottom ? "h-6 w-6 flex-shrink-0" : "h-7 w-7 flex-shrink-0"');
    expect(railSource).toContain('className={`inline-flex h-5 w-5 items-center justify-center rounded-md border UI_SURFACES.borderThin UI_SURFACES.card UI_SURFACES.textMuted3 transition-colors UI_SURFACES.hoverBorderSubtle UI_SURFACES.hoverText`}');
  });
});
