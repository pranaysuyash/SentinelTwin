"use client";

import { useState } from "react";

import { useStudioStore } from "@/store/studio-store";
import type { BottomTab } from "@/store/studio-store";

import { OPERATOR_WORKFLOWS, type OperatorWorkflow } from "./workflows";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


const TONE_CLASSES: Record<NonNullable<OperatorWorkflow["tone"]>, string> = {
  slate: `border-[#273246] ${UI_SURFACES.card} ${UI_SURFACES.textMuted3} hover:border-[#3b4a69]`,
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/60",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-200 hover:border-blue-400/60",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:border-amber-400/60",
  red: "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:border-rose-400/60",
};

function WorkflowChip({ workflow, onSelect }: { workflow: OperatorWorkflow; onSelect: (tab: BottomTab) => void }) {
  const tone = workflow.tone ?? "slate";
  return (
    <button
      type="button"
      onClick={() => onSelect(workflow.startTab)}
      title={`${workflow.goal} — Sequence: ${workflow.sequence.join(" → ")}`}
      data-testid={`workflow-chip-${workflow.id}`}
      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors ${TONE_CLASSES[tone]}`}
    >
      {workflow.label}
    </button>
  );
}

/**
 * Compact workflow chip row for the bottom-panel header.
 * Hidden when the active tab is already in a workflow (so the chips
 * don't compete for attention while the operator is inside a workflow).
 */
export function WorkflowChips({ activeTab }: { activeTab: BottomTab }) {
  const setTab = useStudioStore((s) => s.setBottomTab);
  const enabledAnalysisModules = useStudioStore((s) => s.enabledAnalysisModules);
  const [expanded, setExpanded] = useState(false);

  // Filter workflows whose start tab is enabled in the current preset.
  const available = OPERATOR_WORKFLOWS.filter((workflow) =>
    enabledAnalysisModules[workflow.startTab],
  );
  if (available.length === 0) return null;

  const visibleWorkflows = expanded
    ? available
    : available.filter((workflow) => workflow.sequence.includes(activeTab) || workflow.startTab === activeTab);
  const hiddenCount = available.length - visibleWorkflows.length;

  return (
    <div className="flex items-center gap-1.5" data-testid="workflow-chips">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5f6f8e]">
        Workflows
      </span>
      {visibleWorkflows.map((workflow) => (
        <WorkflowChip key={workflow.id} workflow={workflow} onSelect={setTab} />
      ))}
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={`rounded-md border border-[#273246] bg-[#0e1320] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${UI_SURFACES.textMuted3} transition-colors hover:border-[#3b4a69]`}
        >
          {expanded ? "Hide" : `+${hiddenCount} more`}
        </button>
      ) : expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className={`rounded-md border border-[#273246] bg-[#0e1320] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${UI_SURFACES.textMuted3} transition-colors hover:border-[#3b4a69]`}
        >
          Hide
        </button>
      ) : null}
    </div>
  );
}