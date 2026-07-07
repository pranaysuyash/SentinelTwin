"use client";

import { type CameraVerificationSnapshot, type VerificationAlignmentMethod, type VerificationSourceType, type VerificationViewMode, type VideoFrameCandidate, formatSecondsShort, formatSnapshotEvidenceSummary } from "@/components/view/camera-verification-utils";

export function VerificationPanel({
  enabled,
  mode,
  opacity,
  split,
  offsetX,
  offsetY,
  fileName,
  alignmentScore,
  alignmentLabel,
  alignmentMethod,
  autoAlignDelta,
  scale,
  sourceType,
  videoDurationS,
  sampleTimeS,
  extractionInProgress,
  errorMessage,
  canResample,
  canAutoAlign,
  videoCandidates,
  selectedCandidateId,
  bestCandidateId,
  onSelectVideoCandidate,
  onAutoPickBestFrame,
  onSampleTimeChange,
  onResampleVideoFrame,
  showHeatOverlay,
  snapshots,
  onToggle,
  onUpload,
  onSaveSnapshot,
  onLoadSnapshot,
  onDeleteSnapshot,
  onModeChange,
  onOpacityChange,
  onSplitChange,
  onOffsetXChange,
  onOffsetYChange,
  onScaleChange,
  onToggleHeatOverlay,
  onNudge,
  onAutoAlign,
  onResetAlign,
  onClear,
}: {
  enabled: boolean;
  mode: VerificationViewMode;
  opacity: number;
  split: number;
  offsetX: number;
  offsetY: number;
  fileName: string | null;
  alignmentScore: number | null;
  alignmentLabel: string | null;
  alignmentMethod: VerificationAlignmentMethod | null;
  autoAlignDelta: number | null;
  scale: number;
  sourceType: VerificationSourceType;
  videoDurationS: number | null;
  sampleTimeS: number | null;
  extractionInProgress: boolean;
  errorMessage: string | null;
  canResample: boolean;
  canAutoAlign: boolean;
  videoCandidates: VideoFrameCandidate[];
  selectedCandidateId: string | null;
  bestCandidateId: string | null;
  onSelectVideoCandidate: (candidateId: string) => void;
  onAutoPickBestFrame: () => void;
  onSampleTimeChange: (value: number) => void;
  onResampleVideoFrame: () => void;
  showHeatOverlay: boolean;
  snapshots: CameraVerificationSnapshot[];
  onToggle: (next: boolean) => void;
  onUpload: (file: File) => void;
  onSaveSnapshot: () => void;
  onLoadSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onModeChange: (mode: VerificationViewMode) => void;
  onOpacityChange: (value: number) => void;
  onSplitChange: (value: number) => void;
  onOffsetXChange: (value: number) => void;
  onOffsetYChange: (value: number) => void;
  onScaleChange: (value: number) => void;
  onToggleHeatOverlay: (next: boolean) => void;
  onNudge: (dx: number, dy: number) => void;
  onAutoAlign: () => void;
  onResetAlign: () => void;
  onClear: () => void;
}) {
  const bestCandidate = bestCandidateId ? (videoCandidates.find((candidate) => candidate.id === bestCandidateId) ?? null) : null;
  const selectedCandidate = selectedCandidateId ? (videoCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null) : null;
  return (
    <div className="pointer-events-auto w-full rounded-xl border border-[#243146] bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]">Footage Verification</div>
        <label className="inline-flex cursor-pointer items-center gap-1 text-[9px] text-[#c5d4ef]">
          <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} />
          Enable
        </label>
      </div>
      <p className="mt-1 text-[9px] leading-4 text-[#8b96ab]">
        Planning aid only. This compares a reference frame with simulated view and does not prove forensic identification.
      </p>
      <div className="mt-2 space-y-2 text-[9px] text-[#b8c5df]">
        <label className="block">
          <span className="text-[#7a8fb6]">Reference frame</span>
          <input
            type="file"
            accept="image/*,video/*"
            className="mt-1 block w-full rounded border border-[#2a3650] bg-[#0f1624] px-2 py-1 text-[9px] text-[#cdd8ee]"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          {fileName ? <span className="mt-1 block truncate text-[8px] text-[#8aa0c8]">{fileName}</span> : null}
          {sourceType === "video" && videoDurationS !== null ? (
            <div className="mt-1 space-y-1.5 rounded border border-[#2a3650] bg-[#0d1523] p-1.5">
              <span className="block text-[8px] text-[#9db7e1]">
                Video frame sampled at {sampleTimeS !== null ? formatSecondsShort(sampleTimeS) : "0:00"} / {formatSecondsShort(videoDurationS)}
              </span>
              <label className="block text-[8px] text-[#8aa0c8]">
                <div className="flex justify-between"><span>Sample time</span><span>{formatSecondsShort(sampleTimeS ?? 0)}</span></div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, videoDurationS)}
                  step={0.25}
                  value={sampleTimeS ?? 0}
                  disabled={!canResample || extractionInProgress}
                  onChange={(event) => onSampleTimeChange(Number(event.target.value))}
                  className="mt-1 w-full accent-cyan-400"
                />
              </label>
              <button
                type="button"
                disabled={!canResample || extractionInProgress}
                onClick={onResampleVideoFrame}
                className="rounded bg-[#14304a] px-2 py-1 text-[8px] text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Extract frame at selected time
              </button>

              {videoCandidates.length ? (
                <div className="rounded border border-[#2a3650] bg-[#0b1220] p-1.5">
                  <div className="mb-1 flex items-center justify-between text-[8px] text-[#9db7e1]">
                    <span className="uppercase tracking-[0.12em]">Extracted frames</span>
                    <button
                      type="button"
                      disabled={!bestCandidateId}
                      onClick={onAutoPickBestFrame}
                      className="rounded bg-[#1b3a5a] px-1.5 py-0.5 text-[8px] text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                      Auto-pick best extracted frame
                    </button>
                  </div>
                  <div className="mb-1 rounded border border-[#243146] bg-[#0c1320] px-1.5 py-1 text-[8px] text-[#9db7e1]">
                    {bestCandidate ? (
                      <div className="flex items-center justify-between gap-1">
                        <span>
                          Best frame {formatSecondsShort(bestCandidate.timeS)} · score {bestCandidate.qualityScore.toFixed(1)}
                        </span>
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                          {selectedCandidate?.id === bestCandidate.id ? "Selected" : "Ready"}
                        </span>
                      </div>
                    ) : (
                      <div>Frames are scored deterministically by sharpness.</div>
                    )}
                  </div>
                  <div className="grid gap-1">
                    {videoCandidates.map((candidate) => {
                      const selected = selectedCandidateId === candidate.id;
                      const isBest = bestCandidateId === candidate.id;
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => onSelectVideoCandidate(candidate.id)}
                          className={`flex items-center justify-between gap-2 rounded border px-1.5 py-1 text-left text-[8px] ${selected ? "border-cyan-300 bg-cyan-500/20 text-cyan-100" : "border-[#2a3650] bg-[#111b2c] text-[#9db7e1]"}`}
                          title={`Sharpness score ${candidate.qualityScore.toFixed(1)}`}
                        >
                          <span className="min-w-0 truncate">
                            {formatSecondsShort(candidate.timeS)}{isBest ? " · Best" : ""}
                          </span>
                          <span className="flex-none font-mono text-[7px] uppercase tracking-[0.12em] text-[#8aa0c8]">
                            {candidate.qualityScore.toFixed(1)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {extractionInProgress ? <span className="mt-1 block text-[8px] text-cyan-300">Extracting video frame…</span> : null}
          {errorMessage ? <span className="mt-1 block text-[8px] text-rose-300">{errorMessage}</span> : null}
        </label>
        <div className="flex gap-1">
          <button type="button" onClick={() => onModeChange("overlay")} className={`rounded px-2 py-1 ${mode === "overlay" ? "bg-cyan-500/30 text-cyan-200" : "bg-[#1a2233] text-[#8ea5cc]"}`}>Overlay</button>
          <button type="button" onClick={() => onModeChange("split")} className={`rounded px-2 py-1 ${mode === "split" ? "bg-cyan-500/30 text-cyan-200" : "bg-[#1a2233] text-[#8ea5cc]"}`}>Split</button>
          <button type="button" onClick={onSaveSnapshot} className="rounded bg-[#14304a] px-2 py-1 text-cyan-200">Save</button>
          <button type="button" onClick={onClear} className="rounded bg-[#2b1a20] px-2 py-1 text-rose-200">Clear</button>
        </div>
        {snapshots.length ? (
          <div className="rounded-lg border border-[#2a3650] bg-[#0f1624] p-2">
            <div className="mb-1 text-[8px] uppercase tracking-[0.12em] text-[#7a8fb6]">Saved snapshots</div>
            <div className="max-h-24 space-y-1 overflow-y-auto pr-1">
              {snapshots.map((snapshot) => (
                <div key={snapshot.id} className="rounded border border-[#243146] bg-[#0c1320] px-1.5 py-1">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => onLoadSnapshot(snapshot.id)}
                      className="truncate text-left text-[8px] text-[#c9d8f3] hover:text-white"
                      title={snapshot.fileName}
                    >
                      {snapshot.fileName}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSnapshot(snapshot.id)}
                      className="rounded bg-[#2b1a20] px-1 py-0.5 text-[8px] text-rose-200"
                    >
                      Del
                    </button>
                  </div>
                  <div className="mt-0.5 truncate text-[8px] text-[#8aa0c8]" title={formatSnapshotEvidenceSummary(snapshot)}>
                    {formatSnapshotEvidenceSummary(snapshot)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="rounded-lg border border-[#2a3650] bg-[#0f1624] px-2 py-1.5">
          <div className="flex items-center justify-between text-[#7a8fb6]">
            <span>Alignment Quality</span>
            <span className="font-mono text-[#d4e6ff]">{alignmentScore !== null ? `${Math.round(alignmentScore)}/100` : "N/A"}</span>
          </div>
          <div className="mt-0.5 text-[8px] text-[#9db7e1]">
            {alignmentLabel ? `${alignmentLabel} match (planning aid only, non-forensic).` : "Upload a reference frame to compute mismatch quality."}
          </div>
          <label className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[8px] text-[#9db7e1]">
            <input type="checkbox" checked={showHeatOverlay} onChange={(event) => onToggleHeatOverlay(event.target.checked)} />
            Difference heat overlay
          </label>
        </div>
        <div className="rounded-lg border border-[#2a3650] bg-[#0f1624] px-2 py-1.5">
          <div className="flex items-center justify-between text-[#7a8fb6]">
            <span>Alignment Assist</span>
            <span className="font-mono text-[#d4e6ff]">{alignmentMethod === "auto" ? "AUTO" : alignmentMethod === "manual" ? "MANUAL" : "IDLE"}</span>
          </div>
          <div className="mt-0.5 text-[8px] text-[#9db7e1]">
            {alignmentMethod === "auto"
              ? `Auto align applied${typeof autoAlignDelta === "number" ? ` with ${autoAlignDelta >= 0 ? "+" : ""}${autoAlignDelta.toFixed(1)} score delta.` : "."}`
              : alignmentMethod === "manual"
                ? "Manual offset controls are active for the current reference frame."
                : "Run auto align or use manual offsets after loading a reference frame."}
          </div>
        </div>
        <label className="block">
          <div className="flex justify-between text-[#7a8fb6]"><span>Opacity</span><span>{Math.round(opacity * 100)}%</span></div>
          <input type="range" min={0.15} max={0.95} step={0.01} value={opacity} onChange={(event) => onOpacityChange(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
        </label>
        {mode === "split" ? (
          <label className="block">
            <div className="flex justify-between text-[#7a8fb6]"><span>Split</span><span>{Math.round(split)}%</span></div>
            <input type="range" min={15} max={85} step={1} value={split} onChange={(event) => onSplitChange(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
          </label>
        ) : null}
        <label className="block">
          <div className="flex justify-between text-[#7a8fb6]"><span>Offset X</span><span>{offsetX}px</span></div>
          <input type="range" min={-120} max={120} step={1} value={offsetX} onChange={(event) => onOffsetXChange(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
        </label>
        <label className="block">
          <div className="flex justify-between text-[#7a8fb6]"><span>Offset Y</span><span>{offsetY}px</span></div>
          <input type="range" min={-120} max={120} step={1} value={offsetY} onChange={(event) => onOffsetYChange(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
        </label>
        <label className="block">
          <div className="flex justify-between text-[#7a8fb6]"><span>Reference scale</span><span>{Math.round(scale * 100)}%</span></div>
          <input type="range" min={0.7} max={1.3} step={0.01} value={scale} onChange={(event) => onScaleChange(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
        </label>
        <div className="flex items-center justify-between gap-1">
          <div className="flex gap-1">
            <button type="button" onClick={() => onNudge(-4, 0)} className="rounded bg-[#1a2233] px-1.5 py-1 text-[#c7d0e4]">◀</button>
            <button type="button" onClick={() => onNudge(4, 0)} className="rounded bg-[#1a2233] px-1.5 py-1 text-[#c7d0e4]">▶</button>
            <button type="button" onClick={() => onNudge(0, -4)} className="rounded bg-[#1a2233] px-1.5 py-1 text-[#c7d0e4]">▲</button>
            <button type="button" onClick={() => onNudge(0, 4)} className="rounded bg-[#1a2233] px-1.5 py-1 text-[#c7d0e4]">▼</button>
          </div>
          <div className="flex gap-1">
            <button type="button" disabled={!canAutoAlign} onClick={onAutoAlign} className="rounded bg-[#13354a] px-2 py-1 text-[#8ce3ff] disabled:cursor-not-allowed disabled:opacity-50">Auto align</button>
            <button type="button" onClick={onResetAlign} className="rounded bg-[#1d2b3f] px-2 py-1 text-[#9dd6ff]">Reset align</button>
          </div>
        </div>
      </div>
    </div>
  );
}
