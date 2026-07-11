"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import {
  describeAiProviderHealth,
  describeAiProviderTelemetry,
  describeAiProviderSelection,
  providerKeyAvailable,
} from "@/agents/provider-selection";
import { resolvePromptRegistryLineage } from "@/agents/prompt-registry";
import {
  draftSceneFromPrompt,
  summarizeDraftResult,
} from "@/lib/ai-layout-draft";
import { summarizeAiActionTelemetry } from "@/lib/ai-action-telemetry";
import { safeParseSecurityScene, type SecurityScene } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import type { SiteIntakeSource } from "@/lib/site-compiler";
import { useProductViewStore } from "@/store/product-view-store";
import { writeClipboardText } from "@/lib/share-link";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

function countSceneEntities(scene: SecurityScene) {
  return {
    entryPoints: scene.entryPoints.length,
    cameras: scene.cameras.length,
    securityLights: scene.securityLights.length,
    obstructions: scene.obstructions.length,
    criticalZones: scene.criticalZones.length,
    paths: scene.paths.length,
  };
}

function estimateTokensFromText(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

type AiLayoutDraftViewProps = {
  onApplyDraft: (nextScene: SecurityScene, source: SiteIntakeSource) => void;
};

export function AiLayoutDraftView({ onApplyDraft }: AiLayoutDraftViewProps) {
  const navigate = useProductViewStore((s) => s.navigate);

  const scene = useStudioStore((s) => s.scene);
  const recordOperationalEvidenceEvent = useStudioStore((s) => s.recordOperationalEvidenceEvent);
  const recordAiActionTelemetry = useStudioStore((s) => s.recordAiActionTelemetry);
  const historyDepth = useStudioStore((s) => s.historyPast.length);
  const aiProviderSelection = useStudioStore((s) => s.aiProviderSelection);
  const localOnlyMode = useStudioStore((s) => s.localOnlyMode);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);
  const aiActionTelemetry = useStudioStore((s) => s.aiActionTelemetry);
  const aiActionTelemetrySummary = useMemo(() => summarizeAiActionTelemetry(aiActionTelemetry), [aiActionTelemetry]);

  const currentAiProvider = useMemo(() => describeAiProviderSelection(aiProviderSelection), [aiProviderSelection]);
  const currentAiProviderHealth = useMemo(
    () => describeAiProviderHealth(aiProviderSelection, localOnlyMode),
    [aiProviderSelection, localOnlyMode],
  );
  const currentAiProviderTelemetry = useMemo(
    () => describeAiProviderTelemetry(aiProviderSelection, localOnlyMode),
    [aiProviderSelection, localOnlyMode],
  );
  const aiDraftModelAvailable = useMemo(
    () => providerKeyAvailable(aiProviderSelection.providerId) && !localOnlyMode,
    [aiProviderSelection.providerId, localOnlyMode],
  );

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDraftPreview, setAiDraftPreview] = useState<ReturnType<typeof draftSceneFromPrompt> | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [aiDraftNotice, setAiDraftNotice] = useState<string | null>(null);
  const [aiDraftCopyNotice, setAiDraftCopyNotice] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiDraftJsonVisible, setAiDraftJsonVisible] = useState(false);
  const [aiDraftJsonEditable, setAiDraftJsonEditable] = useState(false);
  const [aiDraftJsonText, setAiDraftJsonText] = useState("");
  const [aiDraftJsonError, setAiDraftJsonError] = useState<string | null>(null);

  const aiDraftModeLabel = aiDraftModelAvailable ? "Assistant draft available" : "Local draft available";
  const aiDraftModeDescription = localOnlyMode
    ? "Local-only mode is on. Drafts stay on this device and cloud-assisted layout generation is disabled."
    : aiDraftModelAvailable
      ? "The assistant can prepare a draft from your description. Review and approve it before use."
      : "No cloud assistant is configured, so SentinelTwin will prepare a local rule-based draft.";

  const aiDraftSummary = useMemo(
    () => (aiDraftPreview ? summarizeDraftResult(aiDraftPreview) : null),
    [aiDraftPreview],
  );
  const aiDraftScene = useMemo(() => {
    if (!aiDraftPreview) return null;
    if (!aiDraftJsonEditable) return aiDraftPreview.scene;
    try {
      const parsed = safeParseSecurityScene(JSON.parse(aiDraftJsonText));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [aiDraftJsonEditable, aiDraftJsonText, aiDraftPreview]);
  const aiDraftJsonValidation = useMemo(() => {
    if (!aiDraftPreview) return { valid: false, error: null as string | null };
    if (!aiDraftJsonEditable) return { valid: true, error: null as string | null };
    try {
      const parsed = JSON.parse(aiDraftJsonText);
      const result = safeParseSecurityScene(parsed);
      return result.success
        ? { valid: true, error: null as string | null }
        : { valid: false, error: result.error.issues[0]?.message ?? "JSON must validate as a SecurityScene." };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : "Draft JSON must be valid JSON." };
    }
  }, [aiDraftJsonEditable, aiDraftJsonText, aiDraftPreview]);
  const aiDraftCounts = useMemo(() => {
    if (!aiDraftScene) return null;
    return countSceneEntities(aiDraftScene);
  }, [aiDraftScene]);
  const aiDraftComparison = useMemo(() => {
    if (!aiDraftSummary || !aiDraftCounts) return null;
    const current = {
      entryPoints: scene.entryPoints.length,
      cameras: scene.cameras.length,
      securityLights: scene.securityLights.length,
      obstructions: scene.obstructions.length,
      criticalZones: scene.criticalZones.length,
      paths: scene.paths.length,
    };
    const delta = {
      entryPoints: aiDraftCounts.entryPoints - current.entryPoints,
      cameras: aiDraftCounts.cameras - current.cameras,
      securityLights: aiDraftCounts.securityLights - current.securityLights,
      obstructions: aiDraftCounts.obstructions - current.obstructions,
      criticalZones: aiDraftCounts.criticalZones - current.criticalZones,
      paths: aiDraftCounts.paths - current.paths,
    };
    return { current, draft: aiDraftCounts, delta };
  }, [aiDraftCounts, aiDraftSummary, scene]);
  const aiDraftSceneJson = useMemo(
    () => {
      if (aiDraftJsonEditable) return aiDraftJsonText;
      if (!aiDraftScene) return "";
      return JSON.stringify(aiDraftScene, null, 2);
    },
    [aiDraftJsonEditable, aiDraftJsonText, aiDraftScene],
  );
  const aiDraftDisplayCounts = aiDraftCounts ?? aiDraftSummary?.counts ?? null;
  const aiDraftJsonIssue = aiDraftJsonError ?? (aiDraftJsonEditable && !aiDraftJsonValidation.valid ? aiDraftJsonValidation.error : null);

  const resetAiDraftPreview = () => {
    setAiDraftPreview(null);
    setAiWarning(null);
    setAiDraftNotice(null);
    setAiDraftCopyNotice(null);
    setAiDraftJsonVisible(false);
    setAiDraftJsonEditable(false);
    setAiDraftJsonText("");
    setAiDraftJsonError(null);
  };

  const handleCancel = () => {
    resetAiDraftPreview();
    navigate("product_home");
  };

  const handleGenerate = async () => {
    setAiGenerating(true);
    const draftStartedAt = performance.now();
    const promptLineage = resolvePromptRegistryLineage("ai_draft");
    try {
      const draftResponse = await fetch("/api/ai/draft-scene", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          selection: aiProviderSelection,
          localOnlyMode,
        }),
      });
      const draftPayload = await draftResponse.json() as {
        ok: boolean;
        mode?: "model" | "heuristic";
        reason?: string;
        draft?: ReturnType<typeof draftSceneFromPrompt>;
        error?: string;
      };
      if (!draftPayload.ok || !draftPayload.draft) {
        throw new Error(draftPayload.error ?? "AI draft generation failed.");
      }
      const useModelDraft = draftPayload.mode === "model";
      const draft = draftPayload.draft;
      const draftValidation = safeParseSecurityScene(draft.scene);
      if (!draftValidation.success) {
        throw new Error(`Generated draft is invalid SecurityScene data: ${draftValidation.error.issues[0]?.message ?? "validation failed"}`);
      }
      setAiDraftPreview(draft);
      recordAiActionTelemetry({
        stage: "ai_draft",
        providerId: aiProviderSelection.providerId,
        providerLabel: currentAiProvider.providerLabel,
        model: aiProviderSelection.model,
        ...(promptLineage ?? {}),
        localOnlyMode,
        cloudAvailable: useModelDraft,
        durationMs: Math.max(0, Math.round(performance.now() - draftStartedAt)),
        estimatedPromptTokens: estimateTokensFromText(aiPrompt),
        estimatedCompletionTokens: estimateTokensFromText(JSON.stringify(draft.scene)),
        estimatedTotalTokens: estimateTokensFromText(aiPrompt) + estimateTokensFromText(JSON.stringify(draft.scene)),
        tokenSource: "estimated",
        status: "success",
        note: useModelDraft
          ? `Model-backed if the provider is configured and local-only mode is off. Draft preview from ${currentAiProvider.providerLabel}.`
          : localOnlyMode
            ? "Heuristic draft preview enforced by local-only policy."
            : `Heuristic draft preview used because ${currentAiProvider.envKey} is not set.`,
      });
      recordOperationalEvidenceEvent({
        kind: "draft_proposed",
        title: "AI draft preview generated",
        details: `Preview generated from prompt: ${aiPrompt.trim().slice(0, 120) || "Untitled prompt"}`,
        actor: "ai",
        source: scene.source,
        sceneId: scene.id,
        sceneName: scene.name,
        revisionDepth: historyDepth,
        affectedNodeIds: [],
        confidence: draft.provenance.confidenceLevel === "high"
          ? 0.92
          : draft.provenance.confidenceLevel === "medium"
            ? 0.74
            : 0.55,
        beforeSummary: `${scene.name || "Current workspace"} · ${scene.cameras.length} cameras · ${scene.criticalZones.length} critical zones`,
        afterSummary: draft.provenance.summary,
        notes: [useModelDraft ? `Provider: ${currentAiProvider.providerLabel}` : "Heuristic preview generated locally."],
      });
      const warning =
        draft.warnings[0] ?? draftPayload.reason ?? (localOnlyMode
          ? "Local-only mode is on, so heuristic draft generation is enforced."
          : useModelDraft
            ? `Model draft generated with ${currentAiProvider.providerLabel}.`
            : `Using heuristic draft because ${currentAiProvider.envKey} is not set.`);
      setAiWarning(warning);
      setAiDraftNotice(`${draft.provenance.summary} (${draft.provenance.confidenceLevel} confidence)`);
    } catch (error) {
      const fallback = draftSceneFromPrompt(aiPrompt);
      const fallbackValidation = safeParseSecurityScene(fallback.scene);
      if (!fallbackValidation.success) {
        setAiWarning(`Draft failed validation and fallback was invalid: ${fallbackValidation.error.issues[0]?.message ?? "validation failed"}`);
        setAiDraftNotice("Draft preview blocked until a valid SecurityScene can be generated.");
        setAiDraftPreview(null);
        recordAiActionTelemetry({
          stage: "ai_draft",
          providerId: aiProviderSelection.providerId,
          providerLabel: currentAiProvider.providerLabel,
          model: aiProviderSelection.model,
          ...(promptLineage ?? {}),
          localOnlyMode,
          cloudAvailable: false,
          durationMs: Math.max(0, Math.round(performance.now() - draftStartedAt)),
          estimatedPromptTokens: estimateTokensFromText(aiPrompt),
          estimatedCompletionTokens: 0,
          estimatedTotalTokens: estimateTokensFromText(aiPrompt),
          tokenSource: "estimated",
          status: "error",
          note: `Draft validation failed and fallback invalid. ${error instanceof Error ? error.message : ""}`.trim(),
        });
        return;
      }
      setAiDraftPreview(fallback);
      recordAiActionTelemetry({
        stage: "ai_draft",
        providerId: aiProviderSelection.providerId,
        providerLabel: currentAiProvider.providerLabel,
        model: aiProviderSelection.model,
        ...(promptLineage ?? {}),
        localOnlyMode,
        cloudAvailable: false,
        durationMs: Math.max(0, Math.round(performance.now() - draftStartedAt)),
        estimatedPromptTokens: estimateTokensFromText(aiPrompt),
        estimatedCompletionTokens: estimateTokensFromText(JSON.stringify(fallback.scene)),
        estimatedTotalTokens: estimateTokensFromText(aiPrompt) + estimateTokensFromText(JSON.stringify(fallback.scene)),
        tokenSource: "estimated",
        status: "error",
        note: localOnlyMode
          ? "Heuristic fallback draft generated in local-only mode."
          : `Model draft failed; heuristic fallback used. ${error instanceof Error ? error.message : ""}`.trim(),
      });
      recordOperationalEvidenceEvent({
        kind: "draft_proposed",
        title: "AI draft preview generated",
        details: `Preview generated from prompt: ${aiPrompt.trim().slice(0, 120) || "Untitled prompt"}`,
        actor: "ai",
        source: scene.source,
        sceneId: scene.id,
        sceneName: scene.name,
        revisionDepth: historyDepth,
        affectedNodeIds: [],
        confidence: fallback.provenance.confidenceLevel === "high"
          ? 0.92
          : fallback.provenance.confidenceLevel === "medium"
            ? 0.74
            : 0.55,
        beforeSummary: `${scene.name || "Current workspace"} · ${scene.cameras.length} cameras · ${scene.criticalZones.length} critical zones`,
        afterSummary: fallback.provenance.summary,
        notes: [localOnlyMode ? "Heuristic preview generated in local-only mode." : "Heuristic fallback preview generated."],
      });
      const warning = localOnlyMode
        ? "Local-only mode is on, so heuristic fallback was used."
        : `Model draft failed; fallback used. ${error instanceof Error ? error.message : ""}`.trim();
      setAiWarning(warning);
      setAiDraftNotice(`${fallback.provenance.summary} (${fallback.provenance.confidenceLevel} confidence)`);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleApplyDraft = () => {
    if (!aiDraftPreview) return;
    if (aiDraftJsonEditable && !aiDraftJsonValidation.valid) {
      setAiDraftJsonError(aiDraftJsonValidation.error ?? "Draft JSON must validate as a SecurityScene.");
      return;
    }
    if (simulationDirty && !window.confirm("Current workspace has unapplied changes. Continue to apply this AI layout draft?")) return;
    const nextScene = aiDraftScene ?? aiDraftPreview.scene;
    onApplyDraft(nextScene, "ai_prompt");
    navigate("site_draft_review");
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-[color:var(--text-muted)] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/12 text-violet-400 ring-1 ring-violet-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Site Layout Draft</h1>
            <p className="text-xs text-[color:var(--text-muted)]">
              Describe the site, review the proposed layout, then approve it before it becomes active.
            </p>
          </div>
        </div>

        {/* Provider status */}
        <div className={`mt-4 rounded-lg border UI_SURFACES.borderStandard UI_SURFACES.hoverBgSubtle px-3 py-2 text-[10px] UI_SURFACES.textMuted4`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${aiDraftModelAvailable ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-amber-400/20 bg-amber-500/10 text-amber-200"}`}>
              {aiDraftModeLabel}
            </span>
            <span className={`rounded-full border UI_SURFACES.borderDark UI_SURFACES.bgDeep px-2 py-0.5 text-[9px] UI_SURFACES.textBlueSoft`}>
              {currentAiProvider.providerLabel}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[9px] ${
                currentAiProviderHealth.overallStatus === "healthy"
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                  : currentAiProviderHealth.overallStatus === "partial"
                    ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
                    : "border-red-400/20 bg-red-500/10 text-red-200"
              }`}
            >
              {currentAiProviderHealth.overallStatus === "healthy" ? "Assistant ready" : currentAiProviderHealth.overallStatus === "partial" ? "Assistant limited" : "Assistant blocked"}
            </span>
          </div>
          <p className={`mt-2 text-[10px] leading-snug UI_SURFACES.textSoftBright`}>{aiDraftModeDescription}</p>
          <details className={`mt-1 text-[10px] leading-snug UI_SURFACES.textSoftBright`}>
            <summary className="cursor-pointer UI_SURFACES.textMuted4">Advanced assistant diagnostics</summary>
            <p className="mt-1">
              Provider readiness: {currentAiProviderHealth.healthyProviders} ready / {currentAiProviderHealth.partialProviders} limited / {currentAiProviderHealth.blockedProviders} blocked.
            </p>
            <p className="mt-1">
              Cost and latency: {currentAiProviderTelemetry.activeCostLabel} · {currentAiProviderTelemetry.activeLatencyLabel}.
            </p>
            <p className="mt-1">
              Usage trend: {aiActionTelemetrySummary.trendLabel} · {aiActionTelemetrySummary.trendNote}
            </p>
          </details>
        </div>

        {/* Prompt input */}
        <textarea
          value={aiPrompt}
          onChange={(event) => {
            setAiPrompt(event.target.value);
            resetAiDraftPreview();
          }}
          placeholder="Describe the site layout, rooms, cameras, and security zones..."
          className={`mt-4 h-36 w-full rounded-lg border UI_SURFACES.borderDark UI_SURFACES.card p-3 text-xs UI_SURFACES.textNear outline-none focus:border-blue-500/50`}
        />

        {aiWarning ? <p className="mt-2 text-xs text-amber-300">{aiWarning}</p> : null}

        {/* Draft preview */}
        {aiDraftSummary ? (
          <div className={`mt-3 rounded-2xl border UI_SURFACES.borderStandard UI_SURFACES.hoverBgDark p-3`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`text-[9px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textSoftBright`}>Draft Preview</div>
                <div className="mt-1 text-sm font-semibold text-white">{aiDraftSummary.sceneName}</div>
                <div className="mt-1 text-[10px] UI_SURFACES.textMuted3">
                  {aiDraftSummary.sourceLabel} · {aiDraftSummary.modeLabel} · {aiDraftSummary.confidenceLabel} · {aiDraftSummary.sizeLabel}
                </div>
              </div>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-cyan-100">
                Review before apply
              </span>
            </div>

            {/* Counts grid */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-[9px]">
              {[
                ["Cameras", "cameras"],
                ["Lights", "securityLights"],
                ["Obstructions", "obstructions"],
                ["Zones", "criticalZones"],
                ["Paths", "paths"],
                ["Entries", "entryPoints"],
              ].map(([label, key]) => (
                <div key={key} className={`rounded-lg border UI_SURFACES.borderStandard UI_SURFACES.card px-2 py-1.5 UI_SURFACES.textNearAlt`}>
                  <div className={`UI_SURFACES.textSoftBright`}>{label}</div>
                  <div className="text-sm font-semibold text-white">
                    {aiDraftDisplayCounts?.[key as keyof typeof aiDraftDisplayCounts] ?? 0}
                  </div>
                </div>
              ))}
            </div>

            {/* Comparison */}
            {aiDraftComparison ? (
              <div className={`mt-3 rounded-2xl border UI_SURFACES.borderStandard UI_SURFACES.panelDeep p-3`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className={`text-[9px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textSoftBright`}>Workspace comparison</div>
                    <div className="mt-0.5 text-[10px] UI_SURFACES.textMuted3">What changes if you apply this draft?</div>
                  </div>
                  <span className={`rounded-full border UI_SURFACES.borderDark UI_SURFACES.card px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] UI_SURFACES.textBlueSoft`}>
                    Current vs Draft
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[9px]">
                  {([
                    ["Cameras", "cameras"],
                    ["Lights", "securityLights"],
                    ["Obstructions", "obstructions"],
                    ["Zones", "criticalZones"],
                    ["Paths", "paths"],
                    ["Entries", "entryPoints"],
                  ] as const).map(([label, key]) => {
                    const currentValue = aiDraftComparison.current[key];
                    const draftValue = aiDraftComparison.draft[key];
                    const delta = aiDraftComparison.delta[key];
                    const deltaLabel = delta === 0 ? "No change" : delta > 0 ? `+${delta}` : `${delta}`;
                    const deltaTone = delta > 0 ? "text-emerald-300" : delta < 0 ? "text-red-300" : "UI_SURFACES.textMuted3";
                    return (
                      <div key={key} className={`rounded-lg border UI_SURFACES.borderStandard UI_SURFACES.card px-2 py-1.5`}>
                        <div className={`UI_SURFACES.textSoftBright`}>{label}</div>
                        <div className="mt-0.5 flex items-baseline justify-between gap-2">
                          <span className="text-[10px] UI_SURFACES.textMuted3">{currentValue} → {draftValue}</span>
                          <span className={`text-[10px] font-semibold ${deltaTone}`}>{deltaLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* JSON */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div>
                <div className={`text-[9px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textSoftBright`}>Advanced Data View</div>
                <div className="mt-0.5 text-[10px] UI_SURFACES.textMuted3">Optional site twin data review before applying the draft.</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAiDraftJsonVisible((v) => !v)}
                  className={`rounded-full border UI_SURFACES.borderDark UI_SURFACES.card px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] UI_SURFACES.textBlueSoft`}
                >
                  {aiDraftJsonVisible ? "Hide Data" : "Show Data"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!aiDraftJsonVisible) setAiDraftJsonVisible(true);
                    setAiDraftJsonEditable((e) => !e);
                    setAiDraftJsonError(null);
                  }}
                  className={`rounded-full border UI_SURFACES.borderDark UI_SURFACES.card px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] UI_SURFACES.textBlueSoft`}
                >
                  {aiDraftJsonEditable ? "Lock Data" : "Edit Data"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!aiDraftSceneJson) return;
                    const copied = await writeClipboardText(aiDraftSceneJson);
                    setAiDraftCopyNotice(copied ? "Draft JSON copied to clipboard." : "Clipboard unavailable.");
                  }}
                  disabled={!aiDraftSceneJson}
                  className={`rounded-full border UI_SURFACES.borderDark UI_SURFACES.card px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] UI_SURFACES.textBlueSoft disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  Copy Data
                </button>
              </div>
            </div>

            {aiDraftJsonVisible ? (
              aiDraftJsonEditable ? (
                <textarea
                  value={aiDraftJsonText}
                  onChange={(event) => {
                    setAiDraftJsonText(event.target.value);
                    if (aiDraftJsonError) setAiDraftJsonError(null);
                  }}
                  spellCheck={false}
                  className="mt-2 h-56 w-full rounded-xl border UI_SURFACES.borderDeep UI_SURFACES.panel p-3 font-mono text-[9px] leading-relaxed UI_SURFACES.textMuted3 outline-none focus:border-cyan-500/40"
                />
              ) : (
                <pre className="mt-2 max-h-52 overflow-auto rounded-xl border UI_SURFACES.borderDeep UI_SURFACES.panel p-3 text-[9px] leading-relaxed UI_SURFACES.textMuted3">
                  {aiDraftSceneJson}
                </pre>
              )
            ) : null}

            {aiDraftJsonIssue ? (
              <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] text-red-100">
                Site twin data must validate before apply: {aiDraftJsonIssue}
              </div>
            ) : null}
            {aiDraftCopyNotice ? (
              <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] text-emerald-100">
                {aiDraftCopyNotice}
              </div>
            ) : null}

            <div className={`mt-3 rounded-xl border UI_SURFACES.borderDeep UI_SURFACES.panelDeep px-3 py-2 text-[10px] UI_SURFACES.textMuted4`}>
              {aiDraftSummary.summary}
            </div>
            {aiDraftSummary.warnings.length > 0 ? (
              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-100">
                <div className="font-semibold uppercase tracking-[0.14em] text-amber-200">Draft notes</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {aiDraftSummary.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className={`mt-3 rounded-lg border border-dashed UI_SURFACES.borderStandard UI_SURFACES.card/60 px-3 py-2 text-[10px] UI_SURFACES.textMuted3`}>
            Generate a preview to review the site summary, counts, and notes before applying it to the workspace.
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-white/8 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className={`rounded-lg border UI_SURFACES.borderDark px-3 py-1.5 text-xs UI_SURFACES.textMuted4 hover:bg-white/[0.03]`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={aiGenerating}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {aiGenerating ? "Preparing..." : aiDraftSummary ? "Regenerate Preview" : "Generate Preview"}
          </button>
          <button
            type="button"
            onClick={handleApplyDraft}
            disabled={!aiDraftPreview || aiGenerating || (aiDraftJsonEditable && !aiDraftJsonValidation.valid)}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-900/60"
          >
            Review Draft Site
          </button>
        </div>

        {aiDraftNotice ? (
          <div className={`mt-3 rounded-lg border UI_SURFACES.borderStandard UI_SURFACES.card px-3 py-2 text-[10px] UI_SURFACES.textNearAlt`}>
            <span className="font-semibold text-cyan-200">Draft status:</span> {aiDraftNotice}
          </div>
        ) : null}
      </div>
    </div>
  );
}
