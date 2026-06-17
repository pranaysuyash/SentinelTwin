import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const wallViewPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../CameraWallView.tsx");

describe("CameraWall dense-mode performance guard (I8)", () => {
  test("DenseModePerfGuard component is defined", () => {
    const source = readFileSync(wallViewPath, "utf8");
    expect(source).toContain("function DenseModePerfGuard");
  });

  test("DenseModePerfGuard is rendered only when effective layout is dense", () => {
    const source = readFileSync(wallViewPath, "utf8");
    // The guard must NOT appear unconditionally — only when the user
    // is in dense mode. The narrow placement also keeps the warning
    // scoped to the exact surface that's expensive.
    expect(source).toMatch(/effectiveLayout === "dense"\s*\?\s*\(\s*<DenseModePerfGuard/);
  });

  test("DenseModePerfGuard has a dismiss control so operators can clear it", () => {
    const source = readFileSync(wallViewPath, "utf8");
    expect(source).toContain("wall-dense-perf-guard");
    // The component keeps a `dismissed` state and returns null when
    // dismissed. A clickable dismiss control must exist in the
    // rendered output.
    expect(source).toMatch(/aria-label="Dismiss dense-mode performance warning for this session"/);
  });

  test("dense layout button has a stable test id for automation", () => {
    const source = readFileSync(wallViewPath, "utf8");
    expect(source).toContain("wall-layout-dense");
  });
});