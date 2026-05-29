"use client";

import { useCallback, useRef, useState } from "react";

import { parseCommand, type SceneContextSummary } from "@/agents/CommandAgent";
import { proposeCounterfactuals, type CounterfactualCandidate } from "@/agents/CounterfactualAgent";
import {
  createModelProvider,
  describeAiProviderHealth,
  describeAiProviderTelemetry,
  describeAiProviderSelection,
  providerKeyAvailable,
} from "@/agents/provider-selection";
import { generateReport, buildSimulationSummary } from "@/agents/ReportAgent";
import type { SceneOperation } from "@/schema/SceneOperation";
import { applySceneOperation } from "@/lib/applySceneOperation";
import { createSecurityLightNode } from "@/lib/node-factory";
import { parseOfflineCommand, type OfflineCommandAction } from "@/lib/offline-command-parser";
import { useStudioStore } from "@/store/studio-store";
import { simulateStudio } from "@/simulation/simulate-studio";
import type { CameraNode, CriticalZoneNode } from "@/schema/security-scene";
import type { AiActionTelemetryStage } from "@/store/studio-store";

export type AiCommandStatus =
  | { state: "idle" }
  | { state: "parsing" }
  | { state: "applying"; descriptions: string[] }
  | { state: "error"; message: string }
  | { state: "success"; message: string }
  | { state: "candidates"; candidates: CounterfactualCandidate[]; description: string };

export type AiCommandMode = {
  label: string;
  detail: string;
  cloudAvailable: boolean;
  providerLabel: string;
  providerName: string;
};

function buildSceneContext(): SceneContextSummary {
  const scene = useStudioStore.getState().scene;
  return {
    cameraNames: scene.cameras.map((c) => c.name),
    obstructionLabels: scene.obstructions.map((o) => o.label),
    lightNames: scene.securityLights.map((l) => l.name),
    zoneLabels: scene.criticalZones.map((z) => z.label),
    activeCameraCount: scene.cameras.filter((c) => c.status === "on").length,
    currentTimeOfDay: scene.assumptions.timeOfDay,
    dimensions: {
      width: scene.dimensions.width,
      depth: scene.dimensions.depth,
      height: scene.dimensions.height,
    },
  };
}

export function useAiCommand() {
  const aiProviderSelection = useStudioStore((s) => s.aiProviderSelection);
  const localOnlyMode = useStudioStore((s) => s.localOnlyMode);
  const recordAiActionTelemetry = useStudioStore((s) => s.recordAiActionTelemetry);
  const latestAiActionTelemetry = useStudioStore((s) => s.aiActionTelemetry[0] ?? null);
  const recordRuntimeIncident = useStudioStore((s) => s.recordRuntimeIncident);
  const [status, setStatus] = useState<AiCommandStatus>({ state: "idle" });
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const providerSummary = describeAiProviderSelection(aiProviderSelection);
  const providerHealth = describeAiProviderHealth(aiProviderSelection, localOnlyMode);
  const providerTelemetry = describeAiProviderTelemetry(aiProviderSelection, localOnlyMode);
  const provider = createModelProvider(aiProviderSelection);
  const apiKeyAvailable = providerKeyAvailable(aiProviderSelection.providerId);
  const cloudAvailable = apiKeyAvailable && !localOnlyMode;
  const mode: AiCommandMode = localOnlyMode
    ? {
        label: "Local-only",
        detail: `Recognized scene edits still run locally. Cloud-backed parsing, fix proposals, and report generation are disabled by policy, even if ${providerSummary.providerName} is configured.`,
        cloudAvailable: false,
        providerLabel: providerSummary.providerLabel,
        providerName: providerSummary.providerName,
      }
    : cloudAvailable
      ? {
          label: "Offline-first",
          detail: `Recognized scene edits run locally. ${providerSummary.providerName} is available for open-ended prompts and fix proposals.`,
          cloudAvailable: true,
          providerLabel: providerSummary.providerLabel,
          providerName: providerSummary.providerName,
        }
      : {
          label: "Offline-first",
          detail: `Recognized scene edits run locally. Open-ended prompts and fix proposals stay offline until ${providerSummary.envKey} is set.`,
          cloudAvailable: false,
          providerLabel: providerSummary.providerLabel,
          providerName: providerSummary.providerName,
        };

  const recordTelemetry = useCallback((
    stage: AiActionTelemetryStage,
    startedAt: number,
    promptTokens: number,
    completionTokens: number,
    status: "success" | "error",
    note?: string | null,
  ) => {
    recordAiActionTelemetry({
      stage,
      providerId: aiProviderSelection.providerId,
      providerLabel: providerSummary.providerLabel,
      model: aiProviderSelection.model,
      localOnlyMode,
      cloudAvailable: apiKeyAvailable && !localOnlyMode,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      estimatedPromptTokens: Math.max(0, Math.round(promptTokens)),
      estimatedCompletionTokens: Math.max(0, Math.round(completionTokens)),
      estimatedTotalTokens: Math.max(0, Math.round(promptTokens + completionTokens)),
      tokenSource: "estimated",
      status,
      note: note ?? null,
    });
  }, [aiProviderSelection.model, aiProviderSelection.providerId, apiKeyAvailable, localOnlyMode, providerSummary.providerLabel, recordAiActionTelemetry]);

  const setStatusSafe = useCallback((newStatus: AiCommandStatus) => {
    // Clear any pending auto-dismiss when status changes
    if (dismissRef.current) {
      clearTimeout(dismissRef.current);
      dismissRef.current = null;
    }
    setStatus(newStatus);
  }, [aiProviderSelection.providerId, provider, providerSummary.providerName]);

  const autoDismiss = useCallback(() => {
    dismissRef.current = setTimeout(() => {
      setStatus({ state: "idle" });
      dismissRef.current = null;
    }, 4000);
  }, [setStatus]);

  const executeCommand = useCallback(async (userText: string) => {
    if (!userText.trim()) return;
    const parseStartedAt = performance.now();

    // Check for special internal commands first
    if (userText.startsWith("/")) {
      const cmd = userText.toLowerCase().trim();
      const rootCommand = cmd.split(/\s+/)[0] ?? "";
      const commandArg = cmd.split(/\s+/).slice(1).join(" ").trim().replace(/-/g, "_");
      const store = useStudioStore.getState();

      const setWorkspaceMode = (mode: "map" | "wall" | "replay" | "camera_view" | "compare") => {
        store.setViewMode(mode);
        setStatusSafe({ state: "success", message: `Switched to ${mode.replace("_", " ")} mode` });
        autoDismiss();
      };

      // Parameterized: /target <type> — sets targetType on all critical zones
      if (rootCommand === "/target") {
        const ARG_ALIASES: Record<string, CriticalZoneNode["targetType"]> = {
          all: "person_detection",
          face: "face_recognition",
          face_recognition: "face_recognition",
          face_id: "face_identification",
          face_identification: "face_identification",
          vehicle: "vehicle_detection",
          vehicle_detection: "vehicle_detection",
          license_plate: "license_plate",
          lpr: "license_plate",
          package: "package_detection",
          package_detection: "package_detection",
          cash: "cash_counter_activity",
          door: "door_entry_exit",
          entry: "door_entry_exit",
          entry_exit: "door_entry_exit",
          perimeter: "perimeter_breach",
          person: "person_detection",
          person_detection: "person_detection",
        };
        const resolved = ARG_ALIASES[commandArg];
        if (resolved) {
          store.setAllZoneTargetTypes(resolved);
          setStatusSafe({ state: "success", message: `Zone target type set to "${resolved}"` });
        } else if (commandArg === "") {
          setStatusSafe({ state: "error", message: "Usage: /target <face | face_recognition | face_identification | vehicle_detection | license_plate>" });
        } else {
          setStatusSafe({ state: "error", message: `Unknown target type "${commandArg}". Valid: face, face_recognition, face_identification, vehicle_detection, license_plate` });
        }
        autoDismiss();
        return;
      }

      if (rootCommand === "/privacy") {
        if (commandArg === "on") {
          store.setLayerVisibility("privacy_zones", true);
          setStatusSafe({ state: "success", message: "Privacy zones enabled" });
          autoDismiss();
          return;
        }
        if (commandArg === "off") {
          store.setLayerVisibility("privacy_zones", false);
          setStatusSafe({ state: "success", message: "Privacy zones hidden" });
          autoDismiss();
          return;
        }
        if (commandArg === "toggle") {
          const next = !store.layerVisibility.privacy_zones;
          store.setLayerVisibility("privacy_zones", next);
          setStatusSafe({ state: "success", message: `Privacy zones ${next ? "enabled" : "hidden"}` });
          autoDismiss();
          return;
        }
        setStatusSafe({ state: "error", message: "Usage: /privacy <on | off | toggle>" });
        autoDismiss();
        return;
      }

      switch (rootCommand) {
        case "/night":
        case "/nightmode":
          store.setEnvironmentMode("night");
          setStatusSafe({ state: "success", message: "Switched to night mode" });
          autoDismiss();
          return;
        case "/dusk":
        case "/duskmode":
          store.setEnvironmentMode("dusk");
          setStatusSafe({ state: "success", message: "Switched to dusk mode" });
          autoDismiss();
          return;
        case "/day":
        case "/daymode":
          store.setEnvironmentMode("day");
          setStatusSafe({ state: "success", message: "Switched to day mode" });
          autoDismiss();
          return;
        case "/map":
        case "/mapview":
          setWorkspaceMode("map");
          return;
        case "/wall":
        case "/camerawall":
        case "/camera-wall":
          setWorkspaceMode("wall");
          return;
        case "/replay":
        case "/pathreplay":
          setWorkspaceMode("replay");
          return;
        case "/camera":
        case "/cameraview":
        case "/camera-view":
          setWorkspaceMode("camera_view");
          return;
        case "/report":
          store.setBottomTab("report");
          setStatusSafe({ state: "success", message: "Opened report panel" });
          autoDismiss();
          return;
        case "/compare":
        case "/beforeafter":
          setWorkspaceMode("compare");
          return;
        case "/snapshot":
          store.saveSnapshot(`Snapshot ${new Date().toLocaleTimeString()}`);
          setStatusSafe({ state: "success", message: "Snapshot saved" });
          autoDismiss();
          return;
        case "/simulate":
        case "/run":
          store.runSimulation();
          setStatusSafe({ state: "success", message: "Simulation started" });
          autoDismiss();
          return;
        case "/fail":
        case "/camera-failure": {
          const { scene: s, updateNode, getSelectedCamera } = useStudioStore.getState();
          const target = getSelectedCamera() ?? s.cameras.find((c) => c.status === "on") ?? s.cameras[0];
          if (target) {
            const newStatus = target.status === "on" ? "off" : "on";
            updateNode(target.id, { status: newStatus as CameraNode["status"] });
            setStatusSafe({ state: "success", message: `Turned ${target.name} ${newStatus}` });
          } else {
            setStatusSafe({ state: "success", message: "No camera to toggle" });
          }
          autoDismiss();
          return;
        }
        case "/fix":
        case "/improve": {
          // Parse constraints from remaining text after the command
          const constraints = userText.replace(/^\/fix\s*/i, "").replace(/^\/improve\s*/i, "").split(",").map((s) => s.trim()).filter(Boolean);

          if (localOnlyMode) {
            setStatusSafe({ state: "error", message: `Local-only mode blocks cloud-backed fix proposals. Turn it off in View Settings to use ${providerSummary.providerName}.` });
            autoDismiss();
            return;
          }

          const hasKey = providerKeyAvailable(aiProviderSelection.providerId);
          if (!hasKey) {
            setStatusSafe({ state: "error", message: `${providerSummary.providerName} API key not configured. Set ${providerSummary.envKey}.` });
            autoDismiss();
            return;
          }

          const storeState = useStudioStore.getState();
          const sim = storeState.simulationResult;
          if (!sim) {
            setStatusSafe({ state: "error", message: "Run simulation first before finding fixes." });
            autoDismiss();
            return;
          }

          setStatusSafe({ state: "parsing" });

          try {
            const scene = storeState.scene;
            const issuesSummary = sim.issues.map((i) => `[${i.severity}] ${i.description}`).join("\n");
            const sceneSummary = [
              `Cameras: ${scene.cameras.map((c) => c.name).join(", ")}`,
              `Obstructions: ${scene.obstructions.map((o) => o.label).join(", ")}`,
              `Zones: ${scene.criticalZones.map((z) => z.label).join(", ")}`,
              `Time: ${scene.assumptions.timeOfDay}`,
            ].join(" | ");

            const rawCandidates = await proposeCounterfactuals(issuesSummary, sceneSummary, constraints, provider);

            // Verify each candidate by simulating
            const verified = rawCandidates.map((candidate) => {
              try {
                const testScene = structuredClone(scene);
                const ops = candidate.operations as unknown as SceneOperation[];
                for (const op of ops) {
                  applySceneOperation(testScene, op);
                }
                const testResult = simulateStudio(testScene);

                const delta = {
                  totalCoveragePctDelta: Number((testResult.totalCoveragePct - sim.totalCoveragePct).toFixed(1)),
                  blindspotPctDelta: Number((testResult.blindspotPct - sim.blindspotPct).toFixed(1)),
                  criticalZoneStatusChanges: testResult.criticalZoneResults
                    .map((z, i) => {
                      const prev = sim.criticalZoneResults[i];
                      if (prev && prev.status !== z.status) return `${z.label}: ${prev.status} → ${z.status}`;
                      return null;
                    })
                    .filter((s): s is string => s !== null),
                  worstIssueResolved: testResult.issues.filter((i) => i.severity === "critical").length < sim.issues.filter((i) => i.severity === "critical").length,
                };

                return { ...candidate, verifiedDelta: delta };
              } catch {
                return { ...candidate, verifiedDelta: undefined };
              }
            });

            const ranked = verified
              .filter((c) => c.verifiedDelta)
              .sort((a, b) => (b.verifiedDelta?.totalCoveragePctDelta ?? 0) - (a.verifiedDelta?.totalCoveragePctDelta ?? 0))
              .map((c, i) => ({ ...c, rank: i + 1 }));

            setStatusSafe({
              state: "candidates",
              candidates: ranked,
              description: `Found ${ranked.length} fix candidate${ranked.length !== 1 ? "s" : ""}`,
            });

            if (ranked.length === 0) {
              setStatusSafe({ state: "error", message: "No verified fixes found. Try different constraints." });
              autoDismiss();
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            setStatusSafe({ state: "error", message });
            autoDismiss();
          }
          return;
        }
        default:
          setStatusSafe({ state: "error", message: `Unknown command: ${cmd}` });
          autoDismiss();
          return;
      }
    }

    const storeState = useStudioStore.getState();
    const offlinePlan = parseOfflineCommand(userText, storeState.scene);
    if (offlinePlan) {
      if (offlinePlan.action) {
        applyOfflineAction(offlinePlan.action);
      }
      if (offlinePlan.operations.length > 0) {
        setStatusSafe({ state: "applying", descriptions: offlinePlan.operations.map((op) => op.type) });
        applySceneOperations(offlinePlan.operations);
        setStatusSafe({ state: "success", message: offlinePlan.message });
        autoDismiss();
      } else {
        setStatusSafe({ state: "success", message: offlinePlan.message });
        autoDismiss();
      }
      return;
    }

    if (localOnlyMode) {
      recordRuntimeIncident({
        category: "user_error",
        severity: "warning",
        title: "Cloud-backed parsing blocked",
        details: "Local-only mode prevented a cloud-backed AI command.",
        action: "ai_command",
        path: "/studio",
      });
      setStatusSafe({
        state: "error",
        message: "Local-only mode blocks cloud-backed parsing. Try /night, /privacy on, /simulate, /report, or turn off Local-only mode in View Settings.",
      });
      autoDismiss();
      return;
    }

    const hasProviderKey = providerKeyAvailable(aiProviderSelection.providerId);
    if (!hasProviderKey) {
      recordRuntimeIncident({
        category: "provider_failure",
        severity: "warning",
        title: "AI provider unavailable",
        details: `${providerSummary.providerName} API key not configured.`,
        action: "ai_command",
        path: "/studio",
      });
      setStatusSafe({ state: "error", message: `${providerSummary.providerName} API key not configured. Try commands like /night, /privacy on, /simulate, /report, or /target license_plate.` });
      return;
    }

    setStatusSafe({ state: "parsing" });

    try {
      const context = buildSceneContext();
      const operations = await parseCommand(userText, context, provider);
      const parsePromptTokens = estimateTokensFromText(`${userText}\n${JSON.stringify(context)}`);
      const parseCompletionTokens = estimateTokensFromText(JSON.stringify(operations));
      recordTelemetry(
        "command_parse",
        parseStartedAt,
        parsePromptTokens,
        parseCompletionTokens,
        "success",
        operations.length === 0
          ? "Parsed command produced no scene operations; counterfactual fallback considered."
          : `Parsed ${operations.length} scene operation${operations.length === 1 ? "" : "s"}.`,
      );

      if (operations.length === 0) {
        // Couldn't parse as a scene operation — try counterfactual agent instead
        const storeState = useStudioStore.getState();
        const sim = storeState.simulationResult;
        if (!sim) {
          setStatusSafe({ state: "error", message: "Could not parse that as a valid scene operation." });
          return;
        }

        setStatusSafe({ state: "parsing" });

        const counterfactualStartedAt = performance.now();
        try {
          const scene = storeState.scene;
          const issuesSummary = sim.issues.map((i) => `[${i.severity}] ${i.description}`).join("\n");
          const sceneSummary = [
            `Cameras: ${scene.cameras.map((c) => c.name).join(", ")}`,
            `Obstructions: ${scene.obstructions.map((o) => o.label).join(", ")}`,
            `Zones: ${scene.criticalZones.map((z) => z.label).join(", ")}`,
            `Time: ${scene.assumptions.timeOfDay}`,
          ].join(" | ");

          const rawCandidates = await proposeCounterfactuals(issuesSummary, sceneSummary, [userText], provider);

          const verified = rawCandidates.map((candidate) => {
            try {
              const testScene = structuredClone(scene);
              const ops = candidate.operations as unknown as SceneOperation[];
              for (const op of ops) {
                applySceneOperation(testScene, op);
              }
              const testResult = simulateStudio(testScene);
              return {
                ...candidate,
                verifiedDelta: {
                  totalCoveragePctDelta: Number((testResult.totalCoveragePct - sim.totalCoveragePct).toFixed(1)),
                  blindspotPctDelta: Number((testResult.blindspotPct - sim.blindspotPct).toFixed(1)),
                  criticalZoneStatusChanges: testResult.criticalZoneResults
                    .map((z, i) => {
                      const prev = sim.criticalZoneResults[i];
                      if (prev && prev.status !== z.status) return `${z.label}: ${prev.status} → ${z.status}`;
                      return null;
                    })
                    .filter((s): s is string => s !== null),
                  worstIssueResolved: testResult.issues.filter((i) => i.severity === "critical").length < sim.issues.filter((i) => i.severity === "critical").length,
                },
              };
            } catch {
              return { ...candidate, verifiedDelta: undefined };
            }
          });

          const ranked = verified
            .filter((c) => c.verifiedDelta)
            .sort((a, b) => (b.verifiedDelta?.totalCoveragePctDelta ?? 0) - (a.verifiedDelta?.totalCoveragePctDelta ?? 0))
            .map((c, i) => ({ ...c, rank: i + 1 }));

          recordTelemetry(
            "counterfactual",
            counterfactualStartedAt,
            estimateTokensFromText(`${issuesSummary}\n${sceneSummary}\n${userText}`),
            estimateTokensFromText(JSON.stringify(ranked)),
            ranked.length > 0 ? "success" : "error",
            ranked.length > 0
              ? `Generated ${ranked.length} verified counterfactual candidate${ranked.length === 1 ? "" : "s"}.`
              : "No verified counterfactual candidates found.",
          );

          if (ranked.length === 0) {
            setStatusSafe({ state: "error", message: "No fixes found for that query." });
            return;
          }

          setStatusSafe({
            state: "candidates",
            candidates: ranked,
            description: `Found ${ranked.length} potential fix${ranked.length !== 1 ? "es" : ""}`,
          });
        } catch (err) {
          recordTelemetry(
            "counterfactual",
            counterfactualStartedAt,
            estimateTokensFromText(`${userText}`),
            0,
            "error",
            err instanceof Error ? err.message : "Unknown error",
          );
          const message = err instanceof Error ? err.message : "Unknown error";
          setStatusSafe({ state: "error", message });
        }
        return;
      }

      setStatusSafe({ state: "applying", descriptions: operations.map((op) => op.type) });

      // Apply operations by mutating the scene directly through the store
      const store = useStudioStore.getState();
      const scene = store.scene;

      for (const op of operations) {
        switch (op.type) {
          case "move_camera": {
            const cam = scene.cameras.find((c) => c.id === op.cameraId);
            if (cam) cam.position = op.newPosition;
            break;
          }
          case "rotate_camera": {
            const cam = scene.cameras.find((c) => c.id === op.cameraId);
            if (cam) {
              cam.yawDeg = op.yawDeg;
              if (op.pitchDeg !== undefined) cam.pitchDeg = op.pitchDeg;
            }
            break;
          }
          case "change_camera_fov": {
            const cam = scene.cameras.find((c) => c.id === op.cameraId);
            if (cam) cam.fovHorizontalDeg = op.fovHorizontalDeg;
            break;
          }
          case "toggle_camera": {
            const cam = scene.cameras.find((c) => c.id === op.cameraId);
            if (cam) cam.status = op.status;
            break;
          }
          case "move_obstruction": {
            const obs = scene.obstructions.find((o) => o.id === op.obstructionId);
            if (obs) obs.position = op.newPosition;
            break;
          }
          case "resize_obstruction": {
            const obs = scene.obstructions.find((o) => o.id === op.obstructionId);
            if (obs) obs.dimensions = op.newDimensions;
            break;
          }
          case "rotate_obstruction": {
            const obs = scene.obstructions.find((o) => o.id === op.obstructionId);
            if (obs) obs.rotationYDeg = op.rotationYDeg;
            break;
          }
          case "add_light": {
            const light = createSecurityLightNode(op.position);
            if (op.name) light.name = op.name;
            if (op.lightType) light.lightType = op.lightType;
            if (op.brightness) light.brightness = op.brightness;
            scene.securityLights.push(light);
            break;
          }
          case "toggle_light": {
            const light = scene.securityLights.find((l) => l.id === op.lightId);
            if (light) light.status = op.status;
            break;
          }
          case "set_time_of_day":
            store.setEnvironmentMode(op.timeOfDay);
            // assumptions.timeOfDay uses "custom" instead of "dusk"
            scene.assumptions.timeOfDay = op.timeOfDay === "dusk" ? "custom" : op.timeOfDay;
            break;
          case "save_snapshot":
            store.saveSnapshot(op.label);
            break;
          case "generate_report":
            store.setBottomTab("report");
            break;
          case "run_adversarial":
          case "run_coverage_failure_analysis":
            store.setActiveTool("path");
            break;
          default:
            break;
        }
      }

      // Mark scene dirty and trigger recompute
      scene.updatedAt = Date.now();
      store.markDirty();

      const descriptions = operations.map((op) => {
        switch (op.type) {
          case "move_camera": return `Moved camera`;
          case "rotate_camera": return `Rotated camera`;
          case "change_camera_fov": return `Changed FOV`;
          case "toggle_camera": return op.status === "on" ? `Turned on camera` : `Turned off camera`;
          case "move_obstruction": return `Moved obstruction`;
          case "resize_obstruction": return `Resized obstruction`;
          case "rotate_obstruction": return `Rotated obstruction`;
          case "add_light": return `Added light`;
          case "toggle_light": return `Toggled light`;
          case "set_time_of_day": return `Set to ${op.timeOfDay}`;
          case "save_snapshot": return `Saved "${op.label}"`;
          case "generate_report": return `Generated report`;
          case "run_adversarial":
          case "run_coverage_failure_analysis":
            return "Running coverage-failure analysis";
          default: return op.type;
        }
      });

      setStatusSafe({
        state: "success",
        message: descriptions.join(" • "),
      });

      autoDismiss();
    } catch (err) {
      recordTelemetry(
        "command_parse",
        parseStartedAt,
        estimateTokensFromText(userText),
        0,
        "error",
        err instanceof Error ? err.message : "Unknown error",
      );
      const message = err instanceof Error ? err.message : "Unknown error";
      recordRuntimeIncident({
        category: "runtime_failure",
        severity: "error",
        title: "AI command failed",
        details: message,
        stack: err instanceof Error ? err.stack : null,
        action: "ai_command",
        path: "/studio",
      });
      setStatusSafe({ state: "error", message });
    }
  }, [
    setStatusSafe,
    autoDismiss,
    aiProviderSelection.providerId,
    aiProviderSelection.model,
    providerSummary.envKey,
    providerSummary.providerName,
    providerSummary.providerLabel,
    provider,
    localOnlyMode,
    recordRuntimeIncident,
    recordTelemetry,
    apiKeyAvailable,
  ]);

  const runCounterfactuals = useCallback(async (constraints: string[], onCandidates: (candidates: CounterfactualCandidate[]) => void) => {
    if (localOnlyMode) {
      recordRuntimeIncident({
        category: "user_error",
        severity: "warning",
        title: "Counterfactual proposals blocked",
        details: "Local-only mode prevented cloud-backed counterfactual proposals.",
        action: "counterfactuals",
        path: "/studio",
      });
      setStatus({ state: "error", message: `Local-only mode blocks cloud-backed counterfactual proposals. Turn it off in View Settings to use ${providerSummary.providerName}.` });
      return;
    }

    const apiKeyAvailable = providerKeyAvailable(aiProviderSelection.providerId);
    if (!apiKeyAvailable) {
      recordRuntimeIncident({
        category: "provider_failure",
        severity: "warning",
        title: "Counterfactual provider unavailable",
        details: `${providerSummary.providerName} API key not configured.`,
        action: "counterfactuals",
        path: "/studio",
      });
      setStatus({ state: "error", message: `${providerSummary.providerName} API key not configured.` });
      return;
    }

    setStatus({ state: "parsing" });
    const startedAt = performance.now();

    try {
      const store = useStudioStore.getState();
      const scene = store.scene;
      const sim = store.simulationResult;

      if (!sim) {
        setStatus({ state: "error", message: "Run simulation first before proposing fixes." });
        return;
      }

      const issuesSummary = sim.issues.map((i) => `[${i.severity}] ${i.description}`).join("\n");
      const sceneSummary = [
        `Cameras: ${scene.cameras.map((c) => c.name).join(", ")}`,
        `Obstructions: ${scene.obstructions.map((o) => o.label).join(", ")}`,
        `Zones: ${scene.criticalZones.map((z) => z.label).join(", ")}`,
        `Time: ${scene.assumptions.timeOfDay}`,
      ].join(" | ");

      const candidates = await proposeCounterfactuals(issuesSummary, sceneSummary, constraints, provider);

      // Verify each candidate by simulating
      const verified = candidates.map((candidate) => {
        try {
          const testScene = structuredClone(scene);
          const ops = candidate.operations as unknown as SceneOperation[];
          for (const op of ops) {
            applySceneOperation(testScene, op);
          }
          const testResult = simulateStudio(testScene);

          const delta = {
            totalCoveragePctDelta: Number((testResult.totalCoveragePct - sim.totalCoveragePct).toFixed(1)),
            blindspotPctDelta: Number((testResult.blindspotPct - sim.blindspotPct).toFixed(1)),
            criticalZoneStatusChanges: testResult.criticalZoneResults
              .map((z, i) => {
                const prev = sim.criticalZoneResults[i];
                if (prev && prev.status !== z.status) return `${z.label}: ${prev.status} → ${z.status}`;
                return null;
              })
              .filter((s): s is string => s !== null),
            worstIssueResolved: testResult.issues.filter((i) => i.severity === "critical").length < sim.issues.filter((i) => i.severity === "critical").length,
          };

          return {
            ...candidate,
            verifiedDelta: delta,
          };
        } catch {
          return { ...candidate, verifiedDelta: undefined };
        }
      });

      const ranked = verified
        .filter((c) => c.verifiedDelta)
        .sort((a, b) => (b.verifiedDelta?.totalCoveragePctDelta ?? 0) - (a.verifiedDelta?.totalCoveragePctDelta ?? 0))
        .map((c, i) => ({ ...c, rank: i + 1 }));

      recordTelemetry(
        "counterfactual",
        startedAt,
        estimateTokensFromText(`${issuesSummary}\n${sceneSummary}\n${constraints.join(", ")}`),
        estimateTokensFromText(JSON.stringify(ranked)),
        "success",
        ranked.length > 0
          ? `Generated ${ranked.length} verified counterfactual candidate${ranked.length === 1 ? "" : "s"}.`
          : "No verified counterfactual candidates found.",
      );

      onCandidates(ranked);
      setStatus({
        state: "success",
        message: `Found ${ranked.length} verified fix candidates`,
      });

      setTimeout(() => setStatus({ state: "idle" }), 4000);
    } catch (err) {
      recordTelemetry(
        "counterfactual",
        startedAt,
        estimateTokensFromText(constraints.join(", ")),
        0,
        "error",
        err instanceof Error ? err.message : "Unknown error",
      );
      const message = err instanceof Error ? err.message : "Unknown error";
      recordRuntimeIncident({
        category: "runtime_failure",
        severity: "error",
        title: "Counterfactual analysis failed",
        details: message,
        stack: err instanceof Error ? err.stack : null,
        action: "counterfactuals",
        path: "/studio",
      });
      setStatus({ state: "error", message });
    }
  }, [
    aiProviderSelection.providerId,
    provider,
    providerSummary.providerName,
    providerSummary.providerLabel,
    localOnlyMode,
    recordRuntimeIncident,
    recordTelemetry,
  ]);

  const runReportGeneration = useCallback(async () => {
    const startedAt = performance.now();
    if (localOnlyMode) {
      recordRuntimeIncident({
        category: "user_error",
        severity: "warning",
        title: "Report generation blocked",
        details: "Local-only mode prevented cloud-backed report generation.",
        action: "report_generation",
        path: "/studio",
      });
      setStatus({ state: "error", message: `Local-only mode blocks cloud-backed report generation. Turn it off in View Settings to use ${providerSummary.providerName}.` });
      return null;
    }

    const apiKeyAvailable = providerKeyAvailable(aiProviderSelection.providerId);
    if (!apiKeyAvailable) {
      recordRuntimeIncident({
        category: "provider_failure",
        severity: "warning",
        title: "Report provider unavailable",
        details: `${providerSummary.providerName} API key not configured.`,
        action: "report_generation",
        path: "/studio",
      });
      setStatus({ state: "error", message: `${providerSummary.providerName} API key not configured.` });
      return null;
    }

    setStatus({ state: "parsing" });

    try {
      const store = useStudioStore.getState();
      const sim = store.simulationResult;
      if (!sim) {
        setStatus({ state: "error", message: "Run simulation first." });
        return null;
      }

      const simData = buildSimulationSummary(sim);
      const sceneSummary = `Site: ${store.scene.name}, ${store.scene.dimensions.width}m × ${store.scene.dimensions.depth}m, ${store.scene.cameras.length} cameras`;

      const report = await generateReport(simData, sceneSummary, provider);
      const elapsedMs = Math.round(performance.now() - startedAt);
      recordAiActionTelemetry({
        stage: "report_generation",
        providerId: aiProviderSelection.providerId,
        providerLabel: providerSummary.providerLabel,
        model: aiProviderSelection.model,
        localOnlyMode,
        cloudAvailable: apiKeyAvailable,
        durationMs: elapsedMs,
        estimatedPromptTokens: estimateTokensFromText(simData + sceneSummary),
        estimatedCompletionTokens: estimateTokensFromText(report.executiveSummary + report.sections.map((section) => section.content).join(" ")),
        estimatedTotalTokens: estimateTokensFromText(simData + sceneSummary) + estimateTokensFromText(report.executiveSummary + report.sections.map((section) => section.content).join(" ")),
        tokenSource: "estimated",
        status: "success",
        note: "Report generation timing recorded from the AI command surface.",
      });
      recordRuntimeIncident({
        category: "performance_trace",
        severity: "info",
        title: "Report generated",
        details: `Report generated in ${elapsedMs} ms.`,
        durationMs: elapsedMs,
        action: "report_generation",
        path: "/studio",
      });
      setStatus({ state: "success", message: "Report generated" });
      setTimeout(() => setStatus({ state: "idle" }), 4000);
      return report;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      recordRuntimeIncident({
        category: "runtime_failure",
        severity: "error",
        title: "Report generation failed",
        details: message,
        stack: err instanceof Error ? err.stack : null,
        action: "report_generation",
        path: "/studio",
      });
      setStatus({ state: "error", message });
      return null;
    }
  }, [aiProviderSelection.providerId, providerSummary.providerName, localOnlyMode, recordRuntimeIncident, provider]);

  const dismissError = useCallback(() => setStatusSafe({ state: "idle" }), [setStatusSafe]);

  const applyCandidate = useCallback((ops: CounterfactualCandidate["operations"]) => {
    const storeState = useStudioStore.getState();
    const logEntries: string[] = [];

    // Snapshot the current state for before/after comparison
    storeState.saveSnapshot("Before fix  " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));

    for (const op of ops) {
      const typedOp = op as { type: string };
      switch (typedOp.type) {
        case "move_obstruction": {
          const o = op as { obstructionId: string; newPosition: [number, number, number] };
          const obs = storeState.scene.obstructions.find((x) => x.id === o.obstructionId);
          if (obs) { obs.position = o.newPosition; storeState.markDirty(); logEntries.push(`Moved ${obs.label} to (${o.newPosition.map((n) => n.toFixed(1)).join(", ")})`); }
          break;
        }
        case "rotate_camera": {
          const o = op as { cameraId: string; yawDeg: number; pitchDeg?: number };
          const cam = storeState.scene.cameras.find((x) => x.id === o.cameraId);
          if (cam) { cam.yawDeg = o.yawDeg; if (o.pitchDeg !== undefined) cam.pitchDeg = o.pitchDeg; storeState.markDirty(); logEntries.push(`Rotated ${cam.name} ${o.pitchDeg !== undefined ? `${o.yawDeg}° yaw, ${o.pitchDeg}° pitch` : `${o.yawDeg}° yaw`}`); }
          break;
        }
        case "toggle_camera": {
          const o = op as { cameraId: string; status: "on" | "off" };
          const cam = storeState.scene.cameras.find((x) => x.id === o.cameraId);
          if (cam) { cam.status = o.status; storeState.markDirty(); logEntries.push(`Turned ${o.status === "on" ? "on" : "off"} ${cam.name}`); }
          break;
        }
        case "add_light": {
          const o = op as { position: [number, number, number] };
          const light = createSecurityLightNode(o.position);
          storeState.scene.securityLights.push(light);
          storeState.markDirty();
          logEntries.push(`Added light at (${o.position.map((n) => n.toFixed(1)).join(", ")})`);
          break;
        }
        case "move_camera": {
          const o = op as { cameraId: string; newPosition: [number, number, number] };
          const cam = storeState.scene.cameras.find((x) => x.id === o.cameraId);
          if (cam) { cam.position = o.newPosition; storeState.markDirty(); logEntries.push(`Moved ${cam.name} to (${o.newPosition.map((n) => n.toFixed(1)).join(", ")})`); }
          break;
        }
        case "resize_obstruction": {
          const o = op as { obstructionId: string; newDimensions: [number, number, number] };
          const obs = storeState.scene.obstructions.find((x) => x.id === o.obstructionId);
          if (obs) { obs.dimensions = o.newDimensions; storeState.markDirty(); logEntries.push(`Resized ${obs.label} to ${o.newDimensions.join("×")}m`); }
          break;
        }
        default:
          break;
      }
    }
    // Log the changes
    for (const entry of logEntries) {
      storeState.logChange(entry);
    }
    storeState.runSimulation();
    // Queue an "after" snapshot once simulation completes
    setTimeout(() => {
      const current = useStudioStore.getState();
      current.saveSnapshot("After fix " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
      current.setBottomTab("beforeafter");
    }, 200);
    setStatusSafe({ state: "idle" });
  }, [setStatusSafe]);

  return { status, executeCommand, runCounterfactuals, runReportGeneration, dismissError, applyCandidate, mode, providerHealth, providerTelemetry, latestAiActionTelemetry };
}

function applyOfflineAction(action: OfflineCommandAction) {
  const store = useStudioStore.getState();
  switch (action.type) {
    case "set_environment_mode":
      store.setEnvironmentMode(action.mode);
      break;
    case "set_view_mode":
      store.setViewMode(action.mode);
      break;
    case "set_bottom_tab":
      store.setBottomTab(action.tab);
      break;
    case "set_layer_visibility":
      store.setLayerVisibility(action.layer, action.visible);
      break;
    case "run_simulation":
      store.runSimulation();
      break;
    case "save_snapshot":
      store.saveSnapshot(action.label);
      break;
    default:
      break;
  }
}

function estimateTokensFromText(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function applySceneOperations(operations: SceneOperation[]) {
  const store = useStudioStore.getState();
  const scene = store.scene;
  for (const op of operations) {
    switch (op.type) {
      case "move_camera": {
        const cam = scene.cameras.find((c) => c.id === op.cameraId);
        if (cam) cam.position = op.newPosition;
        break;
      }
      case "rotate_camera": {
        const cam = scene.cameras.find((c) => c.id === op.cameraId);
        if (cam) {
          cam.yawDeg = op.yawDeg;
          if (op.pitchDeg !== undefined) cam.pitchDeg = op.pitchDeg;
        }
        break;
      }
      case "change_camera_fov": {
        const cam = scene.cameras.find((c) => c.id === op.cameraId);
        if (cam) cam.fovHorizontalDeg = op.fovHorizontalDeg;
        break;
      }
      case "toggle_camera": {
        const cam = scene.cameras.find((c) => c.id === op.cameraId);
        if (cam) cam.status = op.status;
        break;
      }
      case "move_obstruction": {
        const obs = scene.obstructions.find((o) => o.id === op.obstructionId);
        if (obs) obs.position = op.newPosition;
        break;
      }
      case "resize_obstruction": {
        const obs = scene.obstructions.find((o) => o.id === op.obstructionId);
        if (obs) obs.dimensions = op.newDimensions;
        break;
      }
      case "rotate_obstruction": {
        const obs = scene.obstructions.find((o) => o.id === op.obstructionId);
        if (obs) obs.rotationYDeg = op.rotationYDeg;
        break;
      }
      case "add_light": {
        const light = createSecurityLightNode(op.position);
        if (op.name) light.name = op.name;
        if (op.lightType) light.lightType = op.lightType;
        if (op.brightness) light.brightness = op.brightness;
        scene.securityLights.push(light);
        break;
      }
      case "toggle_light": {
        const light = scene.securityLights.find((l) => l.id === op.lightId);
        if (light) light.status = op.status;
        break;
      }
      case "set_time_of_day":
        store.setEnvironmentMode(op.timeOfDay);
        scene.assumptions.timeOfDay = op.timeOfDay === "dusk" ? "custom" : op.timeOfDay;
        break;
      case "save_snapshot":
        store.saveSnapshot(op.label);
        break;
      case "generate_report":
        store.setBottomTab("report");
        break;
      case "run_adversarial":
      case "run_coverage_failure_analysis":
        store.setActiveTool("path");
        break;
      case "replay_path":
        store.setActivePathId(op.pathId);
        store.setViewMode("replay");
        break;
      default:
        break;
    }
  }
  scene.updatedAt = Date.now();
  store.markDirty();
  store.runSimulation();
}
