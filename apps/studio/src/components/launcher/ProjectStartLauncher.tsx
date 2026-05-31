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
import { useState, type ReactNode } from "react";

type ProjectStartLauncherProps = {
  open: boolean;
  onClose: () => void;
  onOpenDemoScene: () => void;
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
  status: "Complete" | "Available" | "Preview" | "Planned";
  onClick: () => void;
};

function ProjectStartCard({ icon, badge, title, description, tone, status, onClick }: ProjectStartOption) {
  const toneClasses: Record<ProjectStartOption["tone"], string> = {
    sky: "border-sky-400/20 bg-sky-500/8 hover:border-sky-300/35 hover:bg-sky-500/12",
    emerald: "border-emerald-400/20 bg-emerald-500/8 hover:border-emerald-300/35 hover:bg-emerald-500/12",
    amber: "border-amber-400/20 bg-amber-500/8 hover:border-amber-300/35 hover:bg-amber-500/12",
    violet: "border-violet-400/20 bg-violet-500/8 hover:border-violet-300/35 hover:bg-violet-500/12",
    slate: "border-[#22314b] bg-[#0e1624] hover:border-[#345073] hover:bg-[#111c2d]",
  };

  const statusTone: Record<ProjectStartOption["status"], string> = {
    Complete: "border-emerald-500/40 bg-emerald-500/20 text-emerald-100",
    Planned: "border-amber-500/40 bg-amber-500/14 text-amber-100",
    Preview: "border-sky-500/40 bg-sky-500/12 text-sky-100",
    Available: "border-amber-500/35 bg-amber-500/10 text-amber-100",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-full min-h-[132px] flex-col justify-between rounded-[24px] border p-4 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 ${toneClasses[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">
            <span className="text-[color:var(--st-accent)]">{icon}</span>
            <span>{badge}</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-[11px] leading-4 text-[color:var(--st-muted)]">{description}</div>
          <div className={`mt-2 inline-flex rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${statusTone[status]}`}>
            {status}
          </div>
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
  onOpenDemoScene,
  onOpenCoverageWorkspace,
  onCreateScene,
  onImportFloorPlan,
  onImportScene,
  onScanSite,
  onAiDraft,
  onVerifyFootagePlanned,
  onOpenReport,
  }: ProjectStartLauncherProps) {
  const [showAdvancedStartActions, setShowAdvancedStartActions] = useState(false);

  if (!open) return null;

  const primaryActions: ProjectStartOption[] = [
    {
      icon: <FolderOpen className="h-3.5 w-3.5" />,
      badge: "Audit",
      title: "Audit existing camera coverage",
      description: "Open the coverage workspace first and review uncovered areas, failures, and assumptions.",
      tone: "sky",
      status: "Available",
      onClick: onOpenCoverageWorkspace,
    },
    {
      icon: <Map className="h-3.5 w-3.5" />,
      badge: "Design",
      title: "Design a new site layout",
      description: "Start a blank site twin and place walls, cameras, lights, and critical zones from scratch.",
      tone: "emerald",
      status: "Available",
      onClick: onCreateScene,
    },
    {
      icon: <ScanSearch className="h-3.5 w-3.5" />,
      badge: "Guided Marking",
      title: "Scan site with phone photos",
      description: "Guided photo marking creates a site twin draft. Review and approve it before use.",
      tone: "emerald",
      status: "Preview",
      onClick: onScanSite,
    },
  ];

  const advancedActions: ProjectStartOption[] = [
    {
      icon: <FileUp className="h-3.5 w-3.5" />,
      badge: "Import",
      title: "Import a floor plan",
      description: "Upload a floor-plan image, review detected geometry, and create an editable site twin draft.",
      tone: "amber",
      status: "Preview",
      onClick: onImportFloorPlan,
    },
    {
      icon: <Sparkles className="h-3.5 w-3.5" />,
      badge: "Draft",
      title: "Draft from site description",
      description: "Create a layout draft from text, review it, then approve it only after confirmation.",
      tone: "violet",
      status: "Preview",
      onClick: onAiDraft,
    },
    {
      icon: <Camera className="h-3.5 w-3.5" />,
      badge: "Preview",
      title: "Verify real footage",
      description: "Preview: static/reference-frame alignment only.",
      tone: "slate",
      status: "Preview",
      onClick: onVerifyFootagePlanned,
    },
    {
      icon: <FileText className="h-3.5 w-3.5" />,
      badge: "Report",
      title: "Generate client report",
      description: "Jump to the report workspace after you have a scene, coverage result, or comparison to share.",
      tone: "sky",
      status: "Available",
      onClick: onOpenReport,
    },
    {
      icon: <Sparkles className="h-3.5 w-3.5" />,
      badge: "Reference",
      title: "Open seeded retail baseline",
      description: "The seeded baseline is the reference baseline.",
      tone: "slate",
      status: "Complete",
      onClick: onOpenDemoScene,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-4 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[32px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
          <div className="flex items-start justify-between gap-4 border-b border-[color:var(--st-border)] px-5 py-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">Project launcher</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Job-first starting path</h2>
              <p className="mt-1 text-sm text-[color:var(--st-muted)]">
                The audit, design, and scan jobs are the primary entry points. The seeded retail scene is available as
                a reference baseline, while the other flows are optional and clearly labeled.
              </p>
              <p className="mt-1 text-xs text-[color:var(--st-muted)]">
                Primary: <span className="font-semibold">audit</span>, <span className="font-semibold">design</span>, <span className="font-semibold">scan</span>. Optional: <span className="font-semibold">import</span>, <span className="font-semibold">AI draft</span>, <span className="font-semibold">verify</span>, <span className="font-semibold">report</span>.
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
            {primaryActions.map((action) => (
              <ProjectStartCard key={action.title} {...action} />
            ))}
          </div>

          <div className="px-5 pb-2">
            <button
              type="button"
              onClick={() => setShowAdvancedStartActions((current) => !current)}
              className="flex w-full items-center justify-between rounded-xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2.5 text-[11px] text-[color:var(--st-muted)] transition-colors hover:border-sky-400/25 hover:bg-white/[0.05]"
              aria-expanded={showAdvancedStartActions}
              aria-controls="advanced-project-starter-actions"
            >
              <span className="flex items-center gap-2">
                <span>Advanced workflows</span>
                <span className="rounded-full border border-amber-400/25 bg-amber-500/12 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.15em] text-amber-200">
                  Optional
                </span>
              </span>
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            </button>
          </div>

          {showAdvancedStartActions ? (
            <div id="advanced-project-starter-actions" className="grid gap-4 px-5 pb-5 lg:grid-cols-2 xl:grid-cols-3">
              {advancedActions.map((action) => (
              <ProjectStartCard key={action.title} {...action} />
            ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--st-border)] px-5 py-4">
              <div className="flex items-start gap-2 text-[11px] text-[color:var(--st-muted)]">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-300" />
                <span>
                The seeded baseline remains available as a reference. The product path starts with the security job and then optional workflows.
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
