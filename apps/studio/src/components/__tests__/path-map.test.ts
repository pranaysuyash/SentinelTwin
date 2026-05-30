import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const pathMapPath = "./src/components/map/PathMap.tsx";

describe("PathMap", () => {
  test("uses scenario/path naming and replay action copy", () => {
    const source = readFileSync(pathMapPath, "utf8");

    expect(source).toContain("Path Map - Scenario / Path");
    expect(source).toContain("Route Visibility");
    expect(source).toContain("Open Path Replay");
    expect(source).toContain("Visibility State");
    expect(source).toContain("Best Camera");
    expect(source).toContain("Actor Position");
    expect(source).toContain("Upcoming Lost / Zone Event");
  });
});
