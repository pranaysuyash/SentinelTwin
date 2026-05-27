"use client";

import { AlertCircle, AlertTriangle, ChevronRight, Eye, EyeOff, Info, ShieldAlert, Wrench } from "lucide-react";
import { useState } from "react";
import { useStudioStore } from "@/store/studio-store";
import { Badge } from "@/components/shared/Badge";
import type { BlindRegionResult, SecurityIssue } from "@/schema/security-scene";

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
  const updateNode = useStudioStore((s) => s.updateNode);
  const selectNode = useStudioStore((s) => s.selectNode);
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
      <div className="flex items-center justify-center h-full text-[#3a4158] text-[11px]">
        Run simulation to see issues
      </div>
    );
  }

  const hasIssues = result.issues.length > 0;
  const blindRegions = result.blindRegions ?? [];
  const criticalBlindRegions = blindRegions.filter((r) => r.severity === "critical" || r.severity === "high");

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
        {result.issues.map((issue, i) => (
          <div key={i} className="flex gap-2.5 p-2.5 bg-[#0d0f17] border border-[#1e2130] rounded-lg hover:border-[#2a3045] transition-colors group">
            <SeverityIcon severity={issue.severity} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold text-[#c0c8da] leading-tight">{issue.description}</span>
                <SeverityBadge severity={issue.severity} />
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
                    <button
                      key={c}
                      onClick={() => selectNode(c)}
                      className="text-[8px] text-blue-400 bg-[#1a1d26] px-1 rounded hover:bg-[#1e2235] cursor-pointer transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

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
                      : "bg-[#0d0f17] border-[#1e2130] hover:border-[#2a3045]"
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
            {result.recommendations.map((rec, i) => {
              const recKey = `${i}:${rec.description}`;
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
                <div key={i} className="flex items-start gap-2 py-2 border-b border-[#181b26]">
                  <ChevronRight className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-[#8090a8]">{rec.description}</span>
                    {canFix && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {canPreview && !isPreviewActive ? (
                          <button
                            onClick={previewFix}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600/20 border border-emerald-600/30 text-[9px] text-emerald-300 hover:bg-emerald-600/30 transition-colors"
                          >
                            Preview Fix
                          </button>
                        ) : null}
                        <button
                          onClick={applyFix}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600/20 border border-blue-600/30 text-[9px] text-blue-300 hover:bg-blue-600/30 transition-colors"
                        >
                          <Wrench className="w-2.5 h-2.5" />
                          Apply Fix
                        </button>
                        {isPreviewActive ? (
                          <button
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
