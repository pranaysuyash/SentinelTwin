"use client";

import {
  Camera,
  FileText,
  FileUp,
  FolderOpen,
  Map,
  ScanSearch,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

type ProjectStartLauncherProps = {
  open: boolean;
  onClose: () => void;
  onOpenCoverageWorkspace: () => void;
  onCreateScene: () => void;
  onImportFloorPlan: () => void;
  onImportScene: () => void;
  onScanSite: () => void;
  onAiDraft: () => void;
  onVerifyFootagePlanned: () => void;
  onOpenReport: () => void;
};

type ProjectStartOption = {
  icon: ReactNode;
  badge: string;
  title: string;
  description: string;
  tone: "sky" | "emerald" | "amber" | "violet" | "slate";
  onClick: () => void;
};

function ProjectStartCard({ icon, badge, title, description, tone, onClick }: ProjectStartOption) {
  const toneClasses: Record<ProjectStartOption["tone"], string> = {
    sky: "border-sky-400/20 bg-sky-500/8 hover:border-sky-300/35 hover:bg-sky-500/12",
    emerald: "border-emerald-400/20 bg-emerald-500/8 hover:border-emerald-300/35 hover:bg-emerald-500/12",
    amber: "border-amber-400/20 bg-amber-500/8 hover:border-amber-300/35 hover:bg-amber-500/12",
    violet: "border-violet-400/20 bg-violet-500/8 hover:border-violet-300/35 hover:bg-violet-500/12",
    slate: "border-[#22314b] bg-[#0e1624] hover:border-[#345073] hover:bg-[#111c2d]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-full min-h-[132px] flex-col justify-between rounded-[24px] border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 ${toneClasses[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">
            <span className="text-[color:var(--st-accent)]">{icon}</span>
            <span>{badge}</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-[11px] leading-4 text-[color:var(--st-muted)]">{description}</div>
        </div>
        <FolderOpen className="h-4 w-4 flex-none text-[color:var(--st-accent)] transition-transform duration-200 group-hover:translate-x-1" />
      </div>
      <div className="mt-4 text-[10px] uppercase tracking-[0.18em] text-[color:var(--st-muted)]">Open this flow</div>
    </button>
  );
}

export function ProjectStartLauncher({
  open,
  onClose,
  onOpenCoverageWorkspace,
  onCreateScene,
  onImportFloorPlan,
  onImportScene,
  onScanSite,
  onAiDraft,
  onVerifyFootagePlanned,
  onOpenReport,
}: ProjectStartLauncherProps) {
  if (!open) return null;

  const actions: ProjectStartOption[] = [
    {
      icon: <FolderOpen className="h-3.5 w-3.5" />,
      badge: "Audit",
      title: "Audit existing CCTV setup",
      description: "Open the coverage workspace first and review blind spots, failures, and assumptions.",
      tone: "sky",
      onClick: onOpenCoverageWorkspace,
    },
    {
      icon: <Map className="h-3.5 w-3.5" />,
      badge: "Design",
      title: "Design a new camera layout",
      description: "Start a blank scene shell and place walls, cameras, lights, and critical zones from scratch.",
      tone: "emerald",
      onClick: onCreateScene,
    },
    {
      icon: <FileUp className="h-3.5 w-3.5" />,
      badge: "Import",
      title: "Import a floor plan",
      description: "Upload a floor-plan image, review extraction, and commit the resulting editable scene.",
      tone: "amber",
      onClick: onImportFloorPlan,
    },
    {
      icon: <ScanSearch className="h-3.5 w-3.5" />,
      badge: "Preview / Manual-assisted",
      title: "Scan site with phone photos",
      description: "Manual-assisted photo marking compiles into a canonical SecurityScene. Guided scan is still planned.",
      tone: "emerald",
      onClick: onScanSite,
    },
    {
      icon: <Sparkles className="h-3.5 w-3.5" />,
      badge: "AI",
      title: "Draft from text prompt",
      description: "Generate a prompt-backed scene draft, review it, then apply it only after confirmation.",
      tone: "violet",
      onClick: onAiDraft,
    },
    {
      icon: <Camera className="h-3.5 w-3.5" />,
      badge: "Preview",
      title: "Verify real footage",
      description: "Open the current footage-verify preview path for overlay comparison and alignment checks.",
      tone: "slate",
      onClick: onVerifyFootagePlanned,
    },
    {
      icon: <FileText className="h-3.5 w-3.5" />,
      badge: "Report",
      title: "Generate client report",
      description: "Jump to the report workspace after you have a scene, coverage result, or comparison to share.",
      tone: "sky",
      onClick: onOpenReport,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[32px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
          <div className="flex items-start justify-between gap-4 border-b border-[color:var(--st-border)] px-5 py-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">Project launcher</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">What are you trying to do?</h2>
              <p className="mt-1 text-sm text-[color:var(--st-muted)]">
                Start from a job, not a dense editor. Choose the flow that matches your input, then Studio opens with the right workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] p-2 text-[color:var(--st-muted)] transition-colors hover:border-sky-400/25 hover:bg-white/[0.06] hover:text-white"
              aria-label="Close project launcher"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-2 xl:grid-cols-3">
            {actions.map((action) => (
              <ProjectStartCard key={action.title} {...action} />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--st-border)] px-5 py-4">
            <div className="flex items-start gap-2 text-[11px] text-[color:var(--st-muted)]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-300" />
              <span>
                Manual-assisted scan and floor-plan import are available now. Guided scan reconstruction is planned, not implemented yet.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-xs text-white transition-colors hover:border-sky-400/25 hover:bg-white/[0.05]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onImportScene}
                className="rounded-xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-xs text-white transition-colors hover:border-sky-400/25 hover:bg-white/[0.05]"
              >
                Import JSON
              </button>
              <button
                type="button"
                onClick={onCreateScene}
                className="rounded-xl border border-emerald-300/30 bg-emerald-500 px-3 py-2 text-xs font-semibold text-[#03130d] transition-colors hover:bg-emerald-400"
              >
                Start Blank Scene
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
