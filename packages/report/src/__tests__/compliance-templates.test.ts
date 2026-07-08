import { describe, expect, test } from "bun:test";
import {
  getAllStandardTemplates,
  applyPolicyRedaction,
  type ReportRedactionPolicy,
} from "../compliance-templates";
import {
  getReportStandardTemplates,
  getReportStandardTemplateProfile,
  buildReportData,
} from "../index";

describe("Compliance Reporting Suite (D-330)", () => {
  test("getAllStandardTemplates returns all 11 standard and regulatory templates", () => {
    const templates = getAllStandardTemplates();
    expect(templates).toHaveLength(11);
    const ids = templates.map((t) => t.id);
    expect(ids).toContain("gdpr-uk-ico");
    expect(ids).toContain("gdpr-cnil");
    expect(ids).toContain("gdpr-bdsg");
    expect(ids).toContain("pci-dss-sec9");
    expect(ids).toContain("bipa-hipaa");
    expect(ids).toContain("general-audit");
    expect(ids).toContain("installer-proposal");
    expect(ids).toContain("insurer-brief");
    expect(ids).toContain("privacy-review");
    expect(ids).toContain("dori-audit");
    expect(ids).toContain("oodpcvs-audit");
  });

  test("getReportStandardTemplates exposes compliance templates with proper ids", () => {
    const templates = getReportStandardTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(11);
    const gdpr = templates.find((t) => t.id === "gdpr-uk-ico");
    expect(gdpr).toBeDefined();
    expect(gdpr?.standardLabel).toContain("UK Data Protection Act");
    expect(gdpr?.regulatoryMandates?.length).toBeGreaterThan(0);
  });

  test("getReportStandardTemplateProfile retrieves regulatory mandates", () => {
    const profile = getReportStandardTemplateProfile("pci-dss-sec9");
    expect(profile.title).toContain("PCI DSS");
    expect(profile.regulatoryMandates).toBeDefined();
    const mandate = profile.regulatoryMandates?.find((m) => m.authority === "PCI Security Standards Council (PCI SSC)");
    expect(mandate).toBeDefined();
    expect(mandate?.mandatoryRedactions).toContain("maskVulnerabilities");
  });

  test("applyPolicyRedaction masks camera IPs, GPS coordinates, patrol routes, and vulnerabilities", () => {
    const sampleData = {
      cameras: [
        { id: "cam_1", name: "Lobby Cam", ipAddress: "192.168.1.100", label: "Camera at 192.168.1.100" },
      ],
      zones: [
        { id: "z1", name: "Vault", coordinates: "37.7749,-122.4194" },
      ],
      evidenceLedger: [
        { title: "Patrol Log", description: "Route A: Lobby -> Server Room -> Exit", details: "" },
      ],
      redundancyMatrix: {
        vulnerableZones: [
          { zoneId: "z1", label: "Vault", reason: "Single point of failure" },
        ],
      },
    };

    const policy: ReportRedactionPolicy = {
      redactCameraIps: true,
      redactGpsCoordinates: true,
      redactPatrolRoutes: true,
      maskVulnerabilities: true,
    };

    const redacted = applyPolicyRedaction(sampleData, policy);
    expect(redacted.cameras[0].ipAddress).toBe("[REDACTED]");
    expect(redacted.cameras[0].label).toContain("[IP REDACTED]");
    expect(redacted.zones[0].coordinates).toBe("[GPS REDACTED]");
    expect(redacted.evidenceLedger[0].description).toBe("[PATROL ROUTE REDACTED FOR SECURITY]");
    expect(redacted.redundancyMatrix.vulnerableZones[0].label).toBe("[MASKED FOR EXTERNAL DISTRIBUTION]");
    expect(redacted.redundancyMatrix.vulnerableZones[0].reason).toBe("[MASKED]");
  });

  test("buildReportData enforces mandatory regulatory redactions for non-internal visibility", () => {
    const dummyScene: any = {
      id: "scene_test",
      name: "Test Facility",
      cameras: [{ id: "c1", name: "Cam 1" }],
      criticalZones: [{ id: "z1", name: "Secure Zone" }],
      source: "manual",
      assumptions: {},
    };
    const dummySim: any = {
      cameraResults: [{ cameraId: "c1", coveragePct: 80, qualityByZone: { z1: "recognition" } }],
      issues: [{ description: "Uncovered area", severity: "high", affectedZones: ["z1"], category: "blindspot" }],
    };

    const reportData = buildReportData(dummyScene, dummySim, {
      templateId: "gdpr-uk-ico",
      visibility: "shared",
    });

    expect(reportData.template.id).toBe("gdpr-uk-ico");
    expect(reportData.template.regulatoryMandates?.length).toBeGreaterThan(0);
    expect(reportData.redactionsApplied).toContain("Camera IPs Redacted");
    expect(reportData.redactionsApplied).toContain("Patrol Routes Redacted");
    expect(reportData.options?.redactionPolicy?.redactCameraIps).toBe(true);
    expect(reportData.options?.redactionPolicy?.redactPatrolRoutes).toBe(true);
  });
});
