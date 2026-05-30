import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const miniMapPath = "./src/components/map/MiniMap.tsx";

describe("MiniMap dock state behavior", () => {
  test("syncs collapsed/compact modes with left dock state", () => {
    const source = readFileSync(miniMapPath, "utf8");

    expect(source).toContain("const leftDockCollapsed = useStudioStore((s) => s.leftDockCollapsed);");
    expect(source).toContain("setMode(\"collapsed\")");
    expect(source).toContain("current === \"collapsed\" ? \"compact\" : current");
  });

  test("collapses the left dock when using collapse-to-icon control", () => {
    const source = readFileSync(miniMapPath, "utf8");

    expect(source).toContain("setDockCollapsed(\"left\", true);");
    expect(source).toContain("Collapse to Icon");
  });
});
