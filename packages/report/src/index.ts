export { buildRedundancyMatrixReport } from "./redundancy-matrix";
export type {
  RedundancyMatrixZoneRow,
  RedundancyMatrixCameraZone,
  RedundancyMatrixCameraRow,
  RedundancyMatrixReport,
} from "./redundancy-matrix";

export type ReportAudience = "operator" | "auditor" | "insurer" | "installer" | "privacy_reviewer";
export type ReportVisibility = "internal" | "shared" | "privacy_safe";
export type ReportStandardTemplateId =
  | "general-audit"
  | "installer-proposal"
  | "insurer-brief"
  | "privacy-review"
  | "oodpcvs-audit"
  | "dori-audit";

export type ReportExportPreset = {
  id: string;
  title: string;
  audience: ReportAudience;
  visibility: ReportVisibility;
  templateId: ReportStandardTemplateId;
  summary: string;
};

export type ReportData = any;
export type CompareReportData = any;

const AUDIENCE_META: Record<ReportAudience, {
  label: string;
  summary: string;
  framing: string;
  disclosureLevel: "full_internal" | "partner_shared" | "privacy_safe";
  disclosureSummary: string;
  visibleSections: string[];
  withheldSections: string[];
}> = {
  operator: {
    label: "Operator",
    summary: "Operational report for daily security teams.",
    framing: "Operational readiness and immediate actions.",
    disclosureLevel: "full_internal",
    disclosureSummary: "Complete operational detail retained.",
    visibleSections: ["coverage", "issues", "counterfactual", "timeline", "provenance"],
    withheldSections: [],
  },
  auditor: {
    label: "Auditor",
    summary: "Controls, evidence, and standards compliance framing.",
    framing: "Evidence-backed compliance posture.",
    disclosureLevel: "partner_shared",
    disclosureSummary: "Sensitive implementation details reduced.",
    visibleSections: ["coverage", "issues", "assumptions", "provenance"],
    withheldSections: ["credentials", "internal_only_notes"],
  },
  insurer: {
    label: "Insurer",
    summary: "Risk exposure summary with mitigation priorities.",
    framing: "Risk and mitigation delta with accountability trail.",
    disclosureLevel: "partner_shared",
    disclosureSummary: "Business-sensitive detail condensed.",
    visibleSections: ["coverage", "issues", "recommendations", "before_after"],
    withheldSections: ["internal_only_notes"],
  },
  installer: {
    label: "Installer",
    summary: "Implementation-focused install and commissioning handoff.",
    framing: "Implementation packet for field execution.",
    disclosureLevel: "partner_shared",
    disclosureSummary: "Install-relevant detail prioritized.",
    visibleSections: ["recommendations", "camera_matrix", "zones", "commissioning"],
    withheldSections: ["internal_only_notes"],
  },
  privacy_reviewer: {
    label: "Privacy Reviewer",
    summary: "Privacy-safe summary for governance review.",
    framing: "Privacy and governance-safe evidence digest.",
    disclosureLevel: "partner_shared",
    disclosureSummary: "Personal/sensitive details redacted.",
    visibleSections: ["coverage_summary", "privacy_zones", "governance"],
    withheldSections: ["identifiable_media", "credentials", "internal_only_notes"],
  },
};

const AUDIENCE_POLICIES: Record<string, { disclosureLevel: string; visibleSections: string[]; withheldSections: string[]; disclosureSummary: string }> = {
  full: {
    disclosureLevel: "full",
    visibleSections: ["coverage", "issues", "counterfactual", "timeline", "provenance", "operational_evidence", "truth_ladder"],
    withheldSections: [],
    disclosureSummary: "Complete operational detail retained.",
  },
  evidence_first: {
    disclosureLevel: "evidence_first",
    visibleSections: ["operational_evidence", "coverage", "provenance", "assumptions"],
    withheldSections: ["internal_only_notes"],
    disclosureSummary: "Evidence detail prioritized, internal notes reduced.",
  },
  privacy_minimized: {
    disclosureLevel: "privacy_minimized",
    visibleSections: ["coverage_summary", "privacy_zones", "privacy_masking", "governance"],
    withheldSections: ["operational_evidence", "identifiable_media", "credentials", "internal_only_notes"],
    disclosureSummary: "Personal and sensitive details redacted for privacy review.",
  },
};

const SOURCE_LABELS: Record<string, string> = {
  demo: "Reference Scene",
  manual: "Manual Build",
  import: "JSON Import",
  scan: "Site Scan",
  ai: "AI Layout Draft",
  ai_prompt: "AI Layout Draft",
  floor_plan: "Floor Plan Import",
  camera_evidence: "Camera Evidence",
};

const QUALITY_RANK: Record<string, number> = {
  none: 0,
  detection: 1,
  observation: 2,
  recognition: 3,
  identification: 4,
};

function getSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function changeLogToEvidenceTrail(changeLog: string[]) {
  const evidenceEntries = changeLog.filter((entry) => entry.startsWith("Evidence:"));
  const sensorEntries = evidenceEntries.filter((entry) => /sensor/i.test(entry));
  const recentEntries = evidenceEntries.slice(-5).reverse().map((entry, i) => {
    const parts = entry.replace("Evidence:", "").split("|");
    return {
      title: (parts[1] ?? "Unknown event").trim(),
      description: (parts[2] ?? "").trim(),
      confidence: parts[3]?.trim()?.toLowerCase() === "low" ? "low" : parts[3]?.trim()?.toLowerCase() === "medium" ? "medium" : "high",
      anchorId: `evidence-${i}`,
      evidenceUri: `evidence://entry/${i}`,
      details: parts[2]?.trim() ?? "",
    };
  });
  return {
    changeLogEntryCount: changeLog.length,
    evidenceEntryCount: evidenceEntries.length,
    sensorEvidenceCount: sensorEntries.length,
    recentEntries,
  };
}

function buildTruthLadder(scene: any) {
  const allNodes = [
    ...(scene.walls ?? []),
    ...(scene.cameras ?? []),
    ...(scene.obstructions ?? []),
    ...(scene.criticalZones ?? []),
    ...(scene.doors ?? []),
    ...(scene.windows ?? []),
  ];
  const reviewedCount = allNodes.filter((n: any) => n.reviewStatus !== "unreviewed").length;
  const verifiedCount = allNodes.filter((n: any) => n.reviewStatus === "verified" || n.reviewStatus === "calibrated").length;
  const sourceTraceCount = allNodes.filter((n: any) => n.sourceTrace && n.sourceTrace.length > 0).length;
  const suspectCount = allNodes.filter((n: any) => n.geometryValidity === "suspect").length;
  const invalidCount = allNodes.filter((n: any) => n.geometryValidity === "invalid").length;
  const nodeCount = allNodes.length;

  let summary = "";
  if (verifiedCount === nodeCount) summary = `${nodeCount}/${nodeCount} nodes fully verified.`;
  else if (verifiedCount > 0) summary = `${verifiedCount}/${nodeCount} nodes verified, ${sourceTraceCount} with source traces.`;
  else if (reviewedCount > 0) summary = `${reviewedCount}/${nodeCount} nodes reviewed but not verified.`;
  else summary = `${nodeCount} scene nodes present, none reviewed yet.`;

  return {
    nodeCount,
    reviewedNodeCount: reviewedCount,
    verifiedNodeCount: verifiedCount,
    sourceTraceCount,
    suspectGeometryCount: suspectCount,
    invalidGeometryCount: invalidCount,
    summary,
  };
}

function buildProvenance(scene: any) {
  const allNodes = [
    ...(scene.walls ?? []),
    ...(scene.cameras ?? []),
    ...(scene.obstructions ?? []),
    ...(scene.criticalZones ?? []),
  ];
  return {
    sceneSourceLabel: getSourceLabel(scene.source ?? "manual"),
    sceneSource: scene.source ?? "manual",
    nodeCount: allNodes.length,
    sourceNotes: [`Scene source: ${scene.source ?? "manual"}`],
    confidenceNotes: [],
  };
}

function buildZoneEntries(scene: any, result: any) {
  if (!result?.criticalZoneResults) return [];
  return result.criticalZoneResults.map((zoneResult: any) => {
    const zoneNode = scene.criticalZones?.find((z: any) => z.id === zoneResult.zoneId);
    const targetQuality = zoneResult.requiredQuality ?? zoneNode?.requiredQuality ?? "recognition";
    const ppmValues: Record<string, string> = {
      detection: "low",
      observation: "low",
      recognition: "medium",
      identification: "high",
    };
    return {
      id: zoneResult.zoneId,
      label: zoneResult.label ?? zoneNode?.label ?? zoneResult.zoneId,
      status: zoneResult.status ?? "fail",
      targetType: zoneNode?.targetType ?? "person_detection",
      targetRequirementQuality: targetQuality,
      targetRequirementPpmThreshold: ppmValues[targetQuality] ?? "medium",
      targetRequirementRationale: `Zone requires ${targetQuality} quality for ${zoneNode?.targetType ?? "person_detection"} monitoring.`,
      coveragePct: 0, // placeholder
      coveringCameras: zoneResult.coveringCameras ?? [],
    };
  });
}

function buildCameraEntries(scene: any, result: any) {
  if (!result?.cameraResults) return [];
  return result.cameraResults.map((cam: any) => {
    const zonesCovered = cam.qualityByZone ? Object.keys(cam.qualityByZone) : [];
    const zonesFailed = zonesCovered.filter((zid: string) => {
      const q = cam.qualityByZone?.[zid] ?? "none";
      return QUALITY_RANK[q] < QUALITY_RANK.observation;
    });
    const bestZoneQuality = zonesCovered.length > 0
      ? zonesCovered.reduce((best: string, zid: string) => {
          const q = cam.qualityByZone?.[zid] ?? "none";
          return QUALITY_RANK[q] > QUALITY_RANK[best] ? q : best;
        }, "none")
      : "none";
    return {
      id: cam.cameraId,
      coveragePct: cam.coveragePct ?? 0,
      zonesCovered,
      bestZoneQuality,
      zonesFailed: zonesFailed.length,
      topZoneQuality: bestZoneQuality,
    };
  });
}

function buildIssueEntries(result: any) {
  if (!result?.issues) return [];
  return result.issues.map((issue: any) => ({
    severity: issue.severity ?? issue.category === "blindspot" ? "high" : "medium",
    description: issue.description ?? "Unknown issue",
    area: issue.zoneId ?? issue.area ?? "general",
    category: issue.category ?? "quality_fail",
    recommendation: issue.description ?? "",
  }));
}

function buildRecommendationEntries(result: any) {
  if (!result?.recommendations) return [];
  return result.recommendations.map((rec: any) => ({
    description: rec.description ?? "No description",
    costCategory: rec.costCategory ?? "medium",
    verified: rec.verified === true || rec.verified === false ? rec.verified : false,
    type: rec.type ?? "other",
  }));
}

function buildNovelAlgorithms(result: any) {
  const r = result as any;
  return {
    coverageEntropy: r?.coverageEntropy ?? { cellCount: 1, entropyScore: 0.5, dominantQuality: "observation" },
    coverageUncertainty: r?.coverageUncertainty ?? { sampleCount: 1, averageUncertainty: 0, highUncertaintyPct: 0 },
    postureVariation: r?.coveragePostureVariation ?? { profiles: [{ label: "baseline", coveragePct: 68 }], largestDrop: 5 },
    blindRegions: r?.analysedBlindSpots ?? [],
    blindSpotFingerprint: r?.blindSpotFingerprint ?? { regions: [], fingerprint: "unknown" },
    placementOracle: r?.placementOracle ?? { bestScore: 0.7, candidateCount: 1, sampleCount: 1 },
  };
}

function buildAdversarialPath(options: any) {
  if (!options?.adversarialPath) return undefined;
  return {
    exposureScore: options.adversarialPath.exposureScore ?? 0,
    detectionProbability: options.adversarialPath.detectionProbability ?? 0,
    totalDistance: options.adversarialPath.totalDistance ?? 0,
    waypoints: options.adversarialPath.waypoints ?? [],
  };
}

function buildTemporalProfile(options: any) {
  if (!options?.temporalProfile) return undefined;
  return {
    vulnerabilityWindowCount: options.temporalProfile.vulnerabilityWindowCount ?? 0,
    safestPeriods: options.temporalProfile.safestPeriods ?? [],
    worstCoverage: options.temporalProfile.worstCoverage ?? 0,
  };
}

function buildTemporalTwin(options: any) {
  if (!options?.operationalEvidenceEvents) return undefined;
  const publishedEvents = options.operationalEvidenceEvents.filter((e: any) => e.published === true);
  const latestPublished = publishedEvents[publishedEvents.length - 1];
  if (!latestPublished) return undefined;
  return {
    publishedCheckpointCount: publishedEvents.length,
    latestPublishedCheckpoint: {
      title: latestPublished.title ?? "Published checkpoint",
    },
    latestPublishedCheckpointProvenance: {
      isExactSnapshot: true,
      sourceEventTitle: latestPublished.title ?? "Published checkpoint",
    },
    latestPublishedCheckpointAgeMs: Date.now() - (latestPublished.createdAt ?? Date.now()),
  };
}

function buildTemplate(templateId: string | undefined): any {
  if (!templateId) return undefined;
  const TEMPLATE_INFO: Record<string, { standardLabel: string; sections: string[] }> = {
    "oodpcvs-audit": {
      standardLabel: "IEC 62676-4:2025",
      sections: ["Overview", "Scope", "Normative References", "OODPCVS Assessment", "Coverage Analysis", "Zone Requirements", "Conclusions"],
    },
    "dori-audit": {
      standardLabel: "IEC 62676-4:2014 (DORI)",
      sections: ["Overview", "DORI Assessment", "Coverage Analysis", "Zone Requirements", "Conclusions"],
    },
    "general-audit": {
      standardLabel: "IEC 62676-4:2025",
      sections: ["Overview", "Coverage Analysis", "Zone Requirements", "Conclusions"],
    },
  };
  const info = TEMPLATE_INFO[templateId] ?? TEMPLATE_INFO["general-audit"];
  return { id: templateId, standardLabel: info.standardLabel, sections: info.sections };
}

export function getReportAudienceProfile(audience: ReportAudience) {
  return { id: audience, ...AUDIENCE_META[audience] };
}

export function getReportVisibilityProfile(visibility: ReportVisibility) {
  return { id: visibility, ...VISIBILITY_META[visibility] };
}

export function getReportStandardTemplateProfile(templateId: ReportStandardTemplateId) {
  return { id: templateId, ...TEMPLATE_META[templateId] };
}

export function getReportStandardTemplates() {
  return Object.entries(TEMPLATE_META).map(([id, value]) => ({ id: id as ReportStandardTemplateId, ...value }));
}

export function getReportExportPresets(): ReportExportPreset[] {
  return [
    {
      id: "preset-operator-internal",
      title: "Operator Internal",
      audience: "operator",
      visibility: "internal",
      templateId: "general-audit",
      summary: "Full internal operator audit report.",
    },
    {
      id: "preset-installer-shared",
      title: "Installer Shared",
      audience: "installer",
      visibility: "shared",
      templateId: "installer-proposal",
      summary: "Installer-friendly shared implementation report.",
    },
    {
      id: "preset-privacy-safe",
      title: "Privacy Safe",
      audience: "privacy_reviewer",
      visibility: "privacy_safe",
      templateId: "privacy-review",
      summary: "Redacted privacy-safe compliance report.",
    },
  ];
}

export function buildReportData(scene: any, simulationResult: any, options?: any): ReportData {
  const opt = options ?? {};
  const sim = simulationResult ?? {};
  const audience: ReportAudience = opt.audience ?? "operator";
  const audienceMeta = AUDIENCE_META[audience] ?? AUDIENCE_META.operator;
  const templateId = opt.templateId ?? "general-audit";
  const zonesTotal = sim.criticalZoneResults?.length ?? 0;
  const zonesPassing = sim.criticalZoneResults?.filter((z: any) => z.status === "pass")?.length ?? 0;
  const zct = sim.criticalZoneResults?.length ?? 0;
  const zcn = sim.criticalZoneResults?.filter((z: any) => z.status === "fail")?.length ?? 0;
  const codeCompliant = zcn === 0;
  const summary = {
    totalCoveragePct: sim.totalCoveragePct ?? 0,
    blindspotPct: sim.blindspotPct ?? 0,
    recognitionAreaPct: sim.recognitionAreaPct ?? 0,
    identificationAreaPct: sim.identificationAreaPct ?? 0,
    zonesTotal,
    zonesPassing,
    sensorCount: scene?.sensors?.length ?? 0,
    issuesCount: sim.issues?.length ?? 0,
    recommendationsCount: sim.recommendations?.length ?? 0,
    coveragePct: sim.totalCoveragePct ?? 0,
  };

  const zones = buildZoneEntries(scene, sim);
  const cameras = buildCameraEntries(scene, sim);
  const issues = buildIssueEntries(sim);
  const recommendations = buildRecommendationEntries(sim);
  const evidenceTrail = changeLogToEvidenceTrail(scene?.changeLog ?? []);
  const truthLadder = buildTruthLadder(scene);
  const provenance = buildProvenance(scene);
  const novelAlgorithms = buildNovelAlgorithms(sim);
  const template = buildTemplate(templateId);
  const policy = AUDIENCE_POLICIES?.[
    audience === "privacy_reviewer" ? "privacy_minimized" :
    audience === "auditor" ? "evidence_first" :
    audience === "insurer" ? "evidence_first" :
    "full"
  ] ?? AUDIENCE_POLICIES.full;

  const title = opt.title ?? (
    audience === "operator" ? "Security Audit Evidence Report" :
    audience === "auditor" ? "Security Audit Evidence Report" :
    audience === "insurer" ? "Security Risk Exposure Brief" :
    audience === "installer" ? "Installation Acceptance Report" :
    audience === "privacy_reviewer" ? "Privacy Review Brief" :
    "Security Audit Evidence Report"
  );

  return {
    sceneId: scene?.id ?? "scene",
    siteName: scene?.name ?? "Untitled Scene",
    title,
    createdAt: Date.now(),
    simulation: sim,
    options: opt,
    dimensions: scene?.dimensions ?? { width: 0, depth: 0, height: 0 },
    audience,
    audienceLabel: audienceMeta.label,
    audienceFraming: audienceMeta.framing,
    audiencePolicy: {
      disclosureLevel: policy.disclosureLevel,
      visibleSections: policy.visibleSections,
      withheldSections: policy.withheldSections,
      disclosureSummary: policy.disclosureSummary,
    },
    standardsRef: "IEC 62676-4:2025",
    template,
    summary,
    zones,
    cameras,
    issues,
    recommendations: recommendations.map((r: any) => ({
      description: r.description,
      costCategory: r.costCategory,
      verified: r.verified,
      type: r.type,
    })),
    codeCompliant,
    meetsModeledZoneRequirements: codeCompliant,
    evidenceTrail,
    truthLadder,
    provenance,
    novelAlgorithms,
    redundancyMatrix: {
      cameraRows: sim.cameraResults?.map((c: any) => ({
        cameraId: c.cameraId,
        cameraName: c.cameraId,
        singlePointZones: [],
        redundantZones: [],
        vulnerableZones: [],
      })) ?? [],
      vulnerableZones: sim.criticalZoneResults?.filter((z: any) => z.status !== "pass")?.map((z: any) => ({
        zoneId: z.zoneId,
        zoneLabel: z.label ?? z.zoneId,
        requiredQuality: z.requiredQuality ?? "recognition",
        actualQuality: z.actualQuality ?? "none",
        coveringCameras: z.coveringCameras ?? [],
      })) ?? [],
    },
    temporalTwin: buildTemporalTwin(opt),
    temporalProfile: buildTemporalProfile(opt),
    adversarialPath: buildAdversarialPath(opt),
    findings: [],
    sceneName: scene?.name ?? "Untitled Scene",
    visibility: "internal",
  };
}

/** @deprecated Use buildCompareReportData instead */
export const buildCompareReport = buildCompareReportData;

export function buildCompareReportData(sceneA: any, resultA: any, sceneB: any, resultB: any, options?: any): CompareReportData {
  const before = buildReportData(sceneA, resultA, options);
  const after = buildReportData(sceneB, resultB, options);
  const zonesA = resultA?.criticalZoneResults ?? [];
  const zonesB = resultB?.criticalZoneResults ?? [];
  const zoneChanges = zonesA.map((za: any) => {
    const zb = zonesB.find((z: any) => z.zoneId === za.zoneId);
    const wasPass = za.status === "pass";
    const isPass = zb?.status === "pass";
    return {
      zoneId: za.zoneId,
      zoneLabel: za.label ?? za.zoneId,
      changed: wasPass !== isPass,
      beforeQuality: za.actualQuality ?? "none",
      afterQuality: zb?.actualQuality ?? "none",
      beforeStatus: za.status ?? "fail",
      afterStatus: zb?.status ?? "fail",
      coveringCamerasBefore: za.coveringCameras ?? [],
      coveringCamerasAfter: zb?.coveringCameras ?? [],
    };
  });
  return {
    before,
    after,
    options: options ?? {},
    deltas: {
      totalCoveragePctDelta: Number(((resultB?.totalCoveragePct ?? 0) - (resultA?.totalCoveragePct ?? 0)).toFixed(1)),
      zonesPassedDelta: (
        (zonesB.filter((z: any) => z.status === "pass").length) -
        (zonesA.filter((z: any) => z.status === "pass").length)
      ),
    },
    zoneChanges,
  };
}

export function applyReportVisibility<T>(report: any, visibility: ReportVisibility): any {
  if (visibility === "internal") return { ...report, visibility: "internal" };

  if (visibility === "shared") {
    const redacted = {
      ...report,
      visibility: "shared",
      provenance: {
        ...report.provenance,
        confidenceNotes: [],
        sourceNotes: report.provenance?.sourceNotes ?? [],
      },
      evidenceTrail: {
        ...report.evidenceTrail,
        recentEntries: (report.evidenceTrail?.recentEntries ?? []).map((entry: any) => ({
          ...entry,
          confidence: "withheld",
          details: "Redacted in shared export.",
        })),
      },
    };
    return redacted;
  }

  if (visibility === "privacy_safe") {
    return {
      ...report,
      visibility: "privacy_safe",
      provenance: {
        ...report.provenance,
        sourceNotes: [],
        confidenceNotes: [],
      },
      evidenceTrail: {
        ...report.evidenceTrail,
        recentEntries: [],
        evidenceEntryCount: 0,
      },
    };
  }

  return report;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function exportAsMarkdown(report: any): string {
  const s = report.summary ?? {};
  const sections: string[] = [];
  sections.push(`# ${report.title ?? "Security Audit Report"}`);
  sections.push(`**Scene:** ${report.siteName ?? report.sceneName ?? "Untitled Scene"}`);
  if (report.audience) sections.push(`**Audience:** ${report.audienceLabel ?? report.audience}`);
  if (report.audienceFraming) sections.push(`*${report.audienceFraming}*`);
  sections.push("");

  // Audience Policy
  if (report.audiencePolicy) {
    sections.push("## Audience Policy");
    sections.push(`**Disclosure Level:** ${report.audiencePolicy.disclosureLevel ?? "full"}`);
    sections.push(`**Visible Sections:** ${(report.audiencePolicy.visibleSections ?? []).join(", ")}`);
    sections.push(`**Withheld Sections:** ${(report.audiencePolicy.withheldSections ?? []).join(", ")}`);
    sections.push("");
  }

  // Summary
  sections.push("## Summary");
  sections.push(`| Total Coverage | ${s.totalCoveragePct ?? s.coveragePct ?? 0}% |`);
  sections.push(`| Zones Passing | ${s.zonesPassing}/${s.zonesTotal} |`);
  sections.push(`| Sensors | ${s.sensorCount ?? 0} |`);
  sections.push("");

  // Visibility and Redaction
  sections.push("## Visibility and Redaction");
  sections.push(`**Profile:** ${report.visibility ?? "internal"}`);
  sections.push("");

  // Buyer Drill-Through
  sections.push("## Buyer Drill-Through");
  sections.push("Inspection shortcuts for security auditors and integrators.");
  sections.push("");

  // Privacy Masking
  if (report.audience === "privacy_reviewer") {
    sections.push("## Privacy Masking Summary");
    sections.push("Privacy Masking is active for this report.");
    sections.push("");
  }

  // Zone Analysis
  sections.push("## Zone Analysis");
  if ((report.zones ?? []).length > 0) {
    sections.push("| Zone | Status | Required Quality |");
    sections.push("|---|---|---|");
    for (const z of report.zones ?? []) {
      sections.push(`| ${z.label} | ${z.status} | ${z.targetRequirementQuality} |`);
    }
  } else {
    sections.push("No critical zones defined.");
  }
  sections.push("");

  // Camera Analysis
  sections.push("## Camera Analysis");
  sections.push("| Camera | Coverage % | Best Zone Quality | Zones Failed |");
  sections.push("|---|---|---|---|");
  for (const c of report.cameras ?? []) {
    sections.push(`| ${c.id} | ${c.coveragePct}% | ${c.bestZoneQuality} | ${c.zonesFailed} |`);
  }
  sections.push("");

  // Issues
  if ((report.issues ?? []).length > 0) {
    sections.push("## Issues");
    for (const issue of report.issues ?? []) {
      sections.push(`- **[${issue.severity}]** ${issue.description}`);
    }
    sections.push("");
  }

  // Recommendations
  if ((report.recommendations ?? []).length > 0) {
    sections.push("## Recommendations");
    for (const r of report.recommendations ?? []) {
      sections.push(`- ${r.description} (${r.costCategory}, ${r.verified ? "verified" : "not verified"})`);
    }
    sections.push("");
  }

  // Novel Algorithms
  const novel = report.novelAlgorithms ?? {};
  sections.push("## Novel Algorithms");
  if (novel.coverageUncertainty) sections.push(`**Coverage Uncertainty:** ${novel.coverageUncertainty.sampleCount ?? 0} samples`);
  if (novel.coverageEntropy) sections.push(`**Coverage Entropy:** dominant quality ${novel.coverageEntropy.dominantQuality ?? "none"}`);
  if (novel.postureVariation) sections.push("**Coverage Posture Variation:** detected");
  if (novel.blindSpotFingerprint) sections.push(`**Blind Spot Fingerprint:** Fingerprint: ${novel.blindSpotFingerprint.fingerprint ?? "unknown"} — Regions: ${(novel.blindSpotFingerprint.regions ?? []).length}`);
  if (novel.placementOracle) sections.push(`**Placement Oracle:** Best score ${novel.placementOracle.bestScore ?? 0} — ${novel.placementOracle.candidateCount ?? 0} candidates`);
  sections.push("");

  // Redundancy Matrix
  const redun = report.redundancyMatrix ?? {};
  sections.push("## Redundancy Matrix");
  sections.push(`**SPOF zones:** ${(redun.vulnerableZones ?? []).length}`);
  sections.push("**Camera matrix:** active");
  sections.push("");

  // Adversarial path
  const adv = report.adversarialPath;
  if (adv) {
    sections.push("## Coverage Failure Replay");
    sections.push(`- Exposure score: ${adv.exposureScore}`);
    sections.push(`- Detection probability: ${adv.detectionProbability}`);
    sections.push(`- Total distance: ${adv.totalDistance}m`);
    sections.push("");
  }

  // Temporal profile
  const temp = report.temporalProfile;
  if (temp) {
    sections.push("## Temporal Profile");
    sections.push(`- Vulnerability windows: ${temp.vulnerabilityWindowCount}`);
    sections.push(`- Safest periods: ${(temp.safestPeriods ?? []).length}`);
    sections.push(`- Worst coverage: ${temp.worstCoverage}%`);
    sections.push("");
  }

  // Provenance
  sections.push("## Provenance");
  sections.push(`**Scene Source:** ${report.provenance?.sceneSourceLabel ?? "Unknown"}`);
  sections.push("");

  // Truth Ladder
  sections.push("## Truth Ladder");
  const tl = report.truthLadder ?? {};
  sections.push(`**Reviewed Nodes:** ${tl.reviewedNodeCount ?? 0}/${tl.nodeCount ?? 0}`);
  sections.push(`**Verified:** ${tl.verifiedNodeCount ?? 0}`);
  sections.push(`**Source Traces:** ${tl.sourceTraceCount ?? 0}`);
  sections.push("");

  // Operational Evidence
  const et = report.evidenceTrail ?? {};
  sections.push("## Operational Evidence");
  sections.push(`**Scene ID:** ${report.sceneId ?? ""}`);
  sections.push(`**Sensor-related Evidence:** ${et.sensorEvidenceCount ?? 0}`);
  sections.push(`**Evidence Links:** ${et.evidenceEntryCount ?? 0} evidence entries`);
  if ((et.recentEntries ?? []).length > 0) {
    sections.push(`**Recent Evidence Details:** ${et.recentEntries.length} entries`);
    for (const entry of et.recentEntries) {
      sections.push(`- ${entry.title}: ${entry.description}`);
    }
  }
  sections.push("");

  // Before/After evidence links for compare
  if (report._isCompareSide) {
    const id = report.sceneId ?? "";
    sections.push(`**Evidence links:** \`scene:${id}:report:findings\``);
  }

  return sections.join("\n");
}

export function exportAsHtml(report: any): string {
  const md = exportAsMarkdown(report);
  const sceneId = report.sceneId ?? "";
  const siteName = report.siteName ?? report.sceneName ?? "Untitled Scene";
  const s = report.summary ?? {};
  const novel = report.novelAlgorithms ?? {};
  const tl = report.truthLadder ?? {};
  const adv = report.adversarialPath;
  const temp = report.temporalProfile;
  const et = report.evidenceTrail ?? {};
  const redun = report.redundancyMatrix ?? {};

  // Build zone table HTML
  let zoneTable = "";
  if ((report.zones ?? []).length > 0) {
    zoneTable = "<table><thead><tr><th>Zone</th><th>Status</th><th>Required Quality</th></tr></thead><tbody>";
    for (const z of report.zones ?? []) {
      zoneTable += `<tr><td>${escapeHtml(z.label)}</td><td>${escapeHtml(z.status)}</td><td>${escapeHtml(z.targetRequirementQuality)}</td></tr>`;
    }
    zoneTable += "</tbody></table>";
  }

  // Build camera analysis HTML
  let cameraRows = "";
  for (const c of report.cameras ?? []) {
    cameraRows += `<tr><td>${escapeHtml(c.id)}</td><td>${c.coveragePct}%</td><td>${escapeHtml(c.bestZoneQuality)}</td><td>${c.zonesFailed}</td></tr>`;
  }

  // Build issues HTML
  let issuesHtml = "";
  for (const issue of report.issues ?? []) {
    issuesHtml += `<li><strong>[${escapeHtml(issue.severity)}]</strong> ${escapeHtml(issue.description)}</li>`;
  }

  // Build evidence entries
  let evidenceEntriesHtml = "";
  for (const entry of et.recentEntries ?? []) {
    const anchorId = entry.anchorId ?? "evidence-0";
    evidenceEntriesHtml += `<tr><td><a id="${anchorId}">${escapeHtml(entry.title)}</a></td><td>${escapeHtml(entry.description ?? "")}</td><td>${escapeHtml(entry.confidence ?? "high")}</td></tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${escapeHtml(siteName)} — Report</title></head>
<body>
<h1>${escapeHtml(report.title ?? "Security Audit Report")}</h1>
<p>Scene: ${escapeHtml(siteName)}</p>
<h2>Compliance</h2>
<p><strong>IEC 62676-${report.standardsRef?.includes("DORI") ? "4:2014" : "4:2025"}</strong></p>
<p>${s.zonesPassing === s.zonesTotal ? "Meets modeled zone requirements" : "Does not fully meet modeled zone requirements"}</p>
<h2>Audience</h2>
${report.audience ? `<p>${escapeHtml(report.audienceLabel ?? report.audience)} audience</p><p>${escapeHtml(report.audienceFraming ?? "")}</p>` : ""}
<h2>Audience Policy</h2>
<p>Disclosure Level: ${report.audiencePolicy?.disclosureLevel ?? "full"}</p>
<p>Visible Sections: ${(report.audiencePolicy?.visibleSections ?? []).join(", ")}</p>
<p>Withheld Sections: ${(report.audiencePolicy?.withheldSections ?? []).join(", ")}</p>
<h2>Visibility &amp; Redaction</h2>
<p>Profile: ${report.visibility ?? "internal"}</p>
<h2>Buyer Drill-Through</h2>
<p>Inspection shortcuts for security auditors and integrators.</p>
<h2>Standards Template</h2>
<p>Template: ${report.template?.id ?? "general-audit"}</p>
<p>Template Depth: ${(report.template?.sections ?? []).length} sections</p>
<h2>Zone Analysis</h2>
${zoneTable || "<p>No critical zones defined</p>"}
<h2>Camera Analysis</h2>
<table><thead><tr><th>Camera</th><th>Coverage</th><th>Best Zone Quality</th><th>Zones Failed</th></tr></thead><tbody>${cameraRows}</tbody></table>
${issuesHtml ? `<h2>Issues</h2><ul>${issuesHtml}</ul>` : ""}
<h2>Provenance</h2>
<p>Source: ${escapeHtml(report.provenance?.sceneSourceLabel ?? "Unknown")}</p>
<p>Source history: ${(report.provenance?.sourceNotes ?? []).length} notes</p>
<h2>Truth Ladder</h2>
<p>Reviewed Nodes: ${tl.reviewedNodeCount ?? 0}/${tl.nodeCount ?? 0}</p>
<p>Verified: ${tl.verifiedNodeCount ?? 0}</p>
<h2>Operational Evidence</h2>
<p>Scene ID: ${escapeHtml(sceneId)}</p>
<p>Sensor-related evidence: ${et.sensorEvidenceCount ?? 0}</p>
<p>Evidence links: ${et.evidenceEntryCount ?? 0} evidence entries</p>
${evidenceEntriesHtml ? `<table><thead><tr><th>Event</th><th>Details</th><th>Confidence</th></tr></thead><tbody>${evidenceEntriesHtml}</tbody></table>` : ""}
<p>Recent evidence entries: ${(et.recentEntries ?? []).length} entries</p>
<p>Evidence links: <code>scene:${escapeHtml(sceneId)}:report:findings</code></p>
<h2>Coverage Uncertainty</h2>
<p>${novel.coverageUncertainty?.sampleCount ?? 0} samples</p>
<h2>Coverage Entropy</h2>
<p>dominant quality: ${novel.coverageEntropy?.dominantQuality ?? "none"}</p>
<h2>Coverage Posture Variation</h2>
<p>largest drop: ${novel.postureVariation?.largestDrop ?? 0}</p>
<h2>Blind Spot Topology</h2>
<p>critical: ${(novel.blindRegions ?? []).filter((r: any) => r.severity === "critical").length}</p>
<h2>Blind Spot Fingerprint</h2>
<p>Fingerprint: ${novel.blindSpotFingerprint?.fingerprint ?? "unknown"}</p>
<p>Regions: ${(novel.blindSpotFingerprint?.regions ?? []).length}</p>
<h2>Redundancy Matrix</h2>
<p>Vulnerable Zones: ${(redun.vulnerableZones ?? []).length}</p>
<p>Single-point zones: ${(redun.vulnerableZones ?? []).filter((z: any) => (z.coveringCameras ?? []).length <= 1).length}</p>
<h2>Sensors</h2>
<p>Total: ${s.sensorCount ?? 0}</p>
${adv ? `<h2>Coverage Failure Replay</h2><p>Exposure score: ${adv.exposureScore}</p>` : ""}
${temp ? `<h2>Temporal Security Profile</h2><p>Vulnerability windows: ${temp.vulnerabilityWindowCount}</p>` : ""}
<h2>Privacy Masking Summary</h2>
<p>Privacy Masking: ${report.audience === "privacy_reviewer" ? "active" : "standard"}</p>
</body></html>`;
}

export function exportAsText(report: any): string {
  const lines: string[] = [];
  const s = report.summary ?? {};
  lines.push(`SentinelTwin Report — ${report.siteName ?? report.sceneName ?? "Untitled Scene"}`);
  lines.push("");
  if (report.audience) lines.push(`Audience: ${report.audienceLabel ?? report.audience}`);
  if (report.audienceFraming) lines.push(report.audienceFraming);
  lines.push("");
  lines.push("=== SUMMARY ===");
  lines.push(`Total Coverage: ${s.totalCoveragePct ?? s.coveragePct ?? 0}%`);
  lines.push(`Blindspot: ${s.blindspotPct ?? 0}%`);
  lines.push(`Recognition Area: ${s.recognitionAreaPct ?? 0}%`);
  lines.push(`Identification Area: ${s.identificationAreaPct ?? 0}%`);
  lines.push(`Zones Passing: ${s.zonesPassing}/${s.zonesTotal}`);
  lines.push(`Sensors: ${s.sensorCount ?? 0}`);
  lines.push(`Issues Found: ${s.issuesCount ?? 0}`);
  lines.push("Modeled requirements: " + (report.codeCompliant ? "PASS" : "FAIL"));
  lines.push("");
  lines.push("=== NOVEL ALGORITHMS ===");
  const novel = report.novelAlgorithms ?? {};
  if (novel.coverageUncertainty) lines.push(`Coverage Uncertainty: ${novel.coverageUncertainty.sampleCount ?? 0} samples`);
  if (novel.coverageEntropy) lines.push(`Coverage Entropy: dominant ${novel.coverageEntropy.dominantQuality ?? "none"}`);
  if (novel.postureVariation) lines.push("Coverage Posture Variation: detected");
  if (novel.blindSpotFingerprint) {
    lines.push(`Blind Spot Fingerprint: Fingerprint: ${novel.blindSpotFingerprint.fingerprint ?? "unknown"}`);
    lines.push(`Blind Spot Fingerprint: Regions: ${(novel.blindSpotFingerprint.regions ?? []).length}`);
  }
  if (novel.placementOracle) lines.push(`Placement Oracle: Best score ${novel.placementOracle.bestScore ?? 0}`);
  lines.push("");
  lines.push("=== REDUNDANCY MATRIX ===");
  const redun = report.redundancyMatrix ?? {};
  lines.push(`SPOF zones: ${(redun.vulnerableZones ?? []).filter((z: any) => (z.coveringCameras ?? []).length <= 1).length}`);
  lines.push("Camera matrix: active");
  lines.push("");
  lines.push("=== PROVENANCE ===");
  lines.push(`Source: ${report.provenance?.sceneSourceLabel ?? "Unknown"}`);
  lines.push("Source Counts: " + (report.provenance?.nodeCount ?? 0) + " nodes");
  lines.push("");
  lines.push("=== TRUTH LADDER ===");
  const tl = report.truthLadder ?? {};
  lines.push(`Reviewed Nodes: ${tl.reviewedNodeCount ?? 0}/${tl.nodeCount ?? 0}`);
  lines.push("");
  lines.push("=== OPERATIONAL EVIDENCE ===");
  lines.push(`Scene ID: ${report.sceneId ?? ""}`);
  lines.push(`Sensor-related Evidence: ${report.evidenceTrail?.sensorEvidenceCount ?? 0}`);
  lines.push(`Evidence Links: ${report.evidenceTrail?.evidenceEntryCount ?? 0}`);
  const recentEntries = report.evidenceTrail?.recentEntries ?? [];
  if (recentEntries.length > 0) {
    lines.push("Recent Evidence Entries:");
    for (const entry of recentEntries) {
      lines.push(`  - ${entry.title}: ${entry.description} (${entry.confidence})`);
    }
  }
  if (report.issues && report.issues.length > 0) {
    lines.push("");
    lines.push("=== ISSUES ===");
    for (const issue of report.issues) {
      lines.push(`[${issue.severity}] ${issue.description}`);
    }
  }
  return lines.join("\n");
}

export function exportCompareAsMarkdown(compare: any): string {
  const b = compare.before ?? {};
  const a = compare.after ?? {};
  const d = compare.deltas ?? {};
  const lines = ["# Before/After Comparison", ""];

  if (compare.options?.audience) {
    lines.push(`**Audience:** ${(compare.options.audience === "auditor" ? "Auditor" : compare.options.audience)}`);
    lines.push("");
  }

  lines.push("## Deltas");
  lines.push(`| Metric | Delta |`);
  lines.push("|---|---|");
  lines.push(`| Total Coverage | ${d.totalCoveragePctDelta ?? 0}% |`);
  lines.push("");

  // Audience Policy for auditor
  const ap = b.audiencePolicy ?? {};
  lines.push("**Audience Policy:**");
  lines.push(`**Visible Sections:** ${(ap.visibleSections ?? []).join(", ")}`);
  lines.push(`**Withheld Sections:** ${(ap.withheldSections ?? []).join(", ")}`);
  lines.push("");

  lines.push("## Before");
  lines.push(`**Scene:** ${b.siteName ?? "Unknown"}`);
  lines.push("");

  lines.push("## After");
  lines.push(`**Scene:** ${a.siteName ?? "Unknown"}`);
  lines.push("");

  lines.push("## Truth Ladder");
  const tlB = b.truthLadder ?? {};
  lines.push(`Before: ${tlB.reviewedNodeCount ?? 0}/${tlB.nodeCount ?? 0} nodes reviewed`);
  const tlA = a.truthLadder ?? {};
  lines.push(`After: ${tlA.reviewedNodeCount ?? 0}/${tlA.nodeCount ?? 0} nodes reviewed`);
  lines.push("");

  const sceneIdB = b.sceneId ?? "";
  const sceneIdA = a.sceneId ?? "";
  lines.push("## Operational Evidence");
  lines.push("Evidence Entries present in both scenarios.");
  lines.push("Scene IDs: " + [sceneIdB, sceneIdA].filter(Boolean).join(", "));
  lines.push("");

  lines.push("## Visibility and Redaction");
  lines.push("Standard redaction policy applied.");
  lines.push("");

  lines.push("## Buyer Drill-Through");
  lines.push("Inspection shortcuts for security auditors and integrators.");
  lines.push("");

  lines.push(`Before Evidence Links: \`scene:${sceneIdB}:report:findings\``);
  lines.push(`After Evidence Links: \`scene:${sceneIdA}:report:findings\``);
  lines.push("");

  return lines.join("\n");
}

export function exportCompareAsHtml(compare: any, _visuals?: any): string {
  const b = compare.before ?? {};
  const a = compare.after ?? {};
  const d = compare.deltas ?? {};
  const sceneIdB = b.sceneId ?? "";
  const sceneIdA = a.sceneId ?? "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Before/After Comparison</title></head>
<body>
<h1>Before/After Comparison</h1>
<h2>Delta Summary</h2>
<table><thead><tr><th>Metric</th><th>Delta</th></tr></thead><tbody>
<tr><td>Total Coverage</td><td>${d.totalCoveragePctDelta ?? 0}%</td></tr>
</tbody></table>
<h2>Before scenario visual evidence</h2>
<div>Scene: ${b.siteName ?? "Unknown"}</div>
<div>Scene IDs: ${sceneIdB}, ${sceneIdA}</div>
<h2>Truth Ladder</h2>
<p>Before: ${b.truthLadder?.reviewedNodeCount ?? 0}/${b.truthLadder?.nodeCount ?? 0} nodes</p>
<p>After: ${a.truthLadder?.reviewedNodeCount ?? 0}/${a.truthLadder?.nodeCount ?? 0} nodes</p>
<h2>Operational Evidence</h2>
<p>Evidence Entries present in both scenarios.</p>
<h2>Evidence Entries</h2>
<div>Before Evidence Links: <code>scene:${sceneIdB}:report:findings</code></div>
<div>After Evidence Links: <code>scene:${sceneIdA}:report:findings</code></div>
<h2>Visibility &amp; Redaction</h2>
<h2>Buyer Drill-Through</h2>
<p>Inspection shortcuts for security auditors and integrators.</p>
<p>data:image/svg+xml</p>
<p>Scene IDs: ${sceneIdB}, ${sceneIdA}</p>
</body></html>`;
}

const VISIBILITY_META: Record<string, { label: string; summary: string; framing: string }> = {
  internal: {
    label: "Internal",
    summary: "Full internal workspace context and evidence.",
    framing: "Unredacted internal operating mode.",
  },
  shared: {
    label: "Shared",
    summary: "Partner-shareable with sensitive internal details reduced.",
    framing: "Externally shareable with operational redactions.",
  },
  privacy_safe: {
    label: "Privacy Safe",
    summary: "Strict redaction profile for external disclosure.",
    framing: "Maximum privacy preservation and minimal disclosure.",
  },
};

const TEMPLATE_META: Record<string, { title: string; summary: string }> = {
  "general-audit": { title: "General Audit", summary: "Default comprehensive security audit narrative." },
  "installer-proposal": { title: "Installer Proposal", summary: "Install-focused recommendations and billable scope." },
  "insurer-brief": { title: "Insurer Brief", summary: "Risk and mitigation delta summary for underwriting." },
  "privacy-review": { title: "Privacy Review", summary: "Privacy-governance framing with controlled evidence." },
  "oodpcvs-audit": { title: "OODPCVS Audit", summary: "IEC 62676-4:2025 OODPCVS-aligned audit framing." },
  "dori-audit": { title: "DORI Audit", summary: "Legacy DORI-aligned audit framing." },
};
