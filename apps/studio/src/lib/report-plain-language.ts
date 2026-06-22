import type { SimulationResult, SecurityScene, TemporalSecurityProfile } from "@/schema/security-scene";
import type { PostureScoreResult } from "@sentineltwin/simulation";

export interface PlainLanguageReport {
  headline: string;
  overallAssessment: string;
  coverageNarrative: string;
  zoneNarrative: string;
  vulnerabilityNarrative: string;
  postureNarrative: string | null;
  temporalNarrative: string | null;
  crowdNarrative: string | null;
  actionItems: string[];
  confidence: string;
}

const QUALITY_PLAIN: Record<string, string> = {
  identification: "identify individuals by face",
  recognition: "recognize a known person",
  observation: "observe general activity",
  detection: "detect that someone is there",
  monitor: "see broad movement",
  none: "see nothing useful",
};

function qualityPlain(quality: string): string {
  return QUALITY_PLAIN[quality] ?? quality;
}

function pctDescriptor(pct: number): string {
  if (pct >= 95) return "nearly complete";
  if (pct >= 85) return "strong";
  if (pct >= 70) return "adequate";
  if (pct >= 50) return "partial";
  if (pct >= 30) return "limited";
  return "minimal";
}

function bandPlain(band: string): string {
  const map: Record<string, string> = {
    exceptional: "excellent — comparable to a well-secured facility",
    excellent: "strong — most areas are well-covered",
    good: "solid — the majority of the site is protected",
    fair: "needs improvement — significant gaps exist",
    poor: "concerning — critical vulnerabilities are present",
  };
  return map[band] ?? band;
}

export function buildPlainLanguageReport(
  scene: SecurityScene,
  result: SimulationResult,
  options?: {
    temporalProfile?: TemporalSecurityProfile | null;
    postureScore?: PostureScoreResult | null;
  },
): PlainLanguageReport {
  const totalPct = Math.round(result.totalCoveragePct);
  const cameraCount = scene.cameras.filter((c) => c.status === "on").length;
  const offlineCount = scene.cameras.filter((c) => c.status !== "on").length;
  const zoneResults = result.criticalZoneResults;
  const zonesPassing = zoneResults.filter((z) => z.status === "pass").length;
  const zonesTotal = zoneResults.length;
  const failingZones = zoneResults.filter((z) => z.status !== "pass");
  const criticalIssues = result.issues.filter((i) => i.severity === "critical");
  const highIssues = result.issues.filter((i) => i.severity === "high");
  const posture = options?.postureScore ?? null;
  const temporal = options?.temporalProfile ?? null;

  const headline = totalPct >= 85
    ? `Your ${scene.name} security coverage is ${pctDescriptor(totalPct)}.`
    : totalPct >= 60
      ? `Your ${scene.name} has gaps that need attention.`
      : `Your ${scene.name} has significant security gaps.`;

  const overallAssessment = [
    `${cameraCount} camera${cameraCount !== 1 ? "s are" : " is"} active across the site.`,
    offlineCount > 0 ? `${offlineCount} camera${offlineCount !== 1 ? "s are" : " is"} currently offline.` : null,
    `Together, they cover ${totalPct}% of the walkable area — that's ${pctDescriptor(totalPct)} coverage.`,
  ].filter(Boolean).join(" ");

  const coverageNarrative = buildCoverageNarrative(result);
  const zoneNarrative = buildZoneNarrative(zonesPassing, zonesTotal, failingZones);
  const vulnerabilityNarrative = buildVulnerabilityNarrative(result, criticalIssues, highIssues);
  const postureNarrative = posture ? buildPostureNarrative(posture) : null;
  const temporalNarrative = temporal ? buildTemporalNarrative(temporal) : null;
  const crowdNarrative = buildCrowdNarrative(result, temporal);
  const actionItems = buildActionItems(result, failingZones, offlineCount, posture);

  const confidence = result.issues.length === 0 && zonesTotal === 0
    ? "This assessment is based on camera geometry only — no critical zones have been defined yet, so zone-level compliance cannot be evaluated."
    : `This assessment is based on a deterministic simulation of ${cameraCount} camera${cameraCount !== 1 ? "s" : ""}, ${zonesTotal} critical zone${zonesTotal !== 1 ? "s" : ""}, and ${scene.obstructions.length} obstruction${scene.obstructions.length !== 1 ? "s" : ""}. Results reflect the physical layout as modeled — actual performance may vary with lighting, weather, and real-world conditions.`;

  return {
    headline,
    overallAssessment,
    coverageNarrative,
    zoneNarrative,
    vulnerabilityNarrative,
    postureNarrative,
    temporalNarrative,
    crowdNarrative,
    actionItems,
    confidence,
  };
}

function buildCoverageNarrative(result: SimulationResult): string {
  const detPct = Math.round(result.totalCoveragePct);
  const recPct = Math.round(result.recognitionAreaPct);
  const idPct = Math.round(result.identificationAreaPct);

  const parts: string[] = [];
  parts.push(`Cameras can detect movement in ${detPct}% of the walkable area.`);

  if (recPct > 0) {
    parts.push(`In ${recPct}% of the area, cameras are close enough to recognize a known individual.`);
  }
  if (idPct > 0) {
    parts.push(`Facial identification is possible in ${idPct}% of the area.`);
  }

  const worst = result.worstAreaQuality;
  if (worst && worst !== "none") {
    parts.push(`The weakest-covered area can ${qualityPlain(worst)}.`);
  } else if (worst === "none") {
    parts.push("Some areas have no camera coverage at all.");
  }

  return parts.join(" ");
}

function buildZoneNarrative(passing: number, total: number, failing: { label: string; requiredQuality: string; actualQuality: string }[]): string {
  if (total === 0) return "No critical zones have been defined. Define entry points, high-value areas, and perimeter boundaries to enable zone-level compliance checking.";

  if (passing === total) {
    return `All ${total} critical zone${total !== 1 ? "s meet" : " meets"} the required camera quality standard. Every designated high-priority area has adequate coverage.`;
  }

  const failDescriptions = failing.slice(0, 3).map((z) =>
    `"${z.label}" needs ${qualityPlain(z.requiredQuality)} quality but currently can only ${qualityPlain(z.actualQuality)}`,
  );

  const remaining = failing.length > 3 ? ` and ${failing.length - 3} more` : "";

  return `${passing} of ${total} critical zones meet the required standard. ${failDescriptions.join("; ")}${remaining}.`;
}

function buildVulnerabilityNarrative(
  result: SimulationResult,
  critical: { description: string }[],
  high: { description: string }[],
): string {
  if (critical.length === 0 && high.length === 0) {
    return "No critical or high-severity vulnerabilities were found in the current layout.";
  }

  const parts: string[] = [];
  if (critical.length > 0) {
    parts.push(`${critical.length} critical issue${critical.length !== 1 ? "s" : ""} found: ${critical.slice(0, 2).map((i) => i.description).join("; ")}.`);
  }
  if (high.length > 0) {
    parts.push(`${high.length} high-priority issue${high.length !== 1 ? "s" : ""}: ${high.slice(0, 2).map((i) => i.description).join("; ")}.`);
  }

  const adversarial = result.adversarialPath;
  if (adversarial) {
    const exposureScore = adversarial.totalExposureScore ?? 0;
    if (exposureScore < 0.3) {
      parts.push("An intruder could potentially cross the site with minimal camera exposure.");
    } else if (exposureScore < 0.6) {
      parts.push("An intruder crossing the site would be partially visible to cameras, but gaps exist along the path.");
    } else {
      parts.push("An intruder attempting to cross the site would be well-covered by cameras along most of the path.");
    }
  }

  return parts.join(" ");
}

function buildPostureNarrative(posture: PostureScoreResult): string {
  const parts: string[] = [];
  parts.push(`Your security posture score is ${posture.score} out of 850 — ${bandPlain(posture.band)}.`);

  if (posture.delta !== null) {
    if (posture.delta > 0) {
      parts.push(`This is ${posture.delta} points higher than the previous assessment.`);
    } else if (posture.delta < 0) {
      parts.push(`This is ${Math.abs(posture.delta)} points lower than the previous assessment.`);
    }
  }

  const weakest = Object.entries(posture.factorScores).reduce(
    (worst, [key, val]) => (val as number) < worst.val ? { key, val: val as number } : worst,
    { key: "", val: 851 },
  );
  const factorLabels: Record<string, string> = {
    coverageCompleteness: "overall coverage completeness",
    temporalResilience: "24-hour resilience (how well coverage holds across day and night)",
    adversarialPathResistance: "resistance to an intruder crossing the site undetected",
    redundancyDepth: "backup camera overlap (redundancy)",
    responseWindow: "early detection of threats before they reach sensitive areas",
  };
  if (weakest.key && weakest.val < 600) {
    parts.push(`The area most in need of improvement is ${factorLabels[weakest.key] ?? weakest.key}.`);
  }

  return parts.join(" ");
}

function buildTemporalNarrative(temporal: TemporalSecurityProfile): string {
  const snapshots = temporal.hourlySnapshots ?? [];
  if (snapshots.length === 0) return "No 24-hour temporal data is available.";

  const coverages = snapshots.map((s) => s.overallCoveragePct);
  const min = Math.min(...coverages);
  const max = Math.max(...coverages);
  const minSnapshot = snapshots.find((s) => s.overallCoveragePct === min);
  const maxSnapshot = snapshots.find((s) => s.overallCoveragePct === max);
  const spread = max - min;

  const parts: string[] = [];

  if (spread < 5) {
    parts.push("Coverage remains consistent throughout the 24-hour cycle.");
  } else {
    parts.push(`Coverage varies between ${Math.round(min)}% and ${Math.round(max)}% over the 24-hour cycle.`);
    if (minSnapshot) {
      const hour = minSnapshot.hour;
      const period = hour < 6 ? "early morning" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 20 ? "evening" : "night";
      parts.push(`The weakest point is during the ${period} (around ${hour}:00) at ${Math.round(min)}% coverage.`);
    }
    if (maxSnapshot && spread > 10) {
      parts.push(`Peak coverage of ${Math.round(max)}% occurs around ${maxSnapshot.hour}:00.`);
    }
  }

  const vulnWindows = temporal.peakVulnerabilityWindows ?? [];
  const highWindows = vulnWindows.filter((w) => w.severity === "high");
  if (highWindows.length > 0) {
    parts.push(`There ${highWindows.length === 1 ? "is" : "are"} ${highWindows.length} high-severity vulnerability window${highWindows.length !== 1 ? "s" : ""} where coverage drops to concerning levels.`);
  }

  return parts.join(" ");
}

function buildCrowdNarrative(result: SimulationResult, temporal: TemporalSecurityProfile | null): string | null {
  const crowd = result.crowdOcclusion;
  if (!crowd) return null;

  const geometric = result.totalCoveragePct;
  const effective = crowd.effectiveCoveragePct;
  const drop = geometric - effective;

  if (drop < 2) {
    return "Foot traffic has minimal impact on camera effectiveness at current crowd levels.";
  }

  const parts: string[] = [];
  parts.push(`When people are moving through the space, camera effectiveness drops by about ${Math.round(drop)} percentage points (from ${Math.round(geometric)}% to ${Math.round(effective)}%).`);
  parts.push("This is because people temporarily block camera sightlines as they walk through the area.");

  if (crowd.chokepoints && crowd.chokepoints.length > 0) {
    parts.push(`${crowd.chokepoints.length} area${crowd.chokepoints.length !== 1 ? "s have" : " has"} particularly high crowd impact where sightlines are frequently blocked.`);
  }

  return parts.join(" ");
}

function buildActionItems(
  result: SimulationResult,
  failingZones: { label: string }[],
  offlineCount: number,
  posture: PostureScoreResult | null,
): string[] {
  const items: string[] = [];

  if (offlineCount > 0) {
    items.push(`Restore ${offlineCount} offline camera${offlineCount !== 1 ? "s" : ""} to full operation — every offline camera is a gap in coverage.`);
  }

  for (const zone of failingZones.slice(0, 3)) {
    items.push(`Improve camera coverage for "${zone.label}" to meet the required quality standard.`);
  }

  const blindspots = result.issues.filter((i) => i.category === "blindspot");
  if (blindspots.length > 0) {
    items.push(`Address ${blindspots.length} blind spot${blindspots.length !== 1 ? "s" : ""} where obstructions are blocking camera views.`);
  }

  if (result.kRobustness && !result.kRobustness.isRobust) {
    items.push("Add backup camera coverage — if a single camera fails, some areas will lose all coverage.");
  }

  const adversarial = result.adversarialPath;
  if (adversarial && (adversarial.totalExposureScore ?? 0) < 0.5) {
    items.push("Close gaps along potential intrusion paths so that an intruder cannot cross the site undetected.");
  }

  if (posture && posture.score < 600) {
    const weakest = Object.entries(posture.factorScores).reduce(
      (worst, [key, val]) => (val as number) < worst.val ? { key, val: val as number } : worst,
      { key: "", val: 851 },
    );
    const labels: Record<string, string> = {
      coverageCompleteness: "expanding camera coverage to more of the walkable area",
      temporalResilience: "ensuring coverage holds consistently across all hours",
      adversarialPathResistance: "closing gaps along potential intrusion routes",
      redundancyDepth: "adding overlapping camera coverage for critical areas",
      responseWindow: "positioning cameras to detect threats earlier in their approach",
    };
    if (weakest.key) {
      items.push(`Focus on ${labels[weakest.key] ?? weakest.key} for the biggest improvement in security posture.`);
    }
  }

  if (result.recommendations.length > 0 && items.length < 5) {
    for (const rec of result.recommendations.slice(0, 2)) {
      if (!items.some((existing) => existing.includes(rec.description.slice(0, 30)))) {
        items.push(rec.description);
      }
    }
  }

  return items;
}

export function formatPlainLanguageMarkdown(report: PlainLanguageReport): string {
  const sections: string[] = [];

  sections.push(`# ${report.headline}\n`);
  sections.push(`## Overview\n\n${report.overallAssessment}\n`);
  sections.push(`## Camera Coverage\n\n${report.coverageNarrative}\n`);
  sections.push(`## Critical Zones\n\n${report.zoneNarrative}\n`);
  sections.push(`## Vulnerabilities\n\n${report.vulnerabilityNarrative}\n`);

  if (report.postureNarrative) {
    sections.push(`## Security Posture Score\n\n${report.postureNarrative}\n`);
  }
  if (report.temporalNarrative) {
    sections.push(`## 24-Hour Coverage Profile\n\n${report.temporalNarrative}\n`);
  }
  if (report.crowdNarrative) {
    sections.push(`## Crowd Impact\n\n${report.crowdNarrative}\n`);
  }

  if (report.actionItems.length > 0) {
    sections.push(`## What to Do Next\n\n${report.actionItems.map((item, i) => `${i + 1}. ${item}`).join("\n")}\n`);
  }

  sections.push(`---\n\n*${report.confidence}*`);

  return sections.join("\n");
}
