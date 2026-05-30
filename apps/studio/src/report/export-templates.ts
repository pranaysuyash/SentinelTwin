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

function formatZoneTarget(zone: ReportData["zones"][number]): string {
  return `${zone.targetType.replace(/_/g, " ")} · default ${zone.targetRequirementQuality} (${zone.targetRequirementPpmThreshold})`;
}

function buildBaseHeader(report: ReportData): string[] {
  return [
    `# ${report.title}`,
    "",
    `**Site:** ${report.siteName}`,
    `**Scene ID:** ${report.sceneId}`,
    `**Audience:** ${report.audienceLabel}`,
    `**Framing:** ${report.audienceFraming}`,
    `**Audience Policy:** ${report.audiencePolicy.disclosureSummary}`,
    `**Disclosure Policy:** ${report.audiencePolicy.disclosureSummary}`,
    `**Visible Sections:** ${report.audiencePolicy.visibleSections.join(", ")}`,
    `**Withheld Sections:** ${report.audiencePolicy.withheldSections.length > 0 ? report.audiencePolicy.withheldSections.join(", ") : "none"}`,
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
    `_${report.audiencePolicy.disclosureSummary}_`,
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
    `- Scene ID: ${report.sceneId}`,
    `- Change Log Entries: ${report.evidenceTrail.changeLogEntryCount}`,
    `- Evidence Entries: ${report.evidenceTrail.evidenceEntryCount}`,
    `- Sensor-related Evidence: ${report.evidenceTrail.sensorEvidenceCount}`,
    ...(report.evidenceTrail.recentEntries.length > 0
      ? [
          "- Evidence Links:",
          ...report.evidenceTrail.recentEntries.map((entry) => `  - [${entry.when} · ${entry.title}](#${entry.anchorId}) :: ${entry.evidenceUri}`),
          "- Recent Evidence Details:",
          ...report.evidenceTrail.recentEntries.map((entry) => `  - <a id="${entry.anchorId}"></a><strong>${entry.when}</strong> · ${entry.title} · ${entry.details} · ${entry.confidence} · ${entry.evidenceUri}`),
        ]
      : ["- Evidence Links: none", "- Recent Evidence Entries: none"]),
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
      ? ["| Zone | Target | Required | Actual | Status | Cameras |",
         "|------|--------|----------|--------|--------|---------|",
         ...report.zones.map((z) =>
           `| ${z.label} | ${formatZoneTarget(z)} | ${z.requiredQuality} | ${z.actualQuality} | ${z.status} | ${z.coveringCameras.join(", ") || "none"} |`,
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
      ? ["| Camera | Status | Coverage | Best Zone Quality | Zones Failed | Covered Zones | Issues |",
         "|--------|--------|----------|------------------|-------------|---------------|--------|",
         ...report.cameras.map((c) =>
           `| ${c.name} | ${c.status} | ${c.coveragePct.toFixed(1)}% | ${c.bestZoneQuality} | ${c.zonesFailed} | ${c.zonesCovered.length} | ${c.issues.length} |`,
         )]
      : ["No cameras deployed."]),
    "",
  ];
}

function buildIssues(report: ReportData): string[] {
  return [
    "## Issues",
    ...(report.issues.length > 0
      ? report.issues.map((issue) => `- [${issue.severity.toUpperCase()}] ${issue.description}`)
      : ["No issues found. Coverage meets all defined requirements."]),
    "",
  ];
}

function buildRecommendations(report: ReportData): string[] {
  return [
    "## Recommendations",
    ...(report.recommendations.length > 0
      ? report.recommendations.map((rec) => `- [${rec.verified ? "verified" : "unverified"}] ${rec.description} (${rec.costCategory}) :: ${rec.estimatedImpact}`)
      : ["No recommendations at this time."]),
    "",
  ];
}

function buildRedundancyMatrix(report: ReportData): string[] {
  if (!report.redundancyMatrix) return [];
  return [
    "## Redundancy Matrix",
    `- Cameras: ${report.redundancyMatrix.cameraCount}`,
    `- Zones: ${report.redundancyMatrix.zoneCount}`,
    `- Redundant zones: ${report.redundancyMatrix.redundantZoneCount}`,
    `- SPOF zones: ${report.redundancyMatrix.spofZoneCount}`,
    `- Uncovered zones: ${report.redundancyMatrix.uncoveredZoneCount}`,
    ...(report.redundancyMatrix.vulnerableZones.length > 0
      ? [
          "- Vulnerable zones:",
          ...report.redundancyMatrix.vulnerableZones.map(
            (zone) => `  - ${zone.label}: ${zone.status.replace(/_/g, " ")}${zone.coveringCameraNames.length > 0 ? ` (${zone.coveringCameraNames.join(", ")})` : ""}`,
          ),
        ]
      : []),
    "- Camera matrix:",
    ...report.redundancyMatrix.cameraRows.map(
      (row) =>
        `  - ${row.cameraName} (${row.status}, ${row.coveragePct.toFixed(1)}%, ${row.criticalityLabel} ${row.criticalityScore}/10) | single-point: ${row.soleCoverageZones.map((zone) => zone.label).join(", ") || "none"} | covered: ${row.coveredZones.map((zone) => `${zone.label}${zone.isSole ? " ⚠" : ""}`).join(", ") || "none"}`,
    ),
    "",
  ];
}

function buildAdversarialPath(report: ReportData): string[] {
  if (!report.adversarialPath) return [];
  return [
    "## Coverage Failure Replay",
    `- Exposure score: ${report.adversarialPath.exposureScore.toFixed(1)}`,
    `- Detection probability: ${(report.adversarialPath.detectionProbability * 100).toFixed(1)}%`,
    `- Total distance: ${report.adversarialPath.totalDistance.toFixed(1)}m`,
    ...(report.adversarialPath.waypoints.length > 0
      ? [
          "- Waypoints:",
          ...report.adversarialPath.waypoints.map((waypoint, index) => `  - ${index + 1}. (${waypoint.x.toFixed(1)}, ${waypoint.z.toFixed(1)}) exposure ${waypoint.exposure.toFixed(2)}`),
        ]
      : ["- Waypoints: none"]),
    "",
  ];
}

function buildTemporalProfile(report: ReportData): string[] {
  if (!report.temporalProfile) return [];
  return [
    "## Temporal Profile",
    `- Vulnerability windows: ${report.temporalProfile.vulnerabilityWindowCount}`,
    `- Worst coverage: ${report.temporalProfile.worstCoverage.toFixed(1)}%`,
    ...(report.temporalProfile.safestPeriods.length > 0
      ? [
          "- Safest periods:",
          ...report.temporalProfile.safestPeriods.map((period) => `  - ${period.label}: ${formatHour(period.startHour)} - ${formatHour(period.endHour)}`),
        ]
      : ["- Safest periods: none"]),
    "",
  ];
}

function buildNovelAlgorithms(report: ReportData): string[] {
  if (!report.novelAlgorithms) return [];

  const lines = [
    "## Novel Algorithms",
    `- Coverage Entropy: ${report.novelAlgorithms.coverageEntropy ? `${report.novelAlgorithms.coverageEntropy.normalizedEntropy.toFixed(2)} norm · ${report.novelAlgorithms.coverageEntropy.entropyBits.toFixed(2)} bits · dominant ${report.novelAlgorithms.coverageEntropy.dominantQuality} ${report.novelAlgorithms.coverageEntropy.dominantQualityShare.toFixed(1)}%` : "Not computed"}`,
    `- Coverage Fragility: ${report.novelAlgorithms.coverageFragility ? `${(report.novelAlgorithms.coverageFragility.meanFragility * 100).toFixed(1)}% mean · ${report.novelAlgorithms.coverageFragility.fragileCellCount}/${report.novelAlgorithms.coverageFragility.totalCells} fragile cells` : "Not computed"}`,
    `- Coverage Uncertainty: ${report.novelAlgorithms.coverageUncertainty ? `${report.novelAlgorithms.coverageUncertainty.sampleCount} samples · ${report.novelAlgorithms.coverageUncertainty.meanCoveragePct.toFixed(1)}% mean (${report.novelAlgorithms.coverageUncertainty.p5CoveragePct.toFixed(1)}%-${report.novelAlgorithms.coverageUncertainty.p95CoveragePct.toFixed(1)}%)` : "Not computed"}`,
    `- Coverage Posture Variation: ${report.novelAlgorithms.postureVariation ? `${report.novelAlgorithms.postureVariation.profiles.length} profiles · worst ${report.novelAlgorithms.postureVariation.worstProfileLabel ?? "-"} ${report.novelAlgorithms.postureVariation.worstProfileCoveragePct != null ? `${report.novelAlgorithms.postureVariation.worstProfileCoveragePct.toFixed(1)}%` : ""} · largest drop ${report.novelAlgorithms.postureVariation.largestDropProfileLabel ?? "-"} (${formatSignedDelta(report.novelAlgorithms.postureVariation.largestDropDeltaPct)})` : "Not computed"}`,
    `- Blind Spot Topology: ${report.novelAlgorithms.blindRegions ? `${report.novelAlgorithms.blindRegionCount ?? report.novelAlgorithms.blindRegions.length} regions · ${report.novelAlgorithms.blindRegions.filter((region) => region.severity === "critical").length} critical` : "Not computed"}`,
    `- Blind Spot Fingerprint: ${report.novelAlgorithms.blindSpotFingerprint ? `${report.novelAlgorithms.blindSpotFingerprint.fingerprint} · ${report.novelAlgorithms.blindSpotFingerprint.regionCount} regions` : "Not computed"}`,
    `- Reflective Bounce Vision: ${report.novelAlgorithms.reflectiveBounce ? `${report.novelAlgorithms.reflectiveBounce.reflectiveWindowCount} reflective windows · ${report.novelAlgorithms.reflectiveBounce.affectedCellCount} affected cells · ${report.novelAlgorithms.reflectiveBounce.affectedCameraCount} affected cameras` : "Not computed"}`,
    `- K-Robustness: ${report.novelAlgorithms.kRobustness ? `K=${report.novelAlgorithms.kRobustness.kRobustness} / ${report.novelAlgorithms.kRobustness.totalCameras}` : "Not computed"}`,
    ...(report.novelAlgorithms.kRobustness?.criticalSets?.length
      ? [
          "- K-Robustness Critical Sets:",
          ...report.novelAlgorithms.kRobustness.criticalSets.slice(0, 5).map(
            (set) => `  - K=${set.k}: ${set.cameraNames.join(", ")} (exposure ${set.exposureScore.toFixed(1)}, ${set.waypointCount} waypoints)`,
          ),
        ]
      : []),
    `- Placement Oracle: ${report.novelAlgorithms.placementOracle ? `${report.novelAlgorithms.placementOracle.candidateCount} candidates · best ${report.novelAlgorithms.placementOracle.bestCandidateMountType} @ ${report.novelAlgorithms.placementOracle.bestCandidatePosition[0].toFixed(1)}, ${report.novelAlgorithms.placementOracle.bestCandidatePosition[2].toFixed(1)} · score ${report.novelAlgorithms.placementOracle.bestCandidateScore.toFixed(1)}` : "Not computed"}`,
    `- Temporal Anomalies: ${report.novelAlgorithms.temporalAnomalies ? `${report.novelAlgorithms.temporalAnomalies.anomalyWindowCount} windows` : "Not computed"}`,
    `- Occlusion Blame: ${report.novelAlgorithms.occlusionBlame ? `${report.novelAlgorithms.occlusionBlame.length} zones` : `${report.novelAlgorithms.occlusionBlameCount ?? 0} groups`}`,
    `- Blind Regions: ${report.novelAlgorithms.blindRegionCount ?? 0} regions`,
    "",
    ...(report.novelAlgorithms.occlusionBlame && report.novelAlgorithms.occlusionBlame.length > 0
      ? [
          "### Occlusion Blame",
          ...report.novelAlgorithms.occlusionBlame.flatMap((zone) => [
            `- ${zone.zoneLabel} (${zone.baselineQuality})`,
            ...zone.obstructions.map(
              (obstruction) =>
                `  - ${obstruction.label}: ${(obstruction.blameFraction * 100).toFixed(0)}% blame, ${obstruction.qualityWithout} without, +${obstruction.qualityImprovement.toFixed(1)} improvement`,
            ),
          ]),
          "",
        ]
      : []),
    ...(report.novelAlgorithms.reflectiveBounce
      ? [
          "### Reflective Bounce Vision",
          `- Reflective windows: ${report.novelAlgorithms.reflectiveBounce.reflectiveWindowCount}`,
          `- Affected cells: ${report.novelAlgorithms.reflectiveBounce.affectedCellCount}`,
          `- Affected cameras: ${report.novelAlgorithms.reflectiveBounce.affectedCameraCount}`,
          "",
        ]
      : []),
    ...(report.novelAlgorithms.placementOracle
      ? [
          "### Placement Oracle",
          `- Candidate count: ${report.novelAlgorithms.placementOracle.candidateCount}`,
          `- Best score: ${report.novelAlgorithms.placementOracle.bestCandidateScore.toFixed(1)}`,
          `- Best candidate: ${report.novelAlgorithms.placementOracle.bestCandidateMountType} @ ${report.novelAlgorithms.placementOracle.bestCandidatePosition[0].toFixed(1)}, ${report.novelAlgorithms.placementOracle.bestCandidatePosition[2].toFixed(1)}`,
          "",
        ]
      : []),
    "",
  ];

  return lines;
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
    ...buildIssues(report),
    ...buildRecommendations(report),
    ...buildRedundancyMatrix(report),
    ...buildAdversarialPath(report),
    ...buildTemporalProfile(report),
    ...buildNovelAlgorithms(report),
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
    ...buildIssues(report),
    ...buildRecommendations(report),
    ...buildRedundancyMatrix(report),
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
    ...buildIssues(report),
    ...buildRecommendations(report),
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
    ...buildIssues(report),
    ...buildRecommendations(report),
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
    ...buildIssues(report),
    ...buildRecommendations(report),
    ...buildFooter(report),
  ].join("\n");
}
