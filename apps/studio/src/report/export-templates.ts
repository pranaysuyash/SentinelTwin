import { type ReportData } from "./index";

function formatHour(hour: number): string {
  if (hour >= 24) return "Midnight";
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:00 ${period}`;
}

function formatSignedDelta(delta: number | null | undefined) {
  if (delta == null || Number.isNaN(delta)) return "—";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

function formatCheckpointProvenance(provenance: any): string {
  if (!provenance) return "Unavailable.";
  return `${provenance.sceneSourceLabel} · ${provenance.nodeCount} nodes · ${provenance.edgeCount} edges`;
}

function buildBaseHeader(report: ReportData): string[] {
  return [
    `# ${report.title}`,
    "",
    `**Site:** ${report.siteName}`,
    `**Audience:** ${report.audienceLabel}`,
    `**Framing:** ${report.audienceFraming}`,
    `**Visibility:** ${report.visibilityLabel}`,
    `**Visibility Framing:** ${report.visibilityFraming}`,
    `**Date:** ${new Date(report.generatedAt).toLocaleDateString()}`,
    `**Dimensions:** ${report.dimensions.width}m × ${report.dimensions.depth}m × ${report.dimensions.height}m`,
    `**Standard:** ${report.standardsRef}`,
    "",
  ];
}

function buildExecutiveSummary(report: ReportData): string[] {
  return [
    "## Executive Summary",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Coverage | ${report.summary.totalCoveragePct.toFixed(1)}% |`,
    `| Recognition Area | ${report.summary.recognitionAreaPct.toFixed(1)}% |`,
    `| Identification Area | ${report.summary.identificationAreaPct.toFixed(1)}% |`,
    `| Zones Passing | ${report.summary.zonesPassing}/${report.summary.zonesTotal} |`,
    `| Sensors | ${report.summary.sensorCount} |`,
    `| Issues Found | ${report.summary.issuesCount} |`,
    `| Verified Recommendations | ${report.summary.verifiedRecommendationsCount}/${report.summary.recommendationsCount} |`,
    "",
  ];
}

function buildAssumptions(report: ReportData): string[] {
  return [
    "## Assumptions",
    `- DORI Standard: ${report.assumptions.doriStandard}`,
    `- Person Height: ${report.assumptions.personHeightM}m`,
    `- Vehicle Height: ${report.assumptions.vehicleHeightM}m`,
    `- Time of Day: ${report.assumptions.timeOfDay}`,
    `- PPM Thresholds: ${report.assumptions.ppm.detection} / ${report.assumptions.ppm.observation} / ${report.assumptions.ppm.recognition} / ${report.assumptions.ppm.identification}`,
    "",
    `_${report.audienceFraming} These outputs are estimated planning indicators under current assumptions, not legal or forensic guarantees._`,
    "",
  ];
}

function buildProvenanceAndTruth(report: ReportData): string[] {
  return [
    "## Provenance",
    `- Scene Source: ${report.provenance.sceneSourceLabel} (${report.provenance.sceneSource})`,
    `- Graph Nodes: ${report.provenance.nodeCount}`,
    `- Graph Edges: ${report.provenance.edgeCount}`,
    `- Revision Depth: ${report.provenance.revisionDepth}`,
    `- Snapshots Tracked: ${report.provenance.snapshotCount}`,
    `- Source Counts: ${Object.entries(report.provenance.sourceCounts).map(([source, count]) => `${source}:${count}`).join(" · ")}`,
    ...(report.provenance.sourceNotes.length > 0 ? [
      "- Source History:",
      ...report.provenance.sourceNotes.map((note) => `  - ${note}`),
    ] : []),
    ...(report.provenance.confidenceNotes.length > 0 ? [
      "- Confidence History:",
      ...report.provenance.confidenceNotes.map((note) => `  - ${note}`),
    ] : []),
    "",
    "## Truth Ladder",
    `- Nodes: ${report.truthLadder.nodeCount}`,
    `- Reviewed Nodes: ${report.truthLadder.reviewedNodeCount} (${report.truthLadder.reviewedCoveragePct.toFixed(1)}%)`,
    `- Verified Nodes: ${report.truthLadder.verifiedNodeCount}`,
    `- Source Traces: ${report.truthLadder.sourceTraceCount} (${report.truthLadder.sourceTraceCoveragePct.toFixed(1)}%)`,
    `- Suspect Geometry: ${report.truthLadder.suspectGeometryCount}`,
    `- Invalid Geometry: ${report.truthLadder.invalidGeometryCount}`,
    `- Summary: ${report.truthLadder.summary}`,
    "",
  ];
}

function buildOperationalEvidence(report: ReportData): string[] {
  return [
    "## Operational Evidence",
    `- Change Log Entries: ${report.evidenceTrail.changeLogEntryCount}`,
    `- Evidence Entries: ${report.evidenceTrail.evidenceEntryCount}`,
    `- Sensor-related Evidence: ${report.evidenceTrail.sensorEvidenceCount}`,
    ...(report.evidenceTrail.recentEntries.length > 0
      ? [
          "- Recent Evidence Entries:",
          ...report.evidenceTrail.recentEntries.map((entry) => `  - ${entry.when} · ${entry.title} · ${entry.details} · ${entry.confidence}`),
        ]
      : ["- Recent Evidence Entries: none"]),
    "",
  ];
}

function buildCausalTrace(report: ReportData): string[] {
  if (!report.evidenceLedger || report.evidenceLedger.length === 0) return [];
  
  return [
    "## Site History / Causal Trace",
    "- A chronological ledger of changes that led to the current scene state.",
    "",
    ...report.evidenceLedger.map((event) => 
      `- **${new Date(event.timestamp).toLocaleString()}** · ${event.title} · ${event.actor === "system" ? "System" : "User"}${event.confidence !== undefined && event.confidence !== 0 && event.confidence !== "withheld" as any ? ` (Confidence: ${event.confidence})` : ""}\n  - ${event.details}`
    ),
    "",
  ];
}

function buildZoneAnalysis(report: ReportData): string[] {
  return [
    "## Zone Analysis",
    "",
    ...(report.zones.length > 0
      ? ["| Zone | Required | Actual | Status | Cameras |",
         "|------|----------|--------|--------|---------|",
         ...report.zones.map((z) =>
           `| ${z.label} | ${z.requiredQuality} | ${z.actualQuality} | ${z.status} | ${z.coveringCameras.join(", ") || "none"} |`,
         )]
      : ["No critical zones defined."]),
    "",
  ];
}

function buildCameraAnalysis(report: ReportData): string[] {
  return [
    "## Camera Analysis",
    "",
    ...(report.cameras.length > 0
      ? ["| Camera | Status | Coverage | Best Zone Q | Failed Zones | Covered Zones | Issues |",
         "|--------|--------|----------|-------------|--------------|---------------|--------|",
         ...report.cameras.map((c) =>
           `| ${c.name} | ${c.status} | ${c.coveragePct.toFixed(1)}% | ${c.bestZoneQuality} | ${c.zonesFailed} | ${c.zonesCovered.length} | ${c.issues.length} |`,
         )]
      : ["No cameras deployed."]),
    "",
  ];
}

function buildFooter(report: ReportData): string[] {
  return [
    "## Modeling scope and requirement checks",
    `**${report.meetsModeledZoneRequirements ? "Meets modeled zone requirements" : "Does not fully meet modeled zone requirements"}** — ${report.summary.zonesPassing}/${report.summary.zonesTotal} zones meet requirements under current assumptions.`,
    "This report is planning-grade and does not confer legal, forensic, or compliance certification.",
    "",
    `---`,
    `*Generated by SentinelTwin Studio. Standards: ${report.standardsRef}*`,
  ];
}

export function exportOperatorMarkdown(report: ReportData): string {
  // Operator needs everything
  return [
    ...buildBaseHeader(report),
    ...buildExecutiveSummary(report),
    ...buildAssumptions(report),
    ...buildProvenanceAndTruth(report),
    ...buildOperationalEvidence(report),
    ...buildCausalTrace(report),
    ...buildZoneAnalysis(report),
    ...buildCameraAnalysis(report),
    ...buildFooter(report),
  ].join("\n");
}

export function exportAuditorMarkdown(report: ReportData): string {
  // Auditor focuses on truth ladder and evidence, less on hardware details
  return [
    ...buildBaseHeader(report),
    ...buildExecutiveSummary(report),
    ...buildAssumptions(report),
    ...buildProvenanceAndTruth(report),
    ...buildOperationalEvidence(report),
    ...buildCausalTrace(report),
    ...buildZoneAnalysis(report),
    ...buildFooter(report),
  ].join("\n");
}

export function exportInsurerMarkdown(report: ReportData): string {
  // Insurer focuses on high-level risk and coverage, not provenance
  return [
    ...buildBaseHeader(report),
    ...buildExecutiveSummary(report),
    ...buildAssumptions(report),
    ...buildZoneAnalysis(report),
    ...buildFooter(report),
  ].join("\n");
}

export function exportInstallerMarkdown(report: ReportData): string {
  // Installer focuses on camera list and locations
  return [
    ...buildBaseHeader(report),
    ...buildExecutiveSummary(report),
    ...buildCameraAnalysis(report),
    ...buildZoneAnalysis(report),
    ...buildFooter(report),
  ].join("\n");
}

export function exportPrivacyReviewerMarkdown(report: ReportData): string {
  // Privacy reviewer focuses on cameras and privacy masks
  return [
    ...buildBaseHeader(report),
    ...buildExecutiveSummary(report),
    "## Privacy Masking Summary",
    ...(report.cameras.length > 0
      ? ["| Camera | Status | Privacy Masking |",
         "|--------|--------|-----------------|",
         ...report.cameras.map((c) =>
           `| ${c.name} | ${c.status} | ${c.privacyMaskingEnabled ? "Enabled" : "Disabled"} |`,
         )]
      : ["No cameras deployed."]),
    "",
    ...buildFooter(report),
  ].join("\n");
}
