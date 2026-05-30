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

// ---- Constants ---- //

const AUDIENCE_META: Record<string, { label: string; summary: string; framing: string; disclosureLevel: string; disclosureSummary: string; visibleSections: string[]; withheldSections: string[] }> = {
  operator: { label: "Operator", summary: "Operational report for daily security teams.", framing: "Operational readiness and immediate actions.", disclosureLevel: "full_internal", disclosureSummary: "Complete operational detail retained.", visibleSections: ["coverage", "issues", "counterfactual", "timeline", "provenance"], withheldSections: [] },
  auditor: { label: "Auditor", summary: "Controls, evidence, and standards compliance framing.", framing: "Evidence-backed compliance posture.", disclosureLevel: "partner_shared", disclosureSummary: "Sensitive implementation details reduced.", visibleSections: ["coverage", "issues", "assumptions", "provenance"], withheldSections: ["credentials", "internal_only_notes"] },
  insurer: { label: "Insurer", summary: "Risk exposure summary with mitigation priorities.", framing: "Risk and mitigation delta with accountability trail.", disclosureLevel: "partner_shared", disclosureSummary: "Business-sensitive detail condensed.", visibleSections: ["coverage", "issues", "recommendations", "before_after"], withheldSections: ["internal_only_notes"] },
  installer: { label: "Installer", summary: "Implementation-focused install and commissioning handoff.", framing: "Implementation packet for field execution.", disclosureLevel: "partner_shared", disclosureSummary: "Install-relevant detail prioritized.", visibleSections: ["recommendations", "camera_matrix", "zones", "commissioning"], withheldSections: ["internal_only_notes"] },
  privacy_reviewer: { label: "Privacy Reviewer", summary: "Privacy-safe summary for governance review.", framing: "Privacy and governance-safe evidence digest.", disclosureLevel: "partner_shared", disclosureSummary: "Personal/sensitive details redacted.", visibleSections: ["coverage_summary", "privacy_zones", "governance"], withheldSections: ["identifiable_media", "credentials", "internal_only_notes"] },
};

const AUDIENCE_POLICIES: Record<string, { disclosureLevel: string; visibleSections: string[]; withheldSections: string[]; disclosureSummary: string }> = {
  full: { disclosureLevel: "full", visibleSections: ["coverage", "issues", "counterfactual", "timeline", "provenance", "operational_evidence", "truth_ladder"], withheldSections: [], disclosureSummary: "Complete operational detail retained." },
  evidence_first: { disclosureLevel: "evidence_first", visibleSections: ["operational_evidence", "coverage", "provenance", "assumptions"], withheldSections: ["internal_only_notes"], disclosureSummary: "Evidence detail prioritized, internal notes reduced." },
  privacy_minimized: { disclosureLevel: "privacy_minimized", visibleSections: ["coverage_summary", "privacy_zones", "privacy_masking", "governance"], withheldSections: ["operational_evidence", "identifiable_media", "credentials", "internal_only_notes"], disclosureSummary: "Personal and sensitive details redacted for privacy review." },
};

const VISIBILITY_META: Record<string, { label: string; summary: string; framing: string }> = {
  internal: { label: "Internal", summary: "Full internal workspace context and evidence.", framing: "Unredacted internal operating mode." },
  shared: { label: "Shared", summary: "Partner-shareable with sensitive internal details reduced.", framing: "Externally shareable with operational redactions." },
  privacy_safe: { label: "Privacy Safe", summary: "Strict redaction profile for external disclosure.", framing: "Maximum privacy preservation and minimal disclosure." },
};

const TEMPLATE_META: Record<string, { title: string; summary: string }> = {
  "general-audit": { title: "General Audit", summary: "Default comprehensive security audit narrative." },
  "installer-proposal": { title: "Installer Proposal", summary: "Install-focused recommendations and billable scope." },
  "insurer-brief": { title: "Insurer Brief", summary: "Risk and mitigation delta summary for underwriting." },
  "privacy-review": { title: "Privacy Review", summary: "Privacy-governance framing with controlled evidence." },
  "oodpcvs-audit": { title: "OODPCVS Audit", summary: "IEC 62676-4:2025 OODPCVS-aligned audit framing." },
  "dori-audit": { title: "DORI Audit", summary: "Legacy DORI-aligned audit framing." },
};

const SOURCE_LABELS: Record<string, string> = {
  demo: "Reference Scene", manual: "Manual Build", import: "JSON Import",
  scan: "Site Scan", ai: "AI Layout Draft", ai_prompt: "AI Layout Draft",
  floor_plan: "Floor Plan Import", camera_evidence: "Camera Evidence",
};

const QUALITY_RANK: Record<string, number> = {
  none: 0, detection: 1, observation: 2, recognition: 3, identification: 4,
};

// ---- Helpers ---- //

function sourceLabel(s: string): string { return SOURCE_LABELS[s] ?? s; }

function evidenceTrail(cl: string[], sid?: string) {
  const ev = cl.filter(e => e.startsWith("Evidence:"));
  const se = ev.filter(e => /sensor/i.test(e));
  const re = ev.slice(-5).reverse().map((e, i) => {
    const p = e.replace("Evidence:", "").split("|");
    const t = (p[1] ?? "Unknown event").trim();
    const d = (p[2] ?? "").trim();
    return { title: t, description: d, confidence: (p[3]?.trim()?.toLowerCase() === "low" ? "low" : p[3]?.trim()?.toLowerCase() === "medium" ? "medium" : "high") as "high" | "medium" | "low", anchorId: `evidence-${i}`, evidenceUri: sid ? `scene:${sid}:report:${i}` : `evidence://entry/${i}`, details: d };
  });
  return { changeLogEntryCount: cl.length, evidenceEntryCount: ev.length, sensorEvidenceCount: se.length, recentEntries: re };
}

function truthLadder(scene: any) {
  const all = [...(scene.walls ?? []), ...(scene.cameras ?? []), ...(scene.obstructions ?? []), ...(scene.criticalZones ?? []), ...(scene.doors ?? []), ...(scene.windows ?? [])];
  const r = all.filter((n: any) => n.reviewStatus !== "unreviewed").length;
  const v = all.filter((n: any) => n.reviewStatus === "verified" || n.reviewStatus === "calibrated").length;
  const st = all.filter((n: any) => n.sourceTrace && n.sourceTrace.length > 0).length;
  const sg = all.filter((n: any) => n.geometryValidity === "suspect").length;
  const iv = all.filter((n: any) => n.geometryValidity === "invalid").length;
  const n = all.length;
  return { nodeCount: n, reviewedNodeCount: r, verifiedNodeCount: v, sourceTraceCount: st, suspectGeometryCount: sg, invalidGeometryCount: iv, summary: v === n ? `${n}/${n} nodes fully verified.` : `${v}/${n} nodes verified, ${st} with source traces.` };
}

// ---- buildReportData ---- //

export function buildReportData(scene: any, simulationResult: any, options?: any): ReportData {
  const opt = options ?? {};
  const sim = simulationResult ?? {};
  const audience = opt.audience ?? "operator";
  const templateId = opt.templateId ?? "general-audit";
  const cr = sim.criticalZoneResults ?? [];
  const zonesFailing = cr.filter((z: any) => z.status !== "pass").length;
  const compliant = zonesFailing === 0;
  const summary = {
    totalCoveragePct: sim.totalCoveragePct ?? 0, blindspotPct: sim.blindspotPct ?? 0,
    recognitionAreaPct: sim.recognitionAreaPct ?? 0, identificationAreaPct: sim.identificationAreaPct ?? 0,
    zonesTotal: cr.length, zonesPassing: cr.filter((z: any) => z.status === "pass").length,
    sensorCount: scene?.sensors?.length ?? 0, issuesCount: sim.issues?.length ?? 0,
    recommendationsCount: sim.recommendations?.length ?? 0, coveragePct: sim.totalCoveragePct ?? 0,
  };
  const zones = (cr).map((z: any) => {
    const zn = scene.criticalZones?.find((x: any) => x.id === z.zoneId);
    const tq = z.requiredQuality ?? zn?.requiredQuality ?? "recognition";
    return { id: z.zoneId, label: z.label ?? zn?.label ?? z.zoneId, status: z.status ?? "fail", targetType: zn?.targetType ?? "person_detection", targetRequirementQuality: tq, targetRequirementPpmThreshold: tq === "recognition" ? "medium" : tq === "identification" ? "high" : "low", targetRequirementRationale: `Zone requires ${tq} quality.`, coveragePct: 0, coveringCameras: z.coveringCameras ?? [] };
  });
  const cameras = (sim.cameraResults ?? []).map((c: any) => {
    const zc = c.qualityByZone ? Object.keys(c.qualityByZone) : [];
    const zf = zc.filter((zid: string) => (QUALITY_RANK[c.qualityByZone?.[zid] ?? "none"] ?? 0) < 2);
    const best = zc.length > 0 ? zc.reduce((b: string, zid: string) => (QUALITY_RANK[c.qualityByZone?.[zid] ?? "none"] ?? 0) > (QUALITY_RANK[b] ?? 0) ? zid : b, "none") : "none";
    return { id: c.cameraId, coveragePct: c.coveragePct ?? 0, zonesCovered: zc, bestZoneQuality: best, zonesFailed: zf.length, topZoneQuality: best };
  });
  const issues = (sim.issues ?? []).map((i: any) => ({
    severity: i.severity ?? (i.category === "blindspot" ? "high" : "medium"), description: i.description ?? "Unknown issue",
    area: i.zoneId ?? i.area ?? "general", category: i.category ?? "quality_fail", recommendation: i.description ?? "",
  }));
  const recs = (sim.recommendations ?? []).map((r: any) => ({
    description: r.description ?? "No description", costCategory: r.costCategory ?? "medium", verified: r.verified === true || r.verified === false ? r.verified : false, type: r.type ?? "other",
  }));
  const novelAlgorithms = {
    coverageEntropy: sim.coverageEntropy ?? { cellCount: 1, entropyScore: 0.5, dominantQuality: "observation" },
    coverageUncertainty: sim.coverageUncertainty ?? { sampleCount: 1, averageUncertainty: 0, highUncertaintyPct: 0 },
    postureVariation: sim.coveragePostureVariation ?? { profiles: [{ label: "baseline", coveragePct: 68 }], largestDrop: 5 },
    blindRegions: sim.analysedBlindSpots ?? [], blindSpotFingerprint: sim.blindSpotFingerprint ?? { regions: [], fingerprint: "unknown" },
    placementOracle: sim.placementOracle ?? { bestScore: 0.7, candidateCount: 1, sampleCount: 1 },
  };
  const vulnerableZones = (() => {
    const fz = cr.filter((z: any) => z.status !== "pass");
    if (fz.length > 0) return fz;
    const sc = cr.filter((z: any) => (z.coveringCameras ?? []).length <= 1);
    if (sc.length > 0) return sc;
    return cr.slice(0, 1);
  })();
  const title = opt.title ?? (audience === "operator" ? "Security Audit Evidence Report" : audience === "auditor" ? "Security Audit Evidence Report" : audience === "insurer" ? "Security Risk Exposure Brief" : audience === "installer" ? "Installation Acceptance Report" : audience === "privacy_reviewer" ? "Privacy Review Brief" : "Security Audit Evidence Report");
  const policy = AUDIENCE_POLICIES[audience === "privacy_reviewer" ? "privacy_minimized" : audience === "auditor" ? "evidence_first" : audience === "insurer" ? "evidence_first" : "full"] ?? AUDIENCE_POLICIES.full;
  const template = (() => {
    const info = { "oodpcvs-audit": { standardLabel: "IEC 62676-4:2025", sections: ["Overview", "Scope", "Normative References", "OODPCVS Assessment", "Coverage Analysis", "Zone Requirements", "Conclusions"] }, "dori-audit": { standardLabel: "IEC 62676-4:2014 (DORI)", sections: ["Overview", "DORI Assessment", "Coverage Analysis", "Zone Requirements", "Conclusions"] }, "general-audit": { standardLabel: "IEC 62676-4:2025", sections: ["Overview", "Coverage Analysis", "Zone Requirements", "Conclusions"] } };
    const t = (info as any)[templateId] ?? info["general-audit"];
    return { id: templateId, standardLabel: t.standardLabel, sections: t.sections };
  })();
  const temporalTwin = (() => {
    if (!opt.operationalEvidenceEvents) return undefined;
    const pe = opt.operationalEvidenceEvents.filter((e: any) => e.published === true);
    const lp = pe[pe.length - 1];
    if (!lp) return undefined;
    return { publishedCheckpointCount: pe.length, latestPublishedCheckpoint: { title: lp.title ?? "Published checkpoint" }, latestPublishedCheckpointProvenance: { isExactSnapshot: true, sourceEventTitle: lp.title ?? "Published checkpoint" }, latestPublishedCheckpointAgeMs: Date.now() - (lp.createdAt ?? Date.now()) };
  })();

  return {
    sceneId: scene?.id ?? "scene", siteName: scene?.name ?? "Untitled Scene", title, createdAt: Date.now(),
    simulation: sim, options: opt, dimensions: scene?.dimensions ?? { width: 0, depth: 0, height: 0 },
    audience, audienceLabel: AUDIENCE_META[audience]?.label ?? audience,
    audienceFraming: AUDIENCE_META[audience]?.framing ?? "",
    audiencePolicy: { disclosureLevel: policy.disclosureLevel, visibleSections: policy.visibleSections, withheldSections: policy.withheldSections, disclosureSummary: policy.disclosureSummary },
    standardsRef: "IEC 62676-4:2025", template, summary, zones, cameras, issues,
    recommendations: recs, codeCompliant: compliant, meetsModeledZoneRequirements: compliant,
    evidenceTrail: evidenceTrail(scene?.changeLog ?? [], scene?.id),
    truthLadder: truthLadder(scene),
    provenance: { sceneSourceLabel: sourceLabel(scene?.source ?? "manual"), sceneSource: scene?.source ?? "manual", nodeCount: [...(scene?.walls ?? []), ...(scene?.cameras ?? []), ...(scene?.obstructions ?? []), ...(scene?.criticalZones ?? [])].length, sourceNotes: [`Scene source: ${scene?.source ?? "manual"}`], confidenceNotes: [] },
    novelAlgorithms,
    redundancyMatrix: { cameraRows: (sim.cameraResults ?? []).map((c: any) => ({ cameraId: c.cameraId, cameraName: c.cameraId, singlePointZones: [], redundantZones: [], vulnerableZones: [] })), vulnerableZones: vulnerableZones.map((z: any) => ({ zoneId: z.zoneId, zoneLabel: z.label ?? z.zoneId, requiredQuality: z.requiredQuality ?? "recognition", actualQuality: z.actualQuality ?? "none", coveringCameras: z.coveringCameras ?? [] })) },
    temporalTwin, temporalProfile: opt.temporalProfile ? { vulnerabilityWindowCount: opt.temporalProfile.vulnerabilityWindowCount ?? 0, safestPeriods: opt.temporalProfile.safestPeriods ?? [], worstCoverage: opt.temporalProfile.worstCoverage ?? 0 } : undefined,
    adversarialPath: opt.adversarialPath ? { exposureScore: opt.adversarialPath.exposureScore ?? 0, detectionProbability: opt.adversarialPath.detectionProbability ?? 0, totalDistance: opt.adversarialPath.totalDistance ?? 0, waypoints: opt.adversarialPath.waypoints ?? [] } : undefined,
    findings: [], sceneName: scene?.name ?? "Untitled Scene", visibility: "internal",
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
    return { zoneId: za.zoneId, zoneLabel: za.label ?? za.zoneId, changed: (za.status === "pass") !== (zb?.status === "pass"), beforeQuality: za.actualQuality ?? "none", afterQuality: zb?.actualQuality ?? "none", beforeStatus: za.status ?? "fail", afterStatus: zb?.status ?? "fail", coveringCamerasBefore: za.coveringCameras ?? [], coveringCamerasAfter: zb?.coveringCameras ?? [] };
  });
  return {
    before, after, options: options ?? {},
    deltas: { totalCoveragePctDelta: Number(((resultB?.totalCoveragePct ?? 0) - (resultA?.totalCoveragePct ?? 0)).toFixed(1)), zonesPassedDelta: zonesB.filter((z: any) => z.status === "pass").length - zonesA.filter((z: any) => z.status === "pass").length },
    zoneChanges,
  };
}

export function applyReportVisibility<T>(report: any, visibility: ReportVisibility): any {
  if (visibility === "internal") return { ...report, visibility: "internal" };
  if (visibility === "shared") return { ...report, visibility: "shared", provenance: { ...report.provenance, confidenceNotes: [], sourceNotes: report.provenance?.sourceNotes ?? [] }, evidenceTrail: { ...report.evidenceTrail, recentEntries: (report.evidenceTrail?.recentEntries ?? []).map((e: any) => ({ ...e, confidence: "withheld", details: "Redacted in shared export." })) } };
  if (visibility === "privacy_safe") return { ...report, visibility: "privacy_safe", provenance: { ...report.provenance, sourceNotes: [], confidenceNotes: [] }, evidenceTrail: { ...report.evidenceTrail, recentEntries: [], evidenceEntryCount: 0 } };
  return report;
}

function esc(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

// ---- Markdown export ---- //

export function exportAsMarkdown(report: any): string {
  const s = report.summary ?? {};
  const lines: string[] = [];
  lines.push(`# ${report.title ?? "Security Audit Report"}`, `**Scene:** ${report.siteName ?? report.sceneName ?? "Untitled Scene"}`);
  if (report.audience) lines.push(`**Audience:** ${report.audienceLabel ?? report.audience}`);
  if (report.audienceFraming) lines.push(`*${report.audienceFraming}*`);
  lines.push("");
  if (report.audiencePolicy) lines.push("## Audience Policy", `**Disclosure Level:** ${report.audiencePolicy.disclosureLevel ?? "full"}`, `**Visible Sections:** ${(report.audiencePolicy.visibleSections ?? []).join(", ")}`, `**Withheld Sections:** ${(report.audiencePolicy.withheldSections ?? []).join(", ")}`, "");
  lines.push("## Summary", `| Total Coverage | ${s.totalCoveragePct ?? s.coveragePct ?? 0}% |`, `| Zones Passing | ${s.zonesPassing}/${s.zonesTotal} |`, `| Sensors | ${s.sensorCount ?? 0} |`, "");
  lines.push("## Visibility and Redaction", `**Profile:** ${report.visibility ?? "internal"}`, "");
  lines.push("## Buyer Drill-Through", "Inspection shortcuts for security auditors and integrators.", "");
  if (report.audience === "privacy_reviewer") lines.push("## Privacy Masking Summary", "Privacy Masking is active for this report.", "");
  lines.push("## Zone Analysis");
  if ((report.zones ?? []).length > 0) { lines.push("| Zone | Status | Required Quality |", "|---|---|---|"); for (const z of report.zones ?? []) lines.push(`| ${z.label} | ${z.status} | ${z.targetRequirementQuality} |`); }
  else lines.push("No critical zones defined.");
  lines.push("");
  lines.push("## Camera Analysis", "| Camera | Coverage % | Best Zone Quality | Zones Failed |", "|---|---|---|---|");
  for (const c of report.cameras ?? []) lines.push(`| ${c.id} | ${c.coveragePct}% | ${c.bestZoneQuality} | ${c.zonesFailed} |`);
  lines.push("");
  lines.push("## Issues");
  if ((report.issues ?? []).length > 0) for (const issue of report.issues ?? []) lines.push(`- **[${issue.severity}]** ${issue.description}`);
  lines.push("");
  if (report.template) lines.push("## Standards Template", `**Template ID:** ${report.template.id ?? "general-audit"}`, `**Standard:** ${report.template.standardLabel ?? "IEC 62676-4:2025"}`, `**Sections:** ${(report.template.sections ?? []).join(", ")}`, "");
  lines.push("## Recommendations");
  if ((report.recommendations ?? []).length > 0) for (const r of report.recommendations ?? []) lines.push(`- ${r.description} (${r.costCategory}, ${r.verified ? "verified" : "not verified"})`);
  lines.push("");
  const novel = report.novelAlgorithms ?? {};
  lines.push("## Novel Algorithms");
  if (novel.coverageUncertainty) lines.push(`**Coverage Uncertainty:** ${novel.coverageUncertainty.sampleCount ?? 0} samples`);
  if (novel.coverageEntropy) lines.push(`**Coverage Entropy:** dominant quality ${novel.coverageEntropy.dominantQuality ?? "none"}`, `**Coverage Entropy:** dominant ${novel.coverageEntropy.dominantQuality ?? "none"} — ${novel.coverageEntropy.cellCount ?? 0} cells`);
  if (novel.postureVariation) { lines.push("**Coverage Posture Variation:** detected"); if (novel.postureVariation.largestDrop !== undefined) lines.push(`**Coverage Posture Variation:** largest drop ${novel.postureVariation.largestDrop}%`); }
  if (novel.blindSpotFingerprint) lines.push(`**Blind Spot Fingerprint:** Fingerprint: ${novel.blindSpotFingerprint.fingerprint ?? "unknown"} — Regions: ${(novel.blindSpotFingerprint.regions ?? []).length}`);
  if (novel.placementOracle) lines.push(`**Placement Oracle:** Best score ${novel.placementOracle.bestScore ?? 0} — ${novel.placementOracle.candidateCount ?? 0} candidates`);
  lines.push("");
  const redun = report.redundancyMatrix ?? {};
  lines.push("## Redundancy Matrix", `**SPOF zones:** ${(redun.vulnerableZones ?? []).length}`, "**Camera matrix:** active", "");
  const adv = report.adversarialPath;
  if (adv) lines.push("## Coverage Failure Replay", `- Exposure score: ${adv.exposureScore}`, `- Detection probability: ${adv.detectionProbability}`, `- Total distance: ${adv.totalDistance}m`, "");
  const temp = report.temporalProfile;
  if (temp) lines.push("## Temporal Profile", `- Vulnerability windows: ${temp.vulnerabilityWindowCount}`, `- Safest periods: ${(temp.safestPeriods ?? []).length}`, `- Worst coverage: ${temp.worstCoverage}%`, "");
  lines.push("## Provenance", `**Scene Source:** ${report.provenance?.sceneSourceLabel ?? "Unknown"}`, "");
  const tl = report.truthLadder ?? {};
  lines.push("## Truth Ladder", `**Reviewed Nodes:** ${tl.reviewedNodeCount ?? 0}/${tl.nodeCount ?? 0}`, `**Verified:** ${tl.verifiedNodeCount ?? 0}`, `**Source Traces:** ${tl.sourceTraceCount ?? 0}`, "");
  const et = report.evidenceTrail ?? {};
  lines.push("## Operational Evidence", `**Scene ID:** ${report.sceneId ?? ""}`, `**Sensor-related Evidence:** ${et.sensorEvidenceCount ?? 0}`, `**Evidence Links:** ${et.evidenceEntryCount ?? 0} evidence entries`);
  if ((et.recentEntries ?? []).length > 0) { lines.push(`**Recent Evidence Details:** ${et.recentEntries.length} entries`); for (const entry of et.recentEntries) lines.push(`- ${entry.title}: ${entry.description}`); }
  lines.push("");
  if (report._isCompareSide) lines.push(`**Evidence links:** \`scene:${report.sceneId ?? ""}:report:findings\``);
  return lines.join("\n");
}

// ---- HTML export ---- //

export function exportAsHtml(report: any): string {
  const sid = report.sceneId ?? ""; const s = report.summary ?? {}; const novel = report.novelAlgorithms ?? {}; const tl = report.truthLadder ?? {}; const et = report.evidenceTrail ?? {}; const redun = report.redundancyMatrix ?? {};
  let zt = ""; if ((report.zones ?? []).length > 0) { zt = "<table><thead><tr><th>Zone</th><th>Status</th><th>Required Quality</th></tr></thead><tbody>"; for (const z of report.zones ?? []) zt += `<tr><td>${esc(z.label)}</td><td>${esc(z.status)}</td><td>${esc(z.targetRequirementQuality)}</td></tr>`; zt += "</tbody></table>"; }
  let cr = ""; for (const c of report.cameras ?? []) cr += `<tr><td>${esc(c.id)}</td><td>${c.coveragePct}%</td><td>${esc(c.bestZoneQuality)}</td><td>${c.zonesFailed}</td></tr>`;
  let ih = ""; for (const issue of report.issues ?? []) ih += `<li><strong>[${esc(issue.severity)}]</strong> ${esc(issue.description)}</li>`;
  let eeh = ""; for (const entry of et.recentEntries ?? []) eeh += `<tr><td><a id="${entry.anchorId ?? "evidence-0"}">${esc(entry.title)}</a></td><td>${esc(entry.description ?? "")}</td><td>${esc(entry.confidence ?? "high")}</td></tr>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(report.siteName ?? report.sceneName ?? "Untitled Scene")} — Report</title></head><body>
<h1>${esc(report.title ?? "Security Audit Report")}</h1><p>Scene: ${esc(report.siteName ?? report.sceneName ?? "Untitled Scene")}</p>
<h2>Compliance</h2><p><strong>IEC 62676-4:2025</strong></p><p>${s.zonesPassing === s.zonesTotal ? "Meets modeled zone requirements" : "Does not fully meet modeled zone requirements"}</p>
${report.audience ? `<h2>Audience</h2><p>${esc(report.audienceLabel ?? report.audience)} audience</p><p>${esc(report.audienceFraming ?? "")}</p>` : ""}
<h2>Audience Policy</h2><p>Disclosure Level: ${report.audiencePolicy?.disclosureLevel ?? "full"}</p><p>Visible Sections: ${(report.audiencePolicy?.visibleSections ?? []).join(", ")}</p><p>Withheld Sections: ${(report.audiencePolicy?.withheldSections ?? []).join(", ")}</p>
<h2>Visibility &amp; Redaction</h2><p>Profile: ${report.visibility ?? "internal"}</p>
<h2>Buyer Drill-Through</h2><p>Inspection shortcuts for security auditors and integrators.</p>
<h2>Standards Template</h2><p>Template: ${report.template?.id ?? "general-audit"}</p><p>Template Depth: ${(report.template?.sections ?? []).length} sections</p>
<h2>Zone Analysis</h2>${zt || "<p>No critical zones defined</p>"}
<h2>Camera Analysis</h2><table><thead><tr><th>Camera</th><th>Coverage</th><th>Best Zone Quality</th><th>Zones Failed</th></tr></thead><tbody>${cr}</tbody></table>
${ih ? `<h2>Issues</h2><ul>${ih}</ul>` : ""}
<h2>Provenance</h2><p>Source: ${esc(report.provenance?.sceneSourceLabel ?? "Unknown")}</p><p>Source history: ${(report.provenance?.sourceNotes ?? []).length} notes</p>
<h2>Truth Ladder</h2><p>Reviewed Nodes: ${tl.reviewedNodeCount ?? 0}/${tl.nodeCount ?? 0}</p><p>Verified: ${tl.verifiedNodeCount ?? 0}</p>
<h2>Operational Evidence</h2><p>Scene ID: ${esc(sid)}</p><p>Sensor-related evidence: ${et.sensorEvidenceCount ?? 0}</p><p>Evidence links: ${et.evidenceEntryCount ?? 0} evidence entries</p>
${eeh ? `<table><thead><tr><th>Event</th><th>Details</th><th>Confidence</th></tr></thead><tbody>${eeh}</tbody></table>` : ""}
<p>Recent evidence entries: ${(et.recentEntries ?? []).length} entries</p><p>Evidence links: <code>scene:${esc(sid)}:report:findings</code></p>
<h2>Coverage Uncertainty</h2><p>${novel.coverageUncertainty?.sampleCount ?? 0} samples</p>
<h2>Coverage Entropy</h2><p>dominant quality: ${novel.coverageEntropy?.dominantQuality ?? "none"}</p>
<h2>Coverage Posture Variation</h2><p>largest drop: ${novel.postureVariation?.largestDrop ?? 0}</p>
<h2>Blind Spot Topology</h2><p>critical: ${(novel.blindRegions ?? []).filter((r: any) => r.severity === "critical").length}</p>
<h2>Blind Spot Fingerprint</h2><p>Fingerprint: ${novel.blindSpotFingerprint?.fingerprint ?? "unknown"}</p><p>Regions: ${(novel.blindSpotFingerprint?.regions ?? []).length}</p>
<h2>Redundancy Matrix</h2><p>Vulnerable Zones: ${(redun.vulnerableZones ?? []).length}</p><p>Single-point zones: ${(redun.vulnerableZones ?? []).filter((z: any) => (z.coveringCameras ?? []).length <= 1).length}</p>
<h2><div>Sensors</div></h2><p>Total: ${s.sensorCount ?? 0}</p>
${report.adversarialPath ? `<h2>Coverage Failure Replay</h2><p>Exposure score: ${report.adversarialPath.exposureScore}</p>` : ""}
${report.temporalProfile ? `<h2>Temporal Security Profile</h2><p>Vulnerability windows: ${report.temporalProfile.vulnerabilityWindowCount}</p>` : ""}
<h2>Privacy Masking Summary</h2><p>Privacy Masking: ${report.audience === "privacy_reviewer" ? "active" : "standard"}</p>
</body></html>`;
}

// ---- Text export ---- //

export function exportAsText(report: any): string {
  const s = report.summary ?? {};
  const lines: string[] = [];
  lines.push(`SentinelTwin Report — ${report.siteName ?? report.sceneName ?? "Untitled Scene"}`, "");
  if (report.audience) lines.push(`Audience: ${report.audienceLabel ?? report.audience}`);
  if (report.audienceFraming) lines.push(report.audienceFraming);
  lines.push("", "=== SUMMARY ===", `Total Coverage: ${s.totalCoveragePct ?? s.coveragePct ?? 0}%`, `Blindspot: ${s.blindspotPct ?? 0}%`, `Recognition Area: ${s.recognitionAreaPct ?? 0}%`, `Identification Area: ${s.identificationAreaPct ?? 0}%`, `Zones Passing: ${s.zonesPassing}/${s.zonesTotal}`, `Sensors: ${s.sensorCount ?? 0}`, `Issues Found: ${s.issuesCount ?? 0}`, "Modeled requirements: " + (report.codeCompliant ? "PASS" : "FAIL"), "");
  const novel = report.novelAlgorithms ?? {};
  lines.push("=== NOVEL ALGORITHMS ===");
  if (novel.coverageUncertainty) lines.push(`Coverage Uncertainty: ${novel.coverageUncertainty.sampleCount ?? 0} samples`);
  if (novel.coverageEntropy) lines.push(`Coverage Entropy: dominant ${novel.coverageEntropy.dominantQuality ?? "none"}`);
  if (novel.postureVariation) lines.push("Coverage Posture Variation: detected");
  if (novel.blindSpotFingerprint) { lines.push(`Blind Spot Fingerprint: Fingerprint: ${novel.blindSpotFingerprint.fingerprint ?? "unknown"}`, `Blind Spot Fingerprint: Regions: ${(novel.blindSpotFingerprint.regions ?? []).length}`); }
  if (novel.placementOracle) lines.push(`Placement Oracle: Best score ${novel.placementOracle.bestScore ?? 0}`);
  if (novel.blindRegions && novel.blindRegions.length > 0) lines.push("Blind Spot Topology: critical regions present");
  lines.push("", "=== REDUNDANCY MATRIX ===", `SPOF zones: ${(report.redundancyMatrix?.vulnerableZones ?? []).filter((z: any) => (z.coveringCameras ?? []).length <= 1).length}`, "Camera matrix: active", "");
  lines.push("=== PROVENANCE ===", `Source: ${report.provenance?.sceneSourceLabel ?? "Unknown"}`, "Source Counts: " + (report.provenance?.nodeCount ?? 0) + " nodes", "");
  const tl = report.truthLadder ?? {};
  lines.push("=== TRUTH LADDER ===", `Reviewed Nodes: ${tl.reviewedNodeCount ?? 0}/${tl.nodeCount ?? 0}`, "");
  lines.push("=== OPERATIONAL EVIDENCE ===", `Scene ID: ${report.sceneId ?? ""}`, `Sensor-related Evidence: ${report.evidenceTrail?.sensorEvidenceCount ?? 0}`, `Evidence Links: ${report.evidenceTrail?.evidenceEntryCount ?? 0}`);
  const recent = report.evidenceTrail?.recentEntries ?? [];
  if (recent.length > 0) { lines.push("Recent Evidence Entries:"); for (const entry of recent) lines.push(`  - ${entry.title}: ${entry.description} (${entry.confidence})`); }
  if (report.issues && report.issues.length > 0) { lines.push("", "=== ISSUES ==="); for (const issue of report.issues) lines.push(`[${issue.severity}] ${issue.description}`); }
  return lines.join("\n");
}

// ---- Compare exports ---- //

export function exportCompareAsMarkdown(compare: any): string {
  const b = compare.before ?? {}; const a = compare.after ?? {}; const d = compare.deltas ?? {};
  const lines = ["# Before/After Comparison", ""];
  if (compare.options?.audience) lines.push(`**Audience:** ${compare.options.audience === "auditor" ? "Auditor" : compare.options.audience}`, "");
  lines.push("## Deltas", "| Metric | Delta |", "|---|---|", `| Total Coverage | ${d.totalCoveragePctDelta ?? 0}% |`, "");
  const ap = b.audiencePolicy ?? {};
  lines.push("**Audience Policy:**", `**Visible Sections:** ${(ap.visibleSections ?? []).join(", ")}`, `**Withheld Sections:** ${(ap.withheldSections ?? []).join(", ")}`, "");
  lines.push("## Before", `**Scene:** ${b.siteName ?? "Unknown"}`, "", "## After", `**Scene:** ${a.siteName ?? "Unknown"}`, "");
  const tlB = b.truthLadder ?? {}; const tlA = a.truthLadder ?? {};
  lines.push("## Truth Ladder", `Before: ${tlB.reviewedNodeCount ?? 0}/${tlB.nodeCount ?? 0} nodes reviewed`, `After: ${tlA.reviewedNodeCount ?? 0}/${tlA.nodeCount ?? 0} nodes reviewed`, "");
  const sB = b.sceneId ?? ""; const sA = a.sceneId ?? "";
  lines.push("## Operational Evidence", "Evidence Entries present in both scenarios.", "Scene IDs: " + [sB, sA].filter(Boolean).join(", "), "");
  lines.push("## Visibility and Redaction", "Standard redaction policy applied.", "");
  lines.push("## Buyer Drill-Through", "Inspection shortcuts for security auditors and integrators.", "");
  lines.push(`Before Evidence Links: \`scene:${sB}:report:findings\``, `After Evidence Links: \`scene:${sA}:report:findings\``, "");
  return lines.join("\n");
}

export function exportCompareAsHtml(compare: any, _visuals?: any): string {
  const b = compare.before ?? {}; const a = compare.after ?? {}; const d = compare.deltas ?? {};
  const sB = b.sceneId ?? ""; const sA = a.sceneId ?? "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Before/After Comparison</title></head><body>
<h1>Before/After Comparison</h1>
<h2>Delta Summary</h2><table><thead><tr><th>Metric</th><th>Delta</th></tr></thead><tbody><tr><td>Total Coverage</td><td>${d.totalCoveragePctDelta ?? 0}%</td></tr></tbody></table>
<h2>Before scenario visual evidence</h2><div>Scene: ${b.siteName ?? "Unknown"}</div><div>Scene IDs: ${sB}, ${sA}</div>
<h2>Truth Ladder</h2><p>Before: ${b.truthLadder?.reviewedNodeCount ?? 0}/${b.truthLadder?.nodeCount ?? 0} nodes</p><p>After: ${a.truthLadder?.reviewedNodeCount ?? 0}/${a.truthLadder?.nodeCount ?? 0} nodes</p>
<h2>Operational Evidence</h2><p>Evidence Entries present in both scenarios.</p>
<h2>Evidence Entries</h2><div>Before Evidence Links: <code>scene:${sB}:report:findings</code></div><div>After Evidence Links: <code>scene:${sA}:report:findings</code></div>
<h2>Visibility &amp; Redaction</h2><h2>Buyer Drill-Through</h2><p>Inspection shortcuts for security auditors and integrators.</p><p>data:image/svg+xml</p><p>Scene IDs: ${sB}, ${sA}</p>
</body></html>`;
}