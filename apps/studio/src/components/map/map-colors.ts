import type { DoriQuality } from "@/schema/security-scene";
import { QUALITY_COLOR } from "@/lib/quality-display";
import { UI_SURFACES_RAW } from "@/lib/studio-surface-tokens";

export const MAP_COLORS = {
  // Surfaces & Backgrounds
  background: "#0a0d14",
  surface: {
    base: "#0b0f17",
    alt: "#111521",
    dark: "#09101a",
    card: "#0c1320",
    hover: "#1e293b",
  },
  // Borders & Grids
  grid: "#263247",
  gridAccent: "#3b4c68",
  panelBorder: "#334155",
  border: {
    base: "#1f2536",
    muted: "#24283a",
    accent: "#31405a",
    highlight: "#475569",
  },
  // Typography & Labels
  panelFill: "#0b0f17",
  panelFillAlt: "#111521",
  panelText: "#e2e8f0",
  panelMuted: "#94a3b8",
  text: {
    primary: "#f8fafc",
    secondary: "#cbd5e1",
    muted: "#8f9bb1",
    dim: "#556076",
    dark: "#020617",
  },
  // Core Scene Elements
  viewport: "#93c5fd",
  selection: "#f59e0b",
  selectionBlue: "#bfdbfe",
  selectionRing: "#e0e7ff",
  hoverRing: "#c7d2fe",
  replayActor: "#fb923c",
  replayActorInner: "#fdba74",
  replayActorGhost: "#f97316",
  path: "#64748b",
  pathActive: "#8b5cf6",
  pathStart: "#22c55e",
  pathMid: "#a78bfa",
  pathEnd: "#f59e0b",
  pathGhost: "#ef4444",
  hatch: "#fda4af",
  // Architectural Materials
  wall: "#cfd8e8",
  wallInner: "#141a26",
  wallGlass: "#74a7ff",
  wallGrill: "#fb7185",
  window: "#7dd3fc",
  windowReflective: "#22d3ee",
  windowCurtain: "#60a5fa",
  windowGrill: "#ef4444",
  door: "#93c5fd",
  doorOpen: "#86efac",
  doorRestricted: "#fb7185",
  // Security Sensors & Lights
  lightOn: "#fbbf24",
  lightOff: "#6b7280",
  lightFailed: "#ef4444",
  // Privacy Zones
  privacy: {
    fill: "#fecdd3",
    fillTint: "rgba(236,72,153,0.28)",
    stroke: "#fda4af",
    strokeAccent: "#fca5a5",
    lock: "#7f1d1d",
  },
  // Zone Status Tints
  zone: {
    pass: "rgba(34,197,94,0.2)",
    partial: "rgba(234,179,8,0.2)",
    fail: "rgba(239,68,68,0.2)",
  },
  // Obstacles
  obstacle: {
    glass: "rgba(125,211,252,0.28)",
    partial: "rgba(148,163,184,0.22)",
    solid: "rgba(148,163,184,0.35)",
    stroke: UI_SURFACES_RAW.textSoftMuted,
    strokeSelected: "#fbbf24",
  },
  priority: {
    default: "#cbd5e1",
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
  if (state === "grill") return MAP_COLORS.windowGrill;
  if (state === "reflective") return MAP_COLORS.windowReflective;
  if (state === "curtain") return MAP_COLORS.windowCurtain;
  return MAP_COLORS.window;
}

export function lightStatusColor(status: string) {
  if (status === "on") return MAP_COLORS.lightOn;
  if (status === "failed") return MAP_COLORS.lightFailed;
  return MAP_COLORS.lightOff;
}

export function priorityStrokeColor(priority: string) {
  return MAP_COLORS.priority[priority as keyof typeof MAP_COLORS.priority] ?? MAP_COLORS.priority.default;
}

