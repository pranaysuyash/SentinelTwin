import type { DoriQuality } from "@/schema/security-scene";
import { QUALITY_COLOR } from "@/lib/quality-display";

export const MAP_COLORS = {
  background: "#0a0d14",
  grid: "#1a2130",
  gridAccent: "#2a3346",
  panelBorder: "#1f2536",
  panelFill: "#0b0f17",
  panelFillAlt: "#111521",
  panelText: "#d5dbea",
  panelMuted: "#6d7690",
  viewport: "#93c5fd",
  selection: "#fbbf24",
  replayActor: "#fb923c",
  path: "#64748b",
  pathActive: "#8b5cf6",
  hatch: "#fda4af",
  wall: "#cfd8e8",
  wallGlass: "#74a7ff",
  wallGrill: "#fb7185",
  window: "#7dd3fc",
  windowReflective: "#22d3ee",
  door: "#93c5fd",
  doorOpen: "#86efac",
  doorRestricted: "#fb7185",
  lightOn: "#fbbf24",
  lightOff: "#6b7280",
  lightFailed: "#ef4444",
  priority: {
    low: "#22c55e",
    medium: "#eab308",
    high: "#f97316",
    critical: "#ef4444",
  } as const,
  quality: QUALITY_COLOR satisfies Record<DoriQuality, string>,
} as const;

export function qualityColor(quality: DoriQuality) {
  return MAP_COLORS.quality[quality] ?? MAP_COLORS.quality.none;
}

export function doorColor(state: string) {
  if (state === "open") return MAP_COLORS.doorOpen;
  if (state === "restricted") return MAP_COLORS.doorRestricted;
  if (state === "locked") return MAP_COLORS.door;
  return MAP_COLORS.door;
}

export function wallStrokeColor(material: string) {
  if (material === "glass") return MAP_COLORS.wallGlass;
  if (material === "grill") return MAP_COLORS.wallGrill;
  return MAP_COLORS.wall;
}

export function windowStrokeColor(state: string) {
  if (state === "grill") return "#ef4444";
  if (state === "reflective") return MAP_COLORS.windowReflective;
  if (state === "curtain") return "#60a5fa";
  return MAP_COLORS.window;
}

export function lightStatusColor(status: string) {
  if (status === "on") return MAP_COLORS.lightOn;
  if (status === "failed") return MAP_COLORS.lightFailed;
  return MAP_COLORS.lightOff;
}

export function priorityStrokeColor(priority: string) {
  return MAP_COLORS.priority[priority as keyof typeof MAP_COLORS.priority] ?? "#cbd5e1";
}
