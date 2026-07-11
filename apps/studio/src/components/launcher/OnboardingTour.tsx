"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export type TourStep = {
  targetSelector: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
};

const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: "[data-tour='launcher']",
    title: "Welcome to SentinelTwin",
    description: "This is your dashboard. From here you can create a new site twin, open a recent workspace, or explore a reference demo.",
    placement: "center",
  },
  {
    targetSelector: "[data-tour='create-scene']",
    title: "Create a Site Twin",
    description: "Start by scanning a site with photos, importing a floor plan, drafting with AI, or building manually. Each path produces a draft that you review before activation.",
    placement: "bottom",
  },
  {
    targetSelector: "[data-tour='workspace']",
    title: "The Studio Workspace",
    description: "This is your 3D editing environment. Place cameras, lights, walls, doors, windows, obstructions, sensors, and zones. Every edit updates the coverage model in real time.",
    placement: "top",
  },
  {
    targetSelector: "[data-tour='simulation']",
    title: "Run Simulation",
    description: "After editing your scene, run the simulation engine. It computes coverage heatmaps, DORI quality zones, path visibility, and security posture scores — all deterministically.",
    placement: "bottom",
  },
  {
    targetSelector: "[data-tour='report']",
    title: "Audit Reports",
    description: "Generate standards-compliant audit reports (IEC 62676-4:2025) with evidence trails, truth ladder, redundancy matrix, and audience-specific redaction policies.",
    placement: "top",
  },
  {
    targetSelector: "[data-tour='compare']",
    title: "Compare Scenarios",
    description: "Compare before/after snapshots side-by-side. See coverage deltas, zone changes, quality trends, and object-level diffs. Export as HTML, Markdown, or share a compare link.",
    placement: "top",
  },
];

const STORAGE_KEY = "sentineltwin.tour.dismissed.v1";

function isTourDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function dismissTour(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {}
}

export function useOnboardingTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    dismissTour();
  }, []);

  const next = useCallback(() => {
    setStepIndex((prev) => Math.min(prev + 1, TOUR_STEPS.length - 1));
  }, []);

  const prev = useCallback(() => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const currentStep = TOUR_STEPS[stepIndex] ?? null;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return { active, stepIndex, currentStep, isFirst, isLast, start, stop, next, prev };
}

export function OnboardingTourOverlay({
  active,
  currentStep,
  stepIndex,
  isFirst,
  isLast,
  onNext,
  onPrev,
  onClose,
}: {
  active: boolean;
  currentStep: TourStep | null;
  stepIndex: number;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  if (!active || !currentStep) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative max-w-md rounded-2xl border UI_SURFACES.borderDark UI_SURFACES.panel p-6 shadow-2xl`}
        style={{ animation: "tourFadeIn 0.2s ease-out" }}
      >
        <button
          type="button"
          onClick={onClose}
          className={`absolute right-3 top-3 rounded-lg p-1 UI_SURFACES.textSoftMid hover:bg-white/8 hover:text-white transition-colors`}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-[11px] font-bold text-sky-400">
            {stepIndex + 1}
          </div>
          <div className="text-[13px] font-medium text-white">{currentStep.title}</div>
        </div>

        <p className="text-[13px] leading-6 UI_SURFACES.textNearAlt">{currentStep.description}</p>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex ? "w-4 bg-sky-400" : "w-1.5 UI_SURFACES.borderDark"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={onPrev}
                className={`flex items-center gap-1 rounded-lg border UI_SURFACES.borderDark px-3 py-1.5 text-[11px] UI_SURFACES.textNearAlt hover:bg-white/8 transition-colors`}
              >
                <ChevronLeft className="h-3 w-3" />
                Back
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-sky-400 transition-colors"
              >
                <Check className="h-3 w-3" />
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={onNext}
                className="flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-sky-400 transition-colors"
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TourLauncherButton({ onClick }: { onClick: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isTourDismissed()) {
      const timer = setTimeout(() => setShow(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-40 animate-bounce"
      data-tour="tour-launcher"
    >
      <button
        type="button"
        onClick={() => {
          setShow(false);
          onClick();
        }}
        className="flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg hover:bg-sky-400 transition-all"
      >
        Take a tour
      </button>
    </div>
  );
}
