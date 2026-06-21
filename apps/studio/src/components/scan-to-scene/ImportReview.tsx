"use client";

import { AlertTriangle, CheckCircle2, ImageUp, Lock, RotateCcw } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  getFloorPlanDiagnostics,
  normalizeFloorPlanResult,
  type FloorPlanGateDecision,
  type FloorPlanResult,
  type FloorPlanSemanticContext,
  type FloorPlanSourceProfile,
} from "@/lib/floor-plan-import";
// Trust Pass T1 — canonical confidence renderer. Enforces warning-gating
// (never 100% when unresolved warnings exist) and carries a source tag.
import {
  CONFIDENCE_TONE_CLASSES,
  renderConfidence,
} from "@/lib/confidence-display";

interface ImportReviewProps {
  result: FloorPlanResult;
  semanticContext?: FloorPlanSemanticContext | null;
  gateDecision?: FloorPlanGateDecision | null;
  warnings: string[];
  onImageChange: () => void;
  onRecalibrate: (calibration: { widthM?: number; depthM?: number; heightM?: number }) => void;
  onUpdateResult: (result: FloorPlanResult) => void;
  sourceProfile?: FloorPlanSourceProfile;
  sourceHint?: string;
}

export function ImportReview({
  result,
  semanticContext,
  gateDecision,
  warnings,
  onImageChange,
  onRecalibrate,
  onUpdateResult,
  sourceProfile = "architectural",
  sourceHint,
}: ImportReviewProps) {
  const [widthM, setWidthM] = useState(result.roomDimensions.widthM.toString());
  const [depthM, setDepthM] = useState(result.roomDimensions.depthM.toString());
  const [heightM, setHeightM] = useState(result.roomDimensions.heightM.toString());
  const [draftWalls, setDraftWalls] = useState(result.walls);
  const [wallMask, setWallMask] = useState<boolean[]>(result.walls.map(() => true));
  const [doorMask, setDoorMask] = useState<boolean[]>(result.doors.map(() => true));
  const [windowMask, setWindowMask] = useState<boolean[]>(result.windows.map(() => true));
  const [draftDoors, setDraftDoors] = useState(result.doors);
  const [draftWindows, setDraftWindows] = useState(result.windows);
  const [showAllWallRows, setShowAllWallRows] = useState(false);
  const [showAllDoorRows, setShowAllDoorRows] = useState(false);
  const [showAllWindowRows, setShowAllWindowRows] = useState(false);
  const [dragging, setDragging] = useState<
    | { type: "door" | "window"; index: number }
    | { type: "wall-start" | "wall-end"; index: number }
    | null
  >(null);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setDraftWalls(result.walls);
      setDraftDoors(result.doors);
      setDraftWindows(result.windows);
      setWallMask(result.walls.map(() => true));
      setDoorMask(result.doors.map(() => true));
      setWindowMask(result.windows.map(() => true));
      setDragging(null);
      setLastActionMessage(null);
    });
  }, [result]);

  const [nextWidthM, nextDepthM, nextHeightM] = useMemo(
    () => [
      Number(widthM),
      Number(depthM),
      Number(heightM),
    ],
    [widthM, depthM, heightM],
  );
  const hasCalibrationChange = useMemo(
    () =>
      Number.isFinite(nextWidthM) &&
      Number.isFinite(nextDepthM) &&
      Number.isFinite(nextHeightM) &&
      nextWidthM > 0 &&
      nextDepthM > 0 &&
      nextHeightM > 0 &&
      (nextWidthM !== result.roomDimensions.widthM ||
        nextDepthM !== result.roomDimensions.depthM ||
        nextHeightM !== result.roomDimensions.heightM),
    [nextHeightM, nextDepthM, nextWidthM, result.roomDimensions.depthM, result.roomDimensions.heightM, result.roomDimensions.widthM],
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
  const diagnostics = useMemo(() => getFloorPlanDiagnostics(result), [result]);
  const unresolvedCount = warnings.length;
  // Trust Pass T1 — confidence now flows through the canonical
  // `renderConfidence` helper (`@/lib/confidence-display`), which enforces
  // the warning-gating rule (never 100% when unresolved warnings exist) and
  // carries a source decomposition. This replaces the local 0.75/0.50 band
  // map that drifted from the rest of the codebase and produced the 06-17
  // "100% next to severe warnings" trust break. See
  // `Docs/review/UI_REVIEW_2026-06-19.md` Trust Pass T1.
  const renderedConfidence = renderConfidence({
    confidence: result.confidence,
    unresolvedWarningCount: unresolvedCount,
    detectorCandidateCount: result.rawWallSegmentCount ?? result.walls.length,
  });
  const confidencePct = renderedConfidence.pct;
  const confidenceBand = renderedConfidence.band;
  const hasManualCalibration = Boolean(result.manualCalibration);
  const qualityPct = semanticContext ? Math.round(semanticContext.qualityScore * 100) : null;
  const rawWallSegmentCount = result.rawWallSegmentCount ?? result.walls.length;
  const removedBeforeDraftCount = Math.max(0, rawWallSegmentCount - draftWalls.length);
  const shortWallThresholdPx = useMemo(
    () => Number((Math.max(12, result.scalePixelsPerMeter * 0.35)).toFixed(2)),
    [result.scalePixelsPerMeter],
  );
  const keptWallCount = useMemo(
    () => draftWalls.reduce((count, _, index) => count + ((wallMask[index] ?? true) ? 1 : 0), 0),
    [draftWalls, wallMask],
  );
  const shortWallIndexes = useMemo(() => {
    const next: number[] = [];
    for (let index = 0; index < draftWalls.length; index += 1) {
      const wall = draftWalls[index];
      const isKept = wallMask[index] ?? true;
      const lengthPx = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
      if (isKept && lengthPx < shortWallThresholdPx) {
        next.push(index);
      }
    }
    return next;
  }, [draftWalls, shortWallThresholdPx, wallMask]);
  const wallListLimit = 24;
  const doorWindowListLimit = 16;
  const visibleWallRows = useMemo(() => (showAllWallRows ? draftWalls : draftWalls.slice(0, wallListLimit)), [draftWalls, showAllWallRows]);
  const visibleDoorRows = useMemo(() => (showAllDoorRows ? draftDoors : draftDoors.slice(0, doorWindowListLimit)), [draftDoors, showAllDoorRows]);
  const visibleWindowRows = useMemo(() => (showAllWindowRows ? draftWindows : draftWindows.slice(0, doorWindowListLimit)), [draftWindows, showAllWindowRows]);
  const duplicateWallIndexes = useMemo(() => {
    const next = new Set<number>();
    for (let i = 0; i < draftWalls.length; i += 1) {
      for (let j = i + 1; j < draftWalls.length; j += 1) {
        if (!areWallsNearlyDuplicate(draftWalls[i], draftWalls[j])) continue;
        const keepIndex = wallLengthPx(draftWalls[i]) < wallLengthPx(draftWalls[j]) ? i : j;
        next.add(keepIndex);
      }
    }
    return [...next];
  }, [draftWalls]);
  const autoCleanupWallIndexes = useMemo(() => {
    const next = new Set<number>();
    shortWallIndexes.forEach((index) => next.add(index));
    duplicateWallIndexes.forEach((index) => next.add(index));
    return [...next];
  }, [duplicateWallIndexes, shortWallIndexes]);
  const canRunAutoCleanup = autoCleanupWallIndexes.length > 0;
  const previewViewport = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];

    draftWalls.forEach((wall, index) => {
      if (!(wallMask[index] ?? true)) return;
      xs.push(wall.start.x, wall.end.x);
      ys.push(wall.start.y, wall.end.y);
    });
    draftDoors.forEach((door, index) => {
      if (!(doorMask[index] ?? true)) return;
      xs.push(door.position.x);
      ys.push(door.position.y);
    });
    draftWindows.forEach((window, index) => {
      if (!(windowMask[index] ?? true)) return;
      xs.push(window.position.x);
      ys.push(window.position.y);
    });

    if (xs.length === 0 || ys.length === 0) {
      return {
        minX: 0,
        minY: 0,
        width: result.imageWidth,
        height: result.imageHeight,
      };
    }

    const minX = Math.max(0, Math.min(...xs) - 80);
    const maxX = Math.min(result.imageWidth, Math.max(...xs) + 80);
    const minY = Math.max(0, Math.min(...ys) - 80);
    const maxY = Math.min(result.imageHeight, Math.max(...ys) + 80);

    return {
      minX,
      minY,
      width: Math.max(240, maxX - minX),
      height: Math.max(180, maxY - minY),
    };
  }, [draftDoors, draftWalls, draftWindows, doorMask, result.imageHeight, result.imageWidth, wallMask, windowMask]);
  const nextStepGuidance = useMemo(() => {
    const guidance: string[] = [];
    if (gateDecision?.action === "human_review") {
      guidance.push("Manual review is required because the import still has signals that are too noisy to trust automatically.");
    }
    if (diagnostics.duplicateWallPairs > 0) {
      guidance.push(`Review duplicate walls first. ${diagnostics.duplicateWallPairs} near-duplicate pairs are still present.`);
    }
    if ((diagnostics.unsnappedDoorCount + diagnostics.unsnappedWindowCount) > 0) {
      guidance.push("Check door and window markers. Some openings are still not aligned to a matching wall.");
    }
    if (diagnostics.shortWallCount > 0) {
      guidance.push("Short wall fragments are still present. Exclude obvious noise before continuing.");
    }
    if (guidance.length === 0) {
      guidance.push("This draft looks coherent enough to continue. Move to review and create the draft scene shell.");
    }
    return guidance;
  }, [diagnostics.duplicateWallPairs, diagnostics.shortWallCount, diagnostics.unsnappedDoorCount, diagnostics.unsnappedWindowCount, gateDecision?.action]);
  const calibrationGuidance = useMemo(() => {
    if (hasManualCalibration) {
      return "Manual calibration is authoritative now: these values define the scene footprint and scale. The preview stays anchored to image pixels, so geometry looks stable while the room dimensions change underneath.";
    }
    return "Enter known dimensions here before final create. The next step is to lock values and scale; it does not move preview anchors.";
  }, [hasManualCalibration]);
  const calibrationSourceCopy = useMemo(() => {
    if (!hasManualCalibration) {
      return "Scene footprint is currently detector-derived. Enter exact dimensions below and apply to lock authoritative size.";
    }
    return "Manual calibration is active. Wall preview anchors remain in image pixels; only final scene scale and dimensions come from the override.";
  }, [hasManualCalibration]);
  const interpretationCopy = useMemo(() => {
    const copyForProfile = sourceProfile === "hand_drawn"
      ? "Hand-drawn plans commonly produce extra segments from text strokes and dimension notes."
      : sourceProfile === "low_res_scan"
        ? "Low-resolution scans commonly turn every text/line edge into multiple short segments."
        : "Architectural/CAD plans are usually cleaner, but legends and callouts can still appear as segments.";

    return {
      wallCounts: rawWallSegmentCount > keptWallCount
        ? `${rawWallSegmentCount} wall segments were detected. ${keptWallCount} are currently kept in the draft shell and ${removedBeforeDraftCount} were removed as pre-filtered noise or excluded in your edits.`
        : `${keptWallCount} wall segments are in the working shell. Pre-filter removal is currently low.`,
      sourceProfile: copyForProfile,
    };
  }, [keptWallCount, rawWallSegmentCount, removedBeforeDraftCount, sourceProfile]);

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
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#22314b] bg-[#0b1220] p-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9bb0cf]">Plan Source Understanding</div>
        <div className="mt-1 text-[12px] leading-5 text-[#9aaed0]">
          The detector is currently tuned for <span className="font-semibold text-[#d6e2f4]">{sourceProfile}</span>.
          {sourceHint ? <span> {sourceHint}</span> : null}
        </div>
      </div>
      <div className="rounded-2xl border border-[#22314b] bg-[#0b1220] p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9bb0cf]">Floor Plan Review</div>
            <div className="mt-1 max-w-[720px] text-[12px] leading-5 text-[#9aaed0]">Review the extracted shell before creating a draft. This screen is for calibration, false-positive cleanup, and opening placement checks.</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {hasManualCalibration ? (
              <span className="rounded border border-blue-500/30 bg-blue-500/12 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-blue-100">
                Manual footprint
              </span>
            ) : null}
            <span
              title={renderedConfidence.source + (renderedConfidence.gated ? " · capped below 100% due to unresolved warnings" : "")}
              className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${
                CONFIDENCE_TONE_CLASSES[renderedConfidence.tone].border
                + " " + CONFIDENCE_TONE_CLASSES[renderedConfidence.tone].bg
                + " " + CONFIDENCE_TONE_CLASSES[renderedConfidence.tone].text
              }`}
            >
              Import trust {confidencePct}% · {renderedConfidence.band}
            </span>
          </div>
        </div>
        {lastActionMessage != null ? (
          <div className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-200">
            {lastActionMessage}
          </div>
        ) : null}
        <div className="mt-4 grid gap-2 text-[10px] md:grid-cols-3">
          <div className="rounded-xl border border-[#1f2a3e] bg-[#0a101d] px-3 py-2 text-[#9fb2d1]">
            <div className="text-[#6f82a4]">Warnings</div>
            <div className={unresolvedCount > 0 ? "text-amber-200" : "text-emerald-200"}>{unresolvedCount} unresolved</div>
          </div>
          <div className="rounded-xl border border-[#1f2a3e] bg-[#0a101d] px-3 py-2 text-[#9fb2d1]">
            <div className="text-[#6f82a4]">Openings</div>
            <div>{result.doors.length + result.windows.length} total</div>
          </div>
          <div className="rounded-xl border border-[#1f2a3e] bg-[#0a101d] px-3 py-2 text-[#9fb2d1]">
            <div className="text-[#6f82a4]">Walls</div>
            <div>{keptWallCount} / {rawWallSegmentCount} kept</div>
            <div className="text-[9px] text-[#6d819f]">
              {rawWallSegmentCount > keptWallCount ? `${removedBeforeDraftCount} removed by pre-filter` : "No pre-filter removals"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#22314b] bg-[#0f1828] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9bb0cf]">Plan-understanding notes</div>
        <div className="mt-2 space-y-1 text-[12px] leading-5 text-[#9aaed0]">
          <p>{interpretationCopy.wallCounts}</p>
          <p>{interpretationCopy.sourceProfile}</p>
        </div>
      </div>

      {gateDecision ? (
        <div className="rounded-2xl border border-[#22314b] bg-[#0a111d] p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9bb0cf]">Tier 1 Gate</div>
              <div className="mt-1 text-[14px] font-medium text-[#d5deed]">{formatGateAction(gateDecision.action)}</div>
            </div>
            {qualityPct != null ? (
              <span className="rounded border border-[#2a3045] bg-[#0f1727] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#b2c4de]">
                Quality {qualityPct}%
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-[12px] leading-5 text-[#9aaed0]">{gateDecision.reason}</div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#1f2a3e] bg-[#0a111d] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9bb0cf]">What to check before continuing</div>
        <ul className="mt-3 space-y-2">
          {nextStepGuidance.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[13px] leading-5 text-[#d2ddf0]">
              <span className="mt-1 h-2 w-2 flex-none rounded-full bg-sky-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[#1e2130] bg-[#070a12] p-4 text-center">
            <div className="text-[22px] font-bold text-[#c5ccdb]">
              {keptWallCount}
            </div>
            <div className="text-[11px] text-[#59637a]">Kept Walls</div>
          </div>
        <div
          className={`rounded-2xl border bg-[#070a12] p-4 text-center ${
            renderedConfidence.gated ? "border-amber-500/40" : "border-[#1e2130]"
          }`}
          title={renderedConfidence.source}
        >
          <div className={`text-[22px] font-bold ${
            renderedConfidence.tone === "emerald" ? "text-emerald-300"
              : renderedConfidence.tone === "amber" ? "text-amber-200"
                : "text-rose-300"
          }`}>
            {confidencePct}%
          </div>
          <div className="text-[11px] text-[#59637a]">
            Import Trust
            {unresolvedCount > 0 ? (
              <span className="ml-1 text-amber-300">· {unresolvedCount} warning{unresolvedCount === 1 ? "" : "s"}</span>
            ) : null}
          </div>
          <div className="mt-0.5 text-[9px] leading-tight text-[#4a5568]">{renderedConfidence.source}</div>
        </div>
        <div
          className={
            "rounded-2xl border bg-[#070a12] p-4 text-center transition-colors " +
            // Trust Pass T2 — distinct visual grammar for user-authoritative
            // (locked) values vs system-derived values. A locked dimension
            // carries an emerald border + value color + lock icon so the buyer
            // can tell at a glance which numbers they own and which the system
            // derived. The prior identical typography was the 06-17 trust-break
            // enabler ("manually entered values were replaced by 12.5 x 7.9
            // after apply" — the UI gave no signal that the value had changed
            // source). See `Docs/review/UI_REVIEW_2026-06-19.md` Trust Pass T2.
            (hasManualCalibration
              ? "border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_0_1px_rgba(16,185,129,0.18)]"
              : "border-[#1e2130]")
          }
          title={hasManualCalibration ? "User-authoritative dimensions — these define the scene footprint and scale. The detector cannot overwrite them." : "System-derived dimensions from detector output — not yet locked."}
        >
          <div className={"flex items-center justify-center gap-1.5 text-[22px] font-bold " + (hasManualCalibration ? "text-emerald-300" : "text-[#c5ccdb]")}>
            {hasManualCalibration ? <Lock className="h-3.5 w-3.5 text-emerald-400" /> : null}
            <span>{result.roomDimensions.widthM}×{result.roomDimensions.depthM}</span>
          </div>
          <div className={"text-[11px] " + (hasManualCalibration ? "text-emerald-400/80 font-medium" : "text-[#59637a]")}>
            {hasManualCalibration ? "User-locked footprint" : "Scene Footprint (m)"}
          </div>
        </div>
      </div>

          <div className="rounded-2xl border border-[#1e2130] bg-[#070a12] p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-[#9bb0cf]">Detection Details</span>
        </div>
        <div className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-2">
          <div className="flex justify-between gap-3 text-[11px]">
            <span className="text-[#3a4158]">Image Size</span>
            <span className="text-[#68738a]">{result.imageWidth}×{result.imageHeight}px</span>
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <span className="text-[#3a4158]">Scale</span>
            <span className="text-[#68738a]">{result.scalePixelsPerMeter} px/m</span>
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <span className="text-[#3a4158]">Wall Segments</span>
            <span className="text-[#68738a]">
              {rawWallSegmentCount} candidate{rawWallSegmentCount === 1 ? "" : "s"} · {keptWallCount} kept
            </span>
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <span className="text-[#3a4158]">Short wall cutoff</span>
            <span className="text-[#68738a]">&lt; {shortWallThresholdPx}px {shortWallIndexes.length} pending</span>
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <span className="text-[#3a4158]">Doors Detected</span>
            <span className="text-[#68738a]">{result.doors.length}</span>
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <span className="text-[#3a4158]">Windows Detected</span>
            <span className="text-[#68738a]">{result.windows.length}</span>
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <span className="text-[#3a4158]">Wall Orientation</span>
            <span className="text-[#68738a]">H {diagnostics.horizontalWallCount} / V {diagnostics.verticalWallCount} / D {diagnostics.diagonalWallCount}</span>
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <span className="text-[#3a4158]">Review Flags</span>
            <span className="text-[#68738a]">{diagnostics.duplicateWallPairs} dup · {diagnostics.unsnappedDoorCount + diagnostics.unsnappedWindowCount} off-wall · {diagnostics.shortWallCount} short</span>
          </div>
          <div className="flex justify-between gap-3 text-[11px] md:col-span-2">
            <span className="text-[#3a4158]">Plan Coverage</span>
            <span className="text-[#68738a]">{Math.round(diagnostics.boundsCoverageRatio * 100)}% of image bounds</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#1e2130] bg-[#070a12] p-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium text-[#9bb0cf]">Detection Corrections</span>
          <button type="button"
            onClick={() => {
              setWallMask(result.walls.map(() => true));
              setDoorMask(result.doors.map(() => true));
              setWindowMask(result.windows.map(() => true));
              setDraftWalls(result.walls);
              setDraftDoors(result.doors);
              setDraftWindows(result.windows);
              setDragging(null);
              setLastActionMessage("Detection state reset to latest extracted geometry.");
            }}
            className="text-[11px] text-[#8ea5c6] hover:text-white"
          >
            Reset
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-[#1b2233] bg-[#0b1220] p-3">
          <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[#7f93b3]">Spatial Preview</div>
          <div className="mb-2 text-[12px] leading-5 text-[#9aaed0]">Preview is zoomed to the extracted geometry so you can inspect the actual draft shell instead of the full uploaded sheet.</div>
          <div className="mb-2 text-[10px] text-[#7f93b3]">
            Blue/cyan/green items are kept in the draft. Red items are excluded from the draft shell.
          </div>
          <svg
            viewBox={`${previewViewport.minX} ${previewViewport.minY} ${previewViewport.width} ${previewViewport.height}`}
            className="h-[28rem] w-full min-h-[360px] max-h-[60vh] rounded-xl border border-[#1b2233] bg-[#060a12]"
            preserveAspectRatio="xMidYMid meet"
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
          <div className="mt-2 text-[11px] leading-5 text-[#7f93b3]">Blue, cyan, and green items stay in the draft. Red items are excluded. Drag wall endpoints and opening markers to correct placement.</div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canRunAutoCleanup}
            onClick={() => {
              if (autoCleanupWallIndexes.length === 0) return;
              const next = [...wallMask];
              autoCleanupWallIndexes.forEach((index) => {
                next[index] = false;
              });
              setWallMask(next);
              setLastActionMessage(`Auto-cleaned ${autoCleanupWallIndexes.length} short/duplicate wall fragments.`);
            }}
            className="rounded-lg border border-[#2a3045] px-3 py-1.5 text-[11px] text-[#93a5c7] transition-colors hover:border-blue-500/40 hover:text-white disabled:opacity-40"
          >
            Auto-clean short + duplicate walls
          </button>
          <button
            type="button"
            disabled={shortWallIndexes.length === 0}
            onClick={() => {
              if (shortWallIndexes.length === 0) return;
              const next = [...wallMask];
              shortWallIndexes.forEach((index) => {
                next[index] = false;
              });
              setWallMask(next);
              setLastActionMessage(`Auto-filtered ${shortWallIndexes.length} short wall fragments shorter than ${shortWallThresholdPx}px.`);
            }}
            className="rounded-lg border border-[#2a3045] px-3 py-1.5 text-[11px] text-[#93a5c7] transition-colors hover:border-blue-500/40 hover:text-white disabled:opacity-40"
          >
            Auto-filter short walls
          </button>
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
            className="rounded-lg border border-[#2a3045] px-3 py-1.5 text-[11px] text-[#93a5c7] hover:border-blue-500/40 hover:text-white"
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
            className="rounded-lg border border-[#2a3045] px-3 py-1.5 text-[11px] text-[#93a5c7] hover:border-blue-500/40 hover:text-white"
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
            className="rounded-lg border border-[#2a3045] px-3 py-1.5 text-[11px] text-[#93a5c7] hover:border-blue-500/40 hover:text-white"
          >
            Snap Kept Walls Orthogonal
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-[#1f2a3e] bg-[#0a0f18] px-2 py-1.5 text-[10px] text-[#a5b8da]">
            Checkbox = keep/exclude. Checked keeps an item in the draft shell, unchecked excludes it from the shell.
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#7f93b3]">Walls</div>
              <div className="text-[11px] text-[#6d819f]">
                {keptWallCount} kept · {draftWalls.length - keptWallCount} excluded
              </div>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWallMask((prev) => prev.map(() => true))}
                className="rounded border border-[#2a3045] px-2 py-1 text-[10px] text-[#93a5c7] hover:border-blue-500/40 hover:text-white"
              >
                Keep all
              </button>
              <button
                type="button"
                onClick={() => setWallMask((prev) => prev.map(() => false))}
                className="rounded border border-[#2a3045] px-2 py-1 text-[10px] text-[#93a5c7] hover:border-blue-500/40 hover:text-white"
              >
                Exclude all
              </button>
            </div>
            <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {visibleWallRows.map((wall, index) => (
                <label key={`wall-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#1b2233] px-2 py-1.5 text-[11px] text-[#9bb0ce]">
                  <span>
                    Keep wall {index + 1}: ({wall.start.x},{wall.start.y}) → ({wall.end.x},{wall.end.y}) · {wallLengthPx(wall).toFixed(1)}px
                  </span>
                  <input
                    type="checkbox"
                    aria-label={`Keep wall ${index + 1}`}
                    checked={wallMask[index] ?? true}
                    onChange={(event) => {
                      const next = [...wallMask];
                      next[index] = event.target.checked;
                      setWallMask(next);
                    }}
                  />
                </label>
              ))}
              {draftWalls.length > wallListLimit ? (
                <div className="pt-1 text-[10px] text-[#6f82a4]">
                  {showAllWallRows
                    ? "Showing all wall rows."
                    : `${draftWalls.length - wallListLimit} additional walls are hidden.`}
                  <button
                    type="button"
                    className="ml-1 inline text-[#9bb0cf] underline decoration-dotted underline-offset-2 hover:text-white"
                    onClick={() => setShowAllWallRows((prev) => !prev)}
                  >
                    {showAllWallRows ? "Show first rows only" : "Show all"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#7f93b3]">Doors</div>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDoorMask((prev) => prev.map(() => true))}
                  className="rounded border border-[#2a3045] px-2 py-1 text-[10px] text-[#93a5c7] hover:border-blue-500/40 hover:text-white"
                >
                  Keep all
                </button>
                <button
                  type="button"
                  onClick={() => setDoorMask((prev) => prev.map(() => false))}
                  className="rounded border border-[#2a3045] px-2 py-1 text-[10px] text-[#93a5c7] hover:border-blue-500/40 hover:text-white"
                >
                  Exclude all
                </button>
              </div>
              <div className="max-h-24 space-y-1.5 overflow-y-auto pr-1">
                {visibleDoorRows.length === 0 ? (
                  <div className="text-[11px] text-[#4f5a72]">None detected</div>
                ) : visibleDoorRows.map((door, index) => (
                  <label key={`door-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#1b2233] px-2 py-1.5 text-[11px] text-[#9bb0ce]">
                    <span>D{index + 1}: {door.widthM}m @ ({door.position.x},{door.position.y})</span>
                    <input
                      type="checkbox"
                      aria-label={`Keep door ${index + 1}`}
                      checked={doorMask[index] ?? true}
                      onChange={(event) => {
                        const next = [...doorMask];
                        next[index] = event.target.checked;
                        setDoorMask(next);
                      }}
                    />
                  </label>
                ))}
                {draftDoors.length > doorWindowListLimit ? (
                  <div className="pt-1 text-[10px] text-[#6f82a4]">
                    {showAllDoorRows ? "Showing all door rows." : `${draftDoors.length - doorWindowListLimit} additional doors are hidden.`}
                    <button
                      type="button"
                      className="ml-1 inline text-[#9bb0cf] underline decoration-dotted underline-offset-2 hover:text-white"
                      onClick={() => setShowAllDoorRows((prev) => !prev)}
                    >
                      {showAllDoorRows ? "Show first rows only" : "Show all"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#7f93b3]">Windows</div>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setWindowMask((prev) => prev.map(() => true))}
                  className="rounded border border-[#2a3045] px-2 py-1 text-[10px] text-[#93a5c7] hover:border-blue-500/40 hover:text-white"
                >
                  Keep all
                </button>
                <button
                  type="button"
                  onClick={() => setWindowMask((prev) => prev.map(() => false))}
                  className="rounded border border-[#2a3045] px-2 py-1 text-[10px] text-[#93a5c7] hover:border-blue-500/40 hover:text-white"
                >
                  Exclude all
                </button>
              </div>
              <div className="max-h-24 space-y-1.5 overflow-y-auto pr-1">
                {visibleWindowRows.length === 0 ? (
                  <div className="text-[11px] text-[#4f5a72]">None detected</div>
                ) : visibleWindowRows.map((window, index) => (
                  <label key={`window-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#1b2233] px-2 py-1.5 text-[11px] text-[#9bb0ce]">
                    <span>Wn{index + 1}: {window.widthM}m @ ({window.position.x},{window.position.y})</span>
                    <input
                      type="checkbox"
                      aria-label={`Keep window ${index + 1}`}
                      checked={windowMask[index] ?? true}
                      onChange={(event) => {
                        const next = [...windowMask];
                        next[index] = event.target.checked;
                        setWindowMask(next);
                      }}
                    />
                  </label>
                ))}
                {draftWindows.length > doorWindowListLimit ? (
                  <div className="pt-1 text-[10px] text-[#6f82a4]">
                    {showAllWindowRows ? "Showing all window rows." : `${draftWindows.length - doorWindowListLimit} additional windows are hidden.`}
                    <button
                      type="button"
                      className="ml-1 inline text-[#9bb0cf] underline decoration-dotted underline-offset-2 hover:text-white"
                      onClick={() => setShowAllWindowRows((prev) => !prev)}
                    >
                      {showAllWindowRows ? "Show first rows only" : "Show all"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] leading-5 text-[#7f93b3]">Use checkboxes to keep/exclude detections, then apply the cleaned draft.</span>
          <button type="button"
            disabled={!hasFilteredEdits}
            onClick={() => {
              const filtered: FloorPlanResult = {
                ...result,
                walls: draftWalls.filter((_, idx) => wallMask[idx]),
                doors: draftDoors.filter((_, idx) => doorMask[idx]),
                windows: draftWindows.filter((_, idx) => windowMask[idx]),
              };
              setLastActionMessage(
                `Applied corrections: kept ${filtered.walls.length}/${draftWalls.length} walls, ${filtered.doors.length}/${draftDoors.length} doors, ${filtered.windows.length}/${draftWindows.length} openings.`,
              );
              onUpdateResult(normalizeFloorPlanResult(filtered));
            }}
            className="rounded-lg border border-[#2a3045] px-3 py-1.5 text-[11px] text-[#93a5c7] transition-colors hover:border-blue-500/40 hover:text-white disabled:opacity-40"
          >
            Apply Corrections
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#1e2130] bg-[#070a12] p-4">
        <div className="mb-1.5 text-[11px] font-medium text-[#9bb0cf]">Known Footprint (meters)</div>
        <p className="mb-2 text-[11px] leading-5 text-[#7f93b3]">{calibrationGuidance}</p>
        <p className="mb-2 text-[11px] leading-5 text-[#9aaed0]">{calibrationSourceCopy}</p>
        {hasManualCalibration ? (
          <div className="mb-3 flex items-start gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/8 px-2 py-1.5 text-[10px] leading-5 text-emerald-100">
            <Lock className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-400" />
            <span>
              <span className="font-semibold text-emerald-200">User-locked footprint:</span>{" "}
              {result.roomDimensions.widthM.toFixed(2)}m × {result.roomDimensions.depthM.toFixed(2)}m × {result.roomDimensions.heightM.toFixed(2)}m
              {" "}at {result.scalePixelsPerMeter.toFixed(2)} px/m. The detector cannot overwrite these values.
            </span>
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-[11px] text-[#59637a]">
            Width
            <input
              value={widthM}
              onChange={(event) => setWidthM(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1e2130] bg-[#0a0f18] px-2 py-2 text-[12px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
            />
          </label>
          <label className="text-[11px] text-[#59637a]">
            Depth
            <input
              value={depthM}
              onChange={(event) => setDepthM(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1e2130] bg-[#0a0f18] px-2 py-2 text-[12px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
            />
          </label>
          <label className="text-[11px] text-[#59637a]">
            Height
            <input
              value={heightM}
              onChange={(event) => setHeightM(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1e2130] bg-[#0a0f18] px-2 py-2 text-[12px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] leading-5 text-[#7f93b3]">
            {hasManualCalibration
              ? "Manual calibration is active. Re-applying updates locked values and refreshes wall normalization."
              : "Use known room dimensions to lock the scene footprint and refine scale."}
          </span>
          <button type="button"
            onClick={() => {
              const nextWidth = Number(widthM);
              const nextDepth = Number(depthM);
              const nextHeight = Number(heightM);
              if (Number.isFinite(nextWidth) && Number.isFinite(nextDepth) && Number.isFinite(nextHeight) && nextWidth > 0 && nextDepth > 0 && nextHeight > 0) {
                setLastActionMessage(
                  `Applying known footprint ${result.roomDimensions.widthM.toFixed(2)}×${result.roomDimensions.depthM.toFixed(2)}×${result.roomDimensions.heightM.toFixed(2)}m -> ${nextWidth.toFixed(2)}×${nextDepth.toFixed(2)}×${nextHeight.toFixed(2)}m. Preview anchors stay pixel-anchored; dimensions and scale now drive scene size.`,
                );
                onRecalibrate({ widthM: Number(nextWidth.toFixed(2)), depthM: Number(nextDepth.toFixed(2)), heightM: Number(nextHeight.toFixed(2)) });
              }
            }}
            disabled={!hasCalibrationChange}
            className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-[11px] font-medium text-blue-100 transition-colors hover:border-blue-400 hover:bg-blue-500/16 hover:text-white disabled:opacity-40"
          >
            Apply Calibration
          </button>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Detection Warnings
          </div>
          <ul className="mt-2 space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} /* stable display list */ className="flex items-start gap-1.5 text-[11px] leading-5 text-amber-300/80">
                <span className="mt-0.5 block h-1 w-1 flex-shrink-0 rounded-full bg-amber-400/40" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success state */}
      {warnings.length === 0 && result.walls.length >= 4 && (
        <div className="flex items-center gap-1.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          <span className="text-[11px] text-emerald-300">Floor plan processed successfully</span>
        </div>
      )}

      {/* Re-upload button */}
      <button type="button"
        onClick={onImageChange}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#1e2130] px-3 py-3 text-[11px] text-[#59637a] transition-colors hover:border-[#2a3045] hover:text-[#68738a]"
      >
        <RotateCcw className="h-3 w-3" />
        Choose different image
        <ImageUp className="h-3 w-3" />
      </button>
    </div>
  );
}

function formatGateAction(action: FloorPlanGateDecision["action"]) {
  switch (action) {
    case "rescan_required":
      return "Rescan Required";
    case "human_review":
      return "Manual Review";
    case "cloud_geometry_required":
      return "Cloud Geometry Required";
    case "proceed_to_tier2":
    default:
      return "Ready for Tier 2";
  }
}

function wallLengthPx(wall: { start: { x: number; y: number }; end: { x: number; y: number } }): number {
  return Math.sqrt((wall.end.x - wall.start.x) ** 2 + (wall.end.y - wall.start.y) ** 2);
}

function areWallsNearlyDuplicate(
  a: { start: { x: number; y: number }; end: { x: number; y: number } },
  b: { start: { x: number; y: number }; end: { x: number; y: number } },
): boolean {
  const aHorizontal = Math.abs(a.start.y - a.end.y) < 3;
  const bHorizontal = Math.abs(b.start.y - b.end.y) < 3;
  const aVertical = Math.abs(a.start.x - a.end.x) < 3;
  const bVertical = Math.abs(b.start.x - b.end.x) < 3;
  if (aHorizontal !== bHorizontal || aVertical !== bVertical) return false;

  if (aHorizontal && bHorizontal) {
    const anchorDistance = Math.abs(a.start.y - b.start.y);
    return anchorDistance <= 6 && intervalsOverlapRatio(
      [Math.min(a.start.x, a.end.x), Math.max(a.start.x, a.end.x)],
      [Math.min(b.start.x, b.end.x), Math.max(b.start.x, b.end.x)],
    ) > 0.8;
  }

  if (aVertical && bVertical) {
    const anchorDistance = Math.abs(a.start.x - b.start.x);
    return anchorDistance <= 6 && intervalsOverlapRatio(
      [Math.min(a.start.y, a.end.y), Math.max(a.start.y, a.end.y)],
      [Math.min(b.start.y, b.end.y), Math.max(b.start.y, b.end.y)],
    ) > 0.8;
  }

  return false;
}

function intervalsOverlapRatio(a: [number, number], b: [number, number]): number {
  const overlap = Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
  const shortest = Math.max(1, Math.min(a[1] - a[0], b[1] - b[0]));
  return overlap / shortest;
}
