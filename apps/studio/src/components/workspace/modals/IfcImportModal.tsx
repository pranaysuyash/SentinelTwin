"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Building2,
  CheckSquare,
  FileCode,
  FileText,
  Layers,
  Loader2,
  Radio,
  ShieldAlert,
  Square,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";
import {
  parseIfcToSecurityScene,
  type WallMaterial,
  type SecurityScene,
  type SceneLevel,
  cloneSecurityScene,
} from "@sentineltwin/core";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
const MATERIAL_OPTIONS: Array<{
  id: WallMaterial;
  label: string;
  rfAttenuationDb: number;
  description: string;
}> = [
  { id: "solid", label: "Solid Structural (Concrete / Brick / Metal)", rfAttenuationDb: 20, description: "High radar/optical occlusion & RF signal attenuation (~20dB)" },
  { id: "partial", label: "Partition / Drywall Wall", rfAttenuationDb: 3, description: "Low RF signal loss (~3dB, interior office divider)" },
  { id: "glass", label: "Architectural Glass / Glazing", rfAttenuationDb: 1, description: "Minimal RF attenuation (~1dB, optical transparency 85%)" },
  { id: "grill", label: "Security Mesh / Wire Grill", rfAttenuationDb: 5, description: "Semi-transparent security barrier (optical transparency 50%)" },
];

export function IfcImportModal() {
  const open = useStudioStore((s) => s.ifcImportModalOpen);
  const setOpen = useStudioStore((s) => s.setIfcImportModalOpen);
  const currentScene = useStudioStore((s) => s.scene);
  const setScene = useStudioStore((s) => s.setScene);
  const importScene = useStudioStore((s) => s.importScene);

  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [defaultMaterial, setDefaultMaterial] = useState<WallMaterial>("solid");
  const [defaultWallHeight, setDefaultWallHeight] = useState<number>(3.0);
  const [defaultElevation, setDefaultElevation] = useState<number>(0.0);

  const [selectedLevelIds, setSelectedLevelIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseResult = useMemo(() => {
    if (!rawText.trim()) return null;
    try {
      return parseIfcToSecurityScene(rawText, {
        defaultWallMaterial: defaultMaterial,
        defaultWallHeightM: defaultWallHeight,
        defaultLevelElevationM: defaultElevation,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  }, [rawText, defaultMaterial, defaultWallHeight, defaultElevation]);

  const parsedScene: SecurityScene | null = useMemo(() => {
    if (!parseResult || "error" in parseResult) return null;
    const base = createBlankSecurityScene();
    return {
      ...base,
      name: fileName ? `IFC Import: ${fileName}` : "IFC/STEP Structural Scene",
      source: "import",
      sourceTrace: fileName ? `Imported from ${fileName}` : "Imported from IFC/STEP text",
      levels: parseResult.levels,
      walls: parseResult.walls,
      doors: parseResult.doors,
      windows: parseResult.windows,
    };
  }, [parseResult, fileName]);

  const levels: SceneLevel[] = useMemo(() => {
    return parsedScene?.levels || [];
  }, [parsedScene]);

  // When parsing a new file/text, auto-select all found levels
  React.useEffect(() => {
    if (levels.length > 0) {
      setSelectedLevelIds(new Set(levels.map((l) => l.id)));
    } else {
      setSelectedLevelIds(new Set());
    }
  }, [levels]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setParseError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setRawText(text);
      } catch {
        setParseError("Failed to read file contents.");
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setParseError("Error reading IFC/STEP file.");
      setParsing(false);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const toggleLevel = useCallback((levelId: string) => {
    setSelectedLevelIds((prev) => {
      const next = new Set(prev);
      if (next.has(levelId)) {
        next.delete(levelId);
      } else {
        next.add(levelId);
      }
      return next;
    });
  }, []);

  const toggleAllLevels = useCallback(() => {
    if (selectedLevelIds.size === levels.length) {
      setSelectedLevelIds(new Set());
    } else {
      setSelectedLevelIds(new Set(levels.map((l) => l.id)));
    }
  }, [selectedLevelIds.size, levels]);

  const filteredScene: SecurityScene | null = useMemo(() => {
    if (!parsedScene) return null;
    if (levels.length === 0 || selectedLevelIds.size === levels.length) {
      return parsedScene;
    }

    const filteredLevels = (parsedScene.levels || []).filter((l) => selectedLevelIds.has(l.id));
    const filteredWalls = parsedScene.walls.filter((w) => !w.levelId || selectedLevelIds.has(w.levelId));
    const filteredDoors = (parsedScene.doors || []).filter((d) => !d.levelId || selectedLevelIds.has(d.levelId));
    const filteredWindows = (parsedScene.windows || []).filter((w) => !w.levelId || selectedLevelIds.has(w.levelId));

    return {
      ...parsedScene,
      levels: filteredLevels,
      walls: filteredWalls,
      doors: filteredDoors,
      windows: filteredWindows,
    };
  }, [parsedScene, levels, selectedLevelIds]);

  const handleImportNew = useCallback(() => {
    if (!filteredScene) return;
    const toImport = cloneSecurityScene({
      ...filteredScene,
      name: fileName ? `IFC Import: ${fileName}` : "IFC/STEP Structural Scene",
    });
    importScene(toImport);
    setOpen(false);
  }, [filteredScene, fileName, importScene, setOpen]);

  const handleMergeCurrent = useCallback(() => {
    if (!filteredScene) return;
    const existing = cloneSecurityScene(currentScene);

    const mergedLevels = [...(existing.levels || [])];
    const existingLevelIds = new Set(mergedLevels.map((l) => l.id));
    for (const lvl of filteredScene.levels || []) {
      if (!existingLevelIds.has(lvl.id)) {
        mergedLevels.push(lvl);
      }
    }

    const mergedScene: SecurityScene = {
      ...existing,
      levels: mergedLevels,
      walls: [...existing.walls, ...filteredScene.walls],
      doors: [...(existing.doors || []), ...(filteredScene.doors || [])],
      windows: [...(existing.windows || []), ...(filteredScene.windows || [])],
    };

    setScene(mergedScene);
    setOpen(false);
  }, [filteredScene, currentScene, setScene, setOpen]);

  if (!open) return null;

  return (
    <div
      data-testid="ifc-import-modal"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-md"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ifc-import-title"
        className={`flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border UI_SURFACES.borderThin UI_SURFACES.panel shadow-2xl shadow-black/50`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between border-b UI_SURFACES.borderSubtle px-6 py-4`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/12 text-emerald-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className={`text-xs font-semibold uppercase tracking-[0.24em] UI_SURFACES.textSoftDim`}>
                Pillar 1 · Structural Import Pipeline
              </div>
              <h2 id="ifc-import-title" className="text-lg font-semibold text-white">
                IFC / STEP BIM Structural Parser
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={`rounded-xl border UI_SURFACES.borderStandard UI_SURFACES.hoverBgSubtle p-2 UI_SURFACES.textSoftDim transition-colors UI_SURFACES.hoverBorderBright UI_SURFACES.hoverText`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* File Upload OR Paste Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-[22px] border border-dashed UI_SURFACES.borderStrong UI_SURFACES.bgDeep p-5 flex flex-col items-center justify-center text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".ifc,.step,.stp,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 text-sky-300 mb-3">
                <Upload className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold text-white">Select IFC or STEP File</div>
              <div className={`mt-1 text-xs UI_SURFACES.textMuted5`}>
                Upload CAD/BIM structural models (`.ifc`, `.step`, `.stp`) to auto-extract storeys and walls.
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 rounded-xl border border-sky-400/30 bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25 transition-colors"
              >
                Browse File System
              </button>
              {fileName && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300">
                  <FileCode className="h-3.5 w-3.5" />
                  Loaded: <span className="font-mono text-white">{fileName}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <label className={`text-xs font-semibold uppercase tracking-[0.16em] UI_SURFACES.textSoftDim mb-2 flex items-center gap-1.5`}>
                <FileText className="h-3.5 w-3.5 text-cyan-300" />
                Or Paste STEP / IFC ASCII Stream
              </label>
              <textarea
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  if (fileName) setFileName(null);
                }}
                placeholder="ISO-10303-21;&#10;HEADER;&#10;FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');&#10;..."
                className={`flex-1 min-h-[140px] rounded-[22px] border UI_SURFACES.borderStandard UI_SURFACES.panel p-3 font-mono text-xs UI_SURFACES.textNear placeholder-[#47536d] focus:border-emerald-400/40 focus:outline-none`}
              />
            </div>
          </div>

          {parsing && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing IFC/STEP entity definitions and cartesian coordinates...
            </div>
          )}

          {parseError && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              {parseError}
            </div>
          )}

          {/* Material & Elevation Configuration */}
          <div className={`rounded-[24px] border UI_SURFACES.borderSubtle UI_SURFACES.bgDeep p-5 space-y-4`}>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] UI_SURFACES.textSoftDim`}>
                <Radio className="h-4 w-4 text-emerald-400" />
                Default Wall Material & RF Attenuation Penalty
              </div>
              <span className={`text-[11px] UI_SURFACES.textMuted5`}>
                Assigned to all parsed IFC walls for DORI / OODPCVS line-of-sight raycasting
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {MATERIAL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDefaultMaterial(opt.id)}
                  className={cn(
                    "flex flex-col rounded-2xl border p-3 text-left transition-colors",
                    defaultMaterial === opt.id
                      ? "border-emerald-400/50 bg-emerald-500/15 text-white shadow-lg shadow-emerald-950/40"
                      : "UI_SURFACES.borderStandard UI_SURFACES.panel UI_SURFACES.textBody UI_SURFACES.hoverBorderBright"
                  )}
                >
                  <div className="text-xs font-semibold flex items-center justify-between">
                    <span>{opt.label}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-emerald-300">
                      {opt.rfAttenuationDb} dB
                    </span>
                  </div>
                  <div className={`mt-1.5 text-[10px] leading-relaxed UI_SURFACES.textMuted5`}>
                    {opt.description}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className={`text-[11px] font-semibold uppercase tracking-wider UI_SURFACES.textSoftDim block mb-1`}>
                  Default Wall Height (Meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="50"
                  value={defaultWallHeight}
                  onChange={(e) => setDefaultWallHeight(parseFloat(e.target.value) || 3.0)}
                  className={`w-full rounded-xl border UI_SURFACES.borderStandard UI_SURFACES.panel px-3 py-2 text-xs font-mono text-white focus:border-emerald-400/40 focus:outline-none`}
                />
              </div>
              <div>
                <label className={`text-[11px] font-semibold uppercase tracking-wider UI_SURFACES.textSoftDim block mb-1`}>
                  Base Level Elevation (Meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={defaultElevation}
                  onChange={(e) => setDefaultElevation(parseFloat(e.target.value) || 0.0)}
                  className={`w-full rounded-xl border UI_SURFACES.borderStandard UI_SURFACES.panel px-3 py-2 text-xs font-mono text-white focus:border-emerald-400/40 focus:outline-none`}
                />
              </div>
            </div>
          </div>

          {/* Parsed Output Preview & Level Filtering */}
          {parseResult && "error" in parseResult ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
              Parsing failed: {parseResult.error}
            </div>
          ) : parsedScene ? (
            <div className={`rounded-[24px] border UI_SURFACES.borderSubtle UI_SURFACES.bgDeep p-5 space-y-4`}>
              <div className={`flex items-center justify-between border-b UI_SURFACES.borderSubtle pb-3`}>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  <Layers className="h-4 w-4" />
                  Extracted Geometry Summary
                </div>
                <div className="flex items-center gap-3 font-mono text-xs UI_SURFACES.textMuted4">
                  <span className="rounded-lg UI_SURFACES.hoverBgMuted px-2 py-1">
                    Storeys: <strong className="text-white">{levels.length}</strong>
                  </span>
                  <span className="rounded-lg UI_SURFACES.hoverBgMuted px-2 py-1">
                    Walls: <strong className="text-white">{parsedScene.walls.length}</strong>
                  </span>
                  <span className="rounded-lg UI_SURFACES.hoverBgMuted px-2 py-1">
                    Doors: <strong className="text-white">{parsedScene.doors?.length || 0}</strong>
                  </span>
                  <span className="rounded-lg UI_SURFACES.hoverBgMuted px-2 py-1">
                    Windows: <strong className="text-white">{parsedScene.windows?.length || 0}</strong>
                  </span>
                </div>
              </div>

              {/* Level Filtering Table */}
              {levels.length > 0 ? (
                <div className="space-y-2">
                  <div className={`flex items-center justify-between text-xs UI_SURFACES.textSoftBright`}>
                    <span className="font-semibold">Select Building Levels to Import:</span>
                    <button
                      type="button"
                      onClick={toggleAllLevels}
                      className="text-emerald-400 hover:underline"
                    >
                      {selectedLevelIds.size === levels.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {levels.map((lvl) => {
                      const isSelected = selectedLevelIds.has(lvl.id);
                      const wallCount = parsedScene.walls.filter((w) => w.levelId === lvl.id).length;
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => toggleLevel(lvl.id)}
                          className={cn(
                            "flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                            isSelected
                              ? "border-emerald-400/40 bg-emerald-500/12 text-white"
                              : "UI_SURFACES.borderStandard UI_SURFACES.panel UI_SURFACES.textMuted5"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 UI_SURFACES.textMuted flex-shrink-0" />
                            )}
                            <div>
                              <div className="text-xs font-semibold text-white">{lvl.name}</div>
                              <div className={`text-[10px] font-mono UI_SURFACES.textMuted5`}>
                                Elev: {lvl.elevation}m · H: {lvl.height ?? "—"}m
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono rounded bg-black/30 px-2 py-0.5 UI_SURFACES.textMuted4">
                            {wallCount} walls
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className={`text-xs UI_SURFACES.textMuted5 italic`}>
                  No explicit `IFCBUILDINGSTOREY` entities found. All walls mapped to default Level 0 (`{defaultElevation}m`).
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between border-t UI_SURFACES.borderSubtle UI_SURFACES.panelDeepAlt px-6 py-4`}>
          <div className={`text-xs UI_SURFACES.textMuted5`}>
            {filteredScene ? (
              <span>
                Ready to import <strong className="text-white">{filteredScene.walls.length}</strong> walls across{" "}
                <strong className="text-white">{filteredScene.levels?.length || 0}</strong> selected level(s).
              </span>
            ) : (
              <span>Upload or paste an IFC/STEP model to enable import.</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`rounded-xl border UI_SURFACES.borderStandard UI_SURFACES.hoverBgSubtle px-4 py-2 text-xs font-semibold UI_SURFACES.textBody UI_SURFACES.hoverBorderBright UI_SURFACES.hoverText transition-colors`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!filteredScene}
              onClick={handleMergeCurrent}
              className={cn(
                "rounded-xl border px-4 py-2 text-xs font-semibold transition-colors",
                filteredScene
                  ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
                  : "UI_SURFACES.borderStandard UI_SURFACES.card UI_SURFACES.textDimMid cursor-not-allowed"
              )}
            >
              Merge into Current Scene
            </button>
            <button
              type="button"
              disabled={!filteredScene}
              onClick={handleImportNew}
              className={cn(
                "rounded-xl border px-4 py-2 text-xs font-semibold transition-colors",
                filteredScene
                  ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 shadow-lg shadow-emerald-950/50"
                  : "UI_SURFACES.borderStandard UI_SURFACES.card UI_SURFACES.textDimMid cursor-not-allowed"
              )}
            >
              Import as New Scene
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
