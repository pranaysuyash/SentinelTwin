import type { CriticalZoneNode, SecurityScene } from "@sentineltwin/core";
import { qualityToScore } from "@sentineltwin/core";

function sortCriticalZonesByPriority(zones: CriticalZoneNode[]) {
  return [...zones].sort((a, b) => {
    const qualityDelta = qualityToScore(b.requiredQuality) - qualityToScore(a.requiredQuality);
    if (qualityDelta !== 0) return qualityDelta;
    const labelDelta = a.label.localeCompare(b.label);
    if (labelDelta !== 0) return labelDelta;
    return a.id.localeCompare(b.id);
  });
}

export function selectHighestPriorityCriticalZone(scene: SecurityScene): CriticalZoneNode | null {
  if (scene.criticalZones.length === 0) return null;
  return sortCriticalZonesByPriority(scene.criticalZones)[0] ?? null;
}

export function selectCounterCriticalZone(scene: SecurityScene): CriticalZoneNode | null {
  const counterZones = scene.criticalZones.filter((zone) => /(counter|cash|checkout|till)/i.test(zone.label));
  if (counterZones.length > 0) {
    return sortCriticalZonesByPriority(counterZones)[0] ?? null;
  }
  return selectHighestPriorityCriticalZone(scene);
}
