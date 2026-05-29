import type { SecurityScene } from "@/schema/security-scene";

type BottomRowScene = Pick<SecurityScene, "assumptions" | "windows" | "doors">;
function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatOptionalNumber(value: number | undefined, unit: string) {
  if (value === undefined) return "Auto";
  return `${value.toFixed(0)} ${unit}`;
}

export function summarizeWindowStates(scene: BottomRowScene) {
  if (scene.windows.length === 0) return "No windows";

  const counts = scene.windows.reduce<Record<string, number>>((acc, window) => {
    acc[window.state] = (acc[window.state] ?? 0) + 1;
    return acc;
  }, {});

  const order: Array<[keyof typeof counts, string]> = [
    ["closed_glass", "glass"],
    ["open", "open"],
    ["grill", "grill"],
    ["curtain", "curtain"],
    ["reflective", "reflective"],
  ];

  const parts = order
    .map(([key, label]) => {
      const count = counts[key] ?? 0;
      return count > 0 ? `${count} ${label}` : null;
    })
    .filter((entry): entry is string => Boolean(entry));

  return parts.length > 0 ? `${scene.windows.length} windows · ${parts.join(", ")}` : `${scene.windows.length} windows`;
}

export function summarizeDoorStates(scene: BottomRowScene) {
  if (scene.doors.length === 0) return "No doors";

  const counts = scene.doors.reduce<Record<string, number>>((acc, door) => {
    acc[door.state] = (acc[door.state] ?? 0) + 1;
    return acc;
  }, {});

  const parts = (["open", "closed", "locked", "restricted"] as const)
    .map((state) => {
      const count = counts[state] ?? 0;
      return count > 0 ? `${count} ${state}` : null;
    })
    .filter((entry): entry is string => Boolean(entry));

  return parts.length > 0 ? `${scene.doors.length} doors · ${parts.join(", ")}` : `${scene.doors.length} doors`;
}

export function buildEnvironmentRows(scene: BottomRowScene, mode: "day" | "night" | "dusk") {
  return [
    { label: "Mode", value: capitalize(mode) },
    { label: "Time of Day", value: capitalize(scene.assumptions.timeOfDay) },
    { label: "Interior Light", value: capitalize(scene.assumptions.interiorLightLevel) },
    { label: "Night Penalty", value: capitalize(scene.assumptions.nightPenaltyMode) },
    { label: "Exterior Lux", value: formatOptionalNumber(scene.assumptions.exteriorLightLux, "lx") },
    { label: "Windows", value: summarizeWindowStates(scene) },
    { label: "Doors", value: summarizeDoorStates(scene) },
  ];
}
