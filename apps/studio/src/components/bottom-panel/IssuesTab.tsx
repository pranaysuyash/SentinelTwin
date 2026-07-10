"use client";

import { AlertCircle, AlertTriangle, ChevronRight, Eye, EyeOff, Info, ShieldAlert, Wrench } from "lucide-react";
import { useState } from "react";
import { TruthBadge } from "@/components/shared/TruthBadge";
import { useStudioStore } from "@/store/studio-store";
import { Badge } from "@/components/shared/Badge";
import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import type { BlindRegionResult, SecurityIssue } from "@/schema/security-scene";
import { selectSecurityOutcomeFromStore } from "@/lib/security-outcome/security-outcome-selectors";
// Loop Pass L2 — `issueFingerprint` is the canonical identity for matching
// issues across recomputes; `recentIssueChangeKeys` carries the most-recent
// diff so changed findings can float to the top with a "changed by last edit"
// tag. See `@/lib/contextual-tabs` and `Docs/review/UI_REVIEW_2026-06-19.md`.
import { issueFingerprint } from "@/lib/contextual-tabs";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

function SeverityBadge({ severity }: { severity: SecurityIssue["severity"] }) {
  const map: Record<SecurityIssue["severity"], { variant: "red" | "amber" | "blue" | "gray"; label: string }> = {
    critical: { variant: "red",   label: "CRITICAL" },
    high:     { variant: "amber", label: "HIGH" },
    medium:   { variant: "blue",  label: "MEDIUM" },
    low:      { variant: "gray",  label: "LOW" },
  };
  const { variant, label } = map[severity];
  return <Badge variant={variant}>{label}</Badge>;
}

function SeverityIcon({ severity }: { severity: SecurityIssue["severity"] }) {
  const cls = "w-3.5 h-3.5 flex-shrink-0";
  if (severity === "critical") return <ShieldAlert className={`${cls} text-red-400`} />;
  if (severity === "high")     return <AlertTriangle className={`${cls} text-amber-400`} />;
  if (severity === "medium")   return <AlertCircle className={`${cls} text-blue-400`} />;
  return <Info className={`${cls} text-[#4a5568]`} />;
}

function BlindRegionBadge({ region }: { region: BlindRegionResult }) {
  const map: Record<BlindRegionResult["severity"], { variant: "red" | "amber" | "blue" | "gray"; label: string }> = {
    critical: { variant: "red",   label: "CRITICAL" },
    high:     { variant: "amber", label: "HIGH" },
    medium:   { variant: "blue",  label: "MEDIUM" },
    low:      { variant: "gray",  label: "LOW" },
  };
  const { variant, label } = map[region.severity];
  return <Badge variant={variant}>{label}</Badge>;
}

function BlindRegionIcon({ severity }: { severity: BlindRegionResult["severity"] }) {
  const cls = "w-3.5 h-3.5 flex-shrink-0";
  if (severity === "critical") return <EyeOff className={`${cls} text-red-400`} />;
  if (severity === "high")     return <EyeOff className={`${cls} text-amber-400`} />;
  if (severity === "medium")   return <Eye className={`${cls} text-blue-400`} />;
  return <Eye className={`${cls} text-[#4a5568]`} />;
}

export function IssuesTab() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const activePathId = useStudioStore((s) => s.activePathId);
  const updateNode = useStudioStore((s) => s.updateNode);
  const runSimulation = useStudioStore((s) => s.runSimulation);
  const selectNode = useStudioStore((s) => s.selectNode);
  // Loop Pass L2 — fingerprints of issues that changed in the most recent
  // recompute. Drives the float-to-top + "changed by last edit" tag so the
  // operator sees the causal consequence of their last edit immediately.
  const recentIssueChangeKeys = useStudioStore((s) => s.recentIssueChangeKeys);
  const recentChangeSet = new Set(recentIssueChangeKeys);
  const outcome = selectSecurityOutcomeFromStore({ scene, simulationResult: result, activePathId });
  const [previewStateByRecKey, setPreviewStateByRecKey] = useState<Record<string, Record<string, unknown>>>({});

  const findNodeById = (nodeId: string) => {
    const collections = [
      scene.cameras,
      scene.obstructions,
      scene.walls,
      scene.securityLights,
      scene.criticalZones,
      scene.paths,
    ];
    for (const list of collections) {
      const found = list.find((entry) => entry.id === nodeId);
      if (found) return found;
    }
    return null;
  };

  const makePatch = (rec: NonNullable<typeof result>["recommendations"][number]) => {
    if (!rec.affectedNodeId) return null;
    if (rec.type === "rotate_camera") {
      const patch: Record<string, unknown> = {};
      if (rec.suggestedYawDeg != null) patch.yawDeg = rec.suggestedYawDeg;
      if (rec.suggestedPitchDeg != null) patch.pitchDeg = rec.suggestedPitchDeg;
      return Object.keys(patch).length ? patch : null;
    }
    if (rec.type === "move_object" && rec.suggestedPosition != null) {
      return { position: rec.suggestedPosition } as Record<string, unknown>;
    }
    if (rec.type === "change_fov" && rec.suggestedPitchDeg != null) {
      // In some generated recommendations `suggestedPitchDeg` is used as a generalized numeric slot.
      // Clamp defensively to a valid horizontal FOV range.
      const clamped = Math.max(15, Math.min(140, rec.suggestedPitchDeg));
      return { fovHorizontalDeg: clamped } as Record<string, unknown>;
    }
    return null;
  };

  if (!result) {
    return (
      <RunSimulationPrompt
        className="h-full px-4"
        message="Run the shared simulation to populate issue detection and recommendations."
      />
    );
  }

  const hasIssues = result.issues.length > 0;
  const privacyIssues = result.issues.filter((issue) => issue.category === "privacy");
  const privacyIssueZones = [...new Set(privacyIssues.flatMap((issue) => issue.affectedZones))];
  const privacyIssueCameras = [...new Set(privacyIssues.flatMap((issue) => issue.affectedCameras))];
  const blindRegions = result.blindRegions ?? [];
  const criticalBlindRegions = blindRegions.filter((r) => r.severity === "critical" || r.severity === "high");

  // Loop Pass L2 — stable-sort issues so findings whose fingerprint appears in
  // `recentIssueChangeKeys` (i.e. appeared or disappeared in the most recent
  // recompute) float to the top. Preserves engine order within each partition
  // (changed vs unchanged) so the diff is non-disruptive when nothing changed.
  // Per `motto_v3 §0.2`: only reorders when there's actual signal, never when
  // `recentIssueChangeKeys` is empty (no edit-driven churn).
  const sortedIssues = recentChangeSet.size > 0
    ? [...result.issues].sort((a, b) => {
        const aChanged = recentChangeSet.has(issueFingerprint(a)) ? 0 : 1;
        const bChanged = recentChangeSet.has(issueFingerprint(b)) ? 0 : 1;
        return aChanged - bChanged;
      })
    : result.issues;

  if (!hasIssues && blindRegions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="text-[11px] text-green-400 font-semibold">No issues found</div>
        <div className="text-[9px] text-[#4a5568]">All coverage requirements are met</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#556076]">Issues</span>
          <TruthBadge label="simulated" />
        </div>
        <div className="`{rounded-lg border ${UI_SURFACES.borderPanel} bg-[#0b1018] px-2.5 py-2 text-[10px] text-[#b9c7df]}`">
          Outcome status: {outcome.summary.status.replace(/_/g, " ")}
          {outcome.summary.primaryRisk ? ` · Primary risk: ${outcome.summary.primaryRisk}` : ""}
        </div>
        {sortedIssues.map((issue) => {
          const isRecentlyChanged = recentChangeSet.has(issueFingerprint(issue));
          return (
          <div
            key={`${issue.category}-${issue.description}`}
            className={
              "flex gap-2.5 p-2.5 bg-[#0d0f17] border rounded-lg hover:border-[#2a3045] transition-colors group " +
              (isRecentlyChanged ? "border-amber-500/40 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]" : "${UI_SURFACES.borderPanel}")
            }
          >
            <SeverityIcon severity={issue.severity} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold text-[#c0c8da] leading-tight">{issue.description}</span>
                <SeverityBadge severity={issue.severity} />
                {isRecentlyChanged ? (
                  <span
                    title="This finding appeared, disappeared, or changed in the most recent simulation recompute"
                    className="ml-auto inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-amber-200"
                  >
                    Changed by last edit
                  </span>
                ) : null}
              </div>
              <div className="text-[9px] text-[#68738a] capitalize">{issue.category.replace(/_/g, " ")}</div>
              {issue.affectedZones.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="text-[8px] text-[#4a5568]">Zones:</span>
                  {issue.affectedZones.map((z) => (
                    <span key={z} className="text-[8px] text-[#8090a8] bg-[#1a1d26] px-1 rounded">{z}</span>
                  ))}
                </div>
              )}
              {issue.affectedCameras.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="text-[8px] text-[#4a5568]">Cameras:</span>
                  {issue.affectedCameras.map((c) => (
                    <button type="button"
                      key={c}
                      onClick={() => selectNode(c)}
                      className="text-[8px] text-blue-400 bg-[#1a1d26] px-1 rounded hover:bg-[#1e2235] cursor-pointer transition-colors active:scale-[0.97]"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          );
        })}

        {privacyIssues.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[9px] font-semibold text-[#3a4158] uppercase tracking-widest">Privacy Review</div>
              <Badge variant="blue">{privacyIssues.length} issues</Badge>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <div className="`{rounded-lg border ${UI_SURFACES.borderPanel} bg-[#090d14] px-2 py-1.5 text-[9px]}`">
                <div className="text-[#4a5568] uppercase tracking-[0.12em]">Zones</div>
                <div className="text-[#c7d0e4]">{privacyIssueZones.length}</div>
              </div>
              <div className="`{rounded-lg border ${UI_SURFACES.borderPanel} bg-[#090d14] px-2 py-1.5 text-[9px]}`">
                <div className="text-[#4a5568] uppercase tracking-[0.12em]">Cameras</div>
                <div className="text-[#c7d0e4]">{privacyIssueCameras.length}</div>
              </div>
              <div className="`{rounded-lg border ${UI_SURFACES.borderPanel} bg-[#090d14] px-2 py-1.5 text-[9px]}`">
                <div className="text-[#4a5568] uppercase tracking-[0.12em]">Restricted Cells</div>
                <div className="text-[#c7d0e4]">{result.coverageCells.filter((cell) => cell.privacyRestricted).length}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {privacyIssues.map((issue, index) => (
                <div key={`privacy-${index}`} className="`{rounded-lg border ${UI_SURFACES.borderPanel} bg-[#0d0f17] p-2.5}`">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-400" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold text-[#dce5f7]">{issue.description}</div>
                      <div className="mt-0.5 text-[9px] text-[#68738a]">
                        Zones: {issue.affectedZones.length > 0 ? issue.affectedZones.join(", ") : "None"} · Cameras: {issue.affectedCameras.length > 0 ? issue.affectedCameras.join(", ") : "None"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {issue.affectedZones.map((zoneId) => {
                          const zone = scene.privacyZones.find((entry) => entry.id === zoneId);
                          return (
                            <button
                              key={zoneId}
                              type="button"
                              onClick={() => selectNode(zoneId)}
                              className="rounded bg-[#1a1d26] px-1.5 py-0.5 text-[8px] text-amber-300 hover:bg-[#222635]"
                            >
                              {zone?.label ?? zoneId}
                            </button>
                          );
                        })}
                        {issue.affectedCameras.map((cameraId) => (
                          <button
                            key={cameraId}
                            type="button"
                            onClick={() => selectNode(cameraId)}
                            className="rounded bg-[#1a1d26] px-1.5 py-0.5 text-[8px] text-blue-300 hover:bg-[#222635]"
                          >
                            {cameraId}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blind Region Topology Section */}
        {blindRegions.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[9px] font-semibold text-[#3a4158] uppercase tracking-widest">Blind Spot Topology</div>
              {criticalBlindRegions.length > 0 && (
                <Badge variant="red">{criticalBlindRegions.length} high-risk</Badge>
              )}
            </div>
            <div className="space-y-1.5">
              {blindRegions.map((region) => (
                <div
                  key={region.id}
                  className={`flex gap-2.5 p-2.5 rounded-lg border transition-colors ${
                    region.severity === "critical"
                      ? "bg-red-950/20 border-red-800/30 hover:border-red-600/40"
                      : region.severity === "high"
                      ? "bg-amber-950/20 border-amber-800/30 hover:border-amber-600/40"
                      : "bg-[#0d0f17] ${UI_SURFACES.borderPanel} hover:border-[#2a3045]"
                  }`}
                >
                  <BlindRegionIcon severity={region.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-[#c0c8da] leading-tight truncate">
                        {region.description}
                      </span>
                      <BlindRegionBadge region={region} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[9px] text-[#68738a] capitalize">
                        {region.classification.replace(/_/g, " ")}
                      </span>
                      <span className="text-[9px] text-[#4a5568]">{region.areaSqM.toFixed(1)} m²</span>
                      <span className="text-[9px] text-[#4a5568]">{region.cells.length} cells</span>
                    </div>
                    {region.affectedZoneIds.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="text-[8px] text-[#4a5568]">Zones:</span>
                        {region.affectedZoneIds.map((id) => (
                          <span key={id} className="text-[8px] text-amber-400 bg-[#1a1d26] px-1 rounded">{id}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div className="mt-3">
            <div className="text-[9px] font-semibold text-[#3a4158] uppercase tracking-widest mb-2">Recommendations</div>
            {result.recommendations.map((rec) => {
              const recKey = `${rec.type}-${rec.description}`;
              const canFix = rec.verified && rec.affectedNodeId != null;
              const canPreview = canFix && makePatch(rec) != null;
              const isPreviewActive = previewStateByRecKey[recKey] != null;
              const previewFix = () => {
                if (!rec.affectedNodeId) return;
                const patch = makePatch(rec);
                if (!patch) return;
                const target = findNodeById(rec.affectedNodeId);
                if (!target) return;
                const previous: Record<string, unknown> = {};
                for (const key of Object.keys(patch)) {
                  previous[key] = (target as Record<string, unknown>)[key];
                }
                setPreviewStateByRecKey((state) => ({ ...state, [recKey]: previous }));
                updateNode(rec.affectedNodeId, patch);
                selectNode(rec.affectedNodeId);
              };
              const testFix = () => {
                previewFix();
                runSimulation();
              };
              const applyFix = () => {
                if (!rec.affectedNodeId) return;
                const patch = makePatch(rec);
                if (!patch) return;
                updateNode(rec.affectedNodeId, patch);
                selectNode(rec.affectedNodeId);
                setPreviewStateByRecKey((state) => {
                  const next = { ...state };
                  delete next[recKey];
                  return next;
                });
              };
              const revertPreview = () => {
                if (!rec.affectedNodeId) return;
                const previous = previewStateByRecKey[recKey];
                if (!previous) return;
                updateNode(rec.affectedNodeId, previous);
                setPreviewStateByRecKey((state) => {
                  const next = { ...state };
                  delete next[recKey];
                  return next;
                });
              };
              return (
                <div key={`${rec.type}-${rec.description}`} className="flex items-start gap-2 py-2 border-b border-[#181b26]">
                  <ChevronRight className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-[#8090a8]">{rec.description}</span>
                    {rec.type ? (
                      <div className="mt-1 text-[8px] uppercase tracking-[0.12em] text-[#4a5568]">
                        Cause: {rec.type.replace(/_/g, " ")}
                      </div>
                    ) : null}
                    {rec.affectedNodeId ? (
                      <div className="mt-0.5 text-[8px] text-[#68738a]">
                        Evidence: affects <span className="text-[#c7d0e4]">{rec.affectedNodeId}</span>
                      </div>
                    ) : null}
                    {canFix && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {canPreview && !isPreviewActive ? (
                          <button type="button"
                            onClick={previewFix}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600/20 border border-emerald-600/30 text-[9px] text-emerald-300 hover:bg-emerald-600/30 transition-colors"
                          >
                            Preview Fix
                          </button>
                        ) : null}
                        {canPreview ? (
                          <button type="button"
                            onClick={testFix}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-violet-600/20 border border-violet-600/30 text-[9px] text-violet-300 hover:bg-violet-600/30 transition-colors"
                          >
                            Test Fix
                          </button>
                        ) : null}
                        <button type="button"
                          onClick={applyFix}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600/20 border border-blue-600/30 text-[9px] text-blue-300 hover:bg-blue-600/30 transition-colors"
                        >
                          <Wrench className="w-2.5 h-2.5" />
                          Apply Fix
                        </button>
                        {isPreviewActive ? (
                          <button type="button"
                            onClick={revertPreview}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1a1d26] border border-[#2b3143] text-[9px] text-[#b9c2d8] hover:border-[#3b435c] transition-colors"
                          >
                            Revert Preview
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
