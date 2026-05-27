"use client";

import { AlertTriangle, CheckCircle2, ImageUp, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { FloorPlanResult } from "@/lib/floor-plan-import";

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
  const [wallMask, setWallMask] = useState<boolean[]>(result.walls.map(() => true));
  const [doorMask, setDoorMask] = useState<boolean[]>(result.doors.map(() => true));
  const [windowMask, setWindowMask] = useState<boolean[]>(result.windows.map(() => true));

  useEffect(() => {
    setWallMask(result.walls.map(() => true));
    setDoorMask(result.doors.map(() => true));
    setWindowMask(result.windows.map(() => true));
    setWidthM(result.roomDimensions.widthM.toString());
    setDepthM(result.roomDimensions.depthM.toString());
    setHeightM(result.roomDimensions.heightM.toString());
  }, [result]);

  const hasCalibrationChange = useMemo(
    () =>
      Number(widthM) !== result.roomDimensions.widthM ||
      Number(depthM) !== result.roomDimensions.depthM ||
      Number(heightM) !== result.roomDimensions.heightM,
    [widthM, depthM, heightM, result.roomDimensions.widthM, result.roomDimensions.depthM, result.roomDimensions.heightM],
  );
  const hasFilteredEdits = useMemo(
    () => wallMask.some((v) => !v) || doorMask.some((v) => !v) || windowMask.some((v) => !v),
    [wallMask, doorMask, windowMask],
  );

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
            }}
            className="text-[8px] text-[#8ea5c6] hover:text-white"
          >
            Reset
          </button>
        </div>
        <div className="space-y-1.5">
          <div>
            <div className="mb-1 text-[8px] uppercase tracking-[0.14em] text-[#4f5a72]">Walls</div>
            <div className="max-h-20 space-y-1 overflow-y-auto pr-1">
              {result.walls.slice(0, 20).map((wall, index) => (
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
                ) : result.doors.map((door, index) => (
                  <label key={`door-${index}`} className="flex items-center justify-between rounded border border-[#1b2233] px-1.5 py-1 text-[8px] text-[#9bb0ce]">
                    <span>D{index + 1}: {door.widthM}m</span>
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
                ) : result.windows.map((window, index) => (
                  <label key={`window-${index}`} className="flex items-center justify-between rounded border border-[#1b2233] px-1.5 py-1 text-[8px] text-[#9bb0ce]">
                    <span>Wn{index + 1}: {window.widthM}m</span>
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
                walls: result.walls.filter((_, idx) => wallMask[idx]),
                doors: result.doors.filter((_, idx) => doorMask[idx]),
                windows: result.windows.filter((_, idx) => windowMask[idx]),
              };
              onUpdateResult(filtered);
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
