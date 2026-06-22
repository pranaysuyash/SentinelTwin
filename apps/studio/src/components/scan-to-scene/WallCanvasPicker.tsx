"use client";

/**
 * WallCanvasPicker — buyer-grade floor-plan wall correction (Intake Pass I3).
 *
 * Replaces the checkbox list of "Keep wall 1: (x,y) → (x,y) · 12.3px" that was
 * the 06-17 buyer trust-break moment (see `Docs/notes/live_demo_session_2026-06-17.md:123`
 * — "1335 walls detected?" and the follow-up 06-19 note "large wall lists
 * rely on manual scrolling; no filter/search yet").
 *
 * First-principles: a buyer cannot operate a 1000-row checkbox list, but they
 * can click a wall on a picture of their floor plan. Each wall is a clickable
 * SVG line segment — kept walls render solid in `MAP_COLORS.wall`, dropped
 * walls render dimmed + dashed. Running kept/total stats update live above
 * the canvas. Bulk actions (Keep all / Exclude all) remain for power users.
 *
 * Visual system (Visual Pass V1): canvas colors come from `MAP_COLORS` (the
 * canonical canvas palette); semantic UI tones (the live stat, the "needs
 * review" hint) come from `UI_TONES`. The two never overlap (per §11).
 *
 * See `Docs/review/UI_REVIEW_2026-06-19.md` Intake Pass I3.
 */

import { useMemo } from "react";

import { MAP_COLORS } from "@/components/map/map-colors";
import { UI_TONES } from "@/lib/design-tokens";

export interface PickableWall {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface WallCanvasPickerProps {
  walls: PickableWall[];
  /** Per-wall keep mask; walls past the array length default to kept. */
  mask: boolean[];
  /** Pixel width of the source floor-plan image (for coordinate scaling). */
  sourceWidthPx: number;
  /** Pixel height of the source floor-plan image. */
  sourceHeightPx: number;
  onToggle: (index: number) => void;
  /** Optional max canvas height; canvas scales to fit width while preserving aspect. */
  maxCanvasHeight?: number;
}

const PADDING = 8;
const DROPPED_OPACITY = 0.22;

export function WallCanvasPicker({
  walls,
  mask,
  sourceWidthPx,
  sourceHeightPx,
  onToggle,
  maxCanvasHeight = 320,
}: WallCanvasPickerProps) {
  // Compute viewBox from the wall bounds (not the source image dimensions,
  // which may include legend/title regions that aren't walls — that was part
  // of the 06-17 "it counts the legend as walls" failure). Tight bounds keep
  // the geometry centered and legible.
  const bounds = useMemo(() => {
    if (walls.length === 0) {
      return { minX: 0, minY: 0, maxX: sourceWidthPx || 1, maxY: sourceHeightPx || 1 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const w of walls) {
      minX = Math.min(minX, w.start.x, w.end.x);
      minY = Math.min(minY, w.start.y, w.end.y);
      maxX = Math.max(maxX, w.start.x, w.end.x);
      maxY = Math.max(maxY, w.start.y, w.end.y);
    }
    // Floor the span at 1px so we never divide by zero on degenerate input.
    return {
      minX,
      minY,
      maxX: Math.max(maxX, minX + 1),
      maxY: Math.max(maxY, minY + 1),
    };
  }, [walls, sourceWidthPx, sourceHeightPx]);

  const vbX = bounds.minX - PADDING;
  const vbY = bounds.minY - PADDING;
  const vbW = bounds.maxX - bounds.minX + PADDING * 2;
  const vbH = bounds.maxY - bounds.minY + PADDING * 2;

  const keptCount = walls.reduce((acc, _w, i) => acc + (mask[i] ?? true ? 1 : 0), 0);
  const droppedCount = walls.length - keptCount;
  const tone = keptCount === walls.length ? UI_TONES.success : droppedCount > walls.length * 0.4 ? UI_TONES.danger : UI_TONES.warning;
  const reviewHint = droppedCount === 0
    ? "All walls kept — review the preview to confirm the shell matches your site."
    : droppedCount > walls.length * 0.4
      ? "Many walls excluded — verify the kept shell still encloses the real rooms."
      : `${droppedCount} wall${droppedCount === 1 ? "" : "s"} excluded — click any segment on the canvas to toggle.`;

  return (
    <div className="flex flex-col gap-2">
      {/* Running before/after stats + review hint. */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`rounded border px-2 py-0.5 font-semibold ${tone.border} ${tone.bg} ${tone.text}`}>
          {keptCount} / {walls.length} kept
        </span>
        {droppedCount > 0 ? (
          <span className={`${UI_TONES.neutral.text}`}>{droppedCount} excluded</span>
        ) : null}
        <span className={`${UI_TONES.neutral.text} opacity-80`}>{reviewHint}</span>
      </div>

      {/* The mini-canvas. SVG scales to container width via viewBox; height
          caps at maxCanvasHeight to keep the layout bounded on huge plans. */}
      <div
        className="relative overflow-hidden rounded-lg border border-[#1b2233] bg-[#070a12]"
        style={{ maxHeight: maxCanvasHeight }}
      >
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full"
          style={{ maxHeight: maxCanvasHeight }}
          role="img"
          aria-label={`Floor-plan wall picker — ${keptCount} of ${walls.length} walls kept. Click a segment to toggle.`}
        >
          {/* Faint bounding rectangle so the operator sees the plan extents. */}
          <rect
            x={bounds.minX}
            y={bounds.minY}
            width={bounds.maxX - bounds.minX}
            height={bounds.maxY - bounds.minY}
            fill="none"
            stroke={MAP_COLORS.grid}
            strokeWidth={Math.max(1, vbW / 400)}
            strokeDasharray={`${Math.max(2, vbW / 100)} ${Math.max(2, vbW / 100)}`}
            opacity={0.4}
          />
          {walls.map((wall, i) => {
            const kept = mask[i] ?? true;
            const stroke = MAP_COLORS.wall;
            // Scale stroke width with the viewBox so lines stay visible at any zoom.
            const sw = Math.max(1.2, vbW / 600);
            return (
              <line
                key={`wall-seg-${i}`}
                x1={wall.start.x}
                y1={wall.start.y}
                x2={wall.end.x}
                y2={wall.end.y}
                stroke={stroke}
                strokeWidth={kept ? sw * 2.2 : sw}
                strokeLinecap="round"
                opacity={kept ? 1 : DROPPED_OPACITY}
                strokeDasharray={kept ? undefined : `${sw * 2} ${sw * 2}`}
                className="cursor-pointer transition-opacity"
                onClick={() => onToggle(i)}
              >
                <title>
                  Wall {i + 1}: ({wall.start.x.toFixed(0)},{wall.start.y.toFixed(0)}) → ({wall.end.x.toFixed(0)},{wall.end.y.toFixed(0)}) — {kept ? "kept, click to exclude" : "excluded, click to keep"}
                </title>
              </line>
            );
          })}
        </svg>
      </div>

      {/* Bulk actions for power users — kept compact below the canvas. */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#7f93b3]">
        <span className="opacity-70">Bulk:</span>
        <button
          type="button"
          onClick={() => walls.forEach((_w, i) => !mask[i] && onToggle(i))}
          className="rounded border border-[#2a3045] px-2 py-0.5 text-[10px] text-[#93a5c7] hover:border-[#3a4358] hover:text-white"
        >
          Keep all
        </button>
        <button
          type="button"
          onClick={() => walls.forEach((_w, i) => (mask[i] ?? true) && onToggle(i))}
          className="rounded border border-[#2a3045] px-2 py-0.5 text-[10px] text-[#93a5c7] hover:border-[#3a4358] hover:text-white"
        >
          Exclude all
        </button>
      </div>
    </div>
  );
}
