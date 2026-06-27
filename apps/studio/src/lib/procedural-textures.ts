/**
 * Procedural Surface Textures — SentinelTwin Studio
 *
 * Canvas-generated albedo + normal maps for every appearance texture style
 * (no external image assets, no network calls during sensitive reviews —
 * see Docs/exploration/3D_REALISTIC_RENDERING_ROADMAP_2026-07-04.md §2.5).
 *
 * The original floor-tile and wall-plaster generators moved here from
 * `SharedScene.tsx` so all canvases and the appearance layer share one
 * texture source. Textures are cached per style for the lifetime of the
 * page; they are rendering-only and never feed the simulation engine.
 *
 * Client-only module: requires `document`. Callers run inside R3F canvases
 * ("use client" components), and every accessor returns null-safe results
 * are not needed because generation is lazy at first render.
 */

import * as THREE from "three";

import type { ProceduralTextureStyle } from "@/lib/scene-appearance";

export interface SurfaceTextureSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  return [canvas, ctx];
}

function toRepeatingTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

/** Flat normal-map base with sparse random perturbation. */
function createNoiseNormal(size: number, count: number, spread: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size);
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const r = 128 + (Math.random() - 0.5) * spread;
    const g = 128 + (Math.random() - 0.5) * spread;
    ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, 255, 0.14)`;
    ctx.fillRect(px, py, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  return toRepeatingTexture(canvas);
}

// ── Tile (original floor texture) ──

function createTileMap(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = "#e2dbd0";
  ctx.fillRect(0, 0, size, size);

  const tileSize = 128;
  const groutWidth = 2;
  ctx.strokeStyle = "#cdc5b8";
  ctx.lineWidth = groutWidth;

  for (let x = 0; x <= size; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  for (let tx = 0; tx < size / tileSize; tx++) {
    for (let ty = 0; ty < size / tileSize; ty++) {
      const brightness = 0.92 + Math.random() * 0.08;
      ctx.fillStyle = `rgba(${Math.floor(226 * brightness)}, ${Math.floor(219 * brightness)}, ${Math.floor(208 * brightness)}, 0.6)`;
      ctx.fillRect(tx * tileSize + groutWidth, ty * tileSize + groutWidth, tileSize - groutWidth * 2, tileSize - groutWidth * 2);

      for (let i = 0; i < 40; i++) {
        const px = tx * tileSize + groutWidth + Math.random() * (tileSize - groutWidth * 2);
        const py = ty * tileSize + groutWidth + Math.random() * (tileSize - groutWidth * 2);
        const gray = 160 + Math.random() * 60;
        ctx.fillStyle = `rgba(${gray}, ${gray - 10}, ${gray - 20}, ${0.04 + Math.random() * 0.06})`;
        ctx.fillRect(px, py, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
    }
  }

  return toRepeatingTexture(canvas);
}

function createTileNormal(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);

  const tileSize = 128;
  const groutWidth = 3;

  for (let x = 0; x <= size; x += tileSize) {
    ctx.fillStyle = "#6060ff";
    ctx.fillRect(x - groutWidth / 2, 0, groutWidth, size);
  }
  for (let y = 0; y <= size; y += tileSize) {
    ctx.fillStyle = "#6060ff";
    ctx.fillRect(0, y - groutWidth / 2, size, groutWidth);
  }

  for (let i = 0; i < 200; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const r = 128 + (Math.random() - 0.5) * 12;
    const g = 128 + (Math.random() - 0.5) * 12;
    ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, 255, 0.15)`;
    ctx.fillRect(px, py, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }

  return toRepeatingTexture(canvas);
}

// ── Plaster (original wall texture) ──

function createPlasterMap(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = "#eaecf0";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 300; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const gray = 220 + Math.random() * 30;
    ctx.fillStyle = `rgba(${gray}, ${gray + 2}, ${gray + 5}, ${0.08 + Math.random() * 0.12})`;
    ctx.fillRect(px, py, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }

  for (let y = 0; y < size; y += 64) {
    ctx.fillStyle = `rgba(200, 204, 212, ${0.02 + Math.random() * 0.03})`;
    ctx.fillRect(0, y, size, 1);
  }

  return toRepeatingTexture(canvas);
}

// ── Concrete ──

function createConcreteMap(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = "#a3a8b0";
  ctx.fillRect(0, 0, size, size);

  // Large soft blotches
  for (let i = 0; i < 60; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const radius = 12 + Math.random() * 46;
    const gray = 140 + Math.random() * 60;
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
    gradient.addColorStop(0, `rgba(${gray}, ${gray + 2}, ${gray + 6}, 0.10)`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
  }

  // Fine speckle
  for (let i = 0; i < 900; i++) {
    const gray = 120 + Math.random() * 90;
    ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray + 4}, ${0.05 + Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  // Hairline cracks
  ctx.strokeStyle = "rgba(90, 94, 102, 0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (Math.random() - 0.5) * 60;
      y += 12 + Math.random() * 26;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  return toRepeatingTexture(canvas);
}

// ── Wood planks ──

function createWoodMap(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);
  const plankHeight = 64;

  for (let py = 0; py < size; py += plankHeight) {
    const base = 118 + Math.random() * 34;
    ctx.fillStyle = `rgb(${Math.floor(base + 24)}, ${Math.floor(base * 0.72)}, ${Math.floor(base * 0.44)})`;
    ctx.fillRect(0, py, size, plankHeight);

    // Grain lines along the plank
    for (let i = 0; i < 14; i++) {
      const gy = py + Math.random() * plankHeight;
      const tone = base * (0.55 + Math.random() * 0.35);
      ctx.strokeStyle = `rgba(${Math.floor(tone)}, ${Math.floor(tone * 0.66)}, ${Math.floor(tone * 0.4)}, ${0.16 + Math.random() * 0.2})`;
      ctx.lineWidth = 0.6 + Math.random() * 1.1;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= size; x += 32) {
        ctx.lineTo(x, gy + Math.sin(x * 0.02 + i) * 2.2 + (Math.random() - 0.5) * 1.5);
      }
      ctx.stroke();
    }

    // Plank seam
    ctx.fillStyle = "rgba(48, 32, 18, 0.55)";
    ctx.fillRect(0, py + plankHeight - 2, size, 2);
    // Butt joint at a random offset per row
    const joint = Math.floor(Math.random() * size);
    ctx.fillRect(joint, py, 2, plankHeight);
  }

  return toRepeatingTexture(canvas);
}

function createWoodNormal(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);
  const plankHeight = 64;
  for (let py = plankHeight; py <= size; py += plankHeight) {
    ctx.fillStyle = "#5858ff";
    ctx.fillRect(0, py - 2, size, 3);
  }
  for (let i = 0; i < 260; i++) {
    const r = 128 + (Math.random() - 0.5) * 10;
    ctx.fillStyle = `rgba(${Math.floor(r)}, 128, 255, 0.12)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 6 + Math.random() * 20, 1);
  }
  return toRepeatingTexture(canvas);
}

// ── Carpet ──

function createCarpetMap(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = "#666d79";
  ctx.fillRect(0, 0, size, size);

  // Dense low-contrast fiber speckle
  for (let i = 0; i < 4200; i++) {
    const tone = 84 + Math.random() * 56;
    ctx.fillStyle = `rgba(${Math.floor(tone)}, ${Math.floor(tone + 5)}, ${Math.floor(tone + 14)}, ${0.18 + Math.random() * 0.22})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1 + Math.random());
  }

  return toRepeatingTexture(canvas);
}

// ── Marble ──

function createMarbleMap(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = "#eceae5";
  ctx.fillRect(0, 0, size, size);

  // Soft tonal clouds
  for (let i = 0; i < 26; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const radius = 34 + Math.random() * 90;
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
    gradient.addColorStop(0, "rgba(214, 212, 206, 0.16)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
  }

  // Veins — meandering bezier strokes
  for (let i = 0; i < 7; i++) {
    const gray = 120 + Math.random() * 50;
    ctx.strokeStyle = `rgba(${gray}, ${gray + 2}, ${gray + 8}, ${0.2 + Math.random() * 0.25})`;
    ctx.lineWidth = 0.8 + Math.random() * 1.6;
    let x = Math.random() * size;
    let y = -10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < size + 10) {
      const cx1 = x + (Math.random() - 0.5) * 90;
      const cy1 = y + 24 + Math.random() * 36;
      const cx2 = x + (Math.random() - 0.5) * 90;
      const cy2 = cy1 + 24 + Math.random() * 36;
      x = x + (Math.random() - 0.5) * 70;
      y = cy2 + 12 + Math.random() * 26;
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x, y);
    }
    ctx.stroke();
  }

  return toRepeatingTexture(canvas);
}

// ── Brick ──

function createBrickMap(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);
  const brickH = 42;
  const brickW = 128;
  const mortar = 6;

  ctx.fillStyle = "#b9aca0"; // mortar base
  ctx.fillRect(0, 0, size, size);

  for (let row = 0; row * brickH < size; row++) {
    const offset = row % 2 === 0 ? 0 : -brickW / 2;
    for (let col = -1; col * brickW < size + brickW; col++) {
      const bx = offset + col * brickW + mortar / 2;
      const by = row * brickH + mortar / 2;
      const tone = 0.85 + Math.random() * 0.3;
      ctx.fillStyle = `rgb(${Math.floor(156 * tone)}, ${Math.floor(90 * tone)}, ${Math.floor(68 * tone)})`;
      ctx.fillRect(bx, by, brickW - mortar, brickH - mortar);

      // Brick surface noise
      for (let i = 0; i < 26; i++) {
        const gray = 60 + Math.random() * 90;
        ctx.fillStyle = `rgba(${gray}, ${Math.floor(gray * 0.66)}, ${Math.floor(gray * 0.5)}, ${0.06 + Math.random() * 0.1})`;
        ctx.fillRect(bx + Math.random() * (brickW - mortar), by + Math.random() * (brickH - mortar), 1 + Math.random() * 3, 1 + Math.random() * 2);
      }
    }
  }

  return toRepeatingTexture(canvas);
}

function createBrickNormal(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);
  const brickH = 42;
  const brickW = 128;
  for (let row = 0; row * brickH < size; row++) {
    ctx.fillStyle = "#5a5aff";
    ctx.fillRect(0, row * brickH, size, 4);
    const offset = row % 2 === 0 ? 0 : -brickW / 2;
    for (let col = -1; col * brickW < size + brickW; col++) {
      ctx.fillRect(offset + col * brickW, row * brickH, 4, brickH);
    }
  }
  return toRepeatingTexture(canvas);
}

// ── Style registry + cache ──

const STYLE_FACTORIES: Record<ProceduralTextureStyle, () => SurfaceTextureSet> = {
  tile: () => ({ map: createTileMap(), normalMap: createTileNormal() }),
  plaster: () => ({ map: createPlasterMap(), normalMap: createNoiseNormal(256, 150, 8) }),
  concrete: () => ({ map: createConcreteMap(), normalMap: createNoiseNormal(512, 420, 14) }),
  wood: () => ({ map: createWoodMap(), normalMap: createWoodNormal() }),
  carpet: () => ({ map: createCarpetMap(), normalMap: createNoiseNormal(256, 500, 18) }),
  marble: () => ({ map: createMarbleMap(), normalMap: createNoiseNormal(512, 120, 6) }),
  brick: () => ({ map: createBrickMap(), normalMap: createBrickNormal() }),
};

const textureCache = new Map<ProceduralTextureStyle, SurfaceTextureSet>();

/**
 * Lazily build (and cache) the albedo + normal texture pair for a style.
 * The cached textures are shared; callers must not mutate `repeat` on them —
 * use `cloneSurfaceTexturesWithRepeat` when a surface needs its own tiling.
 */
export function getSurfaceTextures(style: ProceduralTextureStyle): SurfaceTextureSet {
  let entry = textureCache.get(style);
  if (!entry) {
    entry = STYLE_FACTORIES[style]();
    textureCache.set(style, entry);
  }
  return entry;
}

const scaledTextureCache = new Map<string, SurfaceTextureSet>();

/**
 * Cached texture pair with a specific repeat so per-surface tiling (floor
 * width/depth, appearance textureScale) cannot fight over the shared
 * texture instance. Variants share the underlying image data (cheap) and
 * are cached by (style, repeat) so render loops never churn GPU textures.
 */
export function cloneSurfaceTexturesWithRepeat(
  style: ProceduralTextureStyle,
  repeatX: number,
  repeatY: number,
): SurfaceTextureSet {
  const key = `${style}:${repeatX}x${repeatY}`;
  let entry = scaledTextureCache.get(key);
  if (!entry) {
    const base = getSurfaceTextures(style);
    const map = base.map.clone();
    const normalMap = base.normalMap.clone();
    map.repeat.set(repeatX, repeatY);
    normalMap.repeat.set(repeatX, repeatY);
    map.needsUpdate = true;
    normalMap.needsUpdate = true;
    entry = { map, normalMap };
    scaledTextureCache.set(key, entry);
  }
  return entry;
}
