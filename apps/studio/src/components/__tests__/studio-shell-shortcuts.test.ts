import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const constantsPath = new URL("../../lib/studio-constants.ts", import.meta.url);
const shortcutsModalPath = new URL("../layout/ShortcutsModal.tsx", import.meta.url);
const pathReplayClockPath = new URL("../layout/PathReplayClock.tsx", import.meta.url);
const shellPath = new URL("../layout/StudioShell.tsx", import.meta.url);

describe("Studio shell shortcuts", () => {
  test("wires all visible tool keys into the global shortcut map", () => {
    const constantsSource = readFileSync(constantsPath, "utf8");
    const shortcutsSource = readFileSync(shortcutsModalPath, "utf8");

    expect(constantsSource).toContain('v: "select"');
    expect(constantsSource).toContain('c: "camera"');
    expect(constantsSource).toContain('b: "obstruction"');
    expect(constantsSource).toContain('l: "light"');
    expect(constantsSource).toContain('y: "sensor"');
    expect(constantsSource).toContain('p: "path"');
    expect(constantsSource).toContain('z: "zone"');
    expect(constantsSource).toContain('d: "door_window"');
    expect(constantsSource).toContain('w: "wall"');
    expect(constantsSource).toContain('m: "measure"');
    expect(constantsSource).toContain('t: "comment"');

    expect(shortcutsSource).toContain('keys: "1 – 6"');
    expect(shortcutsSource).toContain('keys: "Enter"');
    expect(shortcutsSource).toContain('keys: "Delete"');
    expect(shortcutsSource).toContain('keys: "← → ↑ ↓"');
    expect(shortcutsSource).toContain('keys: "V"');
    expect(shortcutsSource).toContain('keys: "P"');
    expect(shortcutsSource).toContain('keys: "Y"');
    expect(shortcutsSource).toContain('keys: "Z"');
    expect(shortcutsSource).toContain('keys: "D"');
    expect(shortcutsSource).toContain('keys: "W"');
    expect(shortcutsSource).toContain('keys: "M"');
    expect(shortcutsSource).toContain('keys: "T"');
    expect(shortcutsSource).toContain('keys: "R"');
    expect(shortcutsSource).toContain('keys: "N"');
    expect(shortcutsSource).toContain('keys: "F"');
    expect(shortcutsSource).toContain('keys: "S"');
    expect(shortcutsSource).toContain('keys: "?"');
  });

  test("owns the shared path replay clock so dock panels do not start competing RAF loops", () => {
    const clockSource = readFileSync(pathReplayClockPath, "utf8");
    const shellSource = readFileSync(shellPath, "utf8");

    expect(clockSource).toContain("PATH_REPLAY_PROGRESS_PUBLISH_INTERVAL_MS = 1000 / 24");
    expect(clockSource).toContain("export default function PathReplayClock()");
    expect(clockSource).toContain('if (viewMode === "replay" || !playing || totalDurationS <= 0) return;');
    expect(shellSource).toContain("<PathReplayClock />");
  });
});
