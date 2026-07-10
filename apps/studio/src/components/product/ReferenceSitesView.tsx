"use client";

import { ArrowLeft, Camera, Copy, Sun, TriangleAlert } from "lucide-react";
import { useMemo, useState, useCallback } from "react";

import { cn } from "@/lib/cn";
import { useProductViewStore } from "@/store/product-view-store";
import { useStudioStore } from "@/store/studio-store";
import type { SecurityScene } from "@/schema/security-scene";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

function coverageTone(pct: number) {
  if (pct >= 80) return "text-emerald-300";
  if (pct >= 60) return "text-amber-300";
  return "text-red-300";
}

function sourceBadgeTone(source: SecurityScene["source"]) {
  switch (source) {
    case "demo": return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
    case "preset": return "border-sky-400/20 bg-sky-500/10 text-sky-200";
    case "manual": return "border-violet-400/20 bg-violet-500/10 text-violet-200";
    case "scan": return "border-amber-400/20 bg-amber-500/10 text-amber-200";
    case "ai": return "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-200";
    default: return "border-white/10 bg-white/[0.03] text-[color:var(--text-muted)]";
  }
}

function sourceLabel(source: SecurityScene["source"]): string {
  switch (source) {
    case "demo": return "Reference";
    case "preset": return "Preset";
    case "manual": return "Draft";
    case "scan": return "Scanned";
    case "ai": return "Layout Draft";
    case "import": return "Imported";
    default: return source;
  }
}

function formatTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  const elapsed = Date.now() - ts;
  if (elapsed < 60000) return "Just now";
  if (elapsed < 3600000) return `${Math.round(elapsed / 60000)}m ago`;
  if (elapsed < 86400000) return `${Math.round(elapsed / 3600000)}h ago`;
  return `${Math.round(elapsed / 86400000)}d ago`;
}

function siteCategory(scene: SecurityScene): "retail" | "office" | "warehouse" {
  const haystack = [
    scene.name,
    ...scene.changeLog,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (haystack.includes("warehouse") || haystack.includes("loading") || haystack.includes("dock")) return "warehouse";
  if (haystack.includes("office") || haystack.includes("lobby") || haystack.includes("reception")) return "office";
  return "retail";
}

function SceneCard({
  scene,
  onOpen,
  onDuplicate,
}: {
  scene: SecurityScene;
  onOpen: (scene: SecurityScene) => void;
  onDuplicate?: (scene: SecurityScene) => void;
}) {
  const result = scene.simulation;
  const coverage = result?.totalCoveragePct ?? null;
  const worstQualityLabel = result?.worstAreaQuality
    ? result.worstAreaQuality.charAt(0).toUpperCase() + result.worstAreaQuality.slice(1)
    : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(scene)}
      className={`group flex flex-col overflow-hidden rounded-[24px] border ${UI_SURFACES.borderThin} ${UI_SURFACES.panelDeep} text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-sky-400/25 hover:shadow-xl hover:shadow-black/30`}
    >
      {/* Scene preview area */}
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-[#0f1623] to-[#060a12]">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-white/8 bg-black/40 px-4 py-3 text-center">
            <div className="text-xs font-medium text-white">{scene.name}</div>
            <div className="mt-1 text-[10px] text-[color:var(--text-muted)]">
              {scene.dimensions.width}m × {scene.dimensions.depth}m
            </div>
          </div>
        </div>
        {/* Entity indicators */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-black/50 px-2 py-0.5 text-[9px] text-white/70 bg-black/60">
            <Camera className="h-2.5 w-2.5" />
            {scene.cameras.length}
          </span>
          {scene.criticalZones.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-black/50 px-2 py-0.5 text-[9px] text-amber-200/80 bg-black/60">
              <TriangleAlert className="h-2.5 w-2.5" />
              {scene.criticalZones.length}
            </span>
          )}
          {scene.securityLights.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/15 bg-black/50 px-2 py-0.5 text-[9px] text-amber-200/60 bg-black/60">
              <Sun className="h-2.5 w-2.5" />
              {scene.securityLights.length}
            </span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{scene.name}</div>
            <div className="mt-0.5 text-[10px] text-[color:var(--text-muted)]">
              {formatTime(scene.updatedAt)}
            </div>
          </div>
          <span className={cn(
            "flex-none rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-[0.16em] font-medium",
            sourceBadgeTone(scene.source),
          )}>
            {sourceLabel(scene.source)}
          </span>
        </div>

        {/* Stats row */}
        <div className="mt-1 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-2 py-1.5">
            <div className="text-[8px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Coverage</div>
            <div className={cn("text-sm font-bold", coverage != null ? coverageTone(coverage) : "text-white")}>
              {coverage != null ? `${Math.round(coverage)}%` : "—"}
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-2 py-1.5">
            <div className="text-[8px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Quality</div>
            <div className="truncate text-sm font-bold text-white">
              {worstQualityLabel ?? "—"}
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-2 py-1.5">
            <div className="text-[8px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Zones</div>
            <div className="text-sm font-bold text-white">
              {scene.criticalZones.length}
            </div>
          </div>
        </div>

        {scene.changeLog.length > 0 && (
          <div className="truncate rounded-xl border border-white/[0.03] bg-white/[0.01] px-2 py-1 text-[9px] text-[color:var(--text-muted)]">
            {scene.changeLog[scene.changeLog.length - 1]}
          </div>
        )}
      </div>
    </button>
  );
}

export function ReferenceSitesView() {
  const navigate = useProductViewStore((s) => s.navigate);
  const referenceScenes = useStudioStore((s) => s.referenceScenes);
  const setScene = useStudioStore((s) => s.setScene);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);

  const [filter, setFilter] = useState<"all" | "retail" | "office" | "warehouse">("all");

  const duplicateReferenceToWorkspace = useStudioStore((s) => s.duplicateReferenceToWorkspace);

  const filteredReferenceProjects = useMemo(
    () => referenceScenes.filter((scene) => filter === "all" || siteCategory(scene) === filter),
    [filter, referenceScenes],
  );
  const categoryCounts = useMemo(
    () => referenceScenes.reduce<Record<typeof filter, number>>((acc, scene) => {
      acc.all += 1;
      acc[siteCategory(scene)] += 1;
      return acc;
    }, { all: 0, retail: 0, office: 0, warehouse: 0 }),
    [referenceScenes],
  );

  const openReferenceScene = useCallback((scene: SecurityScene) => {
    setScene(scene);
    setWorkspacePreset("coverage");
    setViewMode("map");
    setBottomTab("metrics");
    navigate("studio");
  }, [setScene, setWorkspacePreset, setViewMode, setBottomTab, navigate]);

  const handleDuplicate = useCallback((scene: SecurityScene) => {
    duplicateReferenceToWorkspace(scene.id);
  }, [duplicateReferenceToWorkspace]);

  const categories = [
    { id: "all" as const, label: "All References" },
    { id: "retail" as const, label: "Retail" },
    { id: "office" as const, label: "Office" },
    { id: "warehouse" as const, label: "Warehouse" },
  ];

  return (
    <div className="flex h-full w-full flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className={`flex flex-wrap items-center gap-3 border-b ${UI_SURFACES.borderSubtle} px-5 py-4`}>
        <button
          type="button"
          onClick={() => navigate("product_home")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-xs text-[color:var(--text-muted)] transition-colors hover:border-sky-400/30 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Product Home
        </button>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--text-muted)]">Reference Sites</div>
          <h1 className="mt-0.5 text-lg font-semibold text-white">Seeded reference scenes</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-1 text-[10px] text-[color:var(--text-muted)]">
            {referenceScenes.length} scenes
          </span>
        </div>
      </header>

      {/* Category filter */}
      <div className={`flex gap-2 border-b ${UI_SURFACES.borderSubtle} px-5 py-3`}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setFilter(cat.id)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-[11px] font-medium transition-colors",
              filter === cat.id
                ? "border-sky-400/30 bg-sky-500/12 text-sky-100"
                : "border-[color:var(--st-border)] text-[color:var(--text-muted)] hover:border-sky-400/20 hover:text-white",
            )}
          >
            {cat.label}
            <span className="ml-1 text-[9px] text-[color:var(--text-muted)]">{categoryCounts[cat.id]}</span>
          </button>
        ))}
      </div>

      {/* Scene grid */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {filteredReferenceProjects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredReferenceProjects.map((scene) => (
              <div key={scene.id} className="relative group">
                <SceneCard
                  scene={scene}
                  onOpen={openReferenceScene}
                  onDuplicate={handleDuplicate}
                />
                <button
                  type="button"
                  onClick={() => handleDuplicate(scene)}
                  title="Duplicate as workspace"
                  className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-sky-400/30 bg-sky-500/20 text-sky-200 opacity-0 shadow-lg backdrop-blur-sm transition-all hover:bg-sky-500/30 group-hover:opacity-100"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-6 py-8 text-center">
              <div className="text-sm font-medium text-white">
                {referenceScenes.length > 0 ? "No matches in this category" : "No reference scenes"}
              </div>
              <div className="mt-2 text-xs text-[color:var(--text-muted)]">
                {referenceScenes.length > 0
                  ? "Choose another reference category, or return home to create a new site twin."
                  : "Run the app to seed reference scenes, or create a workspace from Product Home."}
              </div>
              <button
                type="button"
                onClick={() => referenceScenes.length > 0 ? setFilter("all") : navigate("product_home")}
                className="mt-4 rounded-xl border border-sky-400/25 bg-sky-500/12 px-4 py-2 text-xs font-medium text-sky-100 transition-colors hover:bg-sky-500/20"
              >
                {referenceScenes.length > 0 ? "Show All References" : "Return to Product Home"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
