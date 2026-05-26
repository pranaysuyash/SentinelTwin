"use client";

import { AlertTriangle, CheckCircle2, ImageUp, RotateCcw } from "lucide-react";

import type { FloorPlanResult } from "@/lib/floor-plan-import";

interface ImportReviewProps {
  result: FloorPlanResult;
  warnings: string[];
  onImageChange: () => void;
}

export function ImportReview({ result, warnings, onImageChange }: ImportReviewProps) {
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
