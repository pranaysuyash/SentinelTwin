"use client";

import {
  Camera,
  Layers,
  Lightbulb,
  MousePointer2,
  RefreshCcw,
  ScanSearch,
  Shield,
  Square,
} from "lucide-react";

export const TOOL_GHOST_COLORS: Record<string, string> = {
  select: "#94a3b8",
  camera: "#60a5fa",
  obstruction: "#f97316",
  light: "#eab308",
  sensor: "#22d3ee",
  wall: "#22c55e",
  zone: "#86efac",
  door_window: "#c084fc",
  path: "#fb923c",
  measure: "#f8fafc",
  comment: "#94a3b8",
  default: "#60a5fa",
};

export const TOOL_ICONS: Record<string, React.ReactNode> = {
  select: <MousePointer2 className="h-3 w-3" />,
  camera: <Camera className="h-3 w-3" />,
  obstruction: <Square className="h-3 w-3" />,
  light: <Lightbulb className="h-3 w-3" />,
  sensor: <ScanSearch className="h-3 w-3" />,
  wall: <Square className="h-3 w-3" />,
  zone: <Shield className="h-3 w-3" />,
  door_window: <Layers className="h-3 w-3" />,
  path: <RefreshCcw className="h-3 w-3" />,
  measure: <Layers className="h-3 w-3" />,
  comment: <Layers className="h-3 w-3" />,
};

export const TOOL_LABELS: Record<string, string> = {
  select: "Select",
  camera: "Place Camera",
  obstruction: "Place Obstruction",
  light: "Place Light",
  sensor: "Place Sensor",
  wall: "Draw Wall",
  zone: "Draw Zone",
  door_window: "Place Door / Window",
  path: "Draw Path",
  measure: "Measure",
  comment: "Comment",
};
