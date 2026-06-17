/**
 * Operator workflows for the bottom-panel tab set.
 *
 * The bottom panel exposes 22 tabs across 4 groups (Analysis, Report,
 * Timeline, Dev). Operators new to the studio ask "where do I start?"
 * — these workflows give them a goal-to-tab-sequence mapping without
 * removing any existing tab.
 *
 * Each workflow:
 *   - has a stable id (used as the key for the chip)
 *   - declares the tab sequence as BottomTab ids (no new tab types)
 *   - declares the operator goal in one sentence
 *   - declares the recommended starting tab (the chip navigates to it)
 *
 * Workflows are *additive* — they recommend tabs, they don't replace
 * any. If a tab in a workflow is currently disabled by the active
 * workspace preset, the chip stays clickable and the workflow explains
 * in its label which tab to enable.
 */

import type { BottomTab } from "@/store/studio-store";

export type OperatorWorkflow = {
  id: string;
  label: string;
  /** One-line goal the operator is trying to achieve. */
  goal: string;
  /** Tab the chip navigates to when clicked. */
  startTab: BottomTab;
  /** Tab sequence shown in the chip's tooltip / doc drawer. */
  sequence: BottomTab[];
  /** Optional tone for the chip. */
  tone?: "slate" | "green" | "blue" | "amber" | "red";
};

export const OPERATOR_WORKFLOWS: readonly OperatorWorkflow[] = [
  {
    id: "validate-coverage",
    label: "Validate Coverage",
    goal: "Confirm the current cameras hit the operating target under the active assumptions.",
    startTab: "metrics",
    sequence: ["outcome", "metrics", "issues", "redundancy"],
    tone: "blue",
  },
  {
    id: "find-and-fix",
    label: "Find & Fix",
    goal: "Work the prioritized issue list, try counterfactual fixes, and approve a change.",
    startTab: "issues",
    sequence: ["issues", "counterfactual", "beforeafter"],
    tone: "amber",
  },
  {
    id: "route-exposure",
    label: "Route Exposure",
    goal: "Defensive review of where an authorized route loses usable camera evidence.",
    startTab: "threat",
    sequence: ["threat", "timeline", "temporal"],
    tone: "red",
  },
  {
    id: "prepare-handoff",
    label: "Prepare Handoff",
    goal: "Build an evidence-backed report for an operator who wasn't on this session.",
    startTab: "report",
    sequence: ["report", "assumptions", "provenance"],
    tone: "green",
  },
  {
    id: "time-of-day",
    label: "Time-of-Day Risk",
    goal: "Find weak windows across day, dusk, and night operating conditions.",
    startTab: "temporal",
    sequence: ["temporal", "issues", "counterfactual"],
    tone: "amber",
  },
  {
    id: "budget-impact",
    label: "Budget Impact",
    goal: "Estimate equipment and labor impact from camera presets, lights, and obstruction moves.",
    startTab: "budgeting",
    sequence: ["budgeting", "metrics", "report"],
    tone: "slate",
  },
] as const;

export function findWorkflow(id: string): OperatorWorkflow | undefined {
  return OPERATOR_WORKFLOWS.find((workflow) => workflow.id === id);
}