import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const pathMapPath = "./src/components/map/PathMap.tsx";

describe("PathMap", () => {
  test("uses scenario/path naming and replay action copy", () => {
    const source = readFileSync(pathMapPath, "utf8");

    expect(source).toContain("Path Map - Scenario / Path");
    expect(source).toContain("Route Visibility");
    expect(source).toContain("Open Path Replay");
  });
});
