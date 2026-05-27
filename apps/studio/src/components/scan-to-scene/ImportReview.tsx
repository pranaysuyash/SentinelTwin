"use client";

import { AlertTriangle, CheckCircle2, ImageUp, RotateCcw } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { normalizeFloorPlanResult, type FloorPlanResult } from "@/lib/floor-plan-import";

interface ImportReviewProps {
  result: FloorPlanResult;
  warnings: string[];
  onImageChange: () => void;
  onRecalibrate: (calibration: { widthM?: number; depthM?: number; heightM?: number }) => void;
  onUpdateResult: (result: FloorPlanResult) => void;
}

export function ImportReview({ result, warnings, onImageChange, onRecalibrate, onUpdateResult }: ImportReviewProps) {
  const [widthM, setWidthM] = useState(result.roomDimensions.widthM.toString());
  const [depthM, setDepthM] = useState(result.roomDimensions.depthM.toString());
  const [heightM, setHeightM] = useState(result.roomDimensions.heightM.toString());
  const [draftWalls, setDraftWalls] = useState(result.walls);
  const [wallMask, setWallMask] = useState<boolean[]>(result.walls.map(() => true));
  const [doorMask, setDoorMask] = useState<boolean[]>(result.doors.map(() => true));
  const [windowMask, setWindowMask] = useState<boolean[]>(result.windows.map(() => true));
  const [draftDoors, setDraftDoors] = useState(result.doors);
  const [draftWindows, setDraftWindows] = useState(result.windows);
  const [dragging, setDragging] = useState<
    | { type: "door" | "window"; index: number }
    | { type: "wall-start" | "wall-end"; index: number }
    | null
  >(null);

  useEffect(() => {
    setDraftWalls(result.walls);
    setDraftDoors(result.doors);
    setDraftWindows(result.windows);
    setWallMask(result.walls.map(() => true));
    setDoorMask(result.doors.map(() => true));
    setWindowMask(result.windows.map(() => true));
    setDragging(null);
  }, [result]);

  const hasCalibrationChange = useMemo(
    () =>
      Number(widthM) !== result.roomDimensions.widthM ||
      Number(depthM) !== result.roomDimensions.depthM ||
      Number(heightM) !== result.roomDimensions.heightM,
    [widthM, depthM, heightM, result.roomDimensions.widthM, result.roomDimensions.depthM, result.roomDimensions.heightM],
  );
  const hasFilteredEdits = useMemo(() => {
    const masksChanged = wallMask.some((v) => !v) || doorMask.some((v) => !v) || windowMask.some((v) => !v);
    const wallMoved = draftWalls.some((wall, index) => {
      const base = result.walls[index];
      return base && (
        base.start.x !== wall.start.x ||
        base.start.y !== wall.start.y ||
        base.end.x !== wall.end.x ||
        base.end.y !== wall.end.y
      );
    });
    const openingMoved = draftDoors.some((door, index) => {
      const base = result.doors[index];
      return base && (base.position.x !== door.position.x || base.position.y !== door.position.y);
    }) || draftWindows.some((window, index) => {
      const base = result.windows[index];
      return base && (base.position.x !== window.position.x || base.position.y !== window.position.y);
    });
    return masksChanged || wallMoved || openingMoved;
  }, [wallMask, doorMask, windowMask, draftWalls, draftDoors, draftWindows, result]);
  const preview = useMemo(() => {
    const walls = draftWalls.map((wall, index) => ({ wall, kept: wallMask[index] ?? true }));
    const doors = draftDoors.map((door, index) => ({ opening: door, kept: doorMask[index] ?? true }));
    const windows = draftWindows.map((window, index) => ({ opening: window, kept: windowMask[index] ?? true }));
    return { walls, doors, windows };
  }, [result, draftWalls, wallMask, doorMask, windowMask, draftDoors, draftWindows]);

  const updateDraggedOpening = (
    event: ReactPointerEvent<SVGSVGElement>,
    target:
      | { type: "door" | "window"; index: number }
      | { type: "wall-start" | "wall-end"; index: number },
  ) => {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.round(((event.clientX - rect.left) / rect.width) * result.imageWidth);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * result.imageHeight);
    if (target.type === "door") {
      setDraftDoors((prev) => prev.map((door, index) => (index === target.index ? { ...door, position: { x, y } } : door)));
      return;
    }
    if (target.type === "wall-start") {
      setDraftWalls((prev) => prev.map((wall, index) => (index === target.index ? { ...wall, start: { x, y } } : wall)));
      return;
    }
    if (target.type === "wall-end") {
      setDraftWalls((prev) => prev.map((wall, index) => (index === target.index ? { ...wall, end: { x, y } } : wall)));
      return;
    }
    if (target.type === "window") {
      setDraftWindows((prev) => prev.map((window, index) => (index === target.index ? { ...window, position: { x, y } } : window)));
    }
  };

  return (
    <div className="space-y-3">
      {/* Confidence & metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-[#1e2130] bg-[#070a12] p-2 text-center">
          <div className="text-[14px] font-bold text-[#c5ccdb]">
            {result.walls.length}
          </div>
          <div className="text-[8px] text-[#59637a]">Walls Detected</div>
        </div>
        <div className="rounded-lg border border-[#1e2130] bg-[#070a12] p-2 text-center">
          <div className="text-[14px] font-bold text-[#c5ccdb]">
            {(result.confidence * 100).toFixed(0)}%
          </div>
          <div className="text-[8px] text-[#59637a]">Confidence</div>
        </div>
        <div className="rounded-lg border border-[#1e2130] bg-[#070a12] p-2 text-center">
          <div className="text-[14px] font-bold text-[#c5ccdb]">
            {result.roomDimensions.widthM}×{result.roomDimensions.depthM}
          </div>
          <div className="text-[8px] text-[#59637a]">Room Size (m)</div>
        </div>
      </div>

      {/* Detection details */}
      <div className="rounded-lg border border-[#1e2130] bg-[#070a12] p-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-medium text-[#59637a]">Detection Details</span>
        </div>
        <div className="mt-1.5 space-y-1">
          <div className="flex justify-between text-[8px]">
            <span className="text-[#3a4158]">Image Size</span>
            <span className="text-[#68738a]">{result.imageWidth}×{result.imageHeight}px</span>
          </div>
          <div className="flex justify-between text-[8px]">
            <span className="text-[#3a4158]">Scale</span>
            <span className="text-[#68738a]">{result.scalePixelsPerMeter} px/m</span>
          </div>
          <div className="flex justify-between text-[8px]">
            <span className="text-[#3a4158]">Doors Detected</span>
            <span className="text-[#68738a]">{result.doors.length}</span>
          </div>
          <div className="flex justify-between text-[8px]">
            <span className="text-[#3a4158]">Windows Detected</span>
            <span className="text-[#68738a]">{result.windows.length}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#1e2130] bg-[#070a12] p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[9px] font-medium text-[#59637a]">Detection Corrections</span>
          <button
            onClick={() => {
              setWallMask(result.walls.map(() => true));
              setDoorMask(result.doors.map(() => true));
              setWindowMask(result.windows.map(() => true));
              setDraftWalls(result.walls);
              setDraftDoors(result.doors);
              setDraftWindows(result.windows);
              setDragging(null);
            }}
            className="text-[8px] text-[#8ea5c6] hover:text-white"
          >
            Reset
          </button>
        </div>

        <div className="mb-2 rounded border border-[#1b2233] bg-[#0b1220] p-1.5">
          <div className="mb-1 text-[8px] uppercase tracking-[0.14em] text-[#4f5a72]">Spatial Preview</div>
          <svg
            viewBox={`0 0 ${result.imageWidth} ${result.imageHeight}`}
            className="h-24 w-full rounded bg-[#060a12]"
            onPointerMove={(event) => {
              if (!dragging) return;
              updateDraggedOpening(event, dragging);
            }}
            onPointerUp={() => setDragging(null)}
            onPointerLeave={() => setDragging(null)}
          >
            {preview.walls.map(({ wall, kept }, idx) => (
              <g key={`pw-${idx}`}>
                <line
                  x1={wall.start.x}
                  y1={wall.start.y}
                  x2={wall.end.x}
                  y2={wall.end.y}
                  stroke={kept ? "#7dd3fc" : "#fb7185"}
                  strokeOpacity={kept ? 0.9 : 0.45}
                  strokeWidth={kept ? 4 : 2}
                  strokeDasharray={kept ? undefined : "4 4"}
                />
                <circle
                  cx={wall.start.x}
                  cy={wall.start.y}
                  r={4}
                  fill={kept ? "#bae6fd" : "#fecdd3"}
                  fillOpacity={kept ? 0.9 : 0.45}
                  style={{ cursor: "grab" }}
                  onPointerDown={() => setDragging({ type: "wall-start", index: idx })}
                />
                <circle
                  cx={wall.end.x}
                  cy={wall.end.y}
                  r={4}
                  fill={kept ? "#bae6fd" : "#fecdd3"}
                  fillOpacity={kept ? 0.9 : 0.45}
                  style={{ cursor: "grab" }}
                  onPointerDown={() => setDragging({ type: "wall-end", index: idx })}
                />
              </g>
            ))}
            {preview.doors.map(({ opening, kept }, idx) => (
              <rect
                key={`pd-${idx}`}
                x={opening.position.x - 6}
                y={opening.position.y - 6}
                width={12}
                height={12}
                fill={kept ? "#34d399" : "#fb7185"}
                fillOpacity={kept ? 0.9 : 0.45}
                style={{ cursor: "grab" }}
                onPointerDown={() => setDragging({ type: "door", index: idx })}
              />
            ))}
            {preview.windows.map(({ opening, kept }, idx) => (
              <circle
                key={`pwnd-${idx}`}
                cx={opening.position.x}
                cy={opening.position.y}
                r={6}
                fill={kept ? "#60a5fa" : "#fb7185"}
                fillOpacity={kept ? 0.9 : 0.45}
                style={{ cursor: "grab" }}
                onPointerDown={() => setDragging({ type: "window", index: idx })}
              />
            ))}
          </svg>
          <div className="mt-1 text-[8px] text-[#4f5a72]">Blue/cyan/green = kept, red = excluded. Drag wall endpoints and door/window markers to correct placement.</div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const idx = draftWalls.findIndex((_, i) => wallMask[i] ?? true);
              if (idx === -1) return;
              const wall = draftWalls[idx];
              const midX = Math.round((wall.start.x + wall.end.x) / 2);
              const midY = Math.round((wall.start.y + wall.end.y) / 2);
              const a = { start: wall.start, end: { x: midX, y: midY }, detected: wall.detected };
              const b = { start: { x: midX, y: midY }, end: wall.end, detected: wall.detected };
              const next = [...draftWalls];
              next.splice(idx, 1, a, b);
              setDraftWalls(next);
              setWallMask((prev) => {
                const copy = [...prev];
                copy.splice(idx, 1, true, true);
                return copy;
              });
            }}
            className="rounded border border-[#2a3045] px-2 py-1 text-[8px] text-[#93a5c7] hover:border-blue-500/40 hover:text-white"
          >
            Split First Kept Wall
          </button>
          <button
            type="button"
            onClick={() => {
              const kept = draftWalls
                .map((wall, index) => ({ wall, index }))
                .filter(({ index }) => wallMask[index] ?? true);
              if (kept.length < 2) return;
              const first = kept[0].wall;
              const second = kept[1].wall;
              const merged = { start: first.start, end: second.end, detected: first.detected || second.detected };
              const drop = new Set([kept[0].index, kept[1].index]);
              const next = draftWalls.filter((_, index) => !drop.has(index));
              next.unshift(merged);
              setDraftWalls(next);
              setWallMask(new Array(next.length).fill(true));
            }}
            className="rounded border border-[#2a3045] px-2 py-1 text-[8px] text-[#93a5c7] hover:border-blue-500/40 hover:text-white"
          >
            Merge First Two Kept Walls
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftWalls((prev) => prev.map((wall) => {
                const dx = wall.end.x - wall.start.x;
                const dy = wall.end.y - wall.start.y;
                if (Math.abs(dx) >= Math.abs(dy)) {
                  return { ...wall, end: { x: wall.end.x, y: wall.start.y } };
                }
                return { ...wall, end: { x: wall.start.x, y: wall.end.y } };
              }));
            }}
            className="rounded border border-[#2a3045] px-2 py-1 text-[8px] text-[#93a5c7] hover:border-blue-500/40 hover:text-white"
          >
            Snap Kept Walls Orthogonal
          </button>
        </div>

        <div className="space-y-1.5">
          <div>
            <div className="mb-1 text-[8px] uppercase tracking-[0.14em] text-[#4f5a72]">Walls</div>
            <div className="max-h-20 space-y-1 overflow-y-auto pr-1">
              {draftWalls.slice(0, 20).map((wall, index) => (
                <label key={`wall-${index}`} className="flex items-center justify-between rounded border border-[#1b2233] px-1.5 py-1 text-[8px] text-[#9bb0ce]">
                  <span>
                    W{index + 1}: ({wall.start.x},{wall.start.y}) → ({wall.end.x},{wall.end.y})
                  </span>
                  <input
                    type="checkbox"
                    checked={wallMask[index] ?? true}
                    onChange={(event) => {
                      const next = [...wallMask];
                      next[index] = event.target.checked;
                      setWallMask(next);
                    }}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <div className="mb-1 text-[8px] uppercase tracking-[0.14em] text-[#4f5a72]">Doors</div>
              <div className="max-h-16 space-y-1 overflow-y-auto pr-1">
                {result.doors.length === 0 ? (
                  <div className="text-[8px] text-[#4f5a72]">None detected</div>
                ) : draftDoors.map((door, index) => (
                  <label key={`door-${index}`} className="flex items-center justify-between rounded border border-[#1b2233] px-1.5 py-1 text-[8px] text-[#9bb0ce]">
                    <span>D{index + 1}: {door.widthM}m @ ({door.position.x},{door.position.y})</span>
                    <input
                      type="checkbox"
                      checked={doorMask[index] ?? true}
                      onChange={(event) => {
                        const next = [...doorMask];
                        next[index] = event.target.checked;
                        setDoorMask(next);
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[8px] uppercase tracking-[0.14em] text-[#4f5a72]">Windows</div>
              <div className="max-h-16 space-y-1 overflow-y-auto pr-1">
                {result.windows.length === 0 ? (
                  <div className="text-[8px] text-[#4f5a72]">None detected</div>
                ) : draftWindows.map((window, index) => (
                  <label key={`window-${index}`} className="flex items-center justify-between rounded border border-[#1b2233] px-1.5 py-1 text-[8px] text-[#9bb0ce]">
                    <span>Wn{index + 1}: {window.widthM}m @ ({window.position.x},{window.position.y})</span>
                    <input
                      type="checkbox"
                      checked={windowMask[index] ?? true}
                      onChange={(event) => {
                        const next = [...windowMask];
                        next[index] = event.target.checked;
                        setWindowMask(next);
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[8px] text-[#4f5a72]">Uncheck false detections, then apply.</span>
          <button
            disabled={!hasFilteredEdits}
            onClick={() => {
              const filtered: FloorPlanResult = {
                ...result,
                walls: draftWalls.filter((_, idx) => wallMask[idx]),
                doors: draftDoors.filter((_, idx) => doorMask[idx]),
                windows: draftWindows.filter((_, idx) => windowMask[idx]),
              };
              onUpdateResult(normalizeFloorPlanResult(filtered));
            }}
            className="rounded border border-[#2a3045] px-2 py-1 text-[8px] text-[#93a5c7] transition-colors hover:border-blue-500/40 hover:text-white disabled:opacity-40"
          >
            Apply Corrections
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[#1e2130] bg-[#070a12] p-2">
        <div className="mb-1.5 text-[9px] font-medium text-[#59637a]">Scale Calibration (meters)</div>
        <div className="grid grid-cols-3 gap-1.5">
          <label className="text-[8px] text-[#59637a]">
            Width
            <input
              value={widthM}
              onChange={(event) => setWidthM(event.target.value)}
              className="mt-0.5 w-full rounded border border-[#1e2130] bg-[#0a0f18] px-1.5 py-1 text-[9px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
            />
          </label>
          <label className="text-[8px] text-[#59637a]">
            Depth
            <input
              value={depthM}
              onChange={(event) => setDepthM(event.target.value)}
              className="mt-0.5 w-full rounded border border-[#1e2130] bg-[#0a0f18] px-1.5 py-1 text-[9px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
            />
          </label>
          <label className="text-[8px] text-[#59637a]">
            Height
            <input
              value={heightM}
              onChange={(event) => setHeightM(event.target.value)}
              className="mt-0.5 w-full rounded border border-[#1e2130] bg-[#0a0f18] px-1.5 py-1 text-[9px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
            />
          </label>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[8px] text-[#4f5a72]">Use known room dimensions to refine scale.</span>
          <button
            onClick={() => {
              const nextWidth = Number(widthM);
              const nextDepth = Number(depthM);
              const nextHeight = Number(heightM);
              if (Number.isFinite(nextWidth) && Number.isFinite(nextDepth) && Number.isFinite(nextHeight) && nextWidth > 0 && nextDepth > 0 && nextHeight > 0) {
                onRecalibrate({ widthM: nextWidth, depthM: nextDepth, heightM: nextHeight });
              }
            }}
            disabled={!hasCalibrationChange}
            className="rounded border border-[#2a3045] px-2 py-1 text-[8px] text-[#93a5c7] transition-colors hover:border-blue-500/40 hover:text-white disabled:opacity-40"
          >
            Apply Calibration
          </button>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
          <div className="flex items-center gap-1 text-[9px] font-medium text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Detection Warnings
          </div>
          <ul className="mt-1 space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1 text-[8px] text-amber-300/80">
                <span className="mt-0.5 block h-1 w-1 flex-shrink-0 rounded-full bg-amber-400/40" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success state */}
      {warnings.length === 0 && result.walls.length >= 4 && (
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          <span className="text-[9px] text-emerald-300">Floor plan processed successfully</span>
        </div>
      )}

      {/* Re-upload button */}
      <button
        onClick={onImageChange}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#1e2130] px-3 py-2 text-[9px] text-[#59637a] transition-colors hover:border-[#2a3045] hover:text-[#68738a]"
      >
        <RotateCcw className="h-3 w-3" />
        Choose different image
        <ImageUp className="h-3 w-3" />
      </button>
    </div>
  );
}
