"use client";

import { useState } from "react";
import {
  CircleHelp,
  LayoutDashboard,
  ShieldCheck,
  ArrowRight,
  FileUp,
  Image as ImageIcon,
  ScanSearch,
  Sparkles,
  Square,
  Blocks,
  CheckCircle2,
  Video
} from "lucide-react";
import type { SiteIntakeSource } from "@/lib/site-compiler";

export type { SiteIntakeSource };

export const SAMPLE_SECURITY_SCENE_IMPORT_URL = "/sample-security-scene-import.json";

export type SiteIntakeHubProps = {
  onStartScan: () => void;
  onStartAiDraft: () => void;
  onImportFloorPlan: () => void;
  onImportJson: () => void;
  onBuildManually: () => void;
  onVerifyFootage: () => void;
  onStartSecurityAudit: () => void;
  onEnterStudio: () => void;
  onOpenRecentSite?: (siteId: string) => void;
  onOpenDemo?: () => void;
  recentSites: Array<{
    id: string;
    name: string;
    updatedLabel: string;
    riskLabel: "Low Risk" | "Medium Risk" | "High Risk" | "Baseline Required";
    thumbnailUrl?: string;
  }>;
};

type SiteIntakeSourceCard = {
  id: SiteIntakeSource;
  title: string;
  status: "Working" | "Preview" | "Planned";
  description: string;
  output: string;
  review: string;
  icon: typeof Square;
  recommended?: boolean;
  tone: "sky" | "violet" | "amber" | "slate" | "emerald" | "rose";
  detail: {
    bestFor: string;
    description: string;
    outputDetail: string;
    steps: string[];
    limitations: string[];
    timeEstimate: string;
    confidence: string;
    ctaLabel: string;
  };
  onClickAction: keyof SiteIntakeHubProps;
};

const cards: SiteIntakeSourceCard[] = [
  {
    id: "scan",
    title: "Scan Site Photos",
    status: "Working",
    description: "Guided capture + manual review from phone photos.",
    output: "Site Twin",
    review: "Required",
    icon: ScanSearch,
    recommended: true,
    tone: "sky",
    detail: {
      bestFor: "Existing shops, lobbies, offices, warehouses without CAD.",
      description: "Capture your site using guided steps. You'll mark key elements in photos and create a trusted site twin draft.",
      outputDetail: "Site Twin draft from reviewed photo markers.",
      steps: [
        "Set room dimensions",
        "Upload overview photos",
        "Mark entry, cameras, zones, obstructions",
        "Review candidates and warnings",
        "Compile to Site Twin draft",
        "Run baseline simulation",
      ],
      limitations: [
        "Automatic segmentation/depth reconstruction is still rolling out; candidate confirmation is required."
      ],
      timeEstimate: "15–30 minutes",
      confidence: "Available after compile",
      ctaLabel: "Start Scan Intake",
    },
    onClickAction: "onStartScan",
  },
  {
    id: "ai_prompt",
    title: "Describe with AI",
    status: "Preview",
    description: "Draft a site from text description. Review required before trust.",
    output: "Draft Site Twin",
    review: "Required",
    icon: Sparkles,
    tone: "violet",
    detail: {
      bestFor: "Drafting a site from text before real measurements are available.",
      description: "Describe the space, generate a layout draft, then review it before it can become the active site twin.",
      outputDetail: "Draft Site Twin from text plus model or heuristic layout generation.",
      steps: [
        "Write a description of the space",
        "Generate a draft layout",
        "Review entities and layout",
        "Edit if needed",
        "Approve draft for the current workspace",
      ],
      limitations: [
        "Layout is approximate — expect adjustments after import.",
        "Review required before trusting as the active site twin.",
      ],
      timeEstimate: "1–2 minutes",
      confidence: "Low (Draft layout)",
      ctaLabel: "Start Layout Draft",
    },
    onClickAction: "onStartAiDraft",
  },
  {
    id: "floor_plan",
    title: "Upload Floor Plan",
    status: "Working",
    description: "Best-effort wall/opening extraction from blueprints or images. Manual correction required.",
    output: "Scene Shell",
    review: "Required",
    icon: ImageIcon,
    tone: "amber",
    detail: {
      bestFor: "Blueprints, rough plans, screenshots, PDFs, and site images.",
      description: "Upload a floor plan, review the extracted shell, then send the result through draft review before activation.",
      outputDetail: "Scene shell draft from reviewed floor-plan extraction.",
      steps: [
        "Upload a floor plan image",
        "Review wall extraction and scale",
        "Adjust or correct extraction",
        "Confirm scene shell",
        "Enter Studio to add cameras and zones",
      ],
      limitations: [
        "Wall extraction is best-effort; manual correction may be needed.",
        "Furniture, fixtures, and details are not extracted.",
      ],
      timeEstimate: "5–10 minutes",
      confidence: "Medium (Scale dependent)",
      ctaLabel: "Upload Plan",
    },
    onClickAction: "onImportFloorPlan",
  },
  {
    id: "json",
    title: "Import Site Twin",
    status: "Working",
    description: "Import a full SecurityScene JSON as a draft Site Twin.",
    output: "Draft Site Twin",
    review: "Required",
    icon: FileUp,
    tone: "slate",
    detail: {
      bestFor: "Existing exports, shared site twins, and approved handoff files.",
      description: "Import a valid site twin data file, validate it, then review the draft before it becomes active.",
      outputDetail: "Validated Site Twin draft from JSON import.",
      steps: [
        "Select a Site Twin JSON file",
        "Schema validation runs automatically",
        "Open Site Twin Draft Review",
        "Approve to activate the imported site twin",
        "Enter Studio and run simulation",
      ],
      limitations: [
        "Only valid SecurityScene JSON files are accepted.",
        "Older schema exports may require migration before import.",
      ],
      timeEstimate: "< 1 minute",
      confidence: "High (schema-validated draft)",
      ctaLabel: "Import SecurityScene JSON",
    },
    onClickAction: "onImportJson",
  },
  {
    id: "manual",
    title: "Build Manually",
    status: "Working",
    description: "Start with a blank canvas and build your site.",
    output: "Site Twin",
    review: "Optional",
    icon: Square,
    tone: "emerald",
    detail: {
      bestFor: "Starting from a blank canvas and drawing the site by hand.",
      description: "Draw the site yourself, then approve the manual draft before opening it as the active site twin.",
      outputDetail: "Site Twin draft from manual authoring.",
      steps: [
        "Open the manual builder",
        "Draw walls to define the space",
        "Place cameras, lights, and sensors",
        "Define critical zones and entry points",
        "Add paths for replay analysis",
        "Run simulation to validate coverage",
      ],
      limitations: [
        "Fully manual — no automation or extraction.",
        "Requires familiarity with the editor tools.",
      ],
      timeEstimate: "30+ minutes",
      confidence: "High (Manual input)",
      ctaLabel: "Open Manual Builder",
    },
    onClickAction: "onBuildManually",
  },
  {
    id: "camera_evidence",
    title: "Verify from Footage",
    status: "Preview",
    description: "Preview: static/reference-frame alignment only. No product-grade video/stream verification yet.",
    output: "Evidence",
    review: "Required",
    icon: Video,
    tone: "rose",
    detail: {
      bestFor: "Future/live camera footage alignment and verification.",
      description: "Compare virtual cameras against reference evidence before locking verified camera state.",
      outputDetail: "Evidence review for the current site twin.",
      steps: [
        "Connect live stream or video file",
        "Map stream to virtual camera",
        "Run comparative analysis",
        "Adjust FOV and obstruction zones",
        "Lock verified camera state",
      ],
      limitations: [
        "Currently limited to static occlusion mapping.",
        "No product-grade video or stream verification yet.",
        "Requires active ONVIF/RTSP feeds for live mode.",
      ],
      timeEstimate: "10–20 minutes",
      confidence: "Verified (Real world)",
      ctaLabel: "Verify Footage",
    },
    onClickAction: "onVerifyFootage",
  },
];

const toneClasses: Record<SiteIntakeSourceCard["tone"], { border: string; glow: string; text: string; bg: string }> = {
  sky: { border: "border-sky-500", glow: "shadow-[0_0_20px_rgba(14,165,233,0.15)]", text: "text-sky-400", bg: "bg-sky-500/10" },
  violet: { border: "border-violet-500", glow: "shadow-[0_0_20px_rgba(139,92,246,0.15)]", text: "text-violet-400", bg: "bg-violet-500/10" },
  amber: { border: "border-amber-500", glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]", text: "text-amber-400", bg: "bg-amber-500/10" },
  slate: { border: "border-slate-500", glow: "shadow-[0_0_20px_rgba(100,116,139,0.15)]", text: "text-slate-400", bg: "bg-slate-500/10" },
  emerald: { border: "border-emerald-500", glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]", text: "text-emerald-400", bg: "bg-emerald-500/10" },
  rose: { border: "border-rose-500", glow: "shadow-[0_0_20px_rgba(244,63,94,0.15)]", text: "text-rose-400", bg: "bg-rose-500/10" },
};

export function SiteIntakeHub(props: SiteIntakeHubProps) {
  const [selectedSourceId, setSelectedSourceId] = useState<SiteIntakeSource>("scan");
  
  const selected = cards.find(c => c.id === selectedSourceId) || cards[0];
  const tClasses = toneClasses[selected.tone];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#08101a] text-slate-200">
      <aside className="flex w-[248px] flex-none flex-col justify-between border-r border-white/8 bg-[#07111b] px-3 py-4">
        <div>
          <div className="flex items-center gap-2 px-2 py-1 text-[17px] font-medium tracking-tight text-white">
            <ShieldCheck className="h-6 w-6 text-sky-400" />
            <span>SentinelTwin</span>
          </div>

          <nav className="mt-7 space-y-2">
            {[
              { label: "Create Site Twin", icon: LayoutDashboard, active: true },
              { label: "Studio", icon: Blocks, active: false },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.label === "Studio" ? props.onEnterStudio : undefined}
                  disabled={item.active}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] transition-colors",
                    item.active ? "bg-sky-500/12 text-sky-400 ring-1 ring-sky-500/20" : "text-slate-300 hover:bg-white/4 hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="h-[18px] w-[18px] flex-none" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/82">Reference Baseline</div>
            <div className="overflow-hidden rounded-lg border border-white/6 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.25),transparent_50%),linear-gradient(180deg,#0b192e,#09101d)]">
              <div className="flex h-[82px] items-center justify-center">
                <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-sky-200">Reference</span>
              </div>
            </div>
            <div className="mt-3 text-[15px] font-medium text-white">Retail Store Reference</div>
            <p className="mt-1 max-w-[170px] text-[13px] leading-5 text-slate-300">Explore a complete site twin example</p>
            <button
              type="button"
              onClick={props.onOpenDemo}
              className="mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-sky-500/40 bg-sky-500/10 text-[15px] text-sky-300 transition-colors hover:bg-sky-500/16"
            >
              Open Reference
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/15 text-sm font-medium text-sky-300">
              ST
            </div>
            <div>
              <div className="text-[14px] text-white">SentinelTwin</div>
              <div className="text-[12px] text-slate-400">Security Simulation</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(37,78,140,0.14),_transparent_32%),linear-gradient(180deg,#08101a_0%,#071019_100%)]">
        <div className="flex min-h-0 flex-1 flex-col overflow-auto px-5 pb-5 pt-7 lg:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-[720px]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/12 text-sky-400 ring-1 ring-sky-500/20">
                  <LayoutDashboard className="h-6 w-6" />
                </div>
                <h1 className="text-[50px] font-semibold tracking-[-0.04em] text-white">Create Site Twin</h1>
              </div>
              <p className="mt-4 text-[19px] leading-7 text-slate-300">
                Turn a physical site into a trusted, editable site twin.
              </p>
              <p className="text-[19px] leading-7 text-slate-300">Choose how you want to start.</p>
            </div>

            <div className="mt-1 flex h-12 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 text-[15px] text-slate-300">
              <CircleHelp className="h-4 w-4" />
              <span>Review model and source limits</span>
            </div>
          </div>

          <div className="mt-10 grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0">
              <div className="grid grid-cols-2 gap-4">
                {cards.map((card) => {
                  const isSelected = selectedSourceId === card.id;
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setSelectedSourceId(card.id)}
                      className={[
                        "relative overflow-hidden rounded-3xl border p-5 text-left transition-all duration-200",
                        isSelected
                          ? `${toneClasses[card.tone].border} ${toneClasses[card.tone].bg} ${toneClasses[card.tone].glow}`
                          : "border-white/10 bg-white/[0.015] hover:border-white/16 hover:bg-white/[0.03]",
                      ].join(" ")}
                    >
                      {isSelected ? (
                        <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      ) : null}
                      <div className="flex items-start gap-4">
                        <div className={[
                          "flex h-[56px] w-[56px] flex-none items-center justify-center rounded-xl ring-1",
                          isSelected ? toneClasses[card.tone].bg : "bg-white/[0.05] ring-white/6",
                        ].join(" ")}>
                          <Icon className={`h-7 w-7 ${isSelected ? toneClasses[card.tone].text : "text-slate-400"}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[22px] font-medium tracking-[-0.02em] text-white">{card.title}</div>
                          <span className={[
                            "mt-2 inline-flex rounded-lg border px-2.5 py-1 text-[12px] font-medium uppercase tracking-[0.14em]",
                            card.status === "Working" ? "border-emerald-500/20 bg-emerald-500/12 text-emerald-300" : "border-violet-500/20 bg-violet-500/12 text-violet-300",
                          ].join(" ")}>
                            {card.status}
                          </span>
                          <p className="mt-4 max-w-[240px] text-[17px] leading-7 text-slate-300">{card.description}</p>
                        </div>
                      </div>
                      <div className="mt-7 border-t border-white/8 pt-4 text-[14px] text-slate-400">
                        <div className="flex items-center justify-between gap-3">
                          <span>
                            <span className="text-slate-300">Output:</span> {card.output}
                          </span>
                          <span>
                            <span className="text-slate-300">Review:</span> {card.review}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="min-w-0 rounded-[28px] border border-white/8 bg-white/[0.02] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={[
                    "flex h-12 w-12 items-center justify-center rounded-xl ring-1",
                    tClasses.bg,
                  ].join(" ")}>
                    <selected.icon className={`h-6 w-6 ${tClasses.text}`} />
                  </div>
                  <div>
                    <h2 className="text-[31px] font-medium tracking-[-0.03em] text-white">{selected.title}</h2>
                    <div className="mt-2 flex items-center gap-2 text-[18px] text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span>Manual-assisted · {selected.status}</span>
                    </div>
                  </div>
                </div>
                {selected.recommended ? (
                  <span className="rounded-xl border border-sky-500/20 bg-sky-500/8 px-4 py-2 text-[15px] text-sky-300">Recommended</span>
                ) : null}
              </div>

              <p className="mt-7 max-w-[560px] border-b border-white/8 pb-6 text-[18px] leading-8 text-slate-300">
                {selected.detail.description}
              </p>

              <div className="border-b border-white/8 py-6">
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/8 text-[15px] text-slate-300">
                      <span className="relative top-px">👥</span>
                    </div>
                    <div>
                      <div className="text-[14px] font-medium text-white">Best for</div>
                      <div className="mt-1 max-w-[260px] text-[14px] leading-6 text-slate-300">{selected.detail.bestFor}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/8 text-[15px] text-slate-300">
                      <span className="relative top-px">↪</span>
                    </div>
                    <div>
                      <div className="text-[14px] font-medium text-white">Output</div>
                      <div className="mt-1 max-w-[260px] text-[14px] leading-6 text-slate-300">{selected.detail.outputDetail}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 py-6 xl:grid-cols-[minmax(0,1fr)_252px]">
                <div>
                  <div className="mb-4 text-[17px] font-medium text-white">What you&apos;ll do</div>
                  <ol className="space-y-4">
                    {selected.detail.steps.map((step, index) => (
                      <li key={step} className="flex items-center gap-4 text-[16px] text-slate-300">
                        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-sky-500 text-[14px] font-medium text-white">
                          {index + 1}
                        </span>
                        <span className="leading-6">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="self-start rounded-2xl border border-white/8 bg-[#0c1420] p-4">
                  <div className="grid gap-4 text-[14px] text-slate-300">
                    <div>
                      <div className="text-white">Review level</div>
                      <div className="mt-1">{selected.review}</div>
                    </div>
                    <div>
                      <div className="text-white">Confidence</div>
                      <div className="mt-1">{selected.detail.confidence}</div>
                    </div>
                    <div>
                      <div className="text-white">Average time</div>
                      <div className="mt-1">{selected.detail.timeEstimate}</div>
                    </div>
                    <div>
                      <div className="text-white">Limitations</div>
                      <div className="mt-1 leading-6 text-slate-300">{selected.detail.limitations[0]}</div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const action = props[selected.onClickAction] as (() => void) | undefined;
                  if (action) action();
                }}
                className={`mt-2 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border text-[18px] font-medium text-white transition-transform hover:scale-[1.01] active:scale-[0.99] ${tClasses.bg} ${tClasses.border}`}
              >
                <span>{selected.detail.ctaLabel}</span>
                <ArrowRight className="h-5 w-5" />
              </button>
              {selected.id === "json" ? (
                <a
                  href={SAMPLE_SECURITY_SCENE_IMPORT_URL}
                  download="sample-security-scene-import.json"
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-[15px] text-slate-200 transition-colors hover:bg-white/[0.06]"
                >
                  <FileUp className="h-4 w-4" />
                  <span>Download sample JSON</span>
                </a>
              ) : null}

              <div className="mt-3 flex items-center gap-2 text-[14px] text-slate-400">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-[11px] text-slate-500">🛡</span>
                <span>Local-only mode is available. Cloud-backed AI actions are explicitly labeled before use.</span>
              </div>
            </aside>
          </div>

          <section className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.02] p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="text-[18px] font-medium text-white">Recent Site Twins</div>
              <button type="button" onClick={props.onEnterStudio} className="text-[15px] text-sky-400 hover:text-sky-300">Open Studio Library</button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {props.recentSites.slice(0, 3).map((site) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => props.onOpenRecentSite?.(site.id) ?? props.onEnterStudio()}
                  className="flex w-[285px] flex-none items-center gap-4 rounded-2xl border border-white/8 bg-[#0e1520] p-3 text-left transition-colors hover:border-white/16 hover:bg-[#111926]"
                >
                  <div
                    className="h-[76px] w-[108px] flex-none rounded-xl bg-gradient-to-br from-sky-500/15 to-slate-700/20 flex items-center justify-center"
                  >
                    <div className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-slate-300">Site</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-medium text-white">{site.name}</div>
                    <div className="mt-1 text-[14px] text-slate-400">{site.updatedLabel}</div>
                    <div className={`mt-2 text-[14px] ${site.riskLabel === "Low Risk" ? "text-emerald-300" : site.riskLabel === "Medium Risk" ? "text-amber-300" : site.riskLabel === "Baseline Required" ? "text-sky-300" : "text-rose-300"}`}>
                      ● {site.riskLabel}
                    </div>
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={props.onImportJson}
                className="flex w-[285px] flex-none items-center gap-4 rounded-2xl border border-dashed border-white/12 bg-transparent p-3 text-left transition-colors hover:border-sky-400/35 hover:bg-sky-500/6"
              >
                <div className="flex h-[76px] w-[108px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-white">
                  <FileUp className="h-8 w-8" />
                </div>
                <div>
                  <div className="text-[15px] font-medium text-white">Quick Import</div>
                  <div className="mt-1 text-[14px] text-slate-400">Import JSON or floor plan</div>
                </div>
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
