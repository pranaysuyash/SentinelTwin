"use client";

import {
  ChevronDown,
  ChevronRight,
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
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { MiniMap } from "@/components/map/MiniMap";
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

function SectionTitle({
  icon,
  title,
  collapsed,
  onToggle,
  summary,
}: {
  icon?: React.ReactNode;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  summary?: string;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1 px-0.5 text-[8px] font-semibold uppercase tracking-[0.22em] text-[#4a556b]">
      {icon}
      <span>{title}</span>
      {summary ? (
        <span className="ml-1 rounded-full border border-[#1f2536] bg-[#0b0f17] px-1.5 py-0.5 text-[7px] normal-case tracking-[0.12em] text-[#657086]">
          {summary}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#24283a] bg-[#111521] text-[#7f8aa3] transition-colors hover:border-[#32384d] hover:text-white"
        title={collapsed ? `Expand ${title}` : `Collapse ${title}`}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
    </div>
  );
}

export function LeftPanel() {
  const activeTool = useStudioStore((s) => s.activeTool);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const layerVis = useStudioStore((s) => s.layerVisibility);
  const toggleLayer = useStudioStore((s) => s.toggleLayer);
  const [collapsedSections, setCollapsedSections] = useState({
    tools: false,
    layers: false,
    minimap: false,
  });

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  return (
    <aside className="flex h-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto border-r border-[#1e2130] bg-[#0d1017]">
      <div className="space-y-2.5 px-2 py-2.5">
        <section>
          <SectionTitle
            title="Scene Tools"
            collapsed={collapsedSections.tools}
            onToggle={() => toggleSection("tools")}
            summary={`${TOOLS.length} tools`}
          />
          {!collapsedSections.tools ? (
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
          ) : (
            <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2.5 py-2 text-[9px] text-[#72809a]">
              Toolbar hidden to favor canvas space.
            </div>
          )}
        </section>

        <section>
          <SectionTitle
            icon={<Layers className="h-2.5 w-2.5" />}
            title="Scene Layers"
            collapsed={collapsedSections.layers}
            onToggle={() => toggleSection("layers")}
            summary={`${LAYERS.length} layers`}
          />
          {!collapsedSections.layers ? (
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
          ) : (
            <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2.5 py-2 text-[9px] text-[#72809a]">
              Layer visibility hidden. Selected layers still drive the canvas.
            </div>
          )}
        </section>

        <section>
          <SectionTitle
            icon={<Map className="h-2.5 w-2.5" />}
            title="Mini-Map"
            collapsed={collapsedSections.minimap}
            onToggle={() => toggleSection("minimap")}
            summary="Live navigation"
          />
          {!collapsedSections.minimap ? (
            <MiniMap />
          ) : (
            <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2.5 py-2 text-[9px] text-[#72809a]">
              Minimap hidden. Expand only when navigating the scene.
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
