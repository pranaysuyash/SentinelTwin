"use client";

import { ArrowLeft, ArrowRight, Check, ImageUp, Loader2, Plus, RotateCcw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useStudioStore } from "@/store/studio-store";
import {
  loadImageToData,
  extractFloorPlan,
  createSceneFromFloorPlan,
  recalibrateFloorPlanResult,
  type FloorPlanResult,
  validateFloorPlan,
} from "@/lib/floor-plan-import";
import { SCENE_TEMPLATES, type SceneTemplate } from "@/lib/scene-templates";
import { suggestCameraPlacements } from "@/lib/camera-suggestions";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { ImportReview } from "./ImportReview";
import { getFloorPlanExtractionConfig } from "./floor-plan-extraction-config";

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
  floorPlanFile: File | null;
  isProcessing: boolean;
  importWarnings: string[];
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
  floorPlanFile: null,
  isProcessing: false,
  importWarnings: [],
};

interface SceneBuilderWizardProps {
  onClose?: () => void;
  forceImportMethod?: ImportMethod | null;
}

export function SceneBuilderWizard({ onClose, forceImportMethod = null }: SceneBuilderWizardProps) {
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
  const setScene = useStudioStore((s) => s.setScene);
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
        if (state.importMethod === "floor_plan") return state.floorPlanResult !== null;
        return false;
      case 3: return true; // Review always ready
      default: return true;
    }
  }, [state.step, state.roomName, state.importMethod, state.selectedTemplate, state.floorPlanResult]);

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
      }));
      const { warnings } = validateFloorPlan(result);
      update({
        floorPlanResult: result,
        importWarnings: warnings,
        isProcessing: false,
      });
    } catch (err) {
      update({
        isProcessing: false,
        importWarnings: [`Failed to process image: ${err instanceof Error ? err.message : "Unknown error"}`],
      });
    }
  }, [floorPlanScalePixelsPerMeter, roomHeightM, update]);

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
      // Add suggested cameras at entry points so the user isn't dropped into a bare scene
      const suggestions = suggestCameraPlacements(scene);
      if (suggestions.length > 0) {
        scene.cameras = suggestions;
      }
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
        },
      ];
      scene.source = "manual";
    }

    if (scene) {
      setScene(scene);
      // Capture scene source before onClose may reset state
      const sceneSource = scene.source;
      // Auto-run simulation so the user sees coverage immediately
      setTimeout(() => {
        const store = useStudioStore.getState();
        store.runSimulation();
      }, 100);
      onClose?.();
      // Guide the user on what to do next
      setTimeout(() => {
        const store = useStudioStore.getState();
        const suggestedCameras = store.scene.cameras.filter((c) => c.tags?.includes("suggested")).length;
        if (suggestedCameras > 0) {
          store.setLaunchNotice(
            `Imported with ${suggestedCameras} suggested camera${suggestedCameras > 1 ? "s" : ""} at entry points. Adjust or confirm them, then add more cameras and critical zones.`
          );
        } else if (sceneSource === "manual") {
          store.setLaunchNotice("Blank scene created. Add walls, doors, and cameras to get started.");
        } else {
          store.setLaunchNotice("Scene created. Add cameras and critical zones to see coverage.");
        }
      }, 200);
    }
  }, [state, setScene, onClose]);

  const handleReset = useCallback(() => {
    setState(seededState);
  }, [seededState]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0b0f17]">
      {/* Step indicators */}
      <div className="flex items-center justify-between border-b border-[#1e2130] px-4 py-2">
        <div className="flex items-center gap-2">
          {["Room Setup", "Method", "Configure", "Review"].map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-medium ${
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
                className={`text-[10px] ${
                  i === state.step ? "font-medium text-[#c5ccdb]" : "text-[#59637a]"
                }`}
              >
                {label}
              </span>
              {i < 3 && <div className="mx-1 h-px w-4 bg-[#1e2130]" />}
            </div>
          ))}
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 rounded px-2 py-1 text-[9px] text-[#59637a] hover:text-white"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

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
        {state.step === 3 && <ReviewStep value={state} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-[#1e2130] px-4 py-2">
        <button
          onClick={() => state.step > 0 ? goTo(state.step - 1) : onClose?.()}
          className="flex items-center gap-1 rounded-lg border border-[#1e2130] px-3 py-1.5 text-[10px] text-[#68738a] transition-colors hover:border-[#2a3045] hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          {state.step > 0 ? "Back" : "Cancel"}
        </button>

        {state.step < 3 ? (
          <button
            onClick={() => goTo(state.step + 1)}
            disabled={!canAdvance}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
          >
            Next
            <ArrowRight className="h-3 w-3" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-emerald-500"
          >
            <Plus className="h-3 w-3" /> Create Scene
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
          <button
            key={method.id}
            onClick={() => onChange({ importMethod: method.id, selectedTemplate: method.id === "template" ? value.selectedTemplate : null })}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
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
              <button
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
    return (
      <div className="space-y-4">
        <h3 className="text-[12px] font-medium text-[#c5ccdb]">Upload Floor Plan</h3>
        <p className="text-[9px] text-[#59637a]">
          Upload a floor plan image. Walls will be detected automatically.
        </p>

        {value.floorPlanResult ? (
          <div>
            <ImportReview
              key={`${value.floorPlanResult.imageWidth}x${value.floorPlanResult.imageHeight}-${value.floorPlanResult.walls.length}-${value.floorPlanResult.doors.length}-${value.floorPlanResult.windows.length}-${value.floorPlanResult.confidence.toFixed(3)}`}
              result={value.floorPlanResult}
              warnings={value.importWarnings}
              onImageChange={() => onChange({ floorPlanResult: null, floorPlanFile: null })}
              onRecalibrate={(calibration) => {
                const recalibrated = recalibrateFloorPlanResult(value.floorPlanResult!, calibration);
                const { warnings } = validateFloorPlan(recalibrated);
                onChange({ floorPlanResult: recalibrated, importWarnings: warnings });
              }}
              onUpdateResult={(nextResult) => {
                const { warnings } = validateFloorPlan(nextResult);
                onChange({ floorPlanResult: nextResult, importWarnings: warnings });
              }}
            />
          </div>
        ) : (
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#1e2130] bg-[#070a12] p-8 transition-colors hover:border-[#2a3045]"
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
              className="w-20 rounded border border-[#1e2130] bg-[#0b0f17] px-2 py-1 text-[10px] text-[#c5ccdb] outline-none"
            />
            <span className="text-[8px] text-[#59637a]">pixels/meter</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function ReviewStep({
  value,
}: {
  value: WizardState;
}) {
  const summary = useMemo(() => {
    const lines: { label: string; value: string }[] = [
      { label: "Name", value: value.roomName },
      { label: "Dimensions", value: `${value.widthM}m × ${value.depthM}m × ${value.heightM}m` },
      { label: "Method", value: value.importMethod === "blank" ? "Blank Canvas" : value.importMethod === "template" ? `Template: ${value.selectedTemplate?.name ?? "None"}` : "Floor Plan Import" },
    ];

    if (value.selectedTemplate) {
      lines.push({ label: "Cameras", value: `${value.selectedTemplate.suggestedCameras} (pre-configured)` });
    }

    if (value.floorPlanResult) {
      lines.push({ label: "Detected Walls", value: `${value.floorPlanResult.walls.length}` });
      lines.push({ label: "Confidence", value: `${(value.floorPlanResult.confidence * 100).toFixed(0)}%` });
    }

    return lines;
  }, [value]);

  return (
    <div className="space-y-4">
      <h3 className="text-[12px] font-medium text-[#c5ccdb]">Review & Create</h3>
      <p className="text-[9px] text-[#59637a]">
        Review the scene configuration below. Click &quot;Create Scene&quot; to build it.
      </p>

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
          <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-[#8090a8]">
            <div>Detection confidence: <span className="text-[#c5ccdb]">{(value.floorPlanResult.confidence * 100).toFixed(0)}%</span></div>
            <div>Unresolved warnings: <span className={value.importWarnings.length > 0 ? "text-amber-300" : "text-emerald-300"}>{value.importWarnings.length}</span></div>
            <div>Doors: <span className="text-[#c5ccdb]">{value.floorPlanResult.doors.length}</span></div>
            <div>Windows: <span className="text-[#c5ccdb]">{value.floorPlanResult.windows.length}</span></div>
            <div>Walls: <span className="text-[#c5ccdb]">{value.floorPlanResult.walls.length}</span></div>
            <div>Scale: <span className="text-[#c5ccdb]">{value.floorPlanResult.scalePixelsPerMeter} px/m</span></div>
          </div>
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
              <div key={i} className="flex gap-2 text-[8px] text-[#68738a]">
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
