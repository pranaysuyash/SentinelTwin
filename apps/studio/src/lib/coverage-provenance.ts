import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import type { PostureScoreResult } from "@sentineltwin/simulation";

export interface CoverageClaimAnchor {
  claimId: string;
  claim: string;
  value: string;
  evidenceSources: EvidenceSource[];
  confidence: "verified" | "high" | "medium" | "low";
  verificationPath: string;
}

export interface EvidenceSource {
  type: "camera" | "zone" | "obstruction" | "calibration" | "simulation_engine" | "temporal_profile" | "crowd_model";
  nodeId: string;
  label: string;
  contribution: string;
}

export interface CoverageProvenanceSummary {
  sceneId: string;
  sceneName: string;
  generatedAt: number;
  engineVersion: string;
  calibrated: boolean;
  sceneSource: string;
  claims: CoverageClaimAnchor[];
  cameraChain: CameraProvenanceEntry[];
  zoneChain: ZoneProvenanceEntry[];
  auditNotes: string[];
}

export interface CameraProvenanceEntry {
  cameraId: string;
  cameraName: string;
  source: string;
  reviewStatus: string;
  geometryValidity: string;
  coveragePct: number;
  zonesCovered: string[];
  zonesFailed: string[];
}

export interface ZoneProvenanceEntry {
  zoneId: string;
  zoneLabel: string;
  requiredQuality: string;
  actualQuality: string;
  status: "pass" | "fail";
  coveringCameraIds: string[];
  coveringCameraNames: string[];
}

export function buildCoverageProvenance(
  scene: SecurityScene,
  result: SimulationResult,
  options?: {
    postureScore?: PostureScoreResult | null;
    engineVersion?: string;
    calibrated?: boolean;
  },
): CoverageProvenanceSummary {
  const cameraMap = new Map(scene.cameras.map((c) => [c.id, c]));

  const claims: CoverageClaimAnchor[] = [];

  claims.push(buildTotalCoverageClaim(result, scene));
  claims.push(buildQualityClaim(result));

  for (const zoneResult of result.criticalZoneResults) {
    claims.push(buildZoneClaim(zoneResult, scene));
  }

  if (result.adversarialPath) {
    claims.push(buildAdversarialClaim(result));
  }

  if (result.kRobustness) {
    claims.push(buildRedundancyClaim(result));
  }

  if (options?.postureScore) {
    claims.push(buildPostureClaim(options.postureScore));
  }

  const cameraChain: CameraProvenanceEntry[] = result.cameraResults.map((cr) => {
    const cam = cameraMap.get(cr.cameraId);
    return {
      cameraId: cr.cameraId,
      cameraName: cam?.name ?? cr.cameraId,
      source: cam?.source ?? "unknown",
      reviewStatus: cam?.reviewStatus ?? "unreviewed",
      geometryValidity: cam?.geometryValidity ?? "unknown",
      coveragePct: cr.coveragePct,
      zonesCovered: cr.criticalZonesCovered,
      zonesFailed: cr.criticalZonesFailed,
    };
  });

  const zoneChain: ZoneProvenanceEntry[] = result.criticalZoneResults.map((zr) => ({
    zoneId: zr.zoneId,
    zoneLabel: zr.label,
    requiredQuality: zr.requiredQuality,
    actualQuality: zr.actualQuality,
    status: zr.status as "pass" | "fail",
    coveringCameraIds: zr.coveringCameras,
    coveringCameraNames: zr.coveringCameras.map((id) => cameraMap.get(id)?.name ?? id),
  }));

  const auditNotes: string[] = [];
  const unreviewedCameras = scene.cameras.filter((c) => c.reviewStatus === "unreviewed");
  if (unreviewedCameras.length > 0) {
    auditNotes.push(`${unreviewedCameras.length} camera${unreviewedCameras.length !== 1 ? "s have" : " has"} not been reviewed by an operator.`);
  }
  const suspectGeometry = scene.cameras.filter((c) => c.geometryValidity === "suspect");
  if (suspectGeometry.length > 0) {
    auditNotes.push(`${suspectGeometry.length} camera${suspectGeometry.length !== 1 ? "s have" : " has"} suspect geometry — field verification recommended.`);
  }
  if (!options?.calibrated) {
    auditNotes.push("Scene has not been calibrated against real-world measurements. Coverage percentages are estimates.");
  }
  if (scene.source === "ai" || scene.source === "scan") {
    auditNotes.push(`Scene was ${scene.source === "ai" ? "AI-extracted" : "3D scan reconstructed"} — verify dimensions and obstruction placement on-site.`);
  }

  return {
    sceneId: scene.id,
    sceneName: scene.name,
    generatedAt: Date.now(),
    engineVersion: options?.engineVersion ?? "unknown",
    calibrated: options?.calibrated ?? false,
    sceneSource: scene.source,
    claims,
    cameraChain,
    zoneChain,
    auditNotes,
  };
}

function buildTotalCoverageClaim(result: SimulationResult, scene: SecurityScene): CoverageClaimAnchor {
  const activeCams = scene.cameras.filter((c) => c.status === "on");
  const sources: EvidenceSource[] = activeCams.map((cam) => ({
    type: "camera",
    nodeId: cam.id,
    label: cam.name,
    contribution: `${cam.fovHorizontalDeg}° FOV, ${cam.rangeM}m range, ${cam.mountType} mount at ${cam.mountHeightM}m`,
  }));

  if (scene.obstructions.length > 0) {
    sources.push({
      type: "obstruction",
      nodeId: "obstructions",
      label: `${scene.obstructions.length} obstructions`,
      contribution: "Reduce effective coverage via line-of-sight blocking",
    });
  }

  return {
    claimId: "total-coverage",
    claim: "Total walkable area coverage",
    value: `${result.totalCoveragePct.toFixed(1)}%`,
    evidenceSources: sources,
    confidence: determineConfidence(result),
    verificationPath: "Run simulation > view heatmap overlay > verify cell-by-cell quality",
  };
}

function buildQualityClaim(result: SimulationResult): CoverageClaimAnchor {
  return {
    claimId: "quality-distribution",
    claim: "DORI quality distribution",
    value: `Recognition ${result.recognitionAreaPct.toFixed(1)}%, Identification ${result.identificationAreaPct.toFixed(1)}%`,
    evidenceSources: [{
      type: "simulation_engine",
      nodeId: "dori-engine",
      label: "DORI quality engine",
      contribution: "Pixels-per-meter calculation from camera resolution, focal length, and distance to each cell",
    }],
    confidence: determineConfidence(result),
    verificationPath: "View quality layer overlay > inspect PPM values at specific points > compare against DORI threshold table",
  };
}

function buildZoneClaim(
  zoneResult: { zoneId: string; label: string; requiredQuality: string; actualQuality: string; status: string; coveringCameras: string[] },
  scene: SecurityScene,
): CoverageClaimAnchor {
  const cameraMap = new Map(scene.cameras.map((c) => [c.id, c]));
  const sources: EvidenceSource[] = zoneResult.coveringCameras.map((camId) => {
    const cam = cameraMap.get(camId);
    return {
      type: "camera" as const,
      nodeId: camId,
      label: cam?.name ?? camId,
      contribution: `Covers zone with ${zoneResult.actualQuality} quality`,
    };
  });

  return {
    claimId: `zone-${zoneResult.zoneId}`,
    claim: `Zone "${zoneResult.label}" compliance`,
    value: `${zoneResult.status.toUpperCase()} — required ${zoneResult.requiredQuality}, actual ${zoneResult.actualQuality}`,
    evidenceSources: sources,
    confidence: sources.length > 0 ? "medium" : "low",
    verificationPath: `Select zone "${zoneResult.label}" > inspect covering cameras > verify PPM at zone boundary`,
  };
}

function buildAdversarialClaim(result: SimulationResult): CoverageClaimAnchor {
  const path = result.adversarialPath!;
  return {
    claimId: "adversarial-path",
    claim: "Worst-case intrusion path exposure",
    value: `${((path.totalExposureScore ?? 0) * 100).toFixed(0)}% exposure along ${path.waypoints?.length ?? 0} waypoints`,
    evidenceSources: [{
      type: "simulation_engine",
      nodeId: "dijkstra-engine",
      label: "Adversarial path engine",
      contribution: "Dijkstra shortest-path through lowest-coverage cells weighted by detection probability",
    }],
    confidence: determineConfidence(result),
    verificationPath: "Enable path replay > step through waypoints > verify detection quality at each step",
  };
}

function buildRedundancyClaim(result: SimulationResult): CoverageClaimAnchor {
  const k = result.kRobustness!;
  return {
    claimId: "k-robustness",
    claim: "Camera failure resilience",
    value: `K=${k.kRobustness} (${k.isRobust ? "robust" : "fragile"}) with ${k.criticalSets.length} critical camera sets`,
    evidenceSources: [{
      type: "simulation_engine",
      nodeId: "k-robustness-engine",
      label: "K-robustness analyzer",
      contribution: `Tested all ${k.totalCameras}-choose-${k.kRobustness} camera failure combinations`,
    }],
    confidence: "high",
    verificationPath: "Toggle camera failures in scenario panel > observe coverage change > verify critical sets",
  };
}

function buildPostureClaim(posture: PostureScoreResult): CoverageClaimAnchor {
  return {
    claimId: "posture-score",
    claim: "Security posture score",
    value: `${posture.score}/850 (${posture.band})`,
    evidenceSources: [
      { type: "simulation_engine", nodeId: "coverage-factor", label: "Coverage completeness", contribution: `Factor score ${posture.factorScores.coverageCompleteness}` },
      { type: "simulation_engine", nodeId: "temporal-factor", label: "Temporal resilience", contribution: `Factor score ${posture.factorScores.temporalResilience}` },
      { type: "simulation_engine", nodeId: "adversarial-factor", label: "Adversarial resistance", contribution: `Factor score ${posture.factorScores.adversarialPathResistance}` },
      { type: "simulation_engine", nodeId: "redundancy-factor", label: "Redundancy depth", contribution: `Factor score ${posture.factorScores.redundancyDepth}` },
      { type: "simulation_engine", nodeId: "response-factor", label: "Response window", contribution: `Factor score ${posture.factorScores.responseWindow}` },
    ],
    confidence: "high",
    verificationPath: "Review each factor in the metrics panel > trace back to the underlying simulation data",
  };
}

function determineConfidence(_result: SimulationResult): CoverageClaimAnchor["confidence"] {
  return "medium";
}

export function formatProvenanceMarkdown(summary: CoverageProvenanceSummary): string {
  const sections: string[] = [];

  sections.push("# Coverage Provenance Audit Trail\n");
  sections.push(`**Scene:** ${summary.sceneName} (${summary.sceneId})`);
  sections.push(`**Generated:** ${new Date(summary.generatedAt).toISOString()}`);
  sections.push(`**Engine:** ${summary.engineVersion}`);
  sections.push(`**Calibrated:** ${summary.calibrated ? "Yes" : "No"}`);
  sections.push(`**Source:** ${summary.sceneSource}\n`);

  if (summary.auditNotes.length > 0) {
    sections.push("## Audit Notes\n");
    for (const note of summary.auditNotes) {
      sections.push(`- ${note}`);
    }
    sections.push("");
  }

  sections.push("## Coverage Claims\n");
  for (const claim of summary.claims) {
    sections.push(`### ${claim.claim}`);
    sections.push(`**Value:** ${claim.value}`);
    sections.push(`**Confidence:** ${claim.confidence}`);
    sections.push(`**Verification:** ${claim.verificationPath}\n`);
    if (claim.evidenceSources.length > 0) {
      sections.push("**Evidence sources:**\n");
      for (const source of claim.evidenceSources) {
        sections.push(`- **${source.label}** (${source.type}): ${source.contribution}`);
      }
      sections.push("");
    }
  }

  sections.push("## Camera Evidence Chain\n");
  sections.push("| Camera | Source | Review | Geometry | Coverage | Zones Covered | Zones Failed |");
  sections.push("|--------|--------|--------|----------|----------|---------------|--------------|");
  for (const cam of summary.cameraChain) {
    sections.push(`| ${cam.cameraName} | ${cam.source} | ${cam.reviewStatus} | ${cam.geometryValidity} | ${cam.coveragePct.toFixed(1)}% | ${cam.zonesCovered.join(", ") || "—"} | ${cam.zonesFailed.join(", ") || "—"} |`);
  }
  sections.push("");

  if (summary.zoneChain.length > 0) {
    sections.push("## Zone Evidence Chain\n");
    sections.push("| Zone | Required | Actual | Status | Covering Cameras |");
    sections.push("|------|----------|--------|--------|------------------|");
    for (const zone of summary.zoneChain) {
      sections.push(`| ${zone.zoneLabel} | ${zone.requiredQuality} | ${zone.actualQuality} | ${zone.status.toUpperCase()} | ${zone.coveringCameraNames.join(", ") || "—"} |`);
    }
    sections.push("");
  }

  return sections.join("\n");
}
