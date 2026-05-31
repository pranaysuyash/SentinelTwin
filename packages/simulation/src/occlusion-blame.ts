import type { SecurityScene, DoriQuality } from "@sentineltwin/core";
import { computeCoverageCells } from "./coverage";
import { qualityToScore, maxQuality, cloneSecuritySceneSimulation } from "@sentineltwin/core";

export interface ObstructionBlame {
  obstructionId: string;
  label: string;
  blameFraction: number;
  qualityWithout: DoriQuality;
  qualityImprovement: number;
}

export interface ZoneOcclusionAnalysis {
  zoneId: string;
  zoneLabel: string;
  baselineQuality: DoriQuality;
  obstructions: ObstructionBlame[];
}

function computeZoneQuality(scene: SecurityScene, zoneId: string): DoriQuality {
  const cells = computeCoverageCells(scene);
  const zone = scene.criticalZones.find((z) => z.id === zoneId);
  if (!zone) return "none";

  let best: DoriQuality = "none";
  for (const cell of cells) {
    if (cell.quality === "none") continue;
    const poly = zone.polygon;
    const inside = pointInPolygon(cell.x, cell.z, poly);
    if (inside) {
      best = maxQuality(best, cell.quality as DoriQuality);
    }
  }
  return best;
}

function pointInPolygon(x: number, z: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], zi = polygon[i][1];
    const xj = polygon[j][0], zj = polygon[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function analyzeOcclusionBlame(scene: SecurityScene): ZoneOcclusionAnalysis[] {
  const analyses: ZoneOcclusionAnalysis[] = [];

  for (const zone of scene.criticalZones) {
    const baselineQuality = computeZoneQuality(scene, zone.id);
    if (baselineQuality === "none") continue;

    const total = scene.obstructions.length;
    if (total === 0) continue;

    const blameEntries: { id: string; label: string; qualityWithout: DoriQuality; improvement: number }[] = [];
    let blameTotal = 0;

    for (const obs of scene.obstructions) {
      const modified: SecurityScene = cloneSecuritySceneSimulation(scene);
      modified.obstructions = modified.obstructions.filter((o) => o.id !== obs.id);

      const q = computeZoneQuality(modified, zone.id);
      const improvement = qualityToScore(q) - qualityToScore(baselineQuality);
      if (improvement > 0) {
        blameEntries.push({ id: obs.id, label: obs.label, qualityWithout: q, improvement });
        blameTotal += improvement;
      }
    }

    if (blameTotal === 0) continue;

    const obstructions: ObstructionBlame[] = blameEntries
      .sort((a, b) => b.improvement - a.improvement)
      .map((e) => ({
        obstructionId: e.id,
        label: e.label,
        blameFraction: e.improvement / blameTotal,
        qualityWithout: e.qualityWithout,
        qualityImprovement: e.improvement,
      }));

    analyses.push({ zoneId: zone.id, zoneLabel: zone.label, baselineQuality, obstructions });
  }

  return analyses;
}
