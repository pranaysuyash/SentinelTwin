"use client";

import { useState } from "react";
import {
  Camera,
  FileUp,
  Image as ImageIcon,
  ScanSearch,
  Sparkles,
  Square,
  FolderOpen,
  LayoutDashboard,
  FileText,
  Activity,
  Database,
  Blocks,
  CheckCircle2,
  PlayCircle,
  Video
} from "lucide-react";

export type SiteIntakeSource =
  | "scan"
  | "ai_prompt"
  | "floor_plan"
  | "json_import"
  | "manual"
  | "footage_verify";

export type SiteIntakeHubProps = {
  onStartScan: () => void;
  onStartAiDraft: () => void;
  onImportFloorPlan: () => void;
  onImportJson: () => void;
  onBuildManually: () => void;
  onVerifyFootage: () => void;
  onEnterStudio: () => void;
  onShowProjects?: () => void;
  onOpenDemo?: () => void;
  recentSites: Array<{
    id: string;
    name: string;
    updatedLabel: string;
    riskLabel: "Low Risk" | "Medium Risk" | "High Risk";
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
    description: "Manual-assisted capture using your phone photos.",
    output: "SecurityScene",
    review: "Required",
    icon: ScanSearch,
    recommended: true,
    tone: "sky",
    detail: {
      bestFor: "Existing shops, lobbies, offices, warehouses without CAD.",
      steps: [
        "Set room dimensions",
        "Upload overview photos",
        "Mark entry, cameras, zones, obstructions",
        "Review candidates and warnings",
        "Compile to SecurityScene",
        "Run baseline simulation",
      ],
      limitations: [
        "No automatic segmentation or depth yet. User confirms all candidates."
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
    description: "Draft a site from text description using AI.",
    output: "Draft Scene",
    review: "Required",
    icon: Sparkles,
    tone: "violet",
    detail: {
      bestFor: "Drafting a site from text before real measurements are available.",
      steps: [
        "Write a description of the space",
        "Generate draft (model or heuristic fallback)",
        "Review entities and layout",
        "Edit if needed",
        "Apply draft to current workspace",
      ],
      limitations: [
        "Layout is approximate — expect adjustments after import.",
      ],
      timeEstimate: "1–2 minutes",
      confidence: "Low (Generative Draft)",
      ctaLabel: "Start AI Draft",
    },
    onClickAction: "onStartAiDraft",
  },
  {
    id: "floor_plan",
    title: "Upload Floor Plan",
    status: "Working",
    description: "Upload blueprints, images or PDFs of your floor plan.",
    output: "Scene Shell",
    review: "Required",
    icon: ImageIcon,
    tone: "amber",
    detail: {
      bestFor: "Blueprints, rough plans, screenshots, PDFs, and site images.",
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
    id: "json_import",
    title: "Import SecurityScene",
    status: "Working",
    description: "Import an existing SecurityScene JSON file.",
    output: "SecurityScene",
    review: "Validation",
    icon: FileUp,
    tone: "slate",
    detail: {
      bestFor: "Existing exports, shared scenes, agent-generated JSON files.",
      steps: [
        "Select a JSON file",
        "Schema validation runs automatically",
        "Review validation results",
        "Enter Studio to continue editing",
      ],
      limitations: [
        "Only valid SecurityScene JSON files are accepted.",
        "No backward compatibility with older schema versions.",
      ],
      timeEstimate: "< 1 minute",
      confidence: "Absolute (Schema backed)",
      ctaLabel: "Import JSON",
    },
    onClickAction: "onImportJson",
  },
  {
    id: "manual",
    title: "Build Manually",
    status: "Working",
    description: "Start with a blank canvas and build your site.",
    output: "SecurityScene",
    review: "Optional",
    icon: Square,
    tone: "emerald",
    detail: {
      bestFor: "Starting from a blank canvas and drawing the site by hand.",
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
    id: "footage_verify",
    title: "Verify from Footage",
    status: "Preview",
    description: "Verify real camera views against your scene.",
    output: "Evidence",
    review: "Required",
    icon: Video,
    tone: "rose",
    detail: {
      bestFor: "Future/live camera footage alignment and verification.",
      steps: [
        "Connect live stream or video file",
        "Map stream to virtual camera",
        "Run comparative analysis",
        "Adjust FOV and obstruction zones",
        "Lock verified camera state",
      ],
      limitations: [
        "Currently limited to static occlusion mapping.",
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
    <div className="flex h-screen w-full bg-[#0a0a0a] text-slate-300 font-sans overflow-hidden">
      
      {/* Left Navigation Rail */}
      <div className="w-[240px] flex-none border-r border-white/5 bg-[#0a0a0a] flex flex-col justify-between py-6 px-3">
        <div className="space-y-1">
          <div className="px-3 mb-6 text-sm font-bold tracking-widest text-white/90">
            SENTINELTWIN
          </div>
          
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-sky-500/10 text-sky-400 font-medium">
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-sm">Create Site Twin</span>
          </button>
          
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors">
            <Blocks className="w-4 h-4" />
            <span className="text-sm">Workspaces</span>
          </button>
          
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors" onClick={props.onShowProjects}>
            <FolderOpen className="w-4 h-4" />
            <span className="text-sm">Projects</span>
          </button>
          
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors">
            <FileText className="w-4 h-4" />
            <span className="text-sm">Reports</span>
          </button>
          
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Issues & Actions</span>
          </button>
          
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors">
            <Camera className="w-4 h-4" />
            <span className="text-sm">Evidence</span>
          </button>
          
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors">
            <Database className="w-4 h-4" />
            <span className="text-sm">Integrations</span>
          </button>
        </div>

        <div className="px-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h4 className="text-xs font-semibold text-white mb-1">Reference Demo</h4>
            <p className="text-[10px] text-slate-400 mb-3 leading-snug">Explore a complete retail store example with 6 cameras</p>
            <button 
              onClick={props.onOpenDemo}
              className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-white transition-colors"
            >
              <PlayCircle className="w-3 h-3" /> Open Demo
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        
        {/* Top Split Area: Center Grid + Right Panel */}
        <div className="flex-1 flex min-h-0">
          
          {/* Center Column: Header + Source Grid */}
          <div className="flex-1 px-10 py-12 flex flex-col">
            <div className="max-w-[700px]">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Create Site Twin</h1>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Turn a physical site into a trusted, editable SecurityScene. <br/>Choose how you want to start.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4 max-w-[700px]">
              {cards.map(card => {
                const isSelected = selectedSourceId === card.id;
                const Icon = card.icon;
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelectedSourceId(card.id)}
                    className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group ${
                      isSelected 
                        ? `${toneClasses[card.tone].border} ${toneClasses[card.tone].bg} ${toneClasses[card.tone].glow}`
                        : "border-white/10 bg-[#0e0e0e] hover:border-white/20 hover:bg-[#141414]"
                    }`}
                  >
                    {isSelected && card.recommended && (
                      <div className="absolute top-4 right-4 text-sky-400">
                        <CheckCircle2 className="w-5 h-5 fill-sky-950" />
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${isSelected ? toneClasses[card.tone].bg : "bg-white/5"}`}>
                        <Icon className={`w-5 h-5 ${isSelected ? toneClasses[card.tone].text : "text-slate-400"}`} />
                      </div>
                      <div>
                        <h3 className={`font-semibold text-sm ${isSelected ? "text-white" : "text-slate-200"}`}>{card.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${
                            card.status === "Working" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                          }`}>
                            {card.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{card.description}</p>
                    
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500"><span className="text-slate-300">Output:</span> {card.output}</div>
                      <div className="text-[10px] text-slate-500"><span className="text-slate-300">Review:</span> {card.review}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Column: Detail Panel */}
          <div className="w-[360px] flex-none border-l border-white/5 bg-[#0a0a0a] p-8 overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <selected.icon className={`w-6 h-6 ${tClasses.text}`} />
              <div>
                <h2 className="text-lg font-semibold text-white">{selected.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    {selected.recommended ? "Manual-assisted · " : ""}{selected.status}
                  </span>
                  {selected.recommended && (
                    <span className="text-[9px] uppercase tracking-wider bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded">
                      Recommended
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              {selected.description} {selected.id === "scan" && "You'll mark key elements in photos and compile them into a trusted SecurityScene."}
            </p>

            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-2">Best for</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{selected.detail.bestFor}</p>
              </div>
              
              <div>
                <h4 className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-2">Output</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{selected.output}</p>
              </div>

              <div>
                <h4 className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-3">What you'll do</h4>
                <ol className="space-y-2">
                  {selected.detail.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-xs text-slate-400">
                      <span className="w-4 h-4 rounded-full border border-white/10 flex items-center justify-center text-[9px] flex-none mt-0.5 text-slate-500">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div>
                  <h4 className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-1">Review level</h4>
                  <p className="text-xs text-slate-300">{selected.review}</p>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-1">Average time</h4>
                  <p className="text-xs text-slate-300">{selected.detail.timeEstimate}</p>
                </div>
                <div className="col-span-2">
                  <h4 className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-1">Confidence</h4>
                  <p className="text-xs text-slate-300">{selected.detail.confidence}</p>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-2">Limitations</h4>
                <ul className="space-y-1.5">
                  {selected.detail.limitations.map((lim, i) => (
                    <li key={i} className="flex gap-2 text-xs text-amber-500/70">
                      <span className="flex-none mt-0.5">—</span>
                      <span className="leading-relaxed">{lim}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5">
              <button 
                onClick={() => {
                  const action = props[selected.onClickAction] as (() => void) | undefined;
                  if (action) action();
                }}
                className={`w-full py-3 px-4 rounded-xl text-sm font-medium text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 ${tClasses.bg} ${tClasses.border} border bg-opacity-100 hover:brightness-110`}
                style={{ backgroundColor: `var(--${selected.tone}-600)` }}
              >
                {selected.detail.ctaLabel}
              </button>
              <p className="text-center mt-3 text-[10px] text-slate-500">Your data is secure and never shared.</p>
            </div>
          </div>
        </div>

        {/* Bottom Area: Recent Site Twins */}
        <div className="flex-none border-t border-white/5 p-8 bg-[#0a0a0a]">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Site Twins</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {props.recentSites.slice(0, 4).map((site) => (
              <button key={site.id} className="flex-none w-[260px] text-left p-4 rounded-xl border border-white/10 bg-[#0e0e0e] hover:border-white/20 transition-colors group">
                <div className="flex justify-between items-start mb-6">
                  <h4 className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{site.name}</h4>
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    site.riskLabel === "Low Risk" ? "bg-emerald-500/10 text-emerald-400" :
                    site.riskLabel === "Medium Risk" ? "bg-amber-500/10 text-amber-400" :
                    "bg-rose-500/10 text-rose-400"
                  }`}>
                    {site.riskLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] text-slate-500">{site.updatedLabel}</span>
                </div>
              </button>
            ))}
            
            <button className="flex-none w-[260px] p-4 rounded-xl border border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-slate-200">
              <FileUp className="w-5 h-5" />
              <span className="text-xs font-medium">Quick Import</span>
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
