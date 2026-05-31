"use client";

import { useCallback, useRef, useState } from "react";

import type { SceneContextSummary } from "@/agents/CommandAgent";
import type { CounterfactualCandidate } from "@/agents/CounterfactualAgent";
import {
  describeAiProviderHealth,
  describeAiProviderTelemetry,
  describeAiProviderSelection,
} from "@/agents/provider-selection";
import { buildSimulationSummary } from "@/agents/ReportAgent";
import type { SecurityReport } from "@/agents/ReportAgent";
import type { SceneOperation } from "@/schema/SceneOperation";
import { applySceneOperation } from "@/lib/applySceneOperation";
import { createObstructionNode, createSecurityLightNode } from "@/lib/node-factory";
import { parseOfflineCommand, type OfflineCommandAction } from "@/lib/offline-command-parser";
import { evaluateAiRateLimit, formatRetryHint, recordAiRateLimitUsage } from "@/lib/ai-rate-limit";
import { resolvePromptRegistryLineage } from "@/agents/prompt-registry";
import { useStudioStore } from "@/store/studio-store";
import { simulateStudio } from "@sentineltwin/simulation";
import type { CameraNode, CriticalZoneNode, SecurityScene, SimulationResult } from "@/schema/security-scene";
import type { AiActionTelemetryStage } from "@/store/studio-store";

export type AiCommandStatus =
  | { state: "idle" }
  | { state: "parsing" }
  | { state: "applying"; descriptions: string[] }
  | {
      state: "preview";
      message: string;
      descriptions: string[];
      requiresTargetSelection?: boolean;
      unresolvedTarget?: string;
      candidateTargets?: string[];
    }
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

type PendingCommandPreview = {
  message: string;
  operations: SceneOperation[];
  action?: OfflineCommandAction;
  requiresTargetSelection?: boolean;
  unresolvedTarget?: string;
  candidateTargets?: string[];
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
  const [pendingPreview, setPendingPreview] = useState<PendingCommandPreview | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const providerSummary = describeAiProviderSelection(aiProviderSelection);
  const providerHealth = describeAiProviderHealth(aiProviderSelection, localOnlyMode);
  const providerTelemetry = describeAiProviderTelemetry(aiProviderSelection, localOnlyMode);
  const cloudAvailable = providerHealth.overallStatus !== "blocked" && !localOnlyMode;
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
    const promptLineage = resolvePromptRegistryLineage(stage);
    recordAiActionTelemetry({
      stage,
      providerId: aiProviderSelection.providerId,
      providerLabel: providerSummary.providerLabel,
      model: aiProviderSelection.model,
      ...(promptLineage ?? {}),
      localOnlyMode,
      cloudAvailable,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      estimatedPromptTokens: Math.max(0, Math.round(promptTokens)),
      estimatedCompletionTokens: Math.max(0, Math.round(completionTokens)),
      estimatedTotalTokens: Math.max(0, Math.round(promptTokens + completionTokens)),
      tokenSource: "estimated",
      status,
      note: note ?? null,
    });
  }, [aiProviderSelection.model, aiProviderSelection.providerId, cloudAvailable, localOnlyMode, providerSummary.providerLabel, recordAiActionTelemetry]);

  const setStatusSafe = useCallback((newStatus: AiCommandStatus) => {
    // Clear any pending auto-dismiss when status changes
    if (dismissRef.current) {
      clearTimeout(dismissRef.current);
      dismissRef.current = null;
    }
    if (newStatus.state !== "preview") {
      setPendingPreview(null);
    }
    setStatus(newStatus);
  }, [aiProviderSelection.providerId, providerSummary.providerName]);

  const autoDismiss = useCallback(() => {
    dismissRef.current = setTimeout(() => {
      setStatus({ state: "idle" });
      dismissRef.current = null;
    }, 4000);
  }, [setStatus]);

  const stageCommandPreview = useCallback((preview: PendingCommandPreview) => {
    setPendingPreview(preview);
    const descriptions = preview.operations.map(describeSceneOperation);
    setStatus({
      state: "preview",
      message: preview.message,
      descriptions,
      requiresTargetSelection: preview.requiresTargetSelection,
      unresolvedTarget: preview.unresolvedTarget,
      candidateTargets: preview.candidateTargets,
    });
  }, []);

  const executeCommand = useCallback(async (userText: string) => {
    if (!userText.trim()) return;
    if (containsDisallowedSecurityIntent(userText)) {
      setStatusSafe({
        state: "error",
        message: "I can help with authorized incident replay, coverage-failure analysis, and hardening recommendations only.",
      });
      autoDismiss();
      return;
    }
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
          const isAutoApply = rootCommand === "/improve";
          // Parse constraints from remaining text after the command
          const constraints = userText.replace(/^\/fix\s*/i, "").replace(/^\/improve\s*/i, "").split(",").map((s) => s.trim()).filter(Boolean);

          if (localOnlyMode) {
            setStatusSafe({ state: "error", message: `Local-only mode blocks cloud-backed fix proposals. Turn it off in View Settings to use ${providerSummary.providerName}.` });
            autoDismiss();
            return;
          }

          if (!cloudAvailable) {
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

            const estimatedCounterfactualTokens = estimateTokensFromText(`${issuesSummary}\n${sceneSummary}\n${constraints.join(",")}`);
            const budgetDecision = evaluateAiRateLimit("counterfactual", estimatedCounterfactualTokens);
            if (!budgetDecision.allowed) {
              setStatusSafe({
                state: "error",
                message: `${budgetDecision.reason ?? "Counterfactual budget limit reached."} ${formatRetryHint(budgetDecision.retryInMs)}`,
              });
              autoDismiss();
              return;
            }
            recordAiRateLimitUsage("counterfactual", estimatedCounterfactualTokens);

            const counterfactualResponse = await fetch("/api/ai/counterfactuals", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                selection: aiProviderSelection,
                localOnlyMode,
                issuesSummary,
                sceneSummary,
                constraints,
              }),
            });
            const counterfactualPayload = await counterfactualResponse.json() as {
              ok: boolean;
              error?: string;
              candidates?: CounterfactualCandidate[];
            };
            if (!counterfactualPayload.ok || !counterfactualPayload.candidates) {
              throw new Error(counterfactualPayload.error ?? "Counterfactual proposal failed.");
            }
            const rawCandidates = counterfactualPayload.candidates;
            const ranked = verifyAndRankCounterfactualCandidates(rawCandidates, scene, sim);

            setStatusSafe({
              state: "candidates",
              candidates: ranked,
              description: `Found ${ranked.length} fix candidate${ranked.length !== 1 ? "s" : ""}`,
            });

            if (ranked.length === 0) {
              setStatusSafe({ state: "error", message: "No verified fixes found. Try different constraints." });
              autoDismiss();
              return;
            }

            if (isAutoApply) {
              applyCounterfactualCandidateOperations(ranked[0].operations);
              setStatusSafe({
                state: "success",
                message: `Auto-applied best fix (#${ranked[0].rank ?? 1}): ${ranked[0].description}`,
              });
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
      stageCommandPreview({
        message: offlinePlan.message,
        operations: offlinePlan.operations,
        action: offlinePlan.action,
        requiresTargetSelection: offlinePlan.requiresTargetSelection,
        unresolvedTarget: offlinePlan.unresolvedTarget,
        candidateTargets: offlinePlan.candidateTargets,
      });
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

    if (!cloudAvailable) {
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
      const estimatedParseTokens = estimateTokensFromText(`${userText}\n${JSON.stringify(context)}`);
      const parseBudgetDecision = evaluateAiRateLimit("command_parse", estimatedParseTokens);
      if (!parseBudgetDecision.allowed) {
        setStatusSafe({
          state: "error",
          message: `${parseBudgetDecision.reason ?? "Command parsing budget limit reached."} ${formatRetryHint(parseBudgetDecision.retryInMs)}`,
        });
        autoDismiss();
        return;
      }
      recordAiRateLimitUsage("command_parse", estimatedParseTokens);
      const commandResponse = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userText,
          selection: aiProviderSelection,
          localOnlyMode,
          sceneContext: context,
          scene: useStudioStore.getState().scene,
        }),
      });
      const commandPayload = await commandResponse.json() as {
        ok: boolean;
        error?: string;
        result?: {
          operations: SceneOperation[];
          confidence: number;
          warnings: string[];
          requiresConfirmation: boolean;
        };
      };
      if (!commandPayload.ok || !commandPayload.result) {
        throw new Error(commandPayload.error ?? "Command parsing failed.");
      }
      const parseResult = commandPayload.result;
      const operations = parseResult.operations;
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
          : `Parsed ${operations.length} scene operation${operations.length === 1 ? "" : "s"}${parseResult.warnings.length > 0 ? ` with ${parseResult.warnings.length} semantic warning(s)` : ""}.`,
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

          const estimatedCounterfactualTokens = estimateTokensFromText(`${issuesSummary}\n${sceneSummary}\n${userText}`);
          const fallbackBudgetDecision = evaluateAiRateLimit("counterfactual", estimatedCounterfactualTokens);
          if (!fallbackBudgetDecision.allowed) {
            setStatusSafe({
              state: "error",
              message: `${fallbackBudgetDecision.reason ?? "Counterfactual budget limit reached."} ${formatRetryHint(fallbackBudgetDecision.retryInMs)}`,
            });
            autoDismiss();
            return;
          }
          recordAiRateLimitUsage("counterfactual", estimatedCounterfactualTokens);

          const counterfactualResponse = await fetch("/api/ai/counterfactuals", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              selection: aiProviderSelection,
              localOnlyMode,
              issuesSummary,
              sceneSummary,
              constraints: [userText],
            }),
          });
          const counterfactualPayload = await counterfactualResponse.json() as {
            ok: boolean;
            error?: string;
            candidates?: CounterfactualCandidate[];
          };
          if (!counterfactualPayload.ok || !counterfactualPayload.candidates) {
            throw new Error(counterfactualPayload.error ?? "Counterfactual proposal failed.");
          }
          const rawCandidates = counterfactualPayload.candidates;
          const ranked = verifyAndRankCounterfactualCandidates(rawCandidates, scene, sim);

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

      stageCommandPreview({
        message: `Preview ready: ${operations.length} operation${operations.length === 1 ? "" : "s"} parsed.`,
        operations,
      });
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
    localOnlyMode,
    recordRuntimeIncident,
    recordTelemetry,
    cloudAvailable,
    stageCommandPreview,
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

    if (!cloudAvailable) {
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

      const estimatedCounterfactualTokens = estimateTokensFromText(`${issuesSummary}\n${sceneSummary}\n${constraints.join(",")}`);
      const budgetDecision = evaluateAiRateLimit("counterfactual", estimatedCounterfactualTokens);
      if (!budgetDecision.allowed) {
        setStatus({
          state: "error",
          message: `${budgetDecision.reason ?? "Counterfactual budget limit reached."} ${formatRetryHint(budgetDecision.retryInMs)}`,
        });
        return;
      }
      recordAiRateLimitUsage("counterfactual", estimatedCounterfactualTokens);

      const counterfactualResponse = await fetch("/api/ai/counterfactuals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          selection: aiProviderSelection,
          localOnlyMode,
          issuesSummary,
          sceneSummary,
          constraints,
        }),
      });
      const counterfactualPayload = await counterfactualResponse.json() as {
        ok: boolean;
        error?: string;
        candidates?: CounterfactualCandidate[];
      };
      if (!counterfactualPayload.ok || !counterfactualPayload.candidates) {
        throw new Error(counterfactualPayload.error ?? "Counterfactual proposal failed.");
      }
      const candidates = counterfactualPayload.candidates;
      const ranked = verifyAndRankCounterfactualCandidates(candidates, scene, sim);

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
    cloudAvailable,
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

    if (!cloudAvailable) {
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

      const estimatedReportTokens = estimateTokensFromText(simData + sceneSummary);
      const reportBudgetDecision = evaluateAiRateLimit("report_generation", estimatedReportTokens);
      if (!reportBudgetDecision.allowed) {
        setStatus({
          state: "error",
          message: `${reportBudgetDecision.reason ?? "Report generation budget limit reached."} ${formatRetryHint(reportBudgetDecision.retryInMs)}`,
        });
        return null;
      }
      recordAiRateLimitUsage("report_generation", estimatedReportTokens);

      const reportResponse = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          selection: aiProviderSelection,
          localOnlyMode,
          simulationSummary: simData,
          sceneSummary,
        }),
      });
      const reportPayload = await reportResponse.json() as {
        ok: boolean;
        error?: string;
        report?: SecurityReport;
      };
      if (!reportPayload.ok || !reportPayload.report) {
        throw new Error(reportPayload.error ?? "Report generation failed.");
      }
      const report = reportPayload.report;
      const elapsedMs = Math.round(performance.now() - startedAt);
      const promptLineage = resolvePromptRegistryLineage("report_generation");
      recordAiActionTelemetry({
        stage: "report_generation",
        providerId: aiProviderSelection.providerId,
        providerLabel: providerSummary.providerLabel,
        model: aiProviderSelection.model,
        ...(promptLineage ?? {}),
        localOnlyMode,
        cloudAvailable,
        durationMs: elapsedMs,
        estimatedPromptTokens: estimatedReportTokens,
        estimatedCompletionTokens: estimateTokensFromText(report.executiveSummary + report.sections.map((section) => section.content).join(" ")),
        estimatedTotalTokens: estimatedReportTokens + estimateTokensFromText(report.executiveSummary + report.sections.map((section) => section.content).join(" ")),
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
  }, [aiProviderSelection.model, aiProviderSelection.providerId, cloudAvailable, localOnlyMode, providerSummary.providerLabel, providerSummary.providerName, recordAiActionTelemetry, recordRuntimeIncident]);

  const confirmPreview = useCallback(() => {
    if (!pendingPreview) {
      setStatusSafe({ state: "idle" });
      return;
    }
    if (pendingPreview.requiresTargetSelection) {
      setStatusSafe({
        state: "error",
        message: `Select a specific ${pendingPreview.unresolvedTarget ?? "target"} in the scene, then run the command again.`,
      });
      autoDismiss();
      return;
    }

    if (pendingPreview.action) {
      applyOfflineAction(pendingPreview.action);
    }

    if (pendingPreview.operations.length > 0) {
      const descriptions = applySceneOperations(pendingPreview.operations);
      setStatusSafe({ state: "success", message: descriptions.join(" • ") });
      autoDismiss();
      return;
    }

    setStatusSafe({ state: "success", message: pendingPreview.message });
    autoDismiss();
  }, [autoDismiss, pendingPreview, setStatusSafe]);

  const cancelPreview = useCallback(() => {
    setPendingPreview(null);
    setStatusSafe({ state: "idle" });
  }, [setStatusSafe]);

  const dismissError = useCallback(() => setStatusSafe({ state: "idle" }), [setStatusSafe]);

  const applyCandidate = useCallback((ops: CounterfactualCandidate["operations"]) => {
    applyCounterfactualCandidateOperations(ops);
    setStatusSafe({ state: "idle" });
  }, [setStatusSafe]);

  return {
    status,
    executeCommand,
    runCounterfactuals,
    runReportGeneration,
    dismissError,
    applyCandidate,
    confirmPreview,
    cancelPreview,
    mode,
    providerHealth,
    providerTelemetry,
    latestAiActionTelemetry,
  };
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

function containsDisallowedSecurityIntent(userText: string) {
  return /(bypass|evade|avoid\s+cameras?|disable\s+security|blind\s*spot\s+for\s+intruders?|sneak\s+past|break\s+in)/i.test(userText);
}

function describeSceneOperation(op: SceneOperation) {
  switch (op.type) {
    case "move_camera": return `Move camera`;
    case "rotate_camera": return op.pitchDeg !== undefined ? `Rotate/tilt camera` : `Rotate camera`;
    case "change_camera_fov": return `Change camera FOV`;
    case "toggle_camera": return op.status === "on" ? `Turn on camera` : `Turn off camera`;
    case "move_obstruction": return `Move obstruction`;
    case "resize_obstruction": return `Resize obstruction`;
    case "rotate_obstruction": return `Rotate obstruction`;
    case "add_obstruction": return `Add obstruction`;
    case "add_light": return `Add light`;
    case "toggle_light": return op.status === "on" ? `Turn on light` : `Turn off light`;
    case "set_time_of_day": return `Set ${op.timeOfDay} mode`;
    case "save_snapshot": return `Save snapshot`;
    case "generate_report": return `Open report`;
    case "run_adversarial":
    case "run_coverage_failure_analysis":
      return "Run coverage-failure analysis";
    case "replay_path":
      return "Replay path";
    default:
      return (() => {
        const exhaustive: never = op;
        return exhaustive;
      })();
  }
}

function verifyAndRankCounterfactualCandidates(
  candidates: CounterfactualCandidate[],
  scene: SecurityScene,
  baseline: SimulationResult,
) {
  const verified = candidates.map((candidate) => {
    try {
      const testScene = structuredClone(scene);
      const ops = candidate.operations as unknown as SceneOperation[];
      for (const op of ops) {
        applySceneOperation(testScene, op);
      }
      const testResult = simulateStudio(testScene);

      const baselineExposure = baseline.adversarialPath?.totalExposureScore;
      const nextExposure = testResult.adversarialPath?.totalExposureScore;

      return {
        ...candidate,
        verifiedDelta: {
          totalCoveragePctDelta: Number((testResult.totalCoveragePct - baseline.totalCoveragePct).toFixed(1)),
          blindspotPctDelta: Number((testResult.blindspotPct - baseline.blindspotPct).toFixed(1)),
          criticalZoneStatusChanges: testResult.criticalZoneResults
            .map((zone, index) => {
              const prev = baseline.criticalZoneResults[index];
              if (prev && prev.status !== zone.status) return `${zone.label}: ${prev.status} → ${zone.status}`;
              return null;
            })
            .filter((line): line is string => line !== null),
          worstIssueResolved:
            testResult.issues.filter((issue) => issue.severity === "critical").length
            < baseline.issues.filter((issue) => issue.severity === "critical").length,
          adversarialPathExposureDelta:
            typeof baselineExposure === "number" && typeof nextExposure === "number"
              ? Number((nextExposure - baselineExposure).toFixed(2))
              : undefined,
        },
      };
    } catch {
      return { ...candidate, verifiedDelta: undefined };
    }
  });

  return verified
    .filter((candidate) => candidate.verifiedDelta)
    .sort((a, b) => {
      const aCritical = a.verifiedDelta?.worstIssueResolved ? 1 : 0;
      const bCritical = b.verifiedDelta?.worstIssueResolved ? 1 : 0;
      if (aCritical !== bCritical) return bCritical - aCritical;

      const aCoverage = a.verifiedDelta?.totalCoveragePctDelta ?? 0;
      const bCoverage = b.verifiedDelta?.totalCoveragePctDelta ?? 0;
      if (aCoverage !== bCoverage) return bCoverage - aCoverage;

      const aExposure = a.verifiedDelta?.adversarialPathExposureDelta ?? Number.POSITIVE_INFINITY;
      const bExposure = b.verifiedDelta?.adversarialPathExposureDelta ?? Number.POSITIVE_INFINITY;
      if (aExposure !== bExposure) return aExposure - bExposure;

      const aBlindspot = a.verifiedDelta?.blindspotPctDelta ?? Number.POSITIVE_INFINITY;
      const bBlindspot = b.verifiedDelta?.blindspotPctDelta ?? Number.POSITIVE_INFINITY;
      return aBlindspot - bBlindspot;
    })
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

function applyCounterfactualCandidateOperations(ops: CounterfactualCandidate["operations"]) {
  const storeState = useStudioStore.getState();
  const logEntries: string[] = [];

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
      case "add_obstruction": {
        const o = op as {
          position: [number, number, number];
          obstructionType: "shelf" | "cupboard" | "counter" | "pillar" | "partition" | "vehicle" | "tree" | "gate" | "signboard" | "storage_boxes" | "glass_display" | "curtain" | "other";
          label?: string;
        };
        const obstruction = createObstructionNode(o.position, o.obstructionType);
        if (o.label) obstruction.label = o.label;
        storeState.scene.obstructions.push(obstruction);
        storeState.markDirty();
        logEntries.push(`Added obstruction ${obstruction.label}`);
        break;
      }
      default:
        break;
    }
  }

  for (const entry of logEntries) {
    storeState.logChange(entry);
  }
  storeState.runSimulation();
  setTimeout(() => {
    const current = useStudioStore.getState();
    current.saveSnapshot("After fix " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    current.setBottomTab("beforeafter");
  }, 200);
}

function applySceneOperations(operations: SceneOperation[]) {
  const store = useStudioStore.getState();
  const scene = store.scene;
  const descriptions: string[] = [];
  for (const op of operations) {
    descriptions.push(describeSceneOperation(op));
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
      case "add_obstruction": {
        const obstruction = createObstructionNode(op.position, op.obstructionType);
        if (op.label) obstruction.label = op.label;
        if (op.dimensions) obstruction.dimensions = op.dimensions;
        if (op.rotationYDeg !== undefined) obstruction.rotationYDeg = op.rotationYDeg;
        if (op.material) obstruction.material = op.material;
        if (op.visionTransmission !== undefined) obstruction.visionTransmission = op.visionTransmission;
        scene.obstructions.push(obstruction);
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
  return descriptions;
}
