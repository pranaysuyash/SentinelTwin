"use client";

import {
  TriangleAlert, Info, XCircle, Play,
  CheckCircle2, ArrowRight, Plus, RotateCcw,
  Camera, ShieldAlert, Route, ScanSearch,
  Sparkles, Image as ImageIcon, FileUp, Square,
} from "lucide-react";
import type { SiteIntakeSession, ActionableWarning, SiteTwinDraft, SuggestedNextAction, SiteIntakeSource } from "@/lib/site-compiler";
import { canRunBaselineSimulation, compileToSiteTwinDraft, SITE_SOURCE_MATURITY } from "@/lib/site-compiler";
import type { SecurityScene } from "@/schema/security-scene";

const severityIcon: Record<ActionableWarning["severity"], React.ReactNode> = {
  blocking: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  warning: <TriangleAlert className="h-3.5 w-3.5 text-amber-400" />,
  info: <Info className="h-3.5 w-3.5 text-sky-400" />,
};

const severityLabel: Record<ActionableWarning["severity"], string> = {
  blocking: "text-red-300",
  warning: "text-amber-300",
  info: "text-sky-300",
};

const actionIcons: Record<SuggestedNextAction["action"], React.ReactNode> = {
  edit: <RotateCcw className="h-3.5 w-3.5" />,
  approve: <CheckCircle2 className="h-3.5 w-3.5" />,
  run_baseline: <Play className="h-3.5 w-3.5" />,
  add_camera: <Camera className="h-3.5 w-3.5" />,
  add_zone: <ShieldAlert className="h-3.5 w-3.5" />,
  add_path: <Route className="h-3.5 w-3.5" />,
  open_studio: <ArrowRight className="h-3.5 w-3.5" />,
};

const SOURCE_ICONS: Record<SiteIntakeSource, React.ReactNode> = {
  scan: <ScanSearch className="h-3.5 w-3.5" />,
  ai_prompt: <Sparkles className="h-3.5 w-3.5" />,
  floor_plan: <ImageIcon className="h-3.5 w-3.5" />,
  json: <FileUp className="h-3.5 w-3.5" />,
  manual: <Square className="h-3.5 w-3.5" />,
  camera_evidence: <Camera className="h-3.5 w-3.5" />,
};

type SiteDraftReviewProps = {
  session: SiteIntakeSession;
  onApprove: () => void;
  onReject: () => void;
  onEdit?: () => void;
  onRunBaselineSimulation?: () => void;
};

const SOURCE_APPROVAL_LABELS: Record<SiteIntakeSource, string> = {
  scan: "Approve as Canonical Twin",
  ai_prompt: "Approve as Draft — Review Required",
  floor_plan: "Approve as Scene Shell",
  json: "Import as Canonical Scene",
  manual: "Open in Studio",
  camera_evidence: "Approve Evidence State",
};

const SOURCE_BLOCKED_LABELS: Record<SiteIntakeSource, string> = {
  scan: "Fix warnings before approving",
  ai_prompt: "Resolve blocking issues first",
  floor_plan: "Resolve extraction issues first",
  json: "Fix validation errors first",
  manual: "Add prerequisites first",
  camera_evidence: "Capture evidence first",
};

type XzPoint = [number, number];

function toXz(value: unknown): XzPoint | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  if (typeof value[0] !== "number" || typeof value[1] !== "number") return null;
  if (value.length >= 3 && typeof value[2] === "number") return [value[0], value[2]];
  return [value[0], value[1]];
}

function toPolyline(points: XzPoint[], project: (point: XzPoint) => XzPoint) {
  return points.map((point) => project(point).join(",")).join(" ");
}

function DraftSceneMiniPreview({ scene, warnings }: { scene: SecurityScene; warnings: ActionableWarning[] }) {
  const warningNodeIds = new Set((warnings ?? []).flatMap((warning) => warning.affectedNodeIds ?? []));
  const points: XzPoint[] = [];
  for (const wall of scene.walls) {
    points.push(wall.start, wall.end);
  }
  for (const zone of scene.criticalZones) {
    points.push(...zone.polygon);
  }
  for (const zone of scene.privacyZones) {
    points.push(...zone.polygon);
  }
  for (const path of scene.paths) {
    points.push(...path.points.flatMap((point) => (toXz(point.position) ? [toXz(point.position)!] : [])));
  }
  for (const door of scene.doors) {
    const point = toXz(door.position);
    if (point) points.push(point);
  }
  for (const window of scene.windows) {
    const point = toXz(window.position);
    if (point) points.push(point);
  }
  for (const camera of scene.cameras) {
    const point = toXz(camera.position);
    if (point) points.push(point);
  }
  for (const light of scene.securityLights) {
    const point = toXz(light.position);
    if (point) points.push(point);
  }
  for (const obstruction of scene.obstructions) {
    const point = toXz(obstruction.position);
    if (point) points.push(point);
  }
  for (const entry of scene.entryPoints) {
    const point = toXz(entry.position);
    if (point) points.push(point);
  }

  if (points.length === 0) {
    return (
      <div className="mt-3 flex aspect-video items-center justify-center rounded-xl border border-dashed border-[color:var(--border)] bg-white/[0.02]">
        <div className="text-center text-[11px] text-[color:var(--text-dim)]">
          Geometry preview unavailable. Add walls, zones, or devices to render the draft map.
        </div>
      </div>
    );
  }

  const minX = Math.min(...points.map((point) => point[0]));
  const maxX = Math.max(...points.map((point) => point[0]));
  const minZ = Math.min(...points.map((point) => point[1]));
  const maxZ = Math.max(...points.map((point) => point[1]));
  const spanX = Math.max(0.001, maxX - minX);
  const spanZ = Math.max(0.001, maxZ - minZ);
  const margin = 20;
  const width = 640;
  const height = 360;
  const drawableWidth = width - margin * 2;
  const drawableHeight = height - margin * 2;
  const scale = Math.min(drawableWidth / spanX, drawableHeight / spanZ);
  const offsetX = margin + (drawableWidth - spanX * scale) / 2;
  const offsetY = margin + (drawableHeight - spanZ * scale) / 2;

  const project = ([x, z]: XzPoint): XzPoint => [
    offsetX + (x - minX) * scale,
    offsetY + (maxZ - z) * scale,
  ];

  return (
    <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[#0d1320] p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="aspect-video w-full rounded-lg bg-[#0a101a]">
        {scene.criticalZones.map((zone) => (
          <polygon
            key={zone.id}
            points={toPolyline(zone.polygon, project)}
            fill={warningNodeIds.has(zone.id) ? "rgba(248,113,113,0.2)" : "rgba(14,165,233,0.14)"}
            stroke={warningNodeIds.has(zone.id) ? "rgba(248,113,113,0.85)" : "rgba(56,189,248,0.65)"}
            strokeWidth={1.5}
          />
        ))}
        {scene.privacyZones.map((zone) => (
          <polygon
            key={zone.id}
            points={toPolyline(zone.polygon, project)}
            fill="rgba(244,114,182,0.14)"
            stroke="rgba(244,114,182,0.7)"
            strokeDasharray="4 3"
            strokeWidth={1.2}
          />
        ))}
        {scene.walls.map((wall) => {
          const [x1, y1] = project(wall.start);
          const [x2, y2] = project(wall.end);
          return (
            <line
              key={wall.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={warningNodeIds.has(wall.id) ? "rgba(248,113,113,0.9)" : "rgba(226,232,240,0.95)"}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          );
        })}
        {scene.paths.map((path) => {
          const pathPoints = path.points
            .map((point) => toXz(point.position))
            .filter((point): point is XzPoint => point != null);
          if (pathPoints.length < 2) return null;
          return (
            <polyline
              key={path.id}
              points={toPolyline(pathPoints, project)}
              fill="none"
              stroke={warningNodeIds.has(path.id) ? "rgba(248,113,113,0.9)" : "rgba(250,204,21,0.95)"}
              strokeWidth={2}
              strokeDasharray="5 3"
            />
          );
        })}
        {scene.doors.map((door) => {
          const point = toXz(door.position);
          if (!point) return null;
          const [x, y] = project(point);
          return <rect key={door.id} x={x - 3} y={y - 3} width={6} height={6} fill="#38bdf8" />;
        })}
        {scene.windows.map((window) => {
          const point = toXz(window.position);
          if (!point) return null;
          const [x, y] = project(point);
          return <rect key={window.id} x={x - 3} y={y - 2} width={6} height={4} fill="#60a5fa" />;
        })}
        {scene.obstructions.map((obstruction) => {
          const point = toXz(obstruction.position);
          if (!point) return null;
          const [x, y] = project(point);
          return <rect key={obstruction.id} x={x - 3} y={y - 3} width={6} height={6} fill="#fb923c" />;
        })}
        {scene.securityLights.map((light) => {
          const point = toXz(light.position);
          if (!point) return null;
          const [x, y] = project(point);
          return <circle key={light.id} cx={x} cy={y} r={3} fill="#fde68a" />;
        })}
        {scene.entryPoints.map((entry) => {
          const point = toXz(entry.position);
          if (!point) return null;
          const [x, y] = project(point);
          return <polygon key={entry.id} points={`${x},${y - 4} ${x + 4},${y + 4} ${x - 4},${y + 4}`} fill="#34d399" />;
        })}
        {scene.cameras.map((camera) => {
          const point = toXz(camera.position);
          if (!point) return null;
          const [x, y] = project(point);
          return <circle key={camera.id} cx={x} cy={y} r={3.5} fill={warningNodeIds.has(camera.id) ? "#f87171" : "#c084fc"} />;
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[color:var(--text-muted)]">
        <span className="rounded border border-white/10 px-2 py-0.5">Walls</span>
        <span className="rounded border border-sky-400/30 px-2 py-0.5 text-sky-300">Critical zones</span>
        <span className="rounded border border-pink-400/30 px-2 py-0.5 text-pink-300">Privacy zones</span>
        <span className="rounded border border-yellow-300/30 px-2 py-0.5 text-yellow-200">Paths</span>
        <span className="rounded border border-violet-400/30 px-2 py-0.5 text-violet-300">Cameras</span>
        <span className="rounded border border-red-400/30 px-2 py-0.5 text-red-300">Warning-marked nodes</span>
      </div>
    </div>
  );
}

export function SiteDraftReview({ session, onApprove, onReject, onEdit, onRunBaselineSimulation }: SiteDraftReviewProps) {
  const result = session.result;

  if (!result) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-[color:var(--text-muted)]">No compiled result available.</div>
      </div>
    );
  }

  const draft = session.draft ?? compileToSiteTwinDraft(result);
  const hasBlockers = draft.warnings.some((w) => w.severity === "blocking");
  const canBaseline = canRunBaselineSimulation(draft);
  const confidencePct = Math.round(draft.confidence * 100);
  const confidenceColor = draft.confidenceLabel === "high" ? "text-emerald-300" : draft.confidenceLabel === "medium" ? "text-amber-300" : "text-red-300";
  const sourceInfo = SITE_SOURCE_MATURITY[draft.source];
  const approveLabel = hasBlockers
    ? (SOURCE_BLOCKED_LABELS[draft.source] ?? "Fix warnings before approving")
    : (SOURCE_APPROVAL_LABELS[draft.source] ?? "Approve & Open in Studio");

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-dim)]">
              <span>Site Twin Review</span>
              <span className="text-[color:var(--border)]">·</span>
              <span className="flex items-center gap-1 text-white">
                {SOURCE_ICONS[draft.source]}
                {draft.provenance.sourceLabel}
              </span>
              <span className="text-[color:var(--border)]">·</span>
              <span className={sourceInfo.status === "Working" ? "text-emerald-300" : "text-violet-300"}>
                {sourceInfo.status}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              {draft.scene.name || "Untitled Site Twin"}
            </h1>
            <div className="mt-1 flex items-center gap-3 text-[13px] leading-5 text-[color:var(--text-muted)]">
              <span>{draft.warnings.length} warning{draft.warnings.length !== 1 ? "s" : ""}</span>
              <span className="text-[color:var(--border)]">·</span>
              <span className={confidenceColor}>{confidencePct}% confidence ({draft.confidenceLabel})</span>
              <span className="text-[color:var(--border)]">·</span>
              <span>{draft.entityCounts.walls}w {draft.entityCounts.cameras}c {draft.entityCounts.criticalZones}z {draft.entityCounts.entryPoints}e</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-1 gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Scene Preview</div>
              <DraftSceneMiniPreview scene={draft.scene} warnings={draft.warnings} />
            </div>

            {draft.assumptions.length > 0 ? (
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Assumptions</div>
                <div className="mt-2 space-y-2">
                  {draft.assumptions.map((assumption, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px]">
                      <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${
                        assumption.source === "user" ? "bg-sky-500/10 text-sky-300" :
                        assumption.source === "model" ? "bg-violet-500/10 text-violet-300" :
                        assumption.source === "estimated" ? "bg-amber-500/10 text-amber-300" :
                        "bg-white/[0.05] text-[color:var(--text-dim)]"
                      }`}>{assumption.source}</span>
                      <div>
                        <span className="text-white">{assumption.label}:</span>
                        <span className="ml-1 text-[color:var(--text-muted)]">{assumption.value}</span>
                        {assumption.confidence != null ? (
                          <span className="ml-1 text-[10px] text-[color:var(--text-dim)]">({Math.round(assumption.confidence * 100)}%)</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {draft.missingPrerequisites.length > 0 ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300">Missing Prerequisites</div>
                <div className="mt-2 space-y-2">
                  {draft.missingPrerequisites.map((prereq, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px]">
                      <span className="mt-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-amber-200">
                        {prereq.requiredFor.replace("_", " ")}
                      </span>
                      <span className="text-amber-100">{prereq.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {draft.provenance.notes.length > 0 || draft.provenance.sourceArtifacts.length > 0 ? (
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Evidence Trail</div>
                {draft.provenance.sourceArtifacts.length > 0 ? (
                  <div className="mt-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-dim)]">Source artifacts</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      {draft.provenance.sourceArtifacts.map((artifact, i) => (
                        <span key={i} className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sky-200">
                          {artifact}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {draft.provenance.notes.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-[12px] text-[color:var(--text-muted)]">
                    {draft.provenance.notes.map((note, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1 h-1 w-1 flex-none rounded-full bg-[color:var(--text-dim)]" />
                        {note}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex w-[360px] flex-none flex-col gap-4">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Entities</div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                <EntityCount label="Walls" count={draft.entityCounts.walls} />
                <EntityCount label="Doors" count={draft.entityCounts.doors} />
                <EntityCount label="Windows" count={draft.entityCounts.windows} />
                <EntityCount label="Cameras" count={draft.entityCounts.cameras} highlight />
                <EntityCount label="Lights" count={draft.entityCounts.lights} />
                <EntityCount label="Obstructions" count={draft.entityCounts.obstructions} />
                <EntityCount label="Critical Zones" count={draft.entityCounts.criticalZones} highlight />
                <EntityCount label="Privacy Zones" count={draft.entityCounts.privacyZones} />
                <EntityCount label="Entry Points" count={draft.entityCounts.entryPoints} />
                <EntityCount label="Paths" count={draft.entityCounts.paths} />
                <EntityCount label="Sensors" count={draft.entityCounts.sensors} />
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Source</div>
              <div className="mt-2 space-y-1 text-[12px] text-[color:var(--text-muted)]">
                <div className="flex items-center gap-1">
                  {SOURCE_ICONS[draft.source]}
                  <span>Mode: <span className="text-white">{draft.source}</span></span>
                </div>
                <div>Label: <span className="text-white">{draft.provenance.sourceLabel}</span></div>
                <div>Status: <span className={sourceInfo.status === "Working" ? "text-emerald-300" : "text-violet-300"}>{sourceInfo.status}</span></div>
                <div className="pt-1 text-[10px] leading-5 text-[color:var(--text-dim)]">{sourceInfo.description}</div>
                <div className="pt-1">Confidence: <span className={confidenceColor}>{confidencePct}% ({draft.confidenceLabel})</span></div>
                <div>Baseline sim: <span className={canBaseline ? "text-emerald-300" : "text-amber-300"}>{canBaseline ? "Ready" : "Not ready"}</span></div>
              </div>
            </div>

            {draft.warnings.length > 0 ? (
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                  Warnings ({draft.warnings.length})
                </div>
                <div className="mt-2 space-y-3">
                  {draft.warnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      {severityIcon[warning.severity]}
                      <div className="min-w-0">
                        <span className={`font-semibold ${severityLabel[warning.severity]}`}>
                          {warning.code}
                        </span>
                        <div className="mt-0.5 text-[color:var(--text-muted)]">{warning.message}</div>
                        {warning.suggestedAction ? (
                          <div className="mt-1 text-[10px] text-sky-300">
                            Action: {warning.suggestedAction}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {draft.suggestedNextActions.length > 0 ? (
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Next Actions</div>
                <div className="mt-2 space-y-2">
                  {draft.suggestedNextActions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <span className="mt-0.5 text-[color:var(--text-dim)]">{actionIcons[action.action]}</span>
                      <div>
                        <span className={action.enabled ? "text-white" : "text-[color:var(--text-dim)]"}>
                          {action.label}
                        </span>
                        {action.reason ? (
                          <div className="mt-0.5 text-[10px] text-[color:var(--text-muted)]">{action.reason}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-[color:var(--border)] pt-5">
          <div className="flex items-center gap-2">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-xl border border-[color:var(--border)] bg-white/[0.03] px-4 py-2 text-xs text-[color:var(--text-muted)] transition-colors hover:border-sky-400/25 hover:bg-white/[0.05] hover:text-white"
              >
                Back to Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={onReject}
              className="rounded-xl border border-[color:var(--border)] bg-white/[0.03] px-4 py-2 text-xs text-[color:var(--text-muted)] transition-colors hover:border-red-400/25 hover:bg-red-500/8 hover:text-red-200"
            >
              Discard
            </button>
          </div>
          <div className="flex items-center gap-2">
            {onRunBaselineSimulation && canBaseline ? (
              <button
                type="button"
                onClick={onRunBaselineSimulation}
                className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs text-sky-300 transition-colors hover:bg-sky-500/16"
              >
                <Play className="h-3 w-3" />
                Run Baseline Simulation
              </button>
            ) : null}
            <button
              type="button"
              onClick={onApprove}
              disabled={hasBlockers}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900/60 disabled:text-emerald-300/50"
            >
              {hasBlockers ? `Blocked — ${approveLabel}` : approveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntityCount({ label, count, highlight }: { label: string; count: number; highlight?: boolean }) {
  const color = count === 0 ? "text-[color:var(--text-dim)]" : highlight ? "text-sky-300" : "text-white";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[color:var(--text-muted)]">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{count}</span>
    </div>
  );
}
