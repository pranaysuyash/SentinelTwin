"use client";

import { useState } from "react";
import { Layers, Plus, Trash2, Edit2, Check, X, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";
import type { SceneLevel } from "@/schema/security-scene";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
export function LevelSwitcher() {
  const levels = useStudioStore((s) => s.scene.levels ?? []);
  const activeLevelId = useStudioStore((s) => s.activeLevelId);
  const levelDisplayMode = useStudioStore((s) => s.levelDisplayMode);
  const setActiveLevelId = useStudioStore((s) => s.setActiveLevelId);
  const setLevelDisplayMode = useStudioStore((s) => s.setLevelDisplayMode);
  const addLevel = useStudioStore((s) => s.addLevel);
  const updateLevel = useStudioStore((s) => s.updateLevel);
  const deleteLevel = useStudioStore((s) => s.deleteLevel);

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editElevation, setEditElevation] = useState(0);

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newElevation, setNewElevation] = useState(3.5);

  // Sort levels descending by elevation (top floor first, ground/basement below)
  const sortedLevels = [...levels].sort((a, b) => b.elevation - a.elevation);

  const activeLevel = levels.find((l) => l.id === activeLevelId);
  const activeLabel = activeLevelId === null ? "All Floors" : (activeLevel?.name ?? "Ground Floor");

  const handleStartAdd = () => {
    const highestElev = sortedLevels.length > 0 ? sortedLevels[0].elevation : 0;
    setNewName(`Floor ${levels.length + 1}`);
    setNewElevation(highestElev + 3.5);
    setIsAdding(true);
    setEditingId(null);
  };

  const handleSaveNew = () => {
    if (!newName.trim()) return;
    const newId = `level_${Date.now()}`;
    addLevel({
      id: newId,
      name: newName.trim(),
      elevation: Number(newElevation) || 0,
    });
    setActiveLevelId(newId);
    setIsAdding(false);
  };

  const handleStartEdit = (level: SceneLevel) => {
    setEditingId(level.id);
    setEditName(level.name);
    setEditElevation(level.elevation);
    setIsAdding(false);
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) return;
    updateLevel(id, {
      name: editName.trim(),
      elevation: Number(editElevation) || 0,
    });
    setEditingId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeLevelId === id) {
      setActiveLevelId(null);
    }
    deleteLevel(id);
  };

  return (
    <div className="absolute left-3 top-16 z-10 flex flex-col gap-1.5">
      {/* Main trigger bar */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Switch building floor / level"
          className={`flex h-8 items-center gap-1.5 rounded-lg border UI_SURFACES.borderDark UI_SURFACES.bgDeep/90 px-2.5 text-[11px] font-semibold UI_SURFACES.textBody shadow-md backdrop-blur-md transition-colors UI_SURFACES.hoverBgMuted UI_SURFACES.hoverText`}
        >
          <Layers className="h-3.5 w-3.5 text-sky-400" />
          <span>{activeLabel}</span>
          {isOpen ? <ChevronUp className="h-3 w-3 UI_SURFACES.textSoftMid" /> : <ChevronDown className="h-3 w-3 UI_SURFACES.textSoftMid" />}
        </button>

        {/* Display mode toggle (Stacked vs Solo) when a floor is active or multi-floor exists */}
        {(activeLevelId !== null || levels.length > 0) && (
          <button
            type="button"
            onClick={() => setLevelDisplayMode(levelDisplayMode === "stacked" ? "solo" : "stacked")}
            aria-label={`Display mode: ${levelDisplayMode}. Click to switch.`}
            title={
              levelDisplayMode === "stacked"
                ? "Stacked Mode: Renders all floors at true elevation"
                : "Solo Mode: Renders only the active floor at ground zero"
            }
            className={`flex h-8 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold transition-colors ${
              levelDisplayMode === "solo"
                ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                : "UI_SURFACES.borderDark UI_SURFACES.bgDeep/90 UI_SURFACES.textSoftBright UI_SURFACES.hoverBgMuted UI_SURFACES.hoverText"
            }`}
          >
            {levelDisplayMode === "solo" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            <span className="uppercase tracking-wider">{levelDisplayMode}</span>
          </button>
        )}
      </div>

      {/* Dropdown panel */}
      {isOpen && (
        <div className={`w-[260px] rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel/95 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md`}>
          <div className={`mb-1.5 flex items-center justify-between border-b UI_SURFACES.borderSubtle pb-1.5 px-1`}>
            <span className="text-[10px] font-bold uppercase tracking-wider UI_SURFACES.textSoftMid">Building Levels</span>
            <span className="text-[10px] UI_SURFACES.textMuted">{levels.length} floor{levels.length === 1 ? "" : "s"}</span>
          </div>

          <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-0.5">
            {/* All Floors (Stacked) Option */}
            <button
              type="button"
              onClick={() => {
                setActiveLevelId(null);
                setIsOpen(false);
              }}
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${
                activeLevelId === null
                  ? "bg-sky-500/20 text-sky-200 border border-sky-500/40"
                  : "UI_SURFACES.hoverTextSoft UI_SURFACES.hoverBgMuted UI_SURFACES.hoverText"
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-sky-400" />
                <span>All Floors (Stacked)</span>
              </div>
              <span className="text-[10px] UI_SURFACES.textSoftMid">Full View</span>
            </button>

            {/* List of floors */}
            {sortedLevels.map((level) => {
              const isSelected = activeLevelId === level.id;
              const isEditingThis = editingId === level.id;

              if (isEditingThis) {
                return (
                  <div key={level.id} className={`flex flex-col gap-1.5 rounded-lg border UI_SURFACES.borderDark UI_SURFACES.hoverBgSubtle p-2 text-[11px]`}>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Floor name"
                        className={`w-full rounded border UI_SURFACES.borderDark UI_SURFACES.panel px-1.5 py-0.5 text-white focus:border-sky-500 focus:outline-none`}
                      />
                      <input
                        type="number"
                        step="0.5"
                        value={editElevation}
                        onChange={(e) => setEditElevation(parseFloat(e.target.value) || 0)}
                        placeholder="0.0"
                        className={`w-16 rounded border UI_SURFACES.borderDark UI_SURFACES.panel px-1.5 py-0.5 text-right text-white focus:border-sky-500 focus:outline-none`}
                      />
                      <span className="UI_SURFACES.textSoftMid">m</span>
                    </div>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className={`flex h-5 w-5 items-center justify-center rounded UI_SURFACES.borderSubtle UI_SURFACES.hoverTextSoft UI_SURFACES.hoverText`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(level.id)}
                        className="flex h-5 w-5 items-center justify-center rounded bg-sky-600 text-white hover:bg-sky-500"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={level.id}
                  onClick={() => {
                    setActiveLevelId(level.id);
                    setIsOpen(false);
                  }}
                  className={`group flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer text-[11px] font-medium transition-colors ${
                    isSelected
                      ? "bg-sky-500/20 text-sky-200 border border-sky-500/40"
                      : "UI_SURFACES.textBody UI_SURFACES.hoverBgMuted UI_SURFACES.hoverText"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    <span className="truncate">{level.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="rounded UI_SURFACES.hoverBg px-1.5 py-0.5 text-[10px] font-mono UI_SURFACES.textSoftBright">
                      {level.elevation >= 0 ? `+${level.elevation}m` : `${level.elevation}m`}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(level);
                      }}
                      title="Edit level name & elevation"
                      className={`opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded UI_SURFACES.borderDark UI_SURFACES.textSoftBright UI_SURFACES.hoverText transition-opacity`}
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(level.id, e)}
                      title="Delete level"
                      className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded hover:bg-red-500/20 UI_SURFACES.textSoftBright hover:text-red-400 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Floor Section */}
          <div className={`mt-1.5 border-t UI_SURFACES.borderSubtle pt-1.5`}>
            {isAdding ? (
              <div className={`flex flex-col gap-1.5 rounded-lg border UI_SURFACES.borderDark UI_SURFACES.hoverBgSubtle p-2 text-[11px]`}>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Floor name"
                    autoFocus
                    className={`w-full rounded border UI_SURFACES.borderDark UI_SURFACES.panel px-1.5 py-0.5 text-white focus:border-sky-500 focus:outline-none`}
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={newElevation}
                    onChange={(e) => setNewElevation(parseFloat(e.target.value) || 0)}
                    placeholder="3.5"
                    className={`w-16 rounded border UI_SURFACES.borderDark UI_SURFACES.panel px-1.5 py-0.5 text-right text-white focus:border-sky-500 focus:outline-none`}
                  />
                  <span className="UI_SURFACES.textSoftMid">m</span>
                </div>
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className={`flex h-5 w-5 items-center justify-center rounded UI_SURFACES.borderSubtle UI_SURFACES.hoverTextSoft UI_SURFACES.hoverText`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNew}
                    className="flex h-5 w-5 items-center justify-center rounded bg-sky-600 text-white hover:bg-sky-500"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartAdd}
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed UI_SURFACES.borderDark py-1.5 text-[11px] font-medium UI_SURFACES.hoverTextSoft transition-colors hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-200`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Building Floor</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
