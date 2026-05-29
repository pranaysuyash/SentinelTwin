import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { auditTrustSurfaces, formatTrustAuditReport } from "@/lib/truth-audit";

const appRoot = join(import.meta.dir, "../../..");

describe("truth audit", () => {
  test("keeps the user-facing trust surfaces aligned with the manifest", () => {
    const report = auditTrustSurfaces(appRoot);

    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
    expect(report.surfaces.some((surface) => surface.surface === "Project launcher scan flow" && surface.status === "pass")).toBe(true);
    expect(report.surfaces.some((surface) => surface.surface === "Guided scan kickoff" && surface.status === "pass")).toBe(true);
    expect(report.surfaces.some((surface) => surface.surface === "Feature status manifest" && surface.status === "pass")).toBe(true);
    expect(report.surfaces.some((surface) => surface.surface === "Provenance and memory surface" && surface.status === "pass")).toBe(true);
    expect(report.surfaces.some((surface) => surface.surface === "Bottom-panel sensor wiring" && surface.status === "pass")).toBe(true);
    expect(report.surfaces.some((surface) => surface.surface === "Governance control plane" && surface.status === "pass")).toBe(true);
    expect(report.surfaces.some((surface) => surface.surface === "Novel algorithms tab data wiring" && surface.status === "pass")).toBe(true);
    expect(report.surfaces.some((surface) => surface.surface === "Redundancy tab data wiring" && surface.status === "pass")).toBe(true);
    expect(report.surfaces.some((surface) => surface.surface === "Threat analysis panel data wiring" && surface.status === "pass")).toBe(true);
    expect(report.surfaces.some((surface) => surface.surface === "Temporal profile data wiring" && surface.status === "pass")).toBe(true);
    expect(report.surfaces.some((surface) => surface.surface === "Before-after comparison data wiring" && surface.status === "pass")).toBe(true);
    expect(report.surfaces.some((surface) => surface.surface === "Timeline path replay data wiring" && surface.status === "pass")).toBe(true);
    expect(formatTrustAuditReport(report)).toContain("Status: PASS");
  });
});
