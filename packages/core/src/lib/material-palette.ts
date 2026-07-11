/**
 * Canonical material palette — single source of truth for all physically-
 * based material colors used across SentinelTwin packages.
 *
 * These colors represent physically accurate material appearances for
 * architectural elements (floors, walls, doors, windows) and scene
 * primitives (trees, partitions, fixtures). They are neither UI chrome
 * colors (use UI_SURFACES) nor canvas geometry colors (use MAP_COLORS).
 *
 * Exported from @sentineltwin/core so both the studio app and the
 * simulation/agents packages can reference the same material definitions
 * for rendering, reports, and AI recommendations.
 */
export const MATERIAL_PALETTE = Object.freeze({
  // ── Wood ──
  woodDoor: "#8b5e34",
  woodFrame: "#5c4a3a",
  woodCabinet: "#624633",
  woodShelf: "#5c4324",
  woodBoard: "#6d522f",
  woodOak: "#8a6a44",
  // ── Stone & Surface ──
  floorTile: "#e2dbd0",
  countertop: "#a09080",
  // ── Nature ──
  treeTrunk: "#5a3a1a",
  treeCanopy: "#2d6b2d",
  // ── Glass ──
  glassBlue: "#cfe5ff",
  // ── Light ──
  warmGlow: "#fff4d0",
  // ── Partition & Gray ──
  partitionGray: "#6b7280",
  // ── Brick ──
  brickTerra: "#9c5a44",
  // ── Metal ──
  metalAluminum: "#aeb4bc",
} as const);

export type MaterialPaletteKey = keyof typeof MATERIAL_PALETTE;
