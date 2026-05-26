"use client";

import { useStudioStore } from "@/store/studio-store";
import type { LayerId } from "@/store/studio-store";

const LAYERS: { id: LayerId; label: string }[] = [
  { id: "cameras",       label: "Camera Frustums"    },
  { id: "camera_cones",  label: "Coverage Cones"     },
  { id: "walls_floors",  label: "Walls & Floors"     },
  { id: "obstructions",  label: "Obstructions"       },
  { id: "critical_zones",label: "Critical Zones"     },
  { id: "privacy_zones", label: "Privacy Zones"      },
  { id: "paths",         label: "Path Routes"        },
  { id: "heatmap",       label: "Quality Heatmap"    },
  { id: "grid",          label: "Grid Overlay"       },
  { id: "lights",        label: "Light Sources"      },
  { id: "labels",        label: "Object Labels"      },
];

export function DebugTab() {
  const layers     = useStudioStore((s) => s.layerVisibility);
  const toggleLayer = useStudioStore((s) => s.toggleLayer);
  const result     = useStudioStore((s) => s.simulationResult);
  const assumptions = useStudioStore((s) => s.scene.assumptions);

  return (
    <div className="h-full overflow-y-auto flex gap-4 px-3 py-2">
      {/* Layer toggles */}
      <div className="min-w-[200px]">
        <div className="text-[9px] font-semibold tracking-widest text-[#3a4158] uppercase mb-2">Layer Visibility</div>
        <div className="space-y-1">
          {LAYERS.map(({ id, label }) => (
            <label key={id} className="flex items-center gap-2 cursor-pointer group">
              <div
                onClick={() => toggleLayer(id)}
                className={"w-7 h-3.5 rounded-full transition-colors cursor-pointer " + (layers[id] ? "bg-green-600" : "bg-[#1e2130]")}
              >
                <div className={"w-3 h-3 rounded-full bg-white mt-[1px] transition-transform " + (layers[id] ? "translate-x-[14px] ml-0.5" : "translate-x-[2px]")} />
              </div>
              <span className={"text-[10px] transition-colors " + (layers[id] ? "text-[#c0c8da]" : "text-[#4a5568]")}>
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Debug info */}
      {result && (
        <div className="flex-1">
          <div className="text-[9px] font-semibold tracking-widest text-[#3a4158] uppercase mb-2">Simulation Debug</div>
          <div className="mb-3 rounded-lg border border-[#1a2030] bg-[#07090f]/70 px-2 py-1.5">
            <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#556076]">
              Active PPM Thresholds
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-[#8090a8]">
              <span>Detection</span><span className="text-right font-mono">{assumptions.pixelsPerMeter.detection}</span>
              <span>Observation</span><span className="text-right font-mono">{assumptions.pixelsPerMeter.observation}</span>
              <span>Recognition</span><span className="text-right font-mono">{assumptions.pixelsPerMeter.recognition}</span>
              <span>Identification</span><span className="text-right font-mono">{assumptions.pixelsPerMeter.identification}</span>
            </div>
          </div>
          <div className="space-y-1">
            {[
              ["Total Coverage",       result.totalCoveragePct.toFixed(1) + "%"],
              ["Blindspot",            result.blindspotPct.toFixed(1) + "%"],
              ["Avg Quality Score",    result.averageWalkableQuality.toFixed(3)],
              ["Detection (DORI)",     result.coverageByQuality.detection.toFixed(1) + "%"],
              ["Recognition (DORI)",   result.coverageByQuality.recognition.toFixed(1) + "%"],
              ["Identification (DORI)",result.coverageByQuality.identification.toFixed(1) + "%"],
              ["Critical Zones Pass",  result.criticalZoneResults.filter((z) => z.status === "pass").length + "/" + result.criticalZoneResults.length],
              ["Issues",               result.issues.length],
            ].map(([label, val]) => (
              <div key={String(label)} className="flex justify-between py-1 border-b border-[#181b26]">
                <span className="text-[9px] text-[#4a5568]">{label}</span>
                <span className="text-[9px] font-mono text-[#8090a8]">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
