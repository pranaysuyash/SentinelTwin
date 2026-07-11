import { describe, it, expect } from "bun:test";
import { MATERIAL_PALETTE, type MaterialPaletteKey } from "../lib/material-palette";

/** Matches exactly `#` followed by 6 hex digits. */
const HEX_6 = /^#[0-9a-fA-F]{6}$/;

describe("MATERIAL_PALETTE", () => {
  it("is frozen (immutable at runtime)", () => {
    expect(Object.isFrozen(MATERIAL_PALETTE)).toBe(true);
  });

  it("contains exactly 15 entries", () => {
    const keys = Object.keys(MATERIAL_PALETTE) as MaterialPaletteKey[];
    expect(keys.length).toBe(15);
  });

  it("has expected keys", () => {
    const keys = Object.keys(MATERIAL_PALETTE).sort();
    expect(keys).toEqual([
      "brickTerra",
      "countertop",
      "floorTile",
      "glassBlue",
      "metalAluminum",
      "partitionGray",
      "treeCanopy",
      "treeTrunk",
      "warmGlow",
      "woodBoard",
      "woodCabinet",
      "woodDoor",
      "woodFrame",
      "woodOak",
      "woodShelf",
    ]);
  });

  it("every value is a valid 6-digit hex color", () => {
    const entries = Object.entries(MATERIAL_PALETTE);
    for (const [key, value] of entries) {
      expect(value).toMatch(HEX_6);
      // Extra: ensure lowercase hex (convention)
      expect(value).toBe(value.toLowerCase());
    }
  });

  it("no two entries share the same hex value", () => {
    const values = Object.values(MATERIAL_PALETTE);
    expect(new Set(values).size).toBe(values.length);
  });

  it("wood entries are in a plausible brown range", () => {
    const woods = ["woodDoor", "woodFrame", "woodCabinet", "woodShelf", "woodBoard", "woodOak"] as const;
    for (const key of woods) {
      const hex = MATERIAL_PALETTE[key];
      // R channel should be the highest (brown = high R, medium G, low B)
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThanOrEqual(b);
    }
  });

  it("treeCanopy is green (G channel dominant)", () => {
    const hex = MATERIAL_PALETTE.treeCanopy;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it("glassBlue is light (high RGB values)", () => {
    const hex = MATERIAL_PALETTE.glassBlue;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    expect(r).toBeGreaterThan(180);
    expect(g).toBeGreaterThan(180);
    expect(b).toBeGreaterThan(200);
  });

  it("warmGlow is warm cream (high R and G, creating yellow-ish glow)", () => {
    const hex = MATERIAL_PALETTE.warmGlow;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // #fff4d0: R=255, G=244, B=208 — warm cream, not pure yellow
    expect(r).toBe(255);
    expect(g).toBeGreaterThan(220);
    expect(b).toBeGreaterThan(180);
    // R > G > B (warm bias)
    expect(r).toBeGreaterThanOrEqual(g);
    expect(g).toBeGreaterThanOrEqual(b);
  });
});
