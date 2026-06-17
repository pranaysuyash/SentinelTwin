"use client";

import { TOOL_SHORTCUTS, VIEW_MODE_KEYS } from "@/lib/studio-constants";
import { resetFirstRunGuideDismissal } from "@/components/layout/FirstRunGuide";
import { useStudioStore } from "@/store/studio-store";

const WORKFLOW_STEPS = [
  "Start from a blank site, floor plan, guided photo marking, imported site twin, or layout draft.",
  "Place cameras, lights, access points, critical zones, paths, and obstructions.",
  "Run review to measure coverage quality, route exposure, redundancy, and night readiness.",
  "Use Security Outcome, Issues, Compare, and Report Lite to verify fixes and prepare evidence.",
] as const;

const SECURITY_TEAM_GUIDES = [
  {
    title: "Audit an existing site",
    detail: "Open the site twin, run review, check critical zones first, then work the issue list from highest severity.",
  },
  {
    title: "Test a camera outage",
    detail: "Select a camera, use Test Outage, then open Redundancy to see which zones lose backup coverage.",
  },
  {
    title: "Review night readiness",
    detail: "Switch to night review, rerun, and compare critical-zone quality before changing lights or IR-capable cameras.",
  },
  {
    title: "Prepare audit evidence",
    detail: "Save a snapshot, compare before/after, review assumptions, then open Report Lite for the handoff.",
  },
] as const;

const DOMAIN_TERMS = [
  {
    term: "DORI / OODPCVS",
    meaning: "Evidence quality levels for what a camera can support: detect, observe, recognize, identify, and higher-detail review.",
    why: "Use this to decide whether a zone merely notices movement or captures usable evidence.",
  },
  {
    term: "PPM",
    meaning: "Pixels per meter at a point in the scene. Higher detail supports stronger evidence quality.",
    why: "If PPM is low at a cash counter or entry lane, the camera may see activity without enough detail.",
  },
  {
    term: "FOV",
    meaning: "Field of view, or how wide the camera sees.",
    why: "A wider view can cover more area but may reduce detail at the target.",
  },
  {
    term: "IR / night mode",
    meaning: "Low-light camera behavior used in the night review.",
    why: "Night results can fail even when day coverage looks acceptable.",
  },
  {
    term: "Critical zone",
    meaning: "An area that needs a specific evidence level, such as a till, entry, stock room, or lane.",
    why: "Coverage percentage matters less than whether these zones meet their required target.",
  },
  {
    term: "Privacy zone",
    meaning: "An area where monitoring should be limited or flagged for policy review.",
    why: "This prevents a coverage fix from creating a privacy problem.",
  },
  {
    term: "Single point of failure",
    meaning: "A zone that fails if one camera goes offline.",
    why: "Use redundancy checks before trusting a plan for operations.",
  },
  {
    term: "Assumption",
    meaning: "A setting the simulation used, such as lighting, target height, camera status, or wall height.",
    why: "Reports should be read under these assumptions, not as field guarantees.",
  },
  {
    term: "Evidence trail",
    meaning: "The source files, edits, approvals, and computed results behind the current site twin.",
    why: "Use this when a client or reviewer asks how a result was produced.",
  },
  {
    term: "Verified by simulation",
    meaning: "The change was measured against the current site geometry and assumptions.",
    why: "This separates tested fixes from suggestions that still need review.",
  },
] as const;

const SHORTCUT_GROUPS = [
  {
    title: "Scene Actions",
    items: [
      { keys: "⌘ + N", action: "New Scene" },
      { keys: "⌘ + S", action: "Save Scene" },
      { keys: "⌘ + O", action: "Open / Import Scene" },
      { keys: "⌘ + Enter", action: "Run Simulation" },
      { keys: "?", action: "Toggle this help panel" },
    ],
  },
  {
    title: "View Modes",
    items: [
      { keys: "1", action: "Map / Coverage" },
      { keys: "2", action: "Camera View" },
      { keys: "3", action: "Camera Wall" },
      { keys: "4", action: "Path Replay" },
      { keys: "5", action: "Compare" },
      { keys: "6", action: "Report Lite" },
      { keys: "7", action: "Analytics Dashboard" },
    ],
  },
  {
    title: "Placement Tools",
    items: [
      { keys: "V", action: "Select" },
      { keys: "C", action: "Camera" },
      { keys: "B", action: "Obstruction" },
      { keys: "L", action: "Light" },
      { keys: "P", action: "Path" },
      { keys: "Z", action: "Zone" },
      { keys: "D", action: "Door / Window" },
      { keys: "W", action: "Wall" },
      { keys: "M", action: "Measure" },
      { keys: "T", action: "Comment" },
    ],
  },
  {
    title: "Workspace Shortcuts",
    items: [
      { keys: "R", action: "Open Report Lite" },
      { keys: "N", action: "Toggle Night Mode" },
      { keys: "F", action: "Toggle Focus Mode" },
      { keys: "S", action: "Save Snapshot" },
      { keys: "Esc", action: "Select tool / Cancel placement" },
    ],
  },
] as const;

function toolShortcutSummary() {
  const entries = Object.entries(TOOL_SHORTCUTS);
  return entries
    .map(([key, tool]) => `${key.toUpperCase()} → ${tool}`)
    .join(" · ");
}

function viewModeSummary() {
  return Object.entries(VIEW_MODE_KEYS)
    .map(([key, mode]) => `${key} → ${mode.replace("_", " ")}`)
    .join(" · ");
}

export function HelpTab() {
  const setShowFirstRunGuide = (value: boolean) => {
    // Bridge: the first-run guide's visibility is owned by StudioShell;
    // we just toggle the dismissed flag and rely on the next mount cycle
    // (e.g. tab switch) to re-evaluate it.
    if (value) {
      resetFirstRunGuideDismissal();
    }
    // No-op for closing here — closing is owned by StudioShell's modal.
    void useStudioStore.getState();
  };
  return (
    <div className="h-full overflow-y-auto p-3 text-[12px] text-[#c9d5eb]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-3">
          <div className="rounded-xl border border-[#222b3f] bg-[#0d1220] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[12px] font-semibold text-white">Workflow Map</div>
              <button
                type="button"
                onClick={() => setShowFirstRunGuide(true)}
                data-testid="help-show-first-run-guide"
                className="rounded border border-[#2d3750] px-2 py-1 text-[10px] text-[#cfe0ff] hover:bg-[#161f31]"
                title="Clear the dismissed flag so the next session shows the first-run guide"
              >
                Show First-Run Guide Again
              </button>
            </div>
            <ol className="mt-2 space-y-1 text-[11px] text-[#9fb0ce]">
              {WORKFLOW_STEPS.map((step, index) => (
                <li key={step}>
                  {index + 1}. {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-[#222b3f] bg-[#0d1220] p-3">
            <div className="text-[12px] font-semibold text-white">For Security Teams</div>
            <div className="mt-2 grid gap-2">
              {SECURITY_TEAM_GUIDES.map((guide) => (
                <div key={guide.title} className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                  <div className="text-[11px] font-semibold text-[#d7e4ff]">{guide.title}</div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-[#9fb0ce]">{guide.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#222b3f] bg-[#0d1220] p-3">
            <div className="text-[12px] font-semibold text-white">Glossary</div>
            <div className="mt-2 space-y-1 text-[11px] text-[#9fb0ce]">
              {DOMAIN_TERMS.map((entry) => (
                <div key={entry.term} className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                  <div><span className="text-[#d7e4ff]">{entry.term}:</span> {entry.meaning}</div>
                  <div className="mt-0.5 text-[10px] text-[#7384a5]">Why it matters: {entry.why}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#222b3f] bg-[#0d1220] p-3">
            <div className="text-[12px] font-semibold text-white">Recovery Guidance</div>
            <ul className="mt-2 space-y-1 text-[11px] text-[#9fb0ce]">
              <li>• Import error: validate the site twin file and re-import.</li>
              <li>• Low night score: add light coverage or enable IR-capable camera.</li>
              <li>• Single-point failure: reorient or add a backup camera for the critical zone.</li>
              <li>• Unclear recommendation: preview the fix, run review, compare the delta, then apply.</li>
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-[#222b3f] bg-[#0d1220] p-3">
            <div className="text-[12px] font-semibold text-white">Keyboard Shortcuts</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#6f809f]">
              {toolShortcutSummary()}
            </div>
            <div className="mt-2 space-y-3">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title} className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                  <div className="text-[11px] font-semibold text-[#d7e4ff]">{group.title}</div>
                  <div className="mt-2 space-y-1">
                    {group.items.map(({ keys, action }) => (
                      <div key={`${group.title}-${keys}`} className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[#9fb0ce]">{action}</span>
                        <kbd className="rounded border border-[#2a3248] bg-[#11182a] px-1.5 py-0.5 font-mono text-[10px] text-[#c7d0e4]">
                          {keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#222b3f] bg-[#0d1220] p-3">
            <div className="text-[12px] font-semibold text-white">Mode Map</div>
            <div className="mt-2 text-[11px] text-[#9fb0ce]">
              Use the numbered modes to move between map analysis, camera inspection, wall review, path replay, compare, and report handoff without losing your current scene.
            </div>
            <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-[10px] uppercase tracking-[0.16em] text-[#6f809f]">
              {viewModeSummary()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
