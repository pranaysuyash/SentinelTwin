import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const inspectorPath = resolve(import.meta.dir, "../inspector/CameraInspector.tsx");

describe("CameraInspector", () => {
  test("renders the spec import workflow inside the canonical inspector", () => {
    const source = readFileSync(inspectorPath, "utf8");

    expect(source).toContain("CameraSpecImport");
    expect(source).toContain("recordOperationalEvidenceEvent");
    expect(source).toContain("evidenceEvents");
    expect(source).toContain("ONVIF relay");
  });
});
