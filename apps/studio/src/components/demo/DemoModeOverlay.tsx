"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  LayoutDashboard,
  Play,
  Route,
  Shield,
  SkipForward,
  Sparkles,
  X,
} from "lucide-react";

import { useStudioStore } from "@/store/studio-store";

const DEMO_STEPS = [
  {
    title: "Welcome to SentinelTwin",
    description:
      "This is a live security digital twin. The 3D scene shows your security layout — cameras, obstructions, lighting, and coverage zones. Everything is editable and the simulation updates in real time.",
    icon: Shield,
    highlight: "workspace",
  },
  {
    title: "View Modes",
    description:
      "Switch between Map (3D scene), Wall (camera feeds), and Replay (adversarial path playback) using the tabs at the top of the workspace.",
    icon: LayoutDashboard,
    highlight: "viewmode",
  },
  {
    title: "Coverage Analysis",
    description:
      "The colored tiles on the floor show coverage quality (blue=ID, green=REC, yellow=OBS, orange=DET). Red dashed lines show adversarial path — the most dangerous route an intruder could take.",
    icon: Eye,
    highlight: "coverage",
  },
  {
    title: "AI Command Layer",
    description:
      "Press ⌘K to open the AI Command bar. Type natural language instructions like 'Move Camera 1 toward the counter' or 'Switch to night mode'. The AI parses your intent, applies changes, and re-runs the simulation automatically.",
    icon: Sparkles,
    highlight: "command",
  },
  {
    title: "Threat Analysis & Fixes",
    description:
      "The bottom panel shows detailed metrics, issues, and timeline. The FIXES tab uses AI to propose coverage improvements. Each fix is simulation-verified before you apply it. Run Threat Analysis to see evasion routes.",
    icon: Route,
    highlight: "panel",
  },
];

export function DemoModeOverlay() {
  const demoStep = useStudioStore((s) => s.demoStep);
  const setDemoStep = useStudioStore((s) => s.setDemoStep);
  const setDemoMode = useStudioStore((s) => s.setDemoMode);

  const step = DEMO_STEPS[demoStep];
  const isFirst = demoStep === 0;
  const isLast = demoStep === DEMO_STEPS.length - 1;
  const progress = ((demoStep + 1) / DEMO_STEPS.length) * 100;

  const handleNext = () => {
    if (isLast) {
      setDemoMode(false);
      setDemoStep(0);
    } else {
      setDemoStep(demoStep + 1);
    }
  };

  const handlePrev = () => {
    if (demoStep > 0) {
      setDemoStep(demoStep - 1);
    }
  };

  const handleSkip = () => {
    setDemoMode(false);
    setDemoStep(0);
  };

  const Icon = step.icon;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      {/* Step indicator dots */}
      <div className="absolute right-6 top-6 flex items-center gap-1.5">
        {DEMO_STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setDemoStep(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === demoStep
                ? "w-5 bg-emerald-400"
                : i < demoStep
                  ? "w-1.5 bg-emerald-400/40"
                  : "w-1.5 bg-[#2a3246] hover:bg-[#3a4158]"
            }`}
          />
        ))}
        <button
          onClick={handleSkip}
          className="ml-3 flex h-6 w-6 items-center justify-center rounded-md text-[#5b667c] hover:bg-[#1a2333] hover:text-white"
          title="Skip demo"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main card */}
      <motion.div
        key={demoStep}
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="mx-4 w-full max-w-md"
      >
        <div className="rounded-2xl border border-[#1f2536] bg-[#0b0f17]/95 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          {/* Icon */}
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
            <Icon className="h-6 w-6 text-emerald-400" />
          </div>

          {/* Step label */}
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#4a5568]">
            Step {demoStep + 1} of {DEMO_STEPS.length}
          </div>

          {/* Title */}
          <h2 className="mb-2 text-[15px] font-semibold text-[#d7deed]">{step.title}</h2>

          {/* Description */}
          <p className="text-[11px] leading-relaxed text-[#8b96ab]">{step.description}</p>

          {/* Progress bar */}
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[#1a2333]">
            <motion.div
              initial={{ width: `${((demoStep) / DEMO_STEPS.length) * 100}%` }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className="h-full rounded-full bg-emerald-400"
            />
          </div>

          {/* Controls */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={handlePrev}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-3 text-[10px] font-medium text-[#9da8c0] transition-colors hover:border-[#32384d] hover:text-white"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-3 text-[10px] font-medium text-[#5b667c] transition-colors hover:border-[#32384d] hover:text-white"
              >
                <SkipForward className="h-3 w-3" />
                Skip
              </button>

              <button
                onClick={handleNext}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[10px] font-medium text-white transition-colors hover:bg-emerald-500"
              >
                {isLast ? (
                  <>
                    <Play className="h-3 w-3" />
                    Start
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
