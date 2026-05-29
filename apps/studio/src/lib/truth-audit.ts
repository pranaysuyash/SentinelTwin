import { readFileSync } from "node:fs";
import { join } from "node:path";

export type TrustAuditIssueKind = "missing_file" | "missing_required_phrase" | "forbidden_phrase";

export type TrustAuditIssue = {
  surface: string;
  file: string;
  kind: TrustAuditIssueKind;
  phrase?: string;
};

export type TrustAuditSurface = {
  surface: string;
  file: string;
  requiredPhrases: string[];
  forbiddenPhrases: string[];
};

export type TrustAuditReport = {
  ok: boolean;
  rootDir: string;
  issues: TrustAuditIssue[];
  surfaces: Array<TrustAuditSurface & { status: "pass" | "fail"; missingRequiredPhrases: string[]; forbiddenMatches: string[] }>;
};

export const TRUST_AUDIT_SURFACES: TrustAuditSurface[] = [
  {
    surface: "Project launcher scan flow",
    file: "src/components/launcher/ProjectStartLauncher.tsx",
    requiredPhrases: [
      "Manual-assisted photo marking compiles into a canonical SecurityScene. Guided scan is still planned.",
    ],
    forbiddenPhrases: ["Coming Soon", "fake", "stub"],
  },
  {
    surface: "Guided scan kickoff",
    file: "src/app/page.tsx",
    requiredPhrases: [
      "This future flow will guide capture, segmentation, and multi-photo reconstruction. Today, the manual-assisted scan flow is the product entry point.",
      "Planning mode only: guided capture is not implemented yet, so the manual-assisted scan flow remains the supported entry point.",
    ],
    forbiddenPhrases: ["Coming Soon", "fake", "stub"],
  },
  {
    surface: "Feature status manifest",
    file: "src/lib/product-feature-status.ts",
    requiredPhrases: [
      'feature: "Scan Site (manual-assisted)"',
      'feature: "Guided scan reconstruction"',
      'feature: "Real footage verification"',
    ],
    forbiddenPhrases: ["Coming Soon", "fake", "stub"],
  },
  {
    surface: "Provenance and memory surface",
    file: "src/components/bottom-panel/SceneIntelligenceTab.tsx",
    requiredPhrases: [
      "Operational memory",
      "Point-in-time checkpoints",
      "Restore checkpoint",
      "Restore as draft",
      "Restore as recovered",
      "Restore as published",
      "Publish current scene",
    ],
    forbiddenPhrases: ["Coming Soon", "fake", "stub"],
  },
  {
    surface: "Bottom-panel sensor wiring",
    file: "src/components/bottom-panel/BottomPanel.tsx",
    requiredPhrases: [
      'import { SensorsTab } from "./SensorsTab";',
      'import { GovernanceTab } from "./GovernanceTab";',
      '{ id: "sensors", label: "SENSORS" }',
      '{ id: "governance", label: "GOVERNANCE" }',
      'sensors: "Sensor layer summary and live schema-backed sensor inventory."',
      'governance: "Role, approval, and publish policy controls for the scene control plane."',
      'case "sensors":',
      'case "governance":',
    ],
    forbiddenPhrases: ["stub"],
  },
  {
    surface: "Governance control plane",
    file: "src/components/bottom-panel/GovernanceTab.tsx",
    requiredPhrases: [
      "Role Selector",
      "Workspace Team",
      "Routing Matrix",
      "Action Gate",
      "Governance Trail",
      "Governance Handoff",
      "Workspace Membership Handoff",
      "Approval Routing",
      "Route posture",
      "Active route",
      "Reviewer target",
      "Scene posture",
      "Route status",
      "Route reason",
      "Resolve Approval Route",
      "Latest action",
      "Review requests",
      "Approvals",
      "Rejections",
      "Annotations",
      "Policy changes",
      "Approval routes",
      "Dispatch Governance",
      "Refresh Governance Archive",
      "Remote governance webhook",
      "Dispatch Membership",
      "Refresh Membership Archive",
      "Sync Membership Snapshot",
      "Remote membership webhook",
      "Latest membership snapshot",
      "Active member drift",
      "Team size drift",
      "Policy drift",
      "Membership reconciliation is needed",
      "Membership snapshot is aligned",
      "Single-user access",
      "Shared workspace",
      "Review required",
      "Publish or request review",
      "Add note",
      "Request review",
      "Allowed",
      "Blocked",
    ],
    forbiddenPhrases: ["stub"],
  },
  {
    surface: "Metrics truth labeling",
    file: "src/components/bottom-panel/MetricsTab.tsx",
    requiredPhrases: [
      "Truth",
      "Simulated",
      "Derived from the current scene and simulation state.",
    ],
    forbiddenPhrases: ["placeholder", "stub"],
  },
  {
    surface: "Report truth labeling",
    file: "src/components/bottom-panel/ReportLiteTab.tsx",
    requiredPhrases: [
      "Truth",
      "Computed",
      "Derived from the current scene and simulation state.",
    ],
    forbiddenPhrases: ["placeholder", "stub"],
  },
  {
    surface: "Status bar truth labeling",
    file: "src/components/layout/StatusBar.tsx",
    requiredPhrases: [
      "Truth: Live",
    ],
    forbiddenPhrases: ["placeholder", "stub"],
  },
  {
    surface: "AI command provider health",
    file: "src/components/command-bar/CommandBar.tsx",
    requiredPhrases: [
      "Provider health:",
      "Cloud-backed available",
      "Local-only",
      "Provider healthy",
      "Provider blocked",
      "Budget ready",
      "Cost / latency:",
      "Stage policy:",
      "Telemetry trend:",
    ],
    forbiddenPhrases: ["stub"],
  },
  {
    surface: "AI draft provider health",
    file: "src/app/page.tsx",
    requiredPhrases: [
      "Provider health:",
      "Draft Preview",
      "Review before apply",
      "Cloud-backed AI is disabled by policy.",
      "Model-backed if",
      "Budget ready",
      "Budget guarded",
      "Budget blocked",
      "Cost / latency:",
      "Stage policy:",
      "Telemetry trend:",
    ],
    forbiddenPhrases: ["stub"],
  },
  {
    surface: "Debug diagnostics bundle",
    file: "src/components/bottom-panel/DebugTab.tsx",
    requiredPhrases: [
      "Download Bundle",
      "Download Support Bundle",
      "Download Archive",
      "Restore Archive",
      "Apply Archive",
      "Merge Archive",
      "Restore Latest Checkpoint",
      "Archive Branch",
      "Publish Scene",
      "Run Trust Audit",
      "Trust Audit",
      "Support Bundle",
      "Incident snapshot",
      "Latest incident",
      "Latest performance trace",
      "External logs",
      "Latest external log",
      "AI telemetry trend",
      "External Log Capture",
      "Capture External Log",
      "Clear External Logs",
      "Automated Alerting",
      "Alert status",
      "High priority",
      "Latest alert",
      "attach external logs",
      "Remote Support Ingest",
      "Send to Ingest",
      "Ingest source",
      "Received at",
      "Telemetry events",
      "Support Ingest History",
      "Clear Ingest History",
      "Refresh Archive",
      "server archive",
      "local cache",
      "Remote Support Delivery",
      "Dispatch Support",
      "Refresh Delivery Archive",
      "Paste a remote webhook URL",
      "Remote webhook",
      "Delivery status",
      "Delivered",
      "Queued",
      "Failed",
      "Provider Governance",
      "Provider Health Dashboard",
      "Cost / Latency Policy",
      "Prompt Registry",
      "Model Eval Suite",
      "Run Eval Suite",
      "Clear Eval History",
      "Budget Policy",
      "Heuristic Layout Baseline",
      "Command Parse",
      "Counterfactual Candidates",
      "Report Generation",
      "Model Layout Draft",
      "Model Eval History",
      "Historical comparison",
      "Recent runs",
      "Run Delta",
      "Prompt count",
      "Latest version",
      "Canonical prompt definitions",
      "Active cost",
      "Active latency",
      "Budget status",
      "Policy note",
      "AI Action Telemetry",
      "Latest stage",
      "Trend",
      "Recent avg",
      "Active provider",
      "Cloud availability",
      "Fallback order",
      "Local-only policy",
      "Output preview",
      "buildDiagnosticBundle",
      "stringifyDiagnosticBundle",
    ],
    forbiddenPhrases: ["stub"],
  },
];

function readSurface(rootDir: string, surface: TrustAuditSurface) {
  const filePath = join(rootDir, surface.file);
  const source = readFileSync(filePath, "utf8");
  return { filePath, source };
}

export function auditTrustSurfaces(rootDir: string): TrustAuditReport {
  const issues: TrustAuditIssue[] = [];

  const surfaces = TRUST_AUDIT_SURFACES.map((surface) => {
    try {
      const { source } = readSurface(rootDir, surface);
      const missingRequiredPhrases = surface.requiredPhrases.filter((phrase) => !source.includes(phrase));
      const forbiddenMatches = surface.forbiddenPhrases.filter((phrase) => source.includes(phrase));

      for (const phrase of missingRequiredPhrases) {
        issues.push({ surface: surface.surface, file: surface.file, kind: "missing_required_phrase", phrase });
      }

      for (const phrase of forbiddenMatches) {
        issues.push({ surface: surface.surface, file: surface.file, kind: "forbidden_phrase", phrase });
      }

      return {
        ...surface,
        status: missingRequiredPhrases.length === 0 && forbiddenMatches.length === 0 ? "pass" : "fail",
        missingRequiredPhrases,
        forbiddenMatches,
      } as const;
    } catch {
      issues.push({ surface: surface.surface, file: surface.file, kind: "missing_file" });
      return {
        ...surface,
        status: "fail" as const,
        missingRequiredPhrases: [...surface.requiredPhrases],
        forbiddenMatches: [],
      };
    }
  });

  return {
    ok: issues.length === 0,
    rootDir,
    issues,
    surfaces,
  };
}

export function formatTrustAuditReport(report: TrustAuditReport) {
  const lines: string[] = [];
  lines.push(`Trust audit for ${report.rootDir}`);
  lines.push(report.ok ? "Status: PASS" : `Status: FAIL (${report.issues.length} issue${report.issues.length === 1 ? "" : "s"})`);
  lines.push("");
  for (const surface of report.surfaces) {
    lines.push(`${surface.status === "pass" ? "PASS" : "FAIL"}  ${surface.surface}`);
    lines.push(`  File: ${surface.file}`);
    if (surface.missingRequiredPhrases.length > 0) {
      lines.push("  Missing:");
      for (const phrase of surface.missingRequiredPhrases) {
        lines.push(`    - ${phrase}`);
      }
    }
    if (surface.forbiddenMatches.length > 0) {
      lines.push("  Forbidden:");
      for (const phrase of surface.forbiddenMatches) {
        lines.push(`    - ${phrase}`);
      }
    }
  }
  return lines.join("\n");
}
