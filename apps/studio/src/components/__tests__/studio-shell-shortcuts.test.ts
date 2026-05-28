import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const constantsPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/lib/studio-constants.ts";
const shellPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/layout/StudioShell.tsx";

describe("Studio shell shortcuts", () => {
  test("wires all visible tool keys into the global shortcut map", () => {
    const constantsSource = readFileSync(constantsPath, "utf8");
    const shellSource = readFileSync(shellPath, "utf8");

    expect(constantsSource).toContain('v: "select"');
    expect(constantsSource).toContain('c: "camera"');
    expect(constantsSource).toContain('b: "obstruction"');
    expect(constantsSource).toContain('l: "light"');
    expect(constantsSource).toContain('p: "path"');
    expect(constantsSource).toContain('z: "zone"');
    expect(constantsSource).toContain('d: "door_window"');
    expect(constantsSource).toContain('w: "wall"');
    expect(constantsSource).toContain('m: "measure"');
    expect(constantsSource).toContain('t: "comment"');

    expect(shellSource).toContain('keys: "1 – 6"');
    expect(shellSource).toContain('keys: "V"');
    expect(shellSource).toContain('keys: "P"');
    expect(shellSource).toContain('keys: "Z"');
    expect(shellSource).toContain('keys: "D"');
    expect(shellSource).toContain('keys: "W"');
    expect(shellSource).toContain('keys: "M"');
    expect(shellSource).toContain('keys: "T"');
    expect(shellSource).toContain('keys: "R"');
    expect(shellSource).toContain('keys: "N"');
    expect(shellSource).toContain('keys: "F"');
    expect(shellSource).toContain('keys: "S"');
    expect(shellSource).toContain('keys: "?"');
  });
});
