"use client";

import {
  Camera,
  DoorOpen,
  Eye,
  EyeOff,
  Layers,
  Map,
  MessageSquare,
  MousePointer2,
  Pencil,
  Route,
  Shield,
  Sun,
  Ruler,
  Square,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { type ActiveTool, type LayerId, useStudioStore } from "@/store/studio-store";

const TOOLS: { id: ActiveTool; label: string; icon: React.ReactNode; key: string }[] = [
  { id: "select", label: "Select", icon: <MousePointer2 className="h-3.5 w-3.5" />, key: "V" },
  { id: "camera", label: "Camera", icon: <Camera className="h-3.5 w-3.5" />, key: "C" },
  { id: "obstruction", label: "Obstruction", icon: <Square className="h-3.5 w-3.5" />, key: "B" },
  { id: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" />, key: "L" },
  { id: "path", label: "Path", icon: <Route className="h-3.5 w-3.5" />, key: "P" },
  { id: "zone", label: "Zone", icon: <Shield className="h-3.5 w-3.5" />, key: "Z" },
  { id: "door_window", label: "Door / Window", icon: <DoorOpen className="h-3.5 w-3.5" />, key: "D" },
  { id: "wall", label: "Wall", icon: <Pencil className="h-3.5 w-3.5" />, key: "W" },
  { id: "measure", label: "Measure", icon: <Ruler className="h-3.5 w-3.5" />, key: "M" },
  { id: "comment", label: "Comment", icon: <MessageSquare className="h-3.5 w-3.5" />, key: "T" },
];

const LAYERS: { id: LayerId; label: string }[] = [
  { id: "cameras", label: "Cameras" },
  { id: "camera_cones", label: "Camera Cones" },
  { id: "obstructions", label: "Obstructions" },
  { id: "lights", label: "Lights" },
  { id: "critical_zones", label: "Critical Zones" },
  { id: "privacy_zones", label: "Privacy Zones" },
  { id: "paths", label: "Paths" },
  { id: "heatmap", label: "Heatmap" },
  { id: "grid", label: "Grid" },
  { id: "walls_floors", label: "Walls & Floors" },
  { id: "labels", label: "Labels" },
];

function MiniMap() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const selected = useStudioStore((s) => s.selectedNodeId);

  const W = 154;
  const H = 112;
  const scW = scene.dimensions.width;
  const scD = scene.dimensions.depth;
  const mx = (x: number) => (x / scW) * W;
  const mz = (z: number) => (z / scD) * H;

  const qualColor: Record<string, string> = {
    identification: "#3b82f6",
    recognition: "#22c55e",
    observation: "#eab308",
    detection: "#f97316",
    none: "#ef4444",
  };

  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <svg width={W} height={H} className="block rounded-lg border border-[#1e2130] bg-[#0d1018]">
        <defs>
          <linearGradient id="minimap-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111625" />
            <stop offset="100%" stopColor="#0a0d14" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#minimap-bg)" />
        <rect x={1} y={1} width={W - 2} height={H - 2} fill="none" stroke="#1d2435" strokeWidth={1} rx={8} />

        {result?.coverageCells?.map((cell, index) => (
          <rect
            key={index}
            x={mx(cell.x - 0.125)}
            y={mz(cell.z - 0.125)}
            width={mx(0.25)}
            height={mz(0.25)}
            fill={qualColor[cell.quality] ?? "#1a1a2e"}
            opacity={0.46}
          />
        ))}

        {scene.criticalZones.map((zone) => {
          const xs = zone.polygon.map(([x]) => mx(x));
          const zs = zone.polygon.map(([, z]) => mz(z));
          const minX = Math.min(...xs);
          const minZ = Math.min(...zs);
          const maxX = Math.max(...xs);
          const maxZ = Math.max(...zs);
          return (
            <rect
              key={zone.id}
              x={minX}
              y={minZ}
              width={maxX - minX}
              height={maxZ - minZ}
              fill="#eab30810"
              stroke="#eab308"
              strokeWidth={1}
              opacity={0.9}
            />
          );
        })}

        {scene.walls.map((wall) => (
          <line
            key={wall.id}
            x1={mx(wall.start[0])}
            y1={mz(wall.start[1])}
            x2={mx(wall.end[0])}
            y2={mz(wall.end[1])}
            stroke={wall.material === "glass" ? "#8dbafc99" : "#cad3e4"}
            strokeWidth={wall.material === "glass" ? 1.25 : 1.6}
            strokeLinecap="round"
          />
        ))}

        {scene.paths.map((path) => (
          <polyline
            key={path.id}
            points={path.points.map((point) => `${mx(point.position[0])},${mz(point.position[1])}`).join(" ")}
            fill="none"
            stroke="#a78bfa"
            strokeWidth={1.3}
            strokeDasharray="3,2"
            opacity={0.85}
          />
        ))}

        {result?.adversarialPath?.waypoints.map((waypoint, index, points) =>
          index < points.length - 1 ? (
            <line
              key={index}
              x1={mx(waypoint.position[0])}
              y1={mz(waypoint.position[1])}
              x2={mx(points[index + 1]!.position[0])}
              y2={mz(points[index + 1]!.position[1])}
              stroke="#f43f5e"
              strokeWidth={1}
              strokeDasharray="2,1.5"
              opacity={0.8}
            />
          ) : null,
        )}

        {scene.entryPoints.map((entry) => (
          <g key={entry.id}>
            <circle cx={mx(entry.position[0])} cy={mz(entry.position[1])} r={3.5} fill="#0d1018" stroke="#a78bfa" strokeWidth={1.2} />
            <circle cx={mx(entry.position[0])} cy={mz(entry.position[1])} r={1.2} fill="#a78bfa" />
          </g>
        ))}

        {scene.cameras.map((camera) => {
          const [x, , z] = camera.position;
          const isSelected = camera.id === selected;
          return (
            <g key={camera.id}>
              {isSelected && <circle cx={mx(x)} cy={mz(z)} r={6} fill="none" stroke="#93c5fd" strokeWidth={1.2} opacity={0.95} />}
              <circle
                cx={mx(x)}
                cy={mz(z)}
                r={3.4}
                fill={isSelected ? "#60a5fa" : "#3b82f6"}
                stroke={isSelected ? "#ffffff" : "#183355"}
                strokeWidth={isSelected ? 1.5 : 1}
              />
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex items-center justify-between text-[8px] uppercase tracking-[0.18em] text-[#556076]">
        <span>Coverage</span>
        <span>{scene.dimensions.width}m x {scene.dimensions.depth}m</span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button className="flex h-5 w-5 items-center justify-center rounded-md border border-[#1f2536] text-[#556076] transition-colors hover:border-[#2b3246] hover:text-white">
            <ZoomOut className="h-2.5 w-2.5" />
          </button>
          <button className="flex h-5 w-5 items-center justify-center rounded-md border border-[#1f2536] text-[#556076] transition-colors hover:border-[#2b3246] hover:text-white">
            <ZoomIn className="h-2.5 w-2.5" />
          </button>
          <button className="h-5 rounded-md border border-[#1f2536] px-1.5 text-[9px] font-medium text-[#7f8ca6] transition-colors hover:border-[#2b3246] hover:text-white">
            Fit
          </button>
        </div>
        <button className="h-5 rounded-md border border-[#1f2536] px-1.5 text-[9px] font-medium text-[#7f8ca6] transition-colors hover:border-[#2b3246] hover:text-white">
          2D
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 px-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-[#4a556b]">
      {icon}
      <span>{title}</span>
    </div>
  );
}

export function LeftPanel() {
  const activeTool = useStudioStore((s) => s.activeTool);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const layerVis = useStudioStore((s) => s.layerVisibility);
  const toggleLayer = useStudioStore((s) => s.toggleLayer);

  return (
    <aside className="flex w-[186px] flex-shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-[#1e2130] bg-[#0d1017]">
      <div className="space-y-3 px-2 py-3">
        <section>
          <SectionTitle title="Scene Tools" />
          <div className="space-y-1 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            {TOOLS.map((tool) => {
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={cn(
                    "flex h-7 w-full items-center gap-2 rounded-lg px-2 text-[10px] font-medium transition-colors",
                    active
                      ? "bg-blue-500/14 text-blue-300 ring-1 ring-inset ring-blue-500/30"
                      : "text-[#8b96ae] hover:bg-[#141926] hover:text-[#d6deef]",
                  )}
                >
                  <span className={cn("flex-shrink-0", active ? "text-blue-300" : "text-[#68748d]")}>{tool.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-left">{tool.label}</span>
                  <span className="rounded bg-[#111521] px-1 py-0.5 font-mono text-[8px] text-[#4d566b]">{tool.key}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle icon={<Layers className="h-2.5 w-2.5" />} title="Scene Layers" />
          <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            {LAYERS.map((layer) => {
              const visible = layerVis[layer.id];
              return (
                <div key={layer.id} className="group flex h-6 items-center gap-1.5 rounded-lg px-1.5 transition-colors hover:bg-[#141926]">
                  <span
                    className={cn(
                      "flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-[4px] border",
                      visible ? "border-blue-500/60 bg-blue-500/25" : "border-[#394153] bg-transparent",
                    )}
                  >
                    {visible && (
                      <svg viewBox="0 0 8 8" className="h-full w-full">
                        <polyline points="1,4 3,6 7,2" fill="none" stroke="#93c5fd" strokeWidth="1.4" />
                      </svg>
                    )}
                  </span>
                  <span className={cn("flex-1 truncate text-[10px]", visible ? "text-[#c6cfdf]" : "text-[#535d73]")}>{layer.label}</span>
                  <button onClick={() => toggleLayer(layer.id)} className="flex-shrink-0 text-[#57627a] transition-all hover:text-white">
                    {visible ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle icon={<Map className="h-2.5 w-2.5" />} title="Mini-Map" />
          <MiniMap />
        </section>
      </div>
    </aside>
  );
}
