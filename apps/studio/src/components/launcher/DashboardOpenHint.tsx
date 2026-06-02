"use client";

import { Eye } from "lucide-react";

export type DashboardSectionId =
  | "overview"
  | "preview"
  | "metrics"
  | "workspaces"
  | "library"
  | "recent"
  | "create"
  | "securityStatus"
  | "issues"
  | "assumptions"
  | "projectSettings";

export interface DashboardOpenHintProps {
  title: string;
  description: string;
  actions: { id: DashboardSectionId; label: string; onClick: () => void }[];
}

export function DashboardOpenHint({
  title,
  description,
  actions,
}: DashboardOpenHintProps) {
  return (
    <section className="rounded-[20px] border border-dashed border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-200">{title}</div>
      <div className="mt-1 max-w-2xl text-xs leading-5 text-[color:var(--st-muted)]">{description}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-1.5 text-[11px] font-medium text-sky-100 transition-colors hover:border-sky-300/40 hover:bg-sky-500/16"
          >
            <Eye className="h-3 w-3" />
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
