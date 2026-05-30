import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import type { SecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";

export function buildOutcomeDrivenReportMarkdown(
  outcome: SecurityOutcomeModel,
  result: SimulationResult | null,
  scene: SecurityScene,
  activePathId: string | null,
): string {
  const s = outcome.summary;
  const score = outcome.scorecard;
  const hasFailures = outcome.failedZones.some((z) => z.status !== "pass");
  const statusLine = s.status === "pass" ? "PASS" : s.status === "high_risk" ? "HIGH RISK" : s.status === "needs_attention" ? "NEEDS ATTENTION" : "INCOMPLETE";
  const coverageLine = s.coveragePct != null ? `${Math.round(s.coveragePct)}%` : "N/A";

  const lines: string[] = [
    "# SentinelTwin Security Audit Outcome",
    `**Scene:** ${scene.name}`,
    `**Status:** ${statusLine}`,
    `**Coverage:** ${coverageLine} · **Scorecard:** ${score.overall}/100 (${score.overallLabel})`,
    `**Generated:** ${new Date().toLocaleString()}`,
    "",
    "---",
    "",
    "## Scorecard",
    `| Dimension | Score | Detail |`,
    `|---|---|---|`,
    `| Coverage | ${score.dimensions.coverage.score} | ${score.dimensions.coverage.detail ?? ""} |`,
    `| Zone Compliance | ${score.dimensions.zoneCompliance.score} | ${score.dimensions.zoneCompliance.detail ?? ""} (${score.dimensions.zoneCompliance.passing}/${score.dimensions.zoneCompliance.total}) |`,
    `| Redundancy | ${score.dimensions.redundancy.score} | ${score.dimensions.redundancy.detail ?? ""} |`,
    `| Night Readiness | ${score.dimensions.nightReadiness.score} | ${score.dimensions.nightReadiness.detail ?? ""} |`,
    `| Path Visibility | ${score.dimensions.pathVisibility.score} | ${score.dimensions.pathVisibility.detail ?? ""} |`,
    `| Privacy | ${score.dimensions.privacy.score} | ${score.dimensions.privacy.detail ?? ""} |`,
    "",
    "---",
    "",
    "## Summary",
    `**Headline:** ${s.headline}`,
    `**Coverage:** ${coverageLine}  ·  **Critical Zones:** ${s.criticalZonesPassing}/${s.criticalZonesTotal} passing  ·  **Issues:** ${s.issueCount}`,
    s.primaryRisk ? `**Primary Risk:** ${s.primaryRisk}` : null,
    s.recommendedNextAction ? `**Recommended Action:** ${s.recommendedNextAction}` : null,
    "",
    "---",
    "",
  ].filter((l): l is string => l !== null);

  if (outcome.causeTaxonomy.length > 0) {
    lines.push("## Cause Analysis", "");
    const sevLabels: Record<string, string> = { critical: "CRIT", high: "HIGH", medium: "MED", low: "LOW" };
    for (const cause of outcome.causeTaxonomy) {
      lines.push(`- **[${sevLabels[cause.severity]}] ${cause.label}** — ${cause.productExplanation}`);
    }
    lines.push("");
  }

  if (outcome.failedZones.some((z) => z.status !== "pass")) {
    lines.push("## Failed Zones", "");
    for (const zone of outcome.failedZones) {
      if (zone.status === "pass") continue;
      lines.push(`### ${zone.label} (${zone.status})`);
      lines.push(`- Required: ${zone.requiredQuality} · Actual: ${zone.actualQuality} · Priority: ${zone.priority}`);
      lines.push(`- Cameras: ${zone.coveringCameras.length > 0 ? zone.coveringCameras.join(", ") : "None"}`);
      if (zone.productFailureReasons.length > 0) {
        for (const reason of zone.productFailureReasons) {
          lines.push(`- ${reason}`);
        }
      }
      if (zone.causeCategories.length > 0) {
        lines.push(`- Causes: ${zone.causeCategories.join(", ")}`);
      }
      lines.push("");
    }
  }

  if (outcome.cameraFindings.length > 0) {
    lines.push("## Camera Responsibility", "");
    for (const cam of outcome.cameraFindings) {
      lines.push(`- **${cam.cameraName}**: ${cam.coveragePct.toFixed(1)}% coverage, ${cam.zonesPassed.length} zones passed, ${cam.zonesFailed.length} zones failed`);
      if (cam.roleSummary) lines.push(`  - Role: ${cam.roleSummary}`);
      if (cam.offlineImpactSummary) lines.push(`  - Offline risk: ${cam.offlineImpactSummary}`);
    }
    lines.push("");
  }

  if (outcome.pathFindings.length > 0) {
    lines.push("## Path / Replay Risk", "");
    for (const path of outcome.pathFindings) {
      const riskLabel = path.visiblePct >= 80 ? "Low risk" : path.visiblePct >= 50 ? "Medium risk" : "High risk";
      lines.push(`- **${path.label}**: ${path.visiblePct}% visible, ${path.lostSegments} lost segment(s), best quality ${path.bestQuality} — ${riskLabel}`);
      if (path.worstMomentSummary) lines.push(`  - ${path.worstMomentSummary}`);
      if (path.lostSegmentLabels.length > 0) lines.push(`  - Coverage gaps: ${path.lostSegmentLabels.join(", ")}`);
    }
    lines.push("");
  }

  if (outcome.privacyFindings.length > 0) {
    lines.push("## Privacy Findings", "");
    for (const p of outcome.privacyFindings) {
      lines.push(`- **${p.label}**: ${p.issue}`);
    }
    lines.push("");
  }

  if (outcome.recommendations.length > 0) {
    lines.push("## Recommendations", "");
    for (const rec of outcome.recommendations) {
      const verifiedTag = rec.verificationLabel === "verified_by_simulation" ? "✓ Verified" : rec.verificationLabel === "not_yet_tested" ? "○ Not tested" : rec.verificationLabel === "requires_user_input" ? "✋ Needs input" : "△ Assumption";
      lines.push(`- **[${verifiedTag}]** ${rec.description} (${rec.costCategory})`);
      if (rec.fixesFinding) lines.push(`  - Fixes: ${rec.fixesFinding}`);
      if (rec.scorecardDelta) lines.push(`  - Impact: ${rec.scorecardDelta.description}`);
      if (rec.estimatedImpact) lines.push(`  - ${rec.estimatedImpact}`);
    }
    lines.push("");
  }

  const missingPaths = outcome.pathFindings.length === 0 && scene.paths.length === 0;
  const missingZones = outcome.summary.criticalZonesTotal === 0 && scene.criticalZones.length === 0;
  if (missingPaths || missingZones) {
    lines.push("## Next Actions", "");
    if (missingZones) lines.push("- Add critical zones to measure security requirements.");
    if (missingPaths) lines.push("- Add incident paths to test subject visibility along routes.");
    lines.push("");
  }

  lines.push("## Assumptions", "");
  for (const a of outcome.assumptions) {
    lines.push(`- **${a.label}:** ${a.value} — ${a.impact}`);
  }
  lines.push("");

  lines.push("## Limitations", "");
  for (const l of outcome.limitations) {
    lines.push(`- ${l}`);
  }
  lines.push("");

  lines.push("---");
  lines.push("_Planning indicator: modeled outcomes depend on assumptions and are not legal/forensic guarantees._");

  return lines.join("\n");
}
