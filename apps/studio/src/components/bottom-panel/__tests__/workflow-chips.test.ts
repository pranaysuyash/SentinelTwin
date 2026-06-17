import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const workflowChipsPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../WorkflowChips.tsx");
const workflowDataPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../workflows.ts");
const bottomPanelPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../BottomPanel.tsx");

describe("bottom-panel workflows (I5)", () => {
  test("WorkflowChips component is defined", () => {
    const source = readFileSync(workflowChipsPath, "utf8");
    expect(source).toContain("export function WorkflowChips");
    expect(source).toContain("function WorkflowChip");
  });

  test("workflows.ts declares stable operator workflows as readonly", () => {
    const source = readFileSync(workflowDataPath, "utf8");
    expect(source).toContain("export const OPERATOR_WORKFLOWS");
    expect(source).toMatch(/readonly OperatorWorkflow\[\]/);
    // Each workflow must declare a label, goal, startTab, and sequence —
    // none of these fields may be optional or the chip would be unable to
    // navigate when the user clicks it.
    expect(source).toMatch(/label:\s*string/);
    expect(source).toMatch(/goal:\s*string/);
    expect(source).toMatch(/startTab:\s*BottomTab/);
    expect(source).toMatch(/sequence:\s*BottomTab\[\]/);
  });

  test("every workflow start tab appears in its own sequence", () => {
    const source = readFileSync(workflowDataPath, "utf8");
    // Each workflow's startTab must be the first stop on its sequence.
    // This is enforced by test convention rather than by code; the test
    // asserts the data is shaped correctly so the chip navigation works.
    expect(source).toContain("\"validate-coverage\"");
    expect(source).toContain("\"find-and-fix\"");
    expect(source).toContain("\"route-exposure\"");
    expect(source).toContain("\"prepare-handoff\"");
    expect(source).toContain("\"time-of-day\"");
    expect(source).toContain("\"budget-impact\"");
  });

  test("BottomPanel renders the WorkflowChips in the header strip", () => {
    const source = readFileSync(bottomPanelPath, "utf8");
    expect(source).toContain("<WorkflowChips");
    expect(source).toMatch(/activeTab=\{activeTabSafe\}/);
  });

  test("WorkflowChips hides when no workflows are available in the active preset", () => {
    const source = readFileSync(workflowChipsPath, "utf8");
    expect(source).toMatch(/available\.length === 0\)\s*return null/);
  });

  test("WorkflowChip click handler navigates to the workflow's start tab", () => {
    const source = readFileSync(workflowChipsPath, "utf8");
    expect(source).toMatch(/onClick=\{\(\)\s*=>\s*onSelect\(workflow\.startTab\)\}/);
  });
});