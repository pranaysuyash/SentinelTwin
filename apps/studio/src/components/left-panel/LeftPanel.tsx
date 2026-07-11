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
  ScanSearch,
  Sun,
  Ruler,
  Square,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { MiniMap } from "@/components/map/MiniMap";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { type ActiveTool, type LayerId, useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


const TOOLS: { id: ActiveTool; label: string; icon: React.ReactNode; key: string }[] = [
  { id: "select", label: "Select", icon: <MousePointer2 className="h-3.5 w-3.5" />, key: "V" },
  { id: "camera", label: "Camera", icon: <Camera className="h-3.5 w-3.5" />, key: "C" },
  { id: "obstruction", label: "Obstruction", icon: <Square className="h-3.5 w-3.5" />, key: "B" },
  { id: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" />, key: "L" },
  { id: "sensor", label: "Sensor", icon: <ScanSearch className="h-3.5 w-3.5" />, key: "Y" },
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
  helpText,
}: {
  icon?: React.ReactNode;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  summary?: string;
  helpText?: string;
}) {
  return (
    <div className={`mb-1.5 flex items-center gap-1 px-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] UI_SURFACES.textMuted2`}>
      {icon}
      <span className="min-w-0 truncate">{title}</span>
      {summary ? <span className={`ml-1 min-w-0 truncate text-[10px] normal-case tracking-[0.06em] UI_SURFACES.textMuted3`}>{summary}</span> : null}
      {helpText ? <ExplainBadge text={helpText} /> : null}
      <button
        type="button"
        onClick={onToggle}
        className={`ml-auto inline-flex h-5 w-5 items-center justify-center rounded-md border UI_SURFACES.borderThin UI_SURFACES.card UI_SURFACES.textMuted3 transition-colors UI_SURFACES.hoverBorderSubtle UI_SURFACES.hoverText`}
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
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const viewMode = useStudioStore((s) => s.viewMode);
  const layerVis = useStudioStore((s) => s.layerVisibility);
  const toggleLayer = useStudioStore((s) => s.toggleLayer);
  const visibleComponents = useStudioStore((s) => s.visibleComponents);
  const editor = useStudioStore((s) => s.editor);
  const setSnapEnabled = useStudioStore((s) => s.setSnapEnabled);
  const setSnapDistanceM = useStudioStore((s) => s.setSnapDistanceM);
  const setGridSnapM = useStudioStore((s) => s.setGridSnapM);
  const [collapsedSections, setCollapsedSections] = useState({
    tools: false,
    layers: false,
    minimap: false,
    presets: false,
    snapping: false,
  });
  const [toolPresetName, setToolPresetName] = useState("");
  const [toolPresets, setToolPresets] = useState<Array<{ name: string; tool: ActiveTool; snapEnabled: boolean; snapDistanceM: number; gridSnapM: number }>>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem("sentineltwin_tool_presets_v1") ?? "[]");
    } catch {
      return [];
    }
  });

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const persistPresets = (next: typeof toolPresets) => {
    setToolPresets(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sentineltwin_tool_presets_v1", JSON.stringify(next));
    }
  };

  return (
    <aside className={`flex h-full min-w-0 flex-1 flex-col overflow-hidden border-r UI_SURFACES.borderPanel UI_SURFACES.panel`}>
      <div className={`flex shrink-0 items-center gap-2 border-b UI_SURFACES.borderPanel UI_SURFACES.panel px-2.5 py-1`}>
        <div className="flex h-5 w-5 items-center justify-center rounded-md border border-sky-500/20 bg-sky-500/12">
          <Layers className="h-3 w-3 text-sky-400" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-white">Scene Authoring</div>
          <div className={`truncate text-[10px] uppercase tracking-[0.14em] UI_SURFACES.textMuted2`}>
            {workspacePreset.replace(/_/g, " ")} · {viewMode.replace(/_/g, " ")}
          </div>
        </div>
        <div className={`ml-auto inline-flex min-w-0 items-center gap-1 rounded-md border UI_SURFACES.borderThin UI_SURFACES.card px-1.5 py-0.5 text-[10px] UI_SURFACES.textMuted4`}>
          <span className={cn("truncate font-mono", editor.snapEnabled ? "text-emerald-400 font-bold" : `UI_SURFACES.textMuted`)}>
            {editor.snapEnabled ? "Snap ON" : "Snap OFF"}
          </span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col space-y-2 overflow-x-hidden overflow-y-auto p-2">
        <section>
          <SectionTitle
            title="Scene Tools"
            collapsed={collapsedSections.tools}
            onToggle={() => toggleSection("tools")}
            summary={`${TOOLS.length} tools`}
            helpText="Choose the active authoring tool. Keyboard hints on the right speed up expert workflows."
          />
          {!collapsedSections.tools ? (
            <div className={`space-y-1 rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
              {TOOLS.map((tool) => {
                const active = activeTool === tool.id;
                return (
                  <button type="button"
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    className={cn(
                      "flex h-7 w-full items-center gap-2 rounded-lg px-2 text-[10px] font-medium transition-colors",
                      active
                        ? "bg-blue-500/14 text-blue-300 ring-1 ring-inset ring-blue-500/30"
                        : `UI_SURFACES.textMuted3 UI_SURFACES.hoverBg UI_SURFACES.hoverText`,
                    )}
                  >
                    <span className={cn("flex-shrink-0", active ? "text-blue-300" : `UI_SURFACES.textMuted`)}>{tool.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-left">{tool.label}</span>
                    <span className={`rounded UI_SURFACES.card px-1 py-0.5 font-mono text-[8px] UI_SURFACES.textMuted`}>{tool.key}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2.5 py-2 text-[10px] UI_SURFACES.textMuted2`}>
              Toolbar hidden to favor canvas space.
            </div>
          )}
        </section>

        <section>
          <SectionTitle
            title="Tool Presets"
            collapsed={collapsedSections.presets}
            onToggle={() => toggleSection("presets")}
            summary={`${toolPresets.length} saved`}
            helpText="Save a reusable authoring configuration: active tool and snapping setup."
          />
          {!collapsedSections.presets ? (
            <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-1.5`}>
              <div className="flex gap-1">
                <input
                  value={toolPresetName}
                  onChange={(e) => setToolPresetName(e.target.value)}
                  placeholder="Preset name"
                  aria-label="Preset name"
                  className={`h-7 min-w-0 flex-1 rounded border UI_SURFACES.borderDark UI_SURFACES.card px-2 text-[10px] UI_SURFACES.textBody`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = toolPresetName.trim();
                    if (!name) return;
                    persistPresets([
                      ...toolPresets.filter((p) => p.name !== name),
                      { name, tool: activeTool, snapEnabled: editor.snapEnabled, snapDistanceM: editor.snapDistanceM, gridSnapM: editor.gridSnapM },
                    ]);
                    setToolPresetName("");
                  }}
                  className="rounded border border-emerald-500/35 px-2 text-[10px] text-emerald-300"
                >
                  Save
                </button>
              </div>
              <div className="mt-1.5 space-y-1">
                {toolPresets.length === 0 ? <div className={`text-[10px] UI_SURFACES.textMuted2`}>No presets saved.</div> : null}
                {toolPresets.map((preset) => (
                  <div key={preset.name} className={`flex items-center gap-1 rounded border UI_SURFACES.borderThin UI_SURFACES.card px-1.5 py-1`}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTool(preset.tool);
                        setSnapEnabled(preset.snapEnabled);
                        setSnapDistanceM(preset.snapDistanceM);
                        setGridSnapM(preset.gridSnapM);
                      }}
                      className={`flex-1 truncate text-left text-[10px] UI_SURFACES.textBody`}
                    >
                      {preset.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => persistPresets(toolPresets.filter((entry) => entry.name !== preset.name))}
                      className="text-[10px] text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2.5 py-2 text-[10px] UI_SURFACES.textMuted2`}>
              Presets hidden. Expand to load saved tool setups.
            </div>
          )}
        </section>

        <section>
          <SectionTitle
            title="Snapping"
            collapsed={collapsedSections.snapping}
            onToggle={() => toggleSection("snapping")}
            summary={editor.snapEnabled ? "On" : "Off"}
            helpText="Grid and wall snapping control how new points, walls, and transforms resolve while you edit."
          />
          {!collapsedSections.snapping ? (
            <div className={`space-y-1 rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
            <button
              type="button"
              onClick={() => setSnapEnabled(!editor.snapEnabled)}
              className={cn(
                "flex h-7 w-full items-center justify-between rounded-lg px-2 text-[10px] font-medium transition-colors",
                editor.snapEnabled
                  ? "bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-500/25"
                  : `UI_SURFACES.card UI_SURFACES.textMuted3 UI_SURFACES.hoverBg UI_SURFACES.hoverText`,
              )}
            >
              <span>Enable snapping</span>
              <span className={`rounded UI_SURFACES.card px-1.5 py-0.5 font-mono text-[8px] UI_SURFACES.textMuted`}>
                {editor.snapEnabled ? "On" : "Off"}
              </span>
            </button>
            <label className={`flex items-center gap-2 rounded-lg UI_SURFACES.card px-2 py-1.5 text-[10px] UI_SURFACES.textMuted3`}>
              <span className="w-24 flex-shrink-0">Snap distance</span>
              <input
                type="number"
                min={0.05}
                step={0.05}
                value={editor.snapDistanceM}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) setSnapDistanceM(next);
                }}
                className={`h-7 w-full rounded border UI_SURFACES.borderDark UI_SURFACES.panelDeep px-2 text-[10px] UI_SURFACES.textBody`}
              />
              <span className={`text-[10px] UI_SURFACES.textMuted`}>m</span>
            </label>
            <label className={`flex items-center gap-2 rounded-lg UI_SURFACES.card px-2 py-1.5 text-[10px] UI_SURFACES.textMuted3`}>
              <span className="w-24 flex-shrink-0">Grid size</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={editor.gridSnapM}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) setGridSnapM(next);
                }}
                className={`h-7 w-full rounded border UI_SURFACES.borderDark UI_SURFACES.panelDeep px-2 text-[10px] UI_SURFACES.textBody`}
              />
              <span className={`text-[10px] UI_SURFACES.textMuted`}>m</span>
            </label>
            <div className={`px-0.5 text-[10px] leading-relaxed UI_SURFACES.textMuted`}>
              Grid visibility lives in Scene Layers, while these settings control edit snapping.
            </div>
            </div>
          ) : (
            <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2.5 py-2 text-[10px] UI_SURFACES.textMuted2`}>
              Snapping settings hidden. Expand to tune grid and wall resolution.
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
            helpText="Toggle visibility only; analysis still uses full scene geometry unless removed."
          />
          {!collapsedSections.layers ? (
            <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
              {LAYERS.map((layer) => {
                const visible = layerVis[layer.id];
                return (
                  <div key={layer.id} className={`group flex h-6 items-center gap-1.5 rounded-lg px-1.5 transition-colors UI_SURFACES.hoverBg`}>
                    <span
                      className={cn(
                        "flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-[4px] border",
                        visible ? "border-blue-500/60 bg-blue-500/25" : "UI_SURFACES.textDim bg-transparent",
                      )}
                    >
                      {visible && (
                        <svg viewBox="0 0 8 8" className="h-full w-full">
                          <polyline points="1,4 3,6 7,2" fill="none" stroke="#93c5fd" strokeWidth="1.4" />
                        </svg>
                      )}
                    </span>
                    <span className={cn("flex-1 truncate text-[10px]", visible ? `UI_SURFACES.textBody` : `UI_SURFACES.textMuted`)}>{layer.label}</span>
                    <button type="button" onClick={() => toggleLayer(layer.id)} className={`flex-shrink-0 UI_SURFACES.textMuted transition-colors UI_SURFACES.hoverText`}>
                      {visible ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2.5 py-2 text-[10px] UI_SURFACES.textMuted2`}>
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
            helpText="Mini map supports quick orientation and navigation across large scenes."
          />
          {!collapsedSections.minimap && visibleComponents.minimap ? (
            <MiniMap />
          ) : (
            <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2.5 py-2 text-[10px] UI_SURFACES.textMuted2`}>
              Minimap hidden. Expand only when navigating the scene.
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
