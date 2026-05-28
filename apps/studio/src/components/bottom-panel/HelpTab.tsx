"use client";

import { TOOL_SHORTCUTS, VIEW_MODE_KEYS } from "@/lib/studio-constants";

const WORKFLOW_STEPS = [
  "Start from the launcher with a blank scene, import, scan, or AI draft.",
  "Place cameras, lights, walls, zones, and obstructions in the live scene.",
  "Run simulation to compute coverage, issues, redundancy, and uncertainty signals.",
  "Open Security Outcome, Issues, Report Lite, or Compare to review and test fixes.",
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
      { keys: "R", action: "Open Report" },
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
  return (
    <div className="h-full overflow-y-auto p-3 text-[12px] text-[#c9d5eb]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-3">
          <div className="rounded-xl border border-[#222b3f] bg-[#0d1220] p-3">
            <div className="text-[12px] font-semibold text-white">Workflow Map</div>
            <ol className="mt-2 space-y-1 text-[11px] text-[#9fb0ce]">
              {WORKFLOW_STEPS.map((step, index) => (
                <li key={step}>
                  {index + 1}. {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-[#222b3f] bg-[#0d1220] p-3">
            <div className="text-[12px] font-semibold text-white">Domain Terms</div>
            <div className="mt-2 space-y-1 text-[11px] text-[#9fb0ce]">
              <div><span className="text-[#d7e4ff]">DORI / OODPCVS:</span> Quality thresholds for what a camera can reliably see.</div>
              <div><span className="text-[#d7e4ff]">Fragility:</span> How close coverage is to failing with small scene changes.</div>
              <div><span className="text-[#d7e4ff]">Redundancy:</span> Whether a zone still passes when one camera goes offline.</div>
              <div><span className="text-[#d7e4ff]">Provenance:</span> The source graph that explains how the current result was produced.</div>
            </div>
          </div>

          <div className="rounded-xl border border-[#222b3f] bg-[#0d1220] p-3">
            <div className="text-[12px] font-semibold text-white">Recovery Guidance</div>
            <ul className="mt-2 space-y-1 text-[11px] text-[#9fb0ce]">
              <li>• Import error: validate JSON structure and re-import.</li>
              <li>• Low night score: add light coverage or enable IR-capable camera.</li>
              <li>• Single-point failure: reorient or add a backup camera for the critical zone.</li>
              <li>• Unclear recommendation: use Preview Fix, Test Fix, then Apply Fix.</li>
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
