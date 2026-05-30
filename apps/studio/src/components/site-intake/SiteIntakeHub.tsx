"use client";

import {
  Camera,
  FileUp,
  Map,
  ScanSearch,
  Sparkles,
  Square,
} from "lucide-react";

type IntakeCardConfig = {
  icon: typeof Square;
  badge: string;
  title: string;
  description: string;
  tone: "sky" | "emerald" | "amber" | "violet" | "slate";
  onClick: () => void;
};

const toneClasses: Record<IntakeCardConfig["tone"], string> = {
  sky: "border-sky-400/20 bg-sky-500/8 hover:border-sky-300/35 hover:bg-sky-500/12",
  emerald: "border-emerald-400/20 bg-emerald-500/8 hover:border-emerald-300/35 hover:bg-emerald-500/12",
  amber: "border-amber-400/20 bg-amber-500/8 hover:border-amber-300/35 hover:bg-amber-500/12",
  violet: "border-violet-400/20 bg-violet-500/8 hover:border-violet-300/35 hover:bg-violet-500/12",
  slate: "border-[#22314b] bg-[#0e1624] hover:border-[#345073] hover:bg-[#111c2d]",
};

function IntakeCard({ icon: Icon, badge, title, description, tone, onClick }: IntakeCardConfig) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-full min-h-[132px] flex-col justify-between rounded-[24px] border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 ${toneClasses[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
            <Icon className="h-3.5 w-3.5 text-[color:var(--text)]" />
            <span>{badge}</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-[11px] leading-4 text-[color:var(--text-muted)]">{description}</div>
        </div>
      </div>
      <div className="mt-4 text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Open this flow</div>
    </button>
  );
}

type SiteIntakeHubProps = {
  onCreateScene: () => void;
  onScanSite: () => void;
  onAiDraft: () => void;
  onImportFloorPlan: () => void;
  onImportScene: () => void;
  onEnterStudio: () => void;
  onShowProjects?: () => void;
};

export function SiteIntakeHub({
  onCreateScene,
  onScanSite,
  onAiDraft,
  onImportFloorPlan,
  onImportScene,
  onEnterStudio,
  onShowProjects,
}: SiteIntakeHubProps) {
  const cards: IntakeCardConfig[] = [
    {
      icon: Square,
      badge: "Blank",
      title: "Start from scratch",
      description: "Create a blank SecurityScene and place walls, cameras, lights, and zones manually.",
      tone: "emerald",
      onClick: onCreateScene,
    },
    {
      icon: ScanSearch,
      badge: "Scan",
      title: "Scan site with phone photos",
      description: "Manual-assisted photo marking compiles into a canonical SecurityScene with guided capture prep.",
      tone: "sky",
      onClick: onScanSite,
    },
    {
      icon: Sparkles,
      badge: "AI",
      title: "Draft from text prompt",
      description: "Describe your space in natural language and generate a prompt-backed scene draft to review and apply.",
      tone: "violet",
      onClick: onAiDraft,
    },
    {
      icon: FileUp,
      badge: "Import",
      title: "Import a floor plan",
      description: "Upload a floor-plan image, review extraction, and commit the resulting editable scene.",
      tone: "amber",
      onClick: onImportFloorPlan,
    },
    {
      icon: Camera,
      badge: "JSON",
      title: "Import a scene JSON",
      description: "Load a previously exported SecurityScene JSON file to continue working on it.",
      tone: "slate",
      onClick: onImportScene,
    },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-dim)]">
              SentinelTwin
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Create Site Twin
            </h1>
            <p className="mt-1 max-w-xl text-[13px] leading-5 text-[color:var(--text-muted)]">
              Choose how to build your security digital twin. All intake paths produce a validated scene
              with source tracking and confidence scoring, ready for simulation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onShowProjects ? (
              <button
                type="button"
                onClick={onShowProjects}
                className="flex-none rounded-xl border border-[color:var(--border)] bg-white/[0.03] px-4 py-2 text-xs text-[color:var(--text-muted)] transition-colors hover:border-sky-400/25 hover:bg-white/[0.05] hover:text-white"
              >
                Projects
              </button>
            ) : null}
            <button
              type="button"
              onClick={onEnterStudio}
              className="flex-none rounded-xl border border-[color:var(--border)] bg-white/[0.03] px-4 py-2 text-xs text-[color:var(--text-muted)] transition-colors hover:border-sky-400/25 hover:bg-white/[0.05] hover:text-white"
            >
              Enter Studio
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map((card) => (
            <IntakeCard key={card.badge} {...card} />
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-8 text-[11px] text-[color:var(--text-dim)]">
          <span>All intake paths compile to a validated SecurityScene with provenance tracking.</span>
        </div>
      </div>
    </div>
  );
}
