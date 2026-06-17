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
      "Scan site with phone photos",
      "Open seeded retail baseline",
      "The seeded baseline is the reference baseline.",
    ],
    forbiddenPhrases: ["Coming Soon", "fake", "stub"],
  },
  {
    surface: "Guided scan kickoff",
    file: "src/hooks/use-studio-navigation.ts",
    requiredPhrases: [
      "const openGuidedScanAssistant = useCallback(() => {",
      "Guided scan assistant started",
      "Opened guided scan assistant from the launcher.",
    ],
    forbiddenPhrases: ["Coming Soon", "fake", "stub"],
  },
  {
    surface: "Feature status manifest",
    file: "src/lib/product-feature-status.ts",
    requiredPhrases: [
      'feature: "Scan Site (manual-assisted)"',
      'feature: "Guided scan reconstruction (legacy)"',
      'feature: "Real footage verification"',
    ],
    forbiddenPhrases: ["Coming Soon", "fake"],
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
      'sensors: "Use this to review non-camera sensor inventory and live evidence that may confirm or challenge camera coverage."',
      'governance: "Use this to review role, approval, and publishing controls before sharing audit evidence."',
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
      "Identity Conflict Resolution",
      "Route posture",
      "Active route",
      "Reviewer target",
      "Scene posture",
      "Route status",
      "Route reason",
      "Resolve Approval Route",
      "Resolve Identity Conflict",
      "Latest route",
      "Latest conflict",
      "Conflict Diff",
      "View diff",
      "Replay selected conflict",
      "Replay result",
      "Current member",
      "Archived member",
      "Conflict status",
      "Latest action",
      "Review requests",
      "Approvals",
      "Rejections",
      "Annotations",
      "Policy changes",
      "Approval routes",
      "Identity conflict resolutions",
      "Dispatch Governance",
      "Refresh Governance Archive",
      "Remote governance webhook",
      "Dispatch Membership",
      "Refresh Membership Archive",
      "Sync Membership Snapshot",
      "Remote membership webhook",
      "Remote identity webhook",
      "Latest membership snapshot",
      "Active member drift",
      "Team size drift",
      "Policy drift",
      "No identity conflict resolution yet",
      "identity-conflict fan-out",
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
    surface: "Workspace library launcher surface",
    file: "src/components/launcher/StudioDashboardHome.tsx",
    requiredPhrases: [
      "SentinelTwin",
      "Home",
      "Create Site Twin",
      "Security Twin Studio",
      "Audit Report",
      "Reference Sites",
      "Settings",
      "Run Simulation",
    ],
    forbiddenPhrases: ["stub"],
  },
  {
    surface: "Metrics truth labeling",
    file: "src/components/bottom-panel/MetricsTab.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: ["placeholder", "stub"],
  },
  {
    surface: "Report truth labeling",
    file: "src/components/bottom-panel/ReportLiteTab.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="computed"',
      'label="inferred"',
    ],
    forbiddenPhrases: ["placeholder", "stub"],
  },
  {
    surface: "Report visibility policy",
    file: "../../packages/report/src/index.ts",
    requiredPhrases: [
      "applyReportVisibility",
      "visibility === \"shared\"",
      "temporalTwin",
    ],
    forbiddenPhrases: ["TODO redaction", "stub redaction"],
  },
  {
    surface: "Workspace control-plane persistence route",
    file: "src/app/api/workspace-control-plane/route.ts",
    requiredPhrases: [
      "normalizeWorkspaceAccessState",
      "normalizeWorkspaceGovernance",
      "normalizeWorkspaceAccountProfile",
      "mapLocalGovernanceToSceneRecord",
      "generateAuditLogForGovernanceTransition",
    ],
    forbiddenPhrases: ["stub", "Coming Soon"],
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
      "Cloud review available",
      "Local-only",
      "Budget ready",
      "Budget guarded",
      "Budget blocked",
    ],
    forbiddenPhrases: ["stub"],
  },
  {
    surface: "AI draft provider health",
    file: "src/components/product/AiLayoutDraftView.tsx",
    requiredPhrases: [
      "Draft Preview",
      "Review before apply",
      "Local-only mode is on. Drafts stay on this device and cloud-assisted layout generation is disabled.",
      "local-only policy",
    ],
    forbiddenPhrases: ["stub"],
  },
  {
    surface: "Novel algorithms tab data wiring",
    file: "src/components/bottom-panel/NovelAlgorithmsTab.tsx",
    requiredPhrases: [
      "useStudioStore",
      "computeCoverageEntropy",
      "computeCoverageTimeBudget",
      "computeCoveragePostureVariation",
      "computeCoverageUncertainty",
      "simulationResult",
      "kRobustness",
      "placementOracle",
      "occlusionBlame",
      "blindRegions",
      "blindSpotFingerprint",
      "reflectiveBounce",
      "temporalProfile",
      "coverageCells",
      "fragilitySummary",
    ],
    forbiddenPhrases: ["stub", "hardcoded", "placeholder", "FAKE_DATA"],
  },
  {
    surface: "Redundancy tab data wiring",
    file: "src/components/bottom-panel/RedundancyTab.tsx",
    requiredPhrases: [
      "useStudioStore",
      "simulationResult",
      "criticalZoneResults",
      "cameraResults",
      "redundancyCameraCount",
      "coveringCameras",
    ],
    forbiddenPhrases: ["stub", "hardcoded", "placeholder", "FAKE_DATA"],
  },
  {
    surface: "Threat analysis panel data wiring",
    file: "src/components/bottom-panel/ThreatAnalysisPanel.tsx",
    requiredPhrases: [
      "useStudioStore",
      "QUALITY_ABBR",
      "QUALITY_COLOR",
      "ExposureBar",
      "StatCard",
    ],
    forbiddenPhrases: ["stub", "hardcoded", "placeholder", "FAKE_DATA"],
  },
  {
    surface: "Temporal profile data wiring",
    file: "src/components/bottom-panel/TemporalProfileView.tsx",
    requiredPhrases: [
      "useStudioStore",
      "computeTemporalProfile",
      "HourlySecuritySnapshot",
      "TemporalAnomalyWindow",
      "VulnerabilityWindow",
      "temporalScrubHour",
      "temporalScrubMinute",
    ],
    forbiddenPhrases: ["stub", "hardcoded", "placeholder", "FAKE_DATA"],
  },
  {
    surface: "Before-after comparison data wiring",
    file: "src/components/bottom-panel/BeforeAfterTab.tsx",
    requiredPhrases: [
      "useStudioStore",
      "buildSecurityOutcomeDelta",
      "qualityToScore",
      "SimulationResult",
    ],
    forbiddenPhrases: ["stub", "hardcoded", "placeholder", "FAKE_DATA"],
  },
  {
    surface: "Timeline path replay data wiring",
    file: "src/components/bottom-panel/TimelineTab.tsx",
    requiredPhrases: [
      "useStudioStore",
      "distance2D",
      "lerp2D",
      "QUALITY_ORDER",
      "ScenarioPath",
      "SimulationResult",
      "pathResults",
      "VisibilityTimeline",
    ],
    forbiddenPhrases: ["stub", "hardcoded", "placeholder", "FAKE_DATA"],
  },
  {
    surface: "Debug diagnostics bundle",
    file: "src/components/bottom-panel/DebugTab.tsx",
    requiredPhrases: [
      "Download Bundle",
      "Download Runtime Truth",
      "Download Support Bundle",
      "Download Archive",
      "Share Archive",
      "Copy Archive Link",
      "Open Archive Link",
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
  {
    surface: "Node history tab data wiring",
    file: "src/components/inspector/NodeHistoryTab.tsx",
    requiredPhrases: [
      "operationalEvidenceEvents",
      "affectedNodeIds",
      "reconstructSceneFromEvidence",
      "Restore Scene to This Point",
    ],
    forbiddenPhrases: ["stub", "placeholder", "FAKE_DATA"],
  },
  {
    surface: "TruthBadge component",
    file: "src/components/shared/TruthBadge.tsx",
    requiredPhrases: [
      "simulated",
      "inferred",
      "real",
      "placeholder",
      "TruthLabel",
      "TruthBadge",
    ],
    forbiddenPhrases: ["stub"],
  },
  {
    surface: "Inspector analytics truth labels",
    file: "src/components/inspector/CameraInspector.tsx",
    requiredPhrases: [
      'truthLabel={camResult ? "simulated" : "placeholder"}',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Site intake hub truthful maturity",
    file: "src/components/site-intake/SiteIntakeHub.tsx",
    requiredPhrases: [
      "Guided capture + manual review from phone photos",
      "Automatic segmentation/depth reconstruction is still rolling out; candidate confirmation is required.",
      "Draft-gated",
      "Best-effort wall/opening extraction",
      "No product-grade video/stream verification yet",
      "Local-only mode is available",
    ],
    forbiddenPhrases: [
      "Your data is secure and never shared",
      "automatic reconstruction",
      "automatic depth estimation",
    ],
  },
  {
    surface: "Site draft review unified pipeline",
    file: "src/components/site-intake/SiteDraftReview.tsx",
    requiredPhrases: [
      "compileToSiteTwinDraft",
      "canRunBaselineSimulation",
      "Missing Prerequisites",
      "Assumptions",
      "Next Actions",
      "suggestedAction",
      "Approve as Canonical Twin",
    ],
    forbiddenPhrases: ["stub", "placeholder"],
  },
  {
    surface: "Site twin draft compiler maturity",
    file: "src/lib/site-compiler.ts",
    requiredPhrases: [
      "SITE_SOURCE_MATURITY",
      "No automatic segmentation",
      "No product-grade video",
      "Review required before trust",
      "Manual correction required",
      "canRunBaselineSimulation",
      "compileToSiteTwinDraft",
      "MissingPrerequisite",
      "SuggestedNextAction",
      "DraftAssumption",
    ],
    forbiddenPhrases: ["stub", "placeholder"],
  },
  {
    surface: "Timeline tab truth badge",
    file: "src/components/bottom-panel/TimelineTab.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Issues tab truth badge",
    file: "src/components/bottom-panel/IssuesTab.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Before-after tab truth badge",
    file: "src/components/bottom-panel/BeforeAfterTab.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Scenario path panel truth badge",
    file: "src/components/bottom-panel/ScenarioPathPanel.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Novel algorithms tab truth badge",
    file: "src/components/bottom-panel/NovelAlgorithmsTab.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Redundancy tab truth badge",
    file: "src/components/bottom-panel/RedundancyTab.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Temporal profile view truth badge",
    file: "src/components/bottom-panel/TemporalProfileView.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Threat analysis panel truth badge",
    file: "src/components/bottom-panel/ThreatAnalysisPanel.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Scene intelligence tab truth badge",
    file: "src/components/bottom-panel/SceneIntelligenceTab.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Assumptions tab truth badge",
    file: "src/components/bottom-panel/AssumptionsTab.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Camera status summary panel truth badge",
    file: "src/components/bottom-panel/CameraStatusSummaryPanel.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Counterfactual panel truth badge",
    file: "src/components/bottom-panel/CounterfactualPanel.tsx",
    requiredPhrases: [
      "TruthBadge",
      'label="simulated"',
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Coverage budget tab truth badge",
    file: "src/components/bottom-panel/CoverageBudgetTab.tsx",
    requiredPhrases: [
      "TruthBadge",
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Redundancy matrix panel truth badge",
    file: "src/components/bottom-panel/RedundancyMatrixPanel.tsx",
    requiredPhrases: [
      "TruthBadge",
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Timeline scrubber tab truth badge",
    file: "src/components/bottom-panel/TimelineScrubberTab.tsx",
    requiredPhrases: [
      "TruthBadge",
    ],
    forbiddenPhrases: [],
  },
  {
    surface: "Sensors tab truth labels",
    file: "src/components/bottom-panel/SensorsTab.tsx",
    requiredPhrases: [
      'truthLabel="simulated"',
      'truthLabel="imported"',
      'truthLabel="inferred"',
    ],
    forbiddenPhrases: [],
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
