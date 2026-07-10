"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ArrowRight,
  FileUp,
  Image as ImageIcon,
  ScanSearch,
  Sparkles,
  Square,
  Video,
  LayoutDashboard,
  FolderOpen,
  BarChart3,
  AlertTriangle,
  Film,
  Puzzle,
  Settings,
  CheckCircle2,
} from "lucide-react";
import type { SiteIntakeSource } from "@/lib/site-compiler";
import { CreationFlowShell } from "@/components/site-intake/CreationFlowShell";
import {
  getCapabilityStatus,
  type CapabilityId,
  type CapabilityLevel,
} from "@/lib/capability-registry";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export type { SiteIntakeSource };

export const SAMPLE_SECURITY_SCENE_IMPORT_URL = "/sample-security-scene-import.json";
export const JEWELRY_STORE_SITE_TWIN_IMPORT_URL = "/sample-site-twins/jewelry-store-site-twin.json";

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

type SourceCard = {
  id: SiteIntakeSource;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  /** Capability IDs from the registry — used to derive status automatically. */
  capabilityIds: CapabilityId[];
  status: "Working" | "Preview" | "Planned";
  description: string;
  output: string;
  review: "Required" | "Optional";
  recommended?: boolean;
  accent: {
    border: string;
    iconBg: string;
    iconColor: string;
    badge: string;
    cta: string;
    ctaText: string;
  };
  detail: {
    headline: string;
    steps: string[];
    /** Optional honest-maturity limitations (truth-audit surface). */
    limitations?: string[];
    cta: string;
  };
  action: keyof SiteIntakeHubProps;
};

const SOURCES: SourceCard[] = [
  {
    id: "scan",
    icon: ScanSearch,
    title: "Scan Site Photos",
    capabilityIds: ["scan_site", "guided_scan_reconstruction", "reconstruction_compilation"],
    status: "Working",
    // Truth-audit surface — the maturity tagline is enforced by
    // `src/lib/truth-audit.ts` ("Site intake hub truthful maturity"). The
    // phrase set is the honest disclosure buyers need to see before choosing
    // this path: it is guided capture + manual review, not automatic
    // reconstruction. Per `motto_v3 §0.11`: do not let UI copy imply stronger
    // capabilities than the system has.
    description: "Guided capture + manual review from phone photos. Mark entry, cameras, and zones.",
    output: "Site Twin",
    review: "Required",
    recommended: true,
    accent: {
      border: "border-l-sky-500",
      iconBg: "bg-sky-500/10",
      iconColor: "text-sky-400",
      badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      cta: "bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/18 text-sky-300",
      ctaText: "Start Scan Intake",
    },
    detail: {
      headline: "Capture your site with guided steps. Mark key elements in photos and compile a trusted site twin.",
      steps: [
        "Set room dimensions",
        "Upload overview photos",
        "Mark entry, cameras, zones, obstructions",
        "Review candidates and warnings",
        "Compile to site twin",
        "Run baseline simulation",
      ],
      // Honest-maturity limitations. Required by the truth-audit manifest;
      // surfaced in the detail panel so buyers see them before starting.
      limitations: [
        "Best-effort wall/opening extraction",
        "Automatic segmentation/depth reconstruction is still rolling out; candidate confirmation is required.",
        "Draft-gated — the compiled twin is a draft until reviewed.",
        "No product-grade video/stream verification yet",
        "Local-only mode is available",
      ],
      cta: "Start Scan Intake",
    },
    action: "onStartScan",
  },
  {
    id: "ai_prompt",
    icon: Sparkles,
    title: "Describe with AI",
    capabilityIds: ["ai_layout_draft"],
    status: "Preview",
    description: "Draft a layout from a text description. Review required before use.",
    output: "Draft",
    review: "Required",
    accent: {
      border: "border-l-violet-500",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-400",
      badge: "border-violet-500/25 bg-violet-500/10 text-violet-300",
      cta: "bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/18 text-violet-300",
      ctaText: "Start Layout Draft",
    },
    detail: {
      headline: "Describe the space and generate a layout draft. Review before activating as the site twin.",
      steps: [
        "Write a description of the space",
        "Generate a draft layout",
        "Review entities and layout",
        "Edit if needed",
        "Approve draft for workspace",
      ],
      cta: "Start Layout Draft",
    },
    action: "onStartAiDraft",
  },
  {
    id: "floor_plan",
    icon: ImageIcon,
    title: "Upload Floor Plan",
    capabilityIds: ["floor_plan_import"],
    status: "Working",
    description: "Extract walls from blueprints, PDFs, or images. Manual correction may be needed.",
    output: "Scene Shell",
    review: "Required",
    accent: {
      border: "border-l-amber-500",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
      badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      cta: "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/18 text-amber-300",
      ctaText: "Upload Plan",
    },
    detail: {
      headline: "Upload a floor plan, review the extracted shell, then send the result through draft review before activation.",
      steps: [
        "Upload a floor plan image",
        "Review wall extraction and scale",
        "Adjust or correct extraction",
        "Confirm scene shell",
        "Enter Studio to add cameras and zones",
      ],
      cta: "Upload Plan",
    },
    action: "onImportFloorPlan",
  },
  {
    id: "json",
    icon: FileUp,
    title: "Import Site Twin",
    capabilityIds: ["json_import"],
    status: "Working",
    description: "Import a full site twin data file. Validates automatically before review.",
    output: "Site Twin",
    review: "Required",
    accent: {
      border: "border-l-slate-500",
      iconBg: "bg-white/5",
      iconColor: "text-slate-400",
      badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      cta: "bg-white/5 border-white/10 hover:bg-white/8 text-slate-300",
      ctaText: "Import Data",
    },
    detail: {
      headline: "Import a validated site twin data file. Review the draft before it becomes the active workspace.",
      steps: [
        "Select a site twin data file",
        "File validation runs automatically",
        "Open site twin draft review",
        "Approve to activate",
        "Enter Studio and run review",
      ],
      cta: "Import Data",
    },
    action: "onImportJson",
  },
  {
    id: "manual",
    icon: Square,
    title: "Build Manually",
    capabilityIds: ["manual_builder"],
    status: "Working",
    description: "Start from a blank canvas. Draw walls, place cameras, define zones.",
    output: "Site Twin",
    review: "Optional",
    accent: {
      border: "border-l-emerald-500",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      cta: "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/18 text-emerald-300",
      ctaText: "Open Manual Builder",
    },
    detail: {
      headline: "Draw the site yourself. No files needed — build the space and place every element by hand.",
      steps: [
        "Open the manual builder",
        "Draw walls to define the space",
        "Place cameras, lights, and sensors",
        "Define critical zones and entry points",
        "Add paths for replay analysis",
        "Run simulation to validate coverage",
      ],
      cta: "Open Manual Builder",
    },
    action: "onBuildManually",
  },
  {
    id: "camera_evidence",
    icon: Video,
    title: "Verify from Footage",
    capabilityIds: ["real_footage_verification", "live_camera_connection"],
    status: "Preview",
    description: "Compare virtual cameras against reference evidence. Static alignment only.",
    output: "Evidence",
    review: "Required",
    accent: {
      border: "border-l-rose-500",
      iconBg: "bg-rose-500/10",
      iconColor: "text-rose-400",
      badge: "border-violet-500/25 bg-violet-500/10 text-violet-300",
      cta: "bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/18 text-rose-300",
      ctaText: "Verify Footage",
    },
    detail: {
      headline: "Compare virtual cameras against reference evidence before locking verified camera state.",
      steps: [
        "Connect live stream or video file",
        "Map stream to virtual camera",
        "Run comparative analysis",
        "Adjust FOV and obstruction zones",
        "Lock verified camera state",
      ],
      cta: "Verify Footage",
    },
    action: "onVerifyFootage",
  },
];

const riskColor: Record<string, string> = {
  "Low Risk": "text-emerald-400",
  "Medium Risk": "text-amber-400",
  "High Risk": "text-rose-400",
  "Baseline Required": "text-sky-400",
};

const riskDot: Record<string, string> = {
  "Low Risk": "bg-emerald-400",
  "Medium Risk": "bg-amber-400",
  "High Risk": "bg-rose-400",
  "Baseline Required": "bg-sky-400",
};

const NAV_ITEMS = [
  { label: "Create Site Twin", icon: LayoutDashboard, active: true },
  { label: "Workspaces", icon: FolderOpen, active: false },
  { label: "Projects", icon: Puzzle, active: false },
  { label: "Reports", icon: BarChart3, active: false },
  { label: "Issues & Actions", icon: AlertTriangle, active: false },
  { label: "Evidence", icon: Film, active: false },
  { label: "Integrations", icon: Puzzle, active: false },
  { label: "Settings", icon: Settings, active: false },
];

export function SiteIntakeHub(props: SiteIntakeHubProps) {
  const [selectedId, setSelectedId] = useState<SiteIntakeSource>("scan");
  const selected = SOURCES.find((s) => s.id === selectedId) ?? SOURCES[0];

  return (
    <div className="flex h-screen w-full overflow-hidden ${UI_SURFACES.panel} text-white">
      {/* ── Left nav ───────────────────────────────────────────────────── */}
      <aside className={`flex w-[220px] flex-none flex-col border-r ${UI_SURFACES.borderFaint} ${UI_SURFACES.panelDeepAlt}`}>
        {/* Logo */}
        <div className={`flex items-center gap-2.5 border-b ${UI_SURFACES.borderFaint} px-5 py-4`}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/25">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="text-[14px] font-semibold tracking-tight text-white">SentinelTwin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  disabled={item.active}
                  onClick={item.label === "Workspaces" ? props.onEnterStudio : undefined}
                  className={[
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                    item.active
                      ? "bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/20"
                      : "${UI_SURFACES.textMuted2} hover:bg-white/4 hover:${UI_SURFACES.textBody}",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4 flex-none" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Reference demo */}
        <div className={`border-t ${UI_SURFACES.borderFaint} p-3`}>
          <div className={`rounded-xl border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} p-3`}>
            <div className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${UI_SURFACES.textMuted}`}>
              Reference Scenes
            </div>
            <div className="text-[12px] font-medium text-white">Reference Demo</div>
            <p className="mt-0.5 text-[11px] leading-4 ${UI_SURFACES.textMuted7}">
              Small retail shop example
            </p>
            <button
              type="button"
              onClick={props.onOpenDemo}
              className="mt-2.5 flex h-7 w-full items-center justify-center gap-1 rounded-lg border border-sky-500/20 bg-sky-500/8 text-[11px] text-sky-400 hover:bg-sky-500/14"
            >
              Open demo
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <CreationFlowShell
          activeStage="choose_source"
          title="Create Site Twin"
          subtitle="Turn a physical site into a trusted, editable security model. Choose how you want to start."
          onExit={props.onEnterStudio}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-6">
            {/* ── Grid + detail panel ──────────────────────────────────────── */}
            <div className="flex min-h-0 flex-1 gap-5">
              {/* Card grid */}
              <div className="grid min-w-0 flex-1 auto-rows-min grid-cols-2 gap-3 content-start">
                {SOURCES.map((card) => {
                  const isSelected = card.id === selectedId;
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setSelectedId(card.id)}
                      className={[
                        "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all",
                        isSelected
                          ? `${UI_SURFACES.hoverBgSubtle} border-sky-500/50 shadow-[0_0_24px_rgba(14,165,233,0.12)] ${card.accent.border}`
                          : "${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} ${UI_SURFACES.hoverBorderSubtle} ${UI_SURFACES.hoverBgSubtle}",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl transition-colors ${isSelected ? card.accent.iconBg : "bg-white/5 group-hover:bg-white/10"}`}>
                          <Icon className={`h-5 w-5 ${isSelected ? card.accent.iconColor : "${UI_SURFACES.textSoftBright} group-hover:text-white"}`} />
                        </div>
                        <div className="min-w-0 flex-1 pr-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[14px] font-medium text-white">{card.title}</span>
                            {card.recommended && (
                              <span className="rounded-md border border-sky-500/20 bg-sky-500/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-300">
                                Recommended
                              </span>
                            )}
                          </div>
                          <span className={[
                            "mt-1 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]",
                            card.status === "Working"
                              ? card.accent.badge
                              : "border-violet-500/20 bg-violet-500/8 text-violet-300",
                          ].join(" ")}>
                            {(() => {
                              // Derive the lowest capability level across the card's capabilities
                              const LEVEL_ORDER: CapabilityLevel[] = [
                                "Available", "Preview", "Stub", "RequiresBackend",
                                "RequiresIntegration", "Planned",
                              ];
                              const levels = card.capabilityIds
                                .map((cid) => getCapabilityStatus(cid)?.level)
                                .filter(Boolean) as CapabilityLevel[];
                              const worst = levels.length > 0
                                ? levels.reduce((a, b) =>
                                    LEVEL_ORDER.indexOf(a) > LEVEL_ORDER.indexOf(b) ? a : b)
                                : null;
                              return worst && worst !== "Available"
                                ? worst
                                : card.status;
                            })()}
                          </span>
                        </div>
                      </div>

                      <p className={`mt-3 text-[13px] leading-5 ${UI_SURFACES.textSoftBright}`}>{card.description}</p>

                      <div className={`mt-3 flex items-center gap-3 border-t ${UI_SURFACES.borderFaint} pt-3 text-[11px] ${UI_SURFACES.textMuted}`}>
                        <span>Output: <span className={`${UI_SURFACES.textSoftBright}`}>{card.output}</span></span>
                        <span className="${UI_SURFACES.hoverBorder}">·</span>
                        <span>Review: <span className={`${UI_SURFACES.textSoftBright}`}>{card.review}</span></span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Detail panel */}
              <aside className="w-[340px] flex-none">
                <div className={`sticky top-0 rounded-2xl border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} p-5`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${selected.accent.iconBg}`}>
                      <selected.icon className={`h-5 w-5 ${selected.accent.iconColor}`} />
                    </div>
                    <div>
                      <div className="text-[16px] font-semibold text-white">{selected.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-[12px] ${UI_SURFACES.textMuted7}">
                        <span className="inline-flex items-center gap-1">
                          {selected.capabilityIds.map((cid) => {
                            const cap = getCapabilityStatus(cid);
                            if (!cap) return null;
                            return (
                              <span
                                key={cid}
                                className={[
                                  "rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]",
                                  cap.level === "Available"
                                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                    : cap.level === "Preview"
                                    ? "border-violet-500/20 bg-violet-500/8 text-violet-300"
                                    : "border-amber-500/20 bg-amber-500/8 text-amber-300",
                                ].join(" ")}>
                                {cap.label}: {cap.level}
                              </span>
                            );
                          })}
                        </span>
                        {selected.recommended && (
                          <span className="text-sky-400">· Recommended</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className={`mt-4 text-[13px] leading-5 ${UI_SURFACES.textMuted3}`}>
                    {selected.detail.headline}
                  </p>

                  <div className="mt-5">
                    <div className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.13em] ${UI_SURFACES.textMuted}`}>
                      What you&apos;ll do
                    </div>
                    <ol className="space-y-2">
                      {selected.detail.steps.map((step, i) => (
                        <li key={step} className={`flex items-start gap-3 text-[13px] ${UI_SURFACES.textMuted3}`}>
                          <span className="mt-px flex h-5 w-5 flex-none items-center justify-center rounded-full bg-sky-500/10 text-[11px] font-semibold text-sky-400 ring-1 ring-sky-500/20">
                            {i + 1}
                          </span>
                          <span className="leading-5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Honest-maturity limitations. Required by the truth-audit
                      manifest and surfaced so buyers see what the path can and
                      cannot do before they commit to it. Per `motto_v3 §0.11`. */}
                  {selected.detail.limitations && selected.detail.limitations.length > 0 ? (
                    <div className="mt-5">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-amber-500/80">
                        Maturity &amp; limits
                      </div>
                      <ul className="space-y-1.5">
                        {selected.detail.limitations.map((limitation) => (
                          <li key={limitation} className="flex items-start gap-2 text-[12px] leading-5 ${UI_SURFACES.textMuted5}">
                            <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-amber-500/60" />
                            <span>{limitation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      const action = props[selected.action] as (() => void) | undefined;
                      if (action) action();
                    }}
                    className={[
                      "mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-[14px] font-medium transition-colors",
                      selected.accent.cta,
                    ].join(" ")}
                  >
                    {selected.detail.cta}
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  {selected.id === "json" && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <a
                        href={SAMPLE_SECURITY_SCENE_IMPORT_URL}
                        download="sample-security-scene-import.json"
                        className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border ${UI_SURFACES.borderFaint} bg-white/[0.02] text-[12px] ${UI_SURFACES.textSoftBright} transition-colors hover:bg-white/[0.04] hover:text-white`}
                      >
                        <FileUp className="h-3.5 w-3.5" />
                        Sample JSON
                      </a>
                      <a
                        href={JEWELRY_STORE_SITE_TWIN_IMPORT_URL}
                        download="jewelry-store-site-twin.json"
                        className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border ${UI_SURFACES.borderFaint} bg-white/[0.02] text-[12px] ${UI_SURFACES.textSoftBright} transition-colors hover:bg-white/[0.04] hover:text-white`}
                      >
                        <FileUp className="h-3.5 w-3.5" />
                        Jewelry sample
                      </a>
                    </div>
                  )}

                  <div className={`mt-4 rounded-xl border ${UI_SURFACES.borderFaint} bg-white/[0.02] p-3`}>
                    <div className={`mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textMuted}`}>
                      Capability Status
                    </div>
                    <div className="space-y-1.5">
                      {selected.capabilityIds.map((cid) => {
                        const cap = getCapabilityStatus(cid);
                        if (!cap) return null;
                        return (
                          <div key={cid} className="flex items-center justify-between">
                            <span className={`text-[11px] ${UI_SURFACES.textSoftBright}`}>{cap.label}</span>
                            <span className={[
                              "rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]",
                              cap.level === "Available"
                                ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                                : cap.level === "Preview"
                                ? "border-violet-400/25 bg-violet-500/10 text-violet-300"
                                : "border-amber-400/25 bg-amber-500/10 text-amber-300",
                            ].join(" ")}>
                              {cap.level}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px] leading-4 ${UI_SURFACES.textDim}">
                      Local-only mode is available. Cloud-backed AI actions are explicitly labeled before use.
                    </p>
                  </div>
                </div>
              </aside>
            </div>

            {/* ── Recent site twins ──────────────────────────────────────────── */}
            {props.recentSites.length > 0 && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${UI_SURFACES.textMuted}`}>
                    Recent Site Twins
                  </div>
                  <button
                    type="button"
                    onClick={props.onEnterStudio}
                    className="text-[12px] text-sky-400 hover:text-sky-300"
                  >
                    View all →
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {props.recentSites.slice(0, 4).map((site) => (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() =>
                        props.onOpenRecentSite
                          ? props.onOpenRecentSite(site.id)
                          : props.onEnterStudio()
                      }
                      className={`group flex w-[240px] flex-none items-center gap-3 rounded-xl border ${UI_SURFACES.borderFaint} ${UI_SURFACES.bgDeep} p-3 text-left transition-all ${UI_SURFACES.hoverBorderSubtle} ${UI_SURFACES.hoverBgSubtle}`}
                    >
                      <div className="flex h-[60px] w-[90px] flex-none items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/10 to-slate-700/10 ring-1 ring-white/5">
                        <ShieldCheck className="h-5 w-5 ${UI_SURFACES.borderStrong}" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-white">{site.name}</div>
                        <div className={`mt-0.5 text-[11px] ${UI_SURFACES.textMuted}`}>{site.updatedLabel}</div>
                        <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-medium ${riskColor[site.riskLabel]}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${riskDot[site.riskLabel]}`} />
                          {site.riskLabel}
                        </div>
                      </div>
                    </button>
                  ))}

                  {/* Quick import slot */}
                  <button
                    type="button"
                    onClick={props.onImportJson}
                    className={`flex w-[240px] flex-none items-center gap-3 rounded-xl border border-dashed ${UI_SURFACES.borderFaint} bg-transparent p-3 text-left transition-all hover:border-sky-500/20 hover:bg-sky-500/4`}
                  >
                    <div className={`flex h-[60px] w-[90px] flex-none items-center justify-center rounded-lg border border-dashed ${UI_SURFACES.borderFaint}`}>
                      <FileUp className="h-5 w-5 ${UI_SURFACES.borderStrong}" />
                    </div>
                    <div>
                      <div className={`text-[13px] font-medium ${UI_SURFACES.textSoftBright}`}>Quick Import</div>
                      <div className={`mt-0.5 text-[11px] ${UI_SURFACES.textMuted}`}>Import site twin JSON</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </CreationFlowShell>
      </main>
    </div>
  );
}
