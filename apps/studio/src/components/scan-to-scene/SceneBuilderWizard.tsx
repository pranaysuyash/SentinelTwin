"use client";

import { ArrowLeft, ArrowRight, Check, ImageUp, Loader2, Plus, RotateCcw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  loadImageToData,
  extractFloorPlan,
  createSceneFromFloorPlan,
  recalibrateFloorPlanResult,
  type FloorPlanResult,
  type FloorPlanSemanticContext,
  type FloorPlanGateDecision,
  validateFloorPlan,
  deriveFloorPlanSemanticContext,
  evaluateFloorPlanTierGate,
  getFloorPlanTierGateWarning,
} from "@/lib/floor-plan-import";
import { SCENE_TEMPLATES, type SceneTemplate } from "@/lib/scene-templates";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import type { SecurityScene } from "@/schema/security-scene";
import { ImportReview } from "./ImportReview";
import {
  getFloorPlanExtractionConfig,
  type FloorPlanSourceProfile,
  getFloorPlanSourceProfileHint,
  listFloorPlanSourceProfiles,
} from "./floor-plan-extraction-config";

type ImportMethod = "blank" | "template" | "floor_plan";

interface WizardState {
  step: number;
  roomName: string;
  widthM: number;
  depthM: number;
  heightM: number;
  floorPlanScalePixelsPerMeter: number;
  importMethod: ImportMethod | null;
  selectedTemplate: SceneTemplate | null;
  floorPlanResult: FloorPlanResult | null;
  floorPlanSemanticContext: FloorPlanSemanticContext | null;
  floorPlanGateDecision: FloorPlanGateDecision | null;
  floorPlanFile: File | null;
  isProcessing: boolean;
  importWarnings: string[];
  floorPlanSourceProfile: FloorPlanSourceProfile;
}

const initialState: WizardState = {
  step: 0,
  roomName: "",
  widthM: 10,
  depthM: 8,
  heightM: 3,
  floorPlanScalePixelsPerMeter: 50,
  importMethod: null,
  selectedTemplate: null,
  floorPlanResult: null,
  floorPlanSemanticContext: null,
  floorPlanGateDecision: null,
  floorPlanFile: null,
  isProcessing: false,
  importWarnings: [],
  floorPlanSourceProfile: "architectural",
};

interface SceneBuilderWizardProps {
  onClose?: () => void;
  onBuild?: (scene: SecurityScene) => void;
  forceImportMethod?: ImportMethod | null;
}

export function SceneBuilderWizard({ onClose, onBuild, forceImportMethod = null }: SceneBuilderWizardProps) {
  const seededState = useMemo<WizardState>(() => {
    if (forceImportMethod === "floor_plan") {
      return {
        ...initialState,
        importMethod: "floor_plan",
        step: 2,
      };
    }
    return initialState;
  }, [forceImportMethod]);
  const [state, setState] = useState<WizardState>(seededState);
  const roomHeightM = state.heightM;
  const floorPlanScalePixelsPerMeter = state.floorPlanScalePixelsPerMeter;

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const goTo = useCallback((step: number) => {
    update({ step });
  }, [update]);

  const canAdvance = useMemo(() => {
    switch (state.step) {
      case 0: return state.roomName.trim().length > 0;
      case 1: return state.importMethod !== null;
      case 2:
        if (state.importMethod === "blank") return true;
        if (state.importMethod === "template") return state.selectedTemplate !== null;
        if (state.importMethod === "floor_plan") {
          return state.roomName.trim().length > 0 && state.floorPlanResult !== null && state.floorPlanGateDecision?.action !== "rescan_required";
        }
        return false;
      case 3: return true; // Review always ready
      default: return true;
    }
  }, [state.step, state.roomName, state.importMethod, state.selectedTemplate, state.floorPlanResult, state.floorPlanGateDecision]);

  const handleTemplateSelect = useCallback((template: SceneTemplate) => {
    update({
      selectedTemplate: template,
      roomName: template.name,
      widthM: template.suggestedDimensions.widthM,
      depthM: template.suggestedDimensions.depthM,
      heightM: template.suggestedDimensions.heightM,
    });
  }, [update]);

  const handleFileUpload = useCallback(async (file: File) => {
    update({ isProcessing: true, floorPlanFile: file });
    try {
      const imageData = await loadImageToData(file);
      const result = await extractFloorPlan(imageData, getFloorPlanExtractionConfig({
        heightM: roomHeightM,
        floorPlanScalePixelsPerMeter,
        sourceProfile: state.floorPlanSourceProfile,
      }));
      const sourceHint = getFloorPlanSourceProfileHint(state.floorPlanSourceProfile);
      const validation = validateFloorPlan(result);
      const semanticContext = deriveFloorPlanSemanticContext(result, validation.diagnostics);
      const gateDecision = evaluateFloorPlanTierGate(semanticContext);
      const gateWarning = getFloorPlanTierGateWarning(gateDecision);
      const seededName = state.roomName.trim().length > 0 ? state.roomName : deriveSceneNameFromFile(file.name);
      update({
        floorPlanResult: {
          ...result,
          sourceProfile: state.floorPlanSourceProfile,
          sourceHint,
        },
        floorPlanSemanticContext: semanticContext,
        floorPlanGateDecision: gateDecision,
        importWarnings: gateWarning ? [...validation.warnings, gateWarning] : validation.warnings,
        roomName: seededName,
        widthM: result.roomDimensions.widthM,
        depthM: result.roomDimensions.depthM,
        heightM: result.roomDimensions.heightM,
        isProcessing: false,
      });
    } catch (err) {
      update({
        isProcessing: false,
        floorPlanResult: null,
        floorPlanSemanticContext: null,
        floorPlanGateDecision: null,
        importWarnings: [`Failed to process image: ${err instanceof Error ? err.message : "Unknown error"}`],
      });
    }
  }, [floorPlanScalePixelsPerMeter, roomHeightM, state.floorPlanSourceProfile, state.roomName, update]);

  const handleCreate = useCallback(() => {
    let scene;
    if (state.importMethod === "template" && state.selectedTemplate) {
      scene = state.selectedTemplate.create({
        widthM: state.widthM,
        depthM: state.depthM,
        heightM: state.heightM,
      });
    } else if (state.importMethod === "floor_plan" && state.floorPlanResult) {
      scene = createSceneFromFloorPlan(state.roomName, state.floorPlanResult);
    } else {
      // Blank
      scene = createBlankSecurityScene();
      scene.name = state.roomName;
      scene.dimensions = { width: state.widthM, depth: state.depthM, height: state.heightM };
      scene.assumptions.wallHeightM = state.heightM;
      scene.walls = [
        {
          id: "wall_s",
          nodeType: "wall",
          label: "South Wall",
          start: [0, 0],
          end: [state.widthM, 0],
          heightM: state.heightM,
          thicknessM: 0.18,
          material: "solid",
          visionTransmission: 0,
          source: "manual",
          reviewStatus: "unreviewed",
          sourceTrace: "",
          geometryValidity: "valid",
        },
        {
          id: "wall_n",
          nodeType: "wall",
          label: "North Wall",
          start: [0, state.depthM],
          end: [state.widthM, state.depthM],
          heightM: state.heightM,
          thicknessM: 0.18,
          material: "solid",
          visionTransmission: 0,
          source: "manual",
          reviewStatus: "unreviewed",
          sourceTrace: "",
          geometryValidity: "valid",
        },
        {
          id: "wall_e",
          nodeType: "wall",
          label: "East Wall",
          start: [state.widthM, 0],
          end: [state.widthM, state.depthM],
          heightM: state.heightM,
          thicknessM: 0.18,
          material: "solid",
          visionTransmission: 0,
          source: "manual",
          reviewStatus: "unreviewed",
          sourceTrace: "",
          geometryValidity: "valid",
        },
        {
          id: "wall_w",
          nodeType: "wall",
          label: "West Wall",
          start: [0, 0],
          end: [0, state.depthM],
          heightM: state.heightM,
          thicknessM: 0.18,
          material: "solid",
          visionTransmission: 0,
          source: "manual",
          reviewStatus: "unreviewed",
          sourceTrace: "",
          geometryValidity: "valid",
        },
      ];
      scene.source = "manual";
    }

    if (scene) {
      onBuild?.(scene);
      onClose?.();
    }
  }, [onBuild, onClose]);

  const handleReset = useCallback(() => {
    setState(seededState);
  }, [seededState]);

  const isFloorPlan = state.importMethod === "floor_plan";
  const floorPlanStepLabels = ["Room Setup", "Method", "Floor-Plan Review", "Review"];
  const defaultStepLabels = ["Room Setup", "Method", "Configure", "Review"];
  const stepLabels = isFloorPlan ? floorPlanStepLabels : defaultStepLabels;
  const isFinalReview = state.step === 3;
  const nextActionLabel = state.step === 2
    ? isFloorPlan
      ? "Next: Review"
      : "Next"
    : "Next";
  const primaryActionLabel = isFinalReview
    ? isFloorPlan
      ? "Create Draft Scene"
      : "Create Scene"
    : "Create Scene";
  const backActionLabel = state.step === 0
    ? "Cancel"
    : state.step === 1
      ? "Back to Room Name"
    : state.step === 2
      ? isFloorPlan
        ? "Back to Floor-Plan Setup"
        : "Back to Method"
      : "Back to Floor-Plan Review";
  const navigationHint =
    state.step === 2
      ? isFloorPlan
        ? "This is the floor-plan review lane. Use this step for cleanup, calibration, and calibration locking. After it looks credible, click Next: Review."
        : "Configure method-specific options, then click Next."
      : state.step === 3
        ? isFloorPlan
          ? "You are in final review. Confirm summary items, then click Create Draft Scene."
          : "Review step: confirm the final summary, then use Create Scene."
        : "";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0b0f17]">
        {/* Step indicators */}
      <div className="flex items-center justify-between border-b border-[#1e2130] px-4 py-3">
        <div className="flex items-center gap-2">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium ${
                  i < state.step
                    ? "bg-emerald-500 text-white"
                    : i === state.step
                      ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40"
                      : "bg-[#1a2030] text-[#59637a]"
                }`}
              >
                {i < state.step ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </div>
              <span
                className={`text-[11px] ${
                  i === state.step ? "font-medium text-[#c5ccdb]" : "text-[#59637a]"
                }`}
              >
                {label}
              </span>
              {i < 3 && <div className="mx-1 h-px w-4 bg-[#1e2130]" />}
            </div>
          ))}
        </div>
        <button type="button"
          onClick={handleReset}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[#59637a] hover:text-white"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>
      {navigationHint ? <div className="border-b border-[#121a29] px-4 py-2 text-[9px] text-[#667390]">{navigationHint}</div> : null}

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-4">
        {state.step === 0 && <RoomSetupStep value={state} onChange={update} />}
        {state.step === 1 && <MethodStep value={state} onChange={update} onTemplateSelect={handleTemplateSelect} />}
      {state.step === 2 && (
          <ConfigureStep
            value={state}
            onChange={update}
            onFileUpload={handleFileUpload}
          />
        )}
        {state.step === 3 && <ReviewStep value={state} onChange={update} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-[#1e2130] px-4 py-3">
        <button type="button"
          onClick={() => state.step > 0 ? goTo(state.step - 1) : onClose?.()}
          className="flex items-center gap-1 rounded-lg border border-[#1e2130] px-3 py-2 text-[11px] text-[#68738a] transition-colors hover:border-[#2a3045] hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          {backActionLabel}
        </button>

        {state.step < 3 ? (
          <button type="button"
            onClick={() => goTo(state.step + 1)}
            disabled={!canAdvance}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-[11px] font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
          >
            {nextActionLabel}
            <ArrowRight className="h-3 w-3" />
          </button>
        ) : (
          <button type="button"
            onClick={handleCreate}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-medium text-white transition-colors hover:bg-emerald-500"
          >
            <Plus className="h-3 w-3" /> {primaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Step Components ──

function RoomSetupStep({
  value,
  onChange,
}: {
  value: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[12px] font-medium text-[#c5ccdb]">Room Name</h3>
        <p className="mt-0.5 text-[9px] text-[#59637a]">Give your scene a descriptive name</p>
        <input
          type="text"
          value={value.roomName}
          onChange={(e) => onChange({ roomName: e.target.value })}
          placeholder="e.g., Main Retail Floor"
          className="mt-2 w-full rounded-lg border border-[#1e2130] bg-[#070a12] px-3 py-2 text-[12px] text-[#c5ccdb] outline-none placeholder:text-[#3a4158] focus:border-blue-500/40"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[9px] font-medium text-[#68738a]">Width (m)</label>
          <input
            type="number"
            min={1}
            max={100}
            value={value.widthM}
            onChange={(e) => onChange({ widthM: Math.max(1, Number(e.target.value)) })}
            className="mt-1 w-full rounded-lg border border-[#1e2130] bg-[#070a12] px-2 py-1.5 text-[12px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
          />
        </div>
        <div>
          <label className="text-[9px] font-medium text-[#68738a]">Depth (m)</label>
          <input
            type="number"
            min={1}
            max={100}
            value={value.depthM}
            onChange={(e) => onChange({ depthM: Math.max(1, Number(e.target.value)) })}
            className="mt-1 w-full rounded-lg border border-[#1e2130] bg-[#070a12] px-2 py-1.5 text-[12px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
          />
        </div>
        <div>
          <label className="text-[9px] font-medium text-[#68738a]">Height (m)</label>
          <input
            type="number"
            min={2.5}
            max={20}
            step={0.1}
            value={value.heightM}
            onChange={(e) => onChange({ heightM: Math.max(2.5, Number(e.target.value)) })}
            className="mt-1 w-full rounded-lg border border-[#1e2130] bg-[#070a12] px-2 py-1.5 text-[12px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
          />
        </div>
      </div>
    </div>
  );
}

function MethodStep({
  value,
  onChange,
  onTemplateSelect,
}: {
  value: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onTemplateSelect: (template: SceneTemplate) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[12px] font-medium text-[#c5ccdb]">Choose Import Method</h3>
        <p className="mt-0.5 text-[9px] text-[#59637a]">How would you like to create your scene?</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { id: "blank" as const, label: "Blank Canvas", desc: "Start from empty room", icon: "⬜", color: "border-[#1e2130]" },
          { id: "template" as const, label: "Use Template", desc: "Pre-configured spaces", icon: "📐", color: "border-blue-500/40" },
          { id: "floor_plan" as const, label: "Import Floor Plan", desc: "Upload image to detect walls", icon: "📄", color: "border-emerald-500/40" },
        ].map((method) => (
          <button type="button"
            key={method.id}
            onClick={() => onChange({ importMethod: method.id, selectedTemplate: method.id === "template" ? value.selectedTemplate : null })}
            className={`rounded-xl border-2 p-4 text-left transition-[border-color,background-color] ${
              value.importMethod === method.id
                ? `${method.color} bg-${method.id === "floor_plan" ? "emerald" : "blue"}-500/5`
                : "border-[#1a2030] bg-[#070a12] hover:border-[#2a3045]"
            }`}
          >
            <div className="text-xl">{method.icon}</div>
            <div className="mt-2 text-[11px] font-medium text-[#c5ccdb]">{method.label}</div>
            <div className="mt-0.5 text-[9px] text-[#59637a]">{method.desc}</div>
          </button>
        ))}
      </div>

      {value.importMethod === "template" && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-medium text-[#8090a8]">Templates</h4>
          <div className="grid grid-cols-2 gap-2">
            {SCENE_TEMPLATES.map((t) => (
              <button type="button"
                key={t.id}
                onClick={() => onTemplateSelect(t)}
                className={`rounded-lg border p-2.5 text-left transition-colors ${
                  value.selectedTemplate?.id === t.id
                    ? "border-blue-500/40 bg-blue-500/10"
                    : "border-[#1e2130] bg-[#070a12] hover:border-[#2a3045]"
                }`}
              >
                <div className="text-[10px] font-medium text-[#c5ccdb]">{t.name}</div>
                <div className="mt-0.5 text-[8px] text-[#59637a]">{t.description}</div>
                <div className="mt-1 flex gap-2 text-[7px] text-[#3a4158]">
                  <span>{t.suggestedDimensions.widthM}×{t.suggestedDimensions.depthM}</span>
                  <span>{t.suggestedCameras} cameras</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigureStep({
  value,
  onChange,
  onFileUpload,
}: {
  value: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onFileUpload: (file: File) => void;
}) {
  if (value.importMethod === "blank") {
    return (
      <div className="space-y-4">
        <h3 className="text-[12px] font-medium text-[#c5ccdb]">Configure Blank Scene</h3>
        <p className="text-[9px] text-[#59637a]">
          A blank scene will be created with the dimensions you specified. No cameras, obstructions, or zones will be added.
        </p>
        <p className="text-[9px] text-[#59637a]">
          You can add these later using the editor tools.
        </p>
      </div>
    );
  }

  if (value.importMethod === "template" && value.selectedTemplate) {
    return (
      <div className="space-y-4">
        <h3 className="text-[12px] font-medium text-[#c5ccdb]">Configure Template</h3>
        <p className="text-[9px] text-[#59637a]">
          The <strong className="text-[#8090a8]">{value.selectedTemplate.name}</strong> template will be created with
          pre-configured cameras, obstructions, and zones. You can customize dimensions below.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[9px] font-medium text-[#68738a]">Width (m)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={value.widthM}
              onChange={(e) => onChange({ widthM: Math.max(1, Number(e.target.value)) })}
              className="mt-1 w-full rounded-lg border border-[#1e2130] bg-[#070a12] px-2 py-1.5 text-[12px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
            />
          </div>
          <div>
            <label className="text-[9px] font-medium text-[#68738a]">Depth (m)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={value.depthM}
              onChange={(e) => onChange({ depthM: Math.max(1, Number(e.target.value)) })}
              className="mt-1 w-full rounded-lg border border-[#1e2130] bg-[#070a12] px-2 py-1.5 text-[12px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
            />
          </div>
          <div>
            <label className="text-[9px] font-medium text-[#68738a]">Height (m)</label>
            <input
              type="number"
              min={2.5}
              max={20}
              step={0.1}
              value={value.heightM}
              onChange={(e) => onChange({ heightM: Math.max(2.5, Number(e.target.value)) })}
              className="mt-1 w-full rounded-lg border border-[#1e2130] bg-[#070a12] px-2 py-1.5 text-[12px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
            />
          </div>
        </div>
      </div>
    );
  }

  if (value.importMethod === "floor_plan") {
    const sourceProfiles = listFloorPlanSourceProfiles();

    return (
      <div className="space-y-4">
        <h3 className="text-[12px] font-medium text-[#c5ccdb]">Upload Floor Plan</h3>
        <p className="text-[9px] text-[#59637a]">
          Upload a floor plan image. Walls are detected automatically, then you review structure + calibration before creating.
          If counts feel inflated, treat this as "detected candidates vs kept structure" and clean before final create.
        </p>
        <div className="rounded-lg border border-[#1e2130] bg-[#070a12] p-2">
          <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#8090a8]">Plan Source Profile</div>
          <p className="mt-0.5 text-[8px] text-[#59637a]">Choose the source family once to tune detection behavior.</p>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {sourceProfiles.map((entry) => {
              const isActive = value.floorPlanSourceProfile === entry.profile;
              return (
                <button
                  type="button"
                  key={entry.profile}
                  className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${
                    isActive
                      ? "border-emerald-500/40 bg-emerald-500/10 text-[#dbe7f8]"
                      : "border-[#1e2130] bg-[#0a0f18] text-[#8ea5c6] hover:border-[#2a3045]"
                  }`}
                  onClick={() => {
                    onChange({
                      floorPlanSourceProfile: entry.profile,
                      floorPlanResult: null,
                      floorPlanFile: null,
                      floorPlanSemanticContext: null,
                      floorPlanGateDecision: null,
                      importWarnings: [],
                    });
                  }}
                >
                  <div className="text-[9px] font-medium text-[#c5ccdb]">{entry.label}</div>
                  <div className="mt-1 text-[8px] text-[#6f82a4]">{entry.hint}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-2 rounded border border-[#1f2a3e] bg-[#0a0f18] px-2 py-1.5 text-[9px] text-[#9bb0ce]">
            {getFloorPlanSourceProfileHint(value.floorPlanSourceProfile)}
          </div>
        </div>

        {value.floorPlanResult == null ? (
          <div className="rounded-lg border border-[#22314b] bg-[#0f1828] p-2 text-[9px] text-[#9bb0ce]">
            You are in the floor-plan review lane. Complete trust checks here, then click <span className="font-semibold text-[#cdd9ee]">Next: Review</span> when ready for final summary.
          </div>
        ) : null}

        {value.floorPlanResult ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-[#1e2130] bg-[#070a12] p-3">
              <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#8090a8]">How this review works</div>
              <div className="mt-2 grid gap-2 text-[9px] text-[#9bb0ce] md:grid-cols-3">
                <div className="rounded border border-[#1f2a3e] bg-[#0a0f18] px-2 py-1.5">1. Check the zoomed draft shell and remove obvious false positives.</div>
                <div className="rounded border border-[#1f2a3e] bg-[#0a0f18] px-2 py-1.5">2. Apply known plan dimensions if the detector guessed the footprint incorrectly.</div>
                <div className="rounded border border-[#1f2a3e] bg-[#0a0f18] px-2 py-1.5">3. Continue only when the shell looks credible enough to become a draft scene.</div>
              </div>
            </div>
            <ImportReview
              key={`${value.floorPlanResult.imageWidth}x${value.floorPlanResult.imageHeight}-${value.floorPlanResult.walls.length}-${value.floorPlanResult.doors.length}-${value.floorPlanResult.windows.length}-${value.floorPlanResult.confidence.toFixed(3)}`}
              result={value.floorPlanResult}
              semanticContext={value.floorPlanSemanticContext}
              gateDecision={value.floorPlanGateDecision}
              warnings={value.importWarnings}
              onImageChange={() => onChange({
                floorPlanResult: null,
                floorPlanFile: null,
                floorPlanSemanticContext: null,
                floorPlanGateDecision: null,
                importWarnings: [],
              })}
              onRecalibrate={(calibration) => {
                const recalibrated = recalibrateFloorPlanResult(value.floorPlanResult!, calibration);
                const validation = validateFloorPlan(recalibrated);
                const semanticContext = deriveFloorPlanSemanticContext(recalibrated, validation.diagnostics);
                const gateDecision = evaluateFloorPlanTierGate(semanticContext);
                const gateWarning = getFloorPlanTierGateWarning(gateDecision);
                onChange({
                  floorPlanResult: recalibrated,
                  floorPlanSemanticContext: semanticContext,
                  floorPlanGateDecision: gateDecision,
                  importWarnings: gateWarning ? [...validation.warnings, gateWarning] : validation.warnings,
                  widthM: recalibrated.roomDimensions.widthM,
                  depthM: recalibrated.roomDimensions.depthM,
                  heightM: recalibrated.roomDimensions.heightM,
                });
              }}
              onUpdateResult={(nextResult) => {
                const validation = validateFloorPlan(nextResult);
                const semanticContext = deriveFloorPlanSemanticContext(nextResult, validation.diagnostics);
                const gateDecision = evaluateFloorPlanTierGate(semanticContext);
                const gateWarning = getFloorPlanTierGateWarning(gateDecision);
                onChange({
                  floorPlanResult: nextResult,
                  floorPlanSemanticContext: semanticContext,
                  floorPlanGateDecision: gateDecision,
                  importWarnings: gateWarning ? [...validation.warnings, gateWarning] : validation.warnings,
                  widthM: nextResult.roomDimensions.widthM,
                  depthM: nextResult.roomDimensions.depthM,
                  heightM: nextResult.roomDimensions.heightM,
                });
              }}
              sourceProfile={value.floorPlanSourceProfile}
              sourceHint={getFloorPlanSourceProfileHint(value.floorPlanSourceProfile)}
            />
          </div>
        ) : (
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#1e2130] bg-[#070a12] p-8 transition-colors hover:border-[#2a3045] active:scale-[0.97]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file && file.type.startsWith("image/")) {
                onFileUpload(file);
              }
            }}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) onFileUpload(file);
              };
              input.click();
            }}
          >
            {value.isProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                <span className="text-[10px] text-[#59637a]">Processing image...</span>
              </div>
            ) : (
              <>
                <ImageUp className="h-8 w-8 text-[#3a4158]" />
                <span className="mt-2 text-[11px] font-medium text-[#68738a]">Drop floor plan image or click to upload</span>
                <span className="mt-1 text-[8px] text-[#3a4158]">PNG, JPG, SVG</span>
              </>
            )}
          </div>
        )}

        <div className="rounded-lg border border-[#1e2130] bg-[#070a12] p-2">
          <div className="text-[9px] font-medium text-[#c5ccdb]">Scene Metadata</div>
          <p className="mt-0.5 text-[8px] text-[#59637a]">
            Name the imported scene here. Detected or calibrated dimensions sync into the final review automatically.
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <label className="text-[8px] text-[#59637a]">
              Scene Name
              <input
                type="text"
                value={value.roomName}
                onChange={(e) => onChange({ roomName: e.target.value })}
                placeholder="e.g., East Wing Floor Plan"
                className="mt-0.5 w-full rounded border border-[#1e2130] bg-[#0a0f18] px-1.5 py-1 text-[9px] text-[#c5ccdb] outline-none placeholder:text-[#3a4158] focus:border-blue-500/40"
              />
            </label>
            <div className="rounded border border-[#1e2130] bg-[#0a0f18] px-2 py-1.5 text-[8px] text-[#8090a8]">
              <div className="uppercase tracking-[0.14em] text-[#59637a]">Current Footprint</div>
              <div className="mt-1 text-[10px] font-medium text-[#c5ccdb]">
                {value.widthM}m × {value.depthM}m × {value.heightM}m
              </div>
              <div className="mt-0.5 text-[#59637a]">
                {value.floorPlanResult?.manualCalibration
                  ? "Manual calibration is active."
                  : "Using detector-derived footprint."}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#1e2130] bg-[#070a12] p-2">
          <span className="text-[8px] font-medium uppercase tracking-wider text-[#59637a]">Scale</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={200}
              value={value.floorPlanScalePixelsPerMeter}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isNaN(next)) return;
                onChange({ floorPlanScalePixelsPerMeter: Math.max(10, Math.min(200, next)) });
              }}
              className="w-20 rounded border border-[#1e2130] bg-[#0b0f17] px-2 py-1 text-[10px] text-[#c5ccdb] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
            />
            <span className="text-[8px] text-[#59637a]">pixels/meter</span>
          </div>
        </div>

        {value.floorPlanGateDecision ? (
          <div className={`rounded-lg border px-2 py-1.5 text-[8px] ${
            value.floorPlanGateDecision.action === "rescan_required"
              ? "border-red-500/25 bg-red-500/10 text-red-100"
              : value.floorPlanGateDecision.action === "human_review"
                ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
                : value.floorPlanGateDecision.action === "cloud_geometry_required"
                  ? "border-blue-500/25 bg-blue-500/10 text-blue-100"
                  : "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
          }`}>
            <div className="text-[8px] font-medium uppercase tracking-wider">Tier 1 Gate</div>
            <div className="mt-1">
              {formatGateAction(value.floorPlanGateDecision.action)} — {value.floorPlanGateDecision.reason}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

function ReviewStep({
  value,
  onChange,
}: {
  value: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const reviewDimensions = value.floorPlanResult?.roomDimensions ?? {
    widthM: value.widthM,
    depthM: value.depthM,
    heightM: value.heightM,
  };
  const rawWallCandidateCount = value.floorPlanResult?.rawWallSegmentCount ?? value.floorPlanResult?.walls.length ?? 0;
  const keptWallCount = value.floorPlanResult?.walls.length ?? 0;
  const summary = useMemo(() => {
    const lines: { label: string; value: string }[] = [
      { label: "Name", value: value.roomName || "Untitled Scene" },
      { label: "Dimensions", value: `${reviewDimensions.widthM}m × ${reviewDimensions.depthM}m × ${reviewDimensions.heightM}m` },
      { label: "Method", value: value.importMethod === "blank" ? "Blank Canvas" : value.importMethod === "template" ? `Template: ${value.selectedTemplate?.name ?? "None"}` : "Floor Plan Import" },
    ];

      if (value.selectedTemplate) {
        lines.push({ label: "Cameras", value: `${value.selectedTemplate.suggestedCameras} (pre-configured)` });
      }

      if (value.floorPlanResult) {
      const raw = value.floorPlanResult.rawWallSegmentCount ?? value.floorPlanResult.walls.length;
      const kept = value.floorPlanResult.walls.length;
      lines.push({ label: "Detected Wall Candidates", value: `${raw} raw candidates · ${kept} kept` });
      lines.push({ label: "Confidence", value: `${(value.floorPlanResult.confidence * 100).toFixed(0)}%` });
      lines.push({ label: "Source profile", value: value.floorPlanSourceProfile });
      if (value.floorPlanGateDecision) {
        lines.push({ label: "Tier 1 Gate", value: formatGateAction(value.floorPlanGateDecision.action) });
      }
    }

    return lines;
  }, [reviewDimensions.depthM, reviewDimensions.heightM, reviewDimensions.widthM, value]);

  return (
    <div className="space-y-4">
      <h3 className="text-[12px] font-medium text-[#c5ccdb]">Review & Create</h3>
      <p className="text-[9px] text-[#59637a]">
        Review the scene configuration below. Click the action button below to create this draft.
      </p>

      <label className="block space-y-1 text-[9px] text-[#59637a]">
        Scene Name
        <input
          type="text"
          value={value.roomName}
          onChange={(event) => onChange({ roomName: event.target.value })}
          className="mt-1 w-full rounded-lg border border-[#1e2130] bg-[#070a12] px-3 py-2 text-[12px] text-[#c5ccdb] outline-none placeholder:text-[#3a4158] focus:border-blue-500/40"
          placeholder="Scene name"
        />
      </label>

      <div className="space-y-2">
        {summary.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-lg border border-[#1e2130] bg-[#070a12] px-3 py-2">
            <span className="text-[9px] text-[#59637a]">{item.label}</span>
            <span className="text-[10px] font-medium text-[#c5ccdb]">{item.value}</span>
          </div>
        ))}
      </div>

      {value.importMethod === "floor_plan" && value.floorPlanResult ? (
        <div className="rounded-lg border border-[#1e2130] bg-[#070a12] p-3">
          <div className="text-[8px] font-medium uppercase tracking-wider text-[#59637a]">Floor Plan Commit Summary</div>
          <div className="mt-1 text-[8px] text-[#8090a8]">
            This action creates a draft scene shell for Studio review. It does not imply the floor plan is production-trusted.
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-[#8090a8]">
            <div>Detection confidence: <span className="text-[#c5ccdb]">{(value.floorPlanResult.confidence * 100).toFixed(0)}%</span></div>
            <div>Tier 1 gate: <span className="text-[#c5ccdb]">{formatGateAction(value.floorPlanGateDecision?.action ?? "proceed_to_tier2")}</span></div>
            <div>Scene footprint: <span className="text-[#c5ccdb]">{reviewDimensions.widthM}m × {reviewDimensions.depthM}m × {reviewDimensions.heightM}m</span></div>
            <div>Dimension source: <span className="text-[#c5ccdb]">{value.floorPlanResult.manualCalibration ? "Manual calibration" : "Detector-derived"}</span></div>
            <div>Unresolved warnings: <span className={value.importWarnings.length > 0 ? "text-amber-300" : "text-emerald-300"}>{value.importWarnings.length}</span></div>
            <div>Scene type: <span className="text-[#c5ccdb]">{value.floorPlanSemanticContext?.sceneType ?? "unknown"}</span></div>
            <div>Tier 1 quality: <span className="text-[#c5ccdb]">{value.floorPlanSemanticContext ? `${Math.round(value.floorPlanSemanticContext.qualityScore * 100)}%` : "—"}</span></div>
            <div>Doors: <span className="text-[#c5ccdb]">{value.floorPlanResult.doors.length}</span></div>
            <div>Windows: <span className="text-[#c5ccdb]">{value.floorPlanResult.windows.length}</span></div>
            <div>Walls: <span className="text-[#c5ccdb]">{keptWallCount} kept of {rawWallCandidateCount} candidates</span></div>
            <div>Scale: <span className="text-[#c5ccdb]">{value.floorPlanResult.scalePixelsPerMeter} px/m</span></div>
          </div>
          {value.floorPlanGateDecision?.reason ? (
            <div className="mt-2 rounded border border-[#1f2a3e] bg-[#0a0f18] px-2 py-1.5 text-[8px] text-[#9bb0ce]">
              <span className="font-medium text-[#c5ccdb]">Gate reason:</span> {value.floorPlanGateDecision.reason}
            </div>
          ) : null}
          {value.importWarnings.length > 0 ? (
            <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[8px] text-amber-100">
              {value.importWarnings.slice(0, 4).map((warning, index) => (
                <div key={`${warning}_${index}`}>• {warning}</div>
              ))}
              {value.importWarnings.length > 4 ? <div>• ...and {value.importWarnings.length - 4} more warnings.</div> : null}
            </div>
          ) : (
            <div className="mt-2 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-[8px] text-emerald-200">
              No unresolved import warnings.
            </div>
          )}
        </div>
      ) : null}

      {value.floorPlanResult && value.floorPlanResult.walls.length > 0 && (
        <div className="rounded-lg border border-[#1e2130] bg-[#070a12] p-3">
          <span className="text-[8px] font-medium uppercase tracking-wider text-[#59637a]">Detected Wall Layout</span>
          <div className="mt-2 space-y-1">
            {value.floorPlanResult.walls.slice(0, 8).map((w, i) => (
              <div key={i} /* stable display list */ className="flex gap-2 text-[8px] text-[#68738a]">
                <span>Wall {i + 1}:</span>
                <span>({Math.round(w.start.x)}, {Math.round(w.start.y)}) → ({Math.round(w.end.x)}, {Math.round(w.end.y)})</span>
              </div>
            ))}
            {value.floorPlanResult.walls.length > 8 && (
              <div className="text-[7px] text-[#3a4158]">...and {value.floorPlanResult.walls.length - 8} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function deriveSceneNameFromFile(filename: string) {
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  const normalized = withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized || "Imported Floor Plan";
}

function formatGateAction(action: FloorPlanGateDecision["action"]) {
  switch (action) {
    case "rescan_required":
      return "Rescan Required";
    case "human_review":
      return "Manual Review";
    case "cloud_geometry_required":
      return "Force Cloud Geometry";
    case "proceed_to_tier2":
    default:
      return "Proceed";
  }
}
