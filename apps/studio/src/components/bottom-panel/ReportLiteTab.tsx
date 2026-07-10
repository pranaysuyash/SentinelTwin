"use client";

import { Copy, Database, FileText, Globe, Loader2, Printer, Share2, Sparkles } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";

import type { SecurityReport } from "@/agents/ReportAgent";
import { buildCompareShareLink } from "@/lib/compare-share-link";
import { shareLinkOrCopy, writeClipboardText } from "@/lib/share-link";
import { useAiCommand } from "@/hooks/use-ai-command";
import { buildSecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";
import { exportTextAsPdf, exportAuditReportPdf } from "@/lib/pdf-export";
import { buildReportEvidenceBundle, stringifyReportEvidenceBundle } from "@/lib/report-evidence-bundle";
import { summarizeOperationalEvidenceTemporalTwin } from "@/lib/operational-evidence";
import { buildSecurityAnalyticsModel } from "@/lib/security-analytics";
import { ANALYTICS_REPORT_STYLES, buildAnalyticsReportSection } from "@/lib/report-analytics-export";
import {
  applyReportVisibility,
  buildCompareReportData,
  buildReportData,
  exportCompareAsHtml,
  exportCompareAsMarkdown,
  exportAsMarkdown,
  getReportAudienceProfile,
  getReportStandardTemplateProfile,
  getReportStandardTemplates,
  getReportVisibilityProfile,
  type ReportAudience,
  type ReportRedactionPolicy,
  type ReportStandardTemplateId,
  type ReportVisibility,
} from "@sentineltwin/report";
import { type WorkspaceRole } from "@/lib/workspace-governance";
import {
  buildReportCatalogPresets,
  createReportCatalogPreset,
  findReportCatalogPresetById,
  findReportCatalogPresetBySelection,
  loadReportCatalogState,
  persistReportCatalogState,
  removeReportCatalogPreset,
  upsertReportCatalogPreset,
  type ReportCatalogState,
} from "@/lib/report-catalog";
import { summarizeSceneTruthLadder } from "@/lib/truth-ladder";
import { QUALITY_RANK } from "@/lib/quality-display";
import { TruthBadge } from "@/components/shared/TruthBadge";
import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import { useStudioStore } from "@/store/studio-store";
import { buildReportSummaryLines } from "@/lib/report-summary";
import { buildOutcomeDrivenReportMarkdown } from "@/lib/report-outcome-markdown";
import { truthLabelDetail } from "@/lib/truth-labels";
import { buildPlainLanguageReport, formatPlainLanguageMarkdown } from "@/lib/report-plain-language";
import { buildCoverageProvenance, formatProvenanceMarkdown } from "@/lib/coverage-provenance";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

type InfrastructureEstimate = {
  cameraCount: number;
  sensorCount: number;
  retentionDays: number;
  storageTb: number;
  bandwidthMbps: number;
  poeBudgetW: number;
  poeEstimatedW: number;
  cableEstimateM: number;
  nvrChannels: number;
};

const ROLE_TO_REPORT_AUDIENCE: Record<WorkspaceRole, ReportAudience> = {
  operator: "facilities_director",
  reviewer: "consultant",
  installer: "operations_manager",
  insurer: "auditor",
  auditor: "auditor",
  privacy_reviewer: "privacy_reviewer",
  admin: "facilities_director",
  operations_manager: "operations_manager",
};

function getDefaultReportAudience(activeRole: WorkspaceRole) {
  return ROLE_TO_REPORT_AUDIENCE[activeRole] ?? "operator";
}

export function ReportLiteTab() {
  const result = useStudioStore((s) => s.simulationResult);
  const scene = useStudioStore((s) => s.scene);
  const snapshots = useStudioStore((s) => s.snapshots);
  const temporalProfile = useStudioStore((s) => s.temporalProfile);
  const operationalEvidenceEvents = useStudioStore((s) => s.operationalEvidenceEvents);
  const reportEvidenceEntries = useMemo(
    () => operationalEvidenceEvents.map((event) => ({
      title: event.title,
      description: event.details,
      details: event.details,
      anchorId: event.id,
      published: event.lifecycleStage === "published",
      createdAt: event.timestamp,
      confidence: event.confidence != null ? `${Math.round(event.confidence * 100)}%` : undefined,
    })),
    [operationalEvidenceEvents],
  );
  const compareVisualEvidence = useStudioStore((s) => s.compareVisualEvidence);
  const compareReportSelection = useStudioStore((s) => s.compareReportSelection);
  const workspaceGovernance = useStudioStore((s) => s.workspaceGovernance);
  const activePathId = useStudioStore((s) => s.activePathId);
  const { runReportGeneration } = useAiCommand();
  const [aiReport, setAiReport] = useState<SecurityReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportMode, setReportMode] = useState<"single" | "compare" | "plain">(compareReportSelection ? "compare" : "single");
  const postureScore = useStudioStore((s) => s.postureScore);
  const defaultTemplateId: ReportStandardTemplateId = scene.assumptions.doriStandard === "oodpcvs_2025" ? "oodpcvs-audit" : "dori-audit";
  const [reportCatalogState, setReportCatalogState] = useState<ReportCatalogState>(() => loadReportCatalogState());
  const [reportAudience, setReportAudience] = useState<ReportAudience>(() => getDefaultReportAudience(workspaceGovernance.activeRole));
  const [reportVisibility, setReportVisibility] = useState<ReportVisibility>("internal");
  const [reportTemplateId, setReportTemplateId] = useState<ReportStandardTemplateId>(defaultTemplateId);
  const [redactionPolicy, setRedactionPolicy] = useState<ReportRedactionPolicy>({
    redactCameraIps: false,
    redactGpsCoordinates: false,
    redactPatrolRoutes: false,
    maskVulnerabilities: false,
  });
  const [presetNameDraft, setPresetNameDraft] = useState(() => {
    const defaultAudience = getDefaultReportAudience(workspaceGovernance.activeRole);
    return `${getReportAudienceProfile(defaultAudience).label} Evidence`;
  });
  const [snapshotAId, setSnapshotAId] = useState<string | null>(null);
  const [snapshotBId, setSnapshotBId] = useState<string | null>(null);
  const activePath = scene.paths.find((path) => path.id === activePathId) ?? null;
  const outcome = buildSecurityOutcomeModel(scene, result, activePath);
  const truthLadder = useMemo(() => summarizeSceneTruthLadder(scene), [scene]);
  const audienceProfile = useMemo(() => getReportAudienceProfile(reportAudience), [reportAudience]);
  const visibilityProfile = useMemo(() => getReportVisibilityProfile(reportVisibility), [reportVisibility]);
  const reportCatalog = useMemo(
    () => buildReportCatalogPresets(reportCatalogState.customPresets),
    [reportCatalogState.customPresets],
  );
  const selectedCatalogPreset = useMemo(
    () =>
      findReportCatalogPresetBySelection(reportCatalog, {
        audience: reportAudience,
        visibility: reportVisibility,
        templateId: reportTemplateId,
      }) ??
      findReportCatalogPresetById(reportCatalog, reportCatalogState.selectedPresetId) ??
      null,
    [reportAudience, reportCatalog, reportCatalogState.selectedPresetId, reportTemplateId, reportVisibility],
  );
  const availablePresets = useMemo(
    () => reportCatalog.filter((preset) => preset.id !== selectedCatalogPreset?.id),
    [reportCatalog, selectedCatalogPreset?.id],
  );
  const availableTemplates = useMemo(() => getReportStandardTemplates(), []);
  const singleReport = useMemo(
    () =>
      (result
        ? buildReportData(scene, result, {
            operationalEvidenceEvents: reportEvidenceEntries,
            audience: reportAudience,
            visibility: reportVisibility,
            templateId: reportTemplateId,
            redactionPolicy,
          })
        : null),
    [operationalEvidenceEvents, reportAudience, reportTemplateId, reportVisibility, redactionPolicy, result, scene],
  );
  const singleExportReport = useMemo(
    () => (singleReport ? applyReportVisibility(singleReport, reportVisibility) : null),
    [reportVisibility, singleReport],
  );
  const temporalTwin = useMemo(
    () => summarizeOperationalEvidenceTemporalTwin(operationalEvidenceEvents, scene),
    [operationalEvidenceEvents, scene],
  );
  const reportSummary = buildReportSummaryLines(outcome, result, scene, temporalTwin);
  const infrastructureEstimate = useMemo<InfrastructureEstimate>(() => {
    const cameraCount = scene.cameras.length;
    const sensorCount = scene.sensors.length;
    const retentionDays = 30;
    const storagePerCameraTb = 0.45;
    const storageTb = Number((cameraCount * storagePerCameraTb).toFixed(2));
    const avgBitrateMbps = 3.5;
    const bandwidthMbps = Number((cameraCount * avgBitrateMbps).toFixed(1));
    const poeEstimatedW = Number((cameraCount * 8.5 + sensorCount * 2.2).toFixed(1));
    const poeBudgetW = Math.max(120, Math.ceil(poeEstimatedW / 60) * 60);
    const cableEstimateM = Math.max(40, Math.round((cameraCount * 18 + sensorCount * 8) / 5) * 5);
    const nvrChannels = Math.max(4, Math.ceil(cameraCount / 4) * 4);
    return {
      cameraCount,
      sensorCount,
      retentionDays,
      storageTb,
      bandwidthMbps,
      poeBudgetW,
      poeEstimatedW,
      cableEstimateM,
      nvrChannels,
    };
  }, [scene.cameras.length, scene.sensors.length]);
  const zoneComplianceRows = useMemo(() => {
    if (!result) return [];
    const byId = new Map(result.criticalZoneResults.map((entry) => [entry.zoneId, entry] as const));
    return scene.criticalZones.map((zone) => {
      const row = byId.get(zone.id) ?? null;
      const status = row?.status ?? "unknown";
      return {
        id: zone.id,
        label: zone.label,
        required: zone.requiredQuality,
        actual: row?.actualQuality ?? "none",
        status,
        pass: status === "pass",
      };
    });
  }, [result, scene.criticalZones]);

  useEffect(() => {
    if (selectedCatalogPreset) return;
    const nextDefaultAudience = getDefaultReportAudience(workspaceGovernance.activeRole);
    if (nextDefaultAudience === reportAudience) return;
    setReportAudience(nextDefaultAudience);
    syncCatalogSelection(nextDefaultAudience, reportVisibility, reportTemplateId);
  }, [selectedCatalogPreset, reportAudience, reportTemplateId, reportVisibility, workspaceGovernance.activeRole]);

  const installerHandoffMarkdown = useMemo(() => {
    const lines = [
      "# SentinelTwin Installer Handoff",
      `Scene: ${scene.name}`,
      `Cameras: ${infrastructureEstimate.cameraCount}`,
      `Sensors: ${infrastructureEstimate.sensorCount}`,
      `Cable estimate: ${infrastructureEstimate.cableEstimateM}m`,
      `NVR channels: ${infrastructureEstimate.nvrChannels}`,
      "",
      "## Zone Compliance Checklist",
      ...zoneComplianceRows.map((row) => `- [${row.pass ? "x" : " "}] ${row.label}: required ${row.required}, actual ${row.actual} (${row.status})`),
      "",
      "## Pre-Install Notes",
      "- Validate mounting points, cable paths, and power budget on site.",
      "- Confirm night lighting assumptions and obstruction reality before final alignment.",
      "- Re-run simulation after commissioning captures and update report evidence bundle.",
    ];
    return lines.join("\n");
  }, [infrastructureEstimate, scene.name, zoneComplianceRows]);
  const commissioningChecklistMarkdown = useMemo(() => {
    const lines = [
      "# SentinelTwin Commissioning Checklist",
      `Scene: ${scene.name}`,
      "",
      "1. Camera stream online and naming verified against plan.",
      "2. Field of view, yaw/pitch, and mount heights match simulated assumptions.",
      "3. Critical zones pass required quality thresholds.",
      "4. Path replay visibility validated for active incident routes.",
      "5. Sensor events linked to nearest cameras and evidence timeline.",
      "6. Before/after report and evidence bundle exported for handoff.",
    ];
    return lines.join("\n");
  }, [scene.name]);

  useEffect(() => {
    persistReportCatalogState(reportCatalogState);
  }, [reportCatalogState]);

  useEffect(() => {
    if (!selectedCatalogPreset) return;
    startTransition(() => {
      setReportAudience(selectedCatalogPreset.audience);
      setReportVisibility(selectedCatalogPreset.visibility);
      setReportTemplateId(selectedCatalogPreset.templateId);
      setPresetNameDraft(selectedCatalogPreset.title);
    });
  }, [selectedCatalogPreset]);

  useEffect(() => {
    if (reportCatalogState.selectedPresetId && !selectedCatalogPreset) {
      startTransition(() => {
        setReportCatalogState((current) => ({
          ...current,
          selectedPresetId: null,
        }));
      });
    }
  }, [reportCatalogState.selectedPresetId, selectedCatalogPreset]);

  const syncCatalogSelection = (nextAudience: ReportAudience, nextVisibility: ReportVisibility, nextTemplateId: ReportStandardTemplateId) => {
    const matched = findReportCatalogPresetBySelection(reportCatalog, {
      audience: nextAudience,
      visibility: nextVisibility,
      templateId: nextTemplateId,
    });
    setReportCatalogState((current) => {
      if (current.selectedPresetId === (matched?.id ?? null)) return current;
      return {
        ...current,
        selectedPresetId: matched?.id ?? null,
      };
    });
  };

  // Build markdown from outcome model (canonical source) or AI report
  const singleSceneMarkdown = result
    ? (aiReport ? buildAiReportMarkdown(aiReport) : buildOutcomeDrivenReportMarkdown(outcome, result, scene, activePathId))
    : "";

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    const report = await runReportGeneration();
    if (report) setAiReport(report);
    setIsGenerating(false);
  };

  const selectedSnapshotAId = snapshotAId ?? compareReportSelection?.snapshotAId ?? null;
  const selectedSnapshotBId = snapshotBId ?? compareReportSelection?.snapshotBId ?? null;
  const snapshotA = selectedSnapshotAId ? snapshots.find((snapshot) => snapshot.id === selectedSnapshotAId) ?? null : null;
  const snapshotB = selectedSnapshotBId ? snapshots.find((snapshot) => snapshot.id === selectedSnapshotBId) ?? null : null;
  const compareSelectionProvenanceNote = compareReportSelection?.snapshotAId === selectedSnapshotAId && compareReportSelection?.snapshotBId === selectedSnapshotBId
    ? compareReportSelection.provenanceNote
    : null;
  const compareSelectionMissing = reportMode === "compare" && (!snapshotA || !snapshotB);
  const hasCompareSimulation = Boolean(snapshotA?.simulation && snapshotB?.simulation);
  const compareReport = useMemo(
    () => {
      if (!hasCompareSimulation || !snapshotA?.simulation || !snapshotB?.simulation) {
        return null;
      }
      return buildCompareReportData(
        { ...snapshotA.scene, snapshots: [], scenarios: [] } as never,
        snapshotA.simulation,
        { ...snapshotB.scene, snapshots: [], scenarios: [] } as never,
        snapshotB.simulation,
        { audience: reportAudience, visibility: reportVisibility, templateId: reportTemplateId, redactionPolicy },
      );
    },
    [hasCompareSimulation, reportAudience, reportTemplateId, reportVisibility, redactionPolicy, snapshotA, snapshotB],
  );
  const compareExportReport = useMemo(
    () => (compareReport ? applyReportVisibility(compareReport as never as Parameters<typeof applyReportVisibility>[0], reportVisibility) as never as Parameters<typeof exportCompareAsMarkdown>[0] : null),
    [compareReport, reportVisibility],
  );
  const compareMarkdown = compareExportReport ? exportCompareAsMarkdown(compareExportReport) : "";
  const plainLanguageMarkdown = useMemo(() => {
    if (!result) return "";
    const plain = buildPlainLanguageReport(scene, result, { temporalProfile, postureScore });
    return formatPlainLanguageMarkdown(plain);
  }, [result, scene, temporalProfile, postureScore]);
  const currentReportMarkdown = reportMode === "compare"
    ? (hasCompareSimulation ? compareMarkdown : "Select two simulated snapshots to preview compare markdown.")
    : reportMode === "plain"
      ? plainLanguageMarkdown
      : (singleExportReport ? exportAsMarkdown(singleExportReport) : singleSceneMarkdown);

  useEffect(() => {
    if (compareReportSelection) {
      startTransition(() => {
        setReportMode("compare");
      });
    }
  }, [compareReportSelection]);

  const copy = () => writeClipboardText(currentReportMarkdown);
  const copyCompareLink = async () => {
    if (reportMode !== "compare" || !snapshotA || !snapshotB) return;
    const link = buildCompareShareLink(
      window.location.origin + window.location.pathname,
      window.location.search,
      {
        compareSnapshotAId: snapshotA.id,
        compareSnapshotBId: snapshotB.id,
        compareMode: "report",
        compareProvenanceNote: compareSelectionProvenanceNote,
      },
      window.location.hash,
    );
    await writeClipboardText(link);
  };

  const shareCompareLink = async () => {
    if (reportMode !== "compare" || !snapshotA || !snapshotB) return;
    const link = buildCompareShareLink(
      window.location.origin + window.location.pathname,
      window.location.search,
      {
        compareSnapshotAId: snapshotA.id,
        compareSnapshotBId: snapshotB.id,
        compareMode: "report",
        compareProvenanceNote: compareSelectionProvenanceNote,
      },
      window.location.hash,
    );
    await shareLinkOrCopy({
      title: "SentinelTwin report compare handoff",
      text: "Open this compare pair in the SentinelTwin report comparison view.",
      url: link,
    });
  };
  const visuals = compareVisualEvidence &&
    compareVisualEvidence.snapshotAId === (snapshotA?.id ?? "") &&
    compareVisualEvidence.snapshotBId === (snapshotB?.id ?? "") &&
    compareVisualEvidence.capturedAt >= Math.max(snapshotA?.createdAt ?? 0, snapshotB?.createdAt ?? 0)
    ? {
      beforeImageDataUrl: compareVisualEvidence.beforeImageDataUrl,
      afterImageDataUrl: compareVisualEvidence.afterImageDataUrl,
    }
    : undefined;

  const handleExportHtml = () => {
    if (reportMode === "compare" && compareExportReport) {
      const html = exportCompareAsHtml(compareExportReport, visuals);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sentineltwin-compare-report-${scene.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!singleExportReport || !result) return;
    const html = buildHtmlReport(scene, result, aiReport, temporalProfile, operationalEvidenceEvents, snapshots, audienceProfile, visibilityProfile, singleExportReport);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentineltwin-report-${scene.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportEvidenceBundle = () => {
    if (reportMode === "compare" && compareExportReport && snapshotB?.simulation) {
      const afterScene = { ...snapshotB.scene, snapshots: [], scenarios: [] } as never;
      const bundle = buildReportEvidenceBundle({
        scene: afterScene,
        report: compareExportReport.after,
        simulationResult: snapshotB.simulation,
        compare: compareExportReport,
        visualEvidence: visuals,
        notes: ["Compare-mode report evidence bundle exported from the report handoff surface."],
      });
      const blob = new Blob([stringifyReportEvidenceBundle(bundle)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sentineltwin-report-evidence-${scene.name.replace(/[^a-zA-Z0-9_-]/g, "_")}-compare.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!result) return;
    const report = singleExportReport;
    if (!report) return;
    const bundle = buildReportEvidenceBundle({
      scene,
      report,
      simulationResult: result,
      notes: ["Single-scene report evidence bundle exported from the report handoff surface."],
    });
    const blob = new Blob([stringifyReportEvidenceBundle(bundle)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentineltwin-report-evidence-${scene.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportProvenance = () => {
    if (!result) return;
    const provenance = buildCoverageProvenance(scene, result, { postureScore });
    const md = formatProvenanceMarkdown(provenance);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentineltwin-provenance-${scene.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    const filenameBase = reportMode === "compare"
      ? `sentineltwin-compare-report-${scene.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`
      : `sentineltwin-report-${scene.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const text = reportMode === "compare" && compareExportReport
      ? exportCompareAsMarkdown(compareExportReport)
      : currentReportMarkdown;
    if (!text) return;
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenameBase}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    const filenameBase = reportMode === "compare"
      ? `sentineltwin-compare-report-${scene.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`
      : `sentineltwin-report-${scene.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    if (reportMode !== "compare" && result) {
      await exportAuditReportPdf({
        scene,
        result,
        title: scene.name || "Security Audit Report",
        subtitle: `${scene.cameras.length} cameras · ${scene.criticalZones.length} critical zones · ${scene.dimensions.width}m x ${scene.dimensions.depth}m`,
        includeTimestamp: true,
      });
      return;
    }

    const text = reportMode === "compare" && compareExportReport
      ? exportCompareAsMarkdown(compareExportReport)
      : currentReportMarkdown;
    if (!text) return;
    await exportTextAsPdf({
      text,
      filename: `${filenameBase}.pdf`,
      title: reportMode === "compare" ? "SentinelTwin Compare Report" : "SentinelTwin Coverage Report",
    });
  };

  const handlePrint = () => {
    if (reportMode === "compare" && compareExportReport) {
      const html = exportCompareAsHtml(compareExportReport, visuals);
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
      }
      return;
    }
    if (!result) return;
    const html = buildHtmlReport(scene, result, aiReport, temporalProfile, operationalEvidenceEvents, snapshots, audienceProfile, visibilityProfile, singleExportReport);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    }
  };

  const handleApplyCatalogPreset = (presetId: string) => {
    const preset = findReportCatalogPresetById(reportCatalog, presetId);
    if (!preset) return;
    setReportAudience(preset.audience);
    setReportVisibility(preset.visibility);
    setReportTemplateId(preset.templateId);
    setPresetNameDraft(preset.title);
    setReportCatalogState((current) => ({
      ...current,
      selectedPresetId: preset.id,
    }));
  };

  const handleSaveCatalogPreset = () => {
    const presetTitle = presetNameDraft.trim() || `${getReportAudienceProfile(reportAudience).label} ${getReportVisibilityProfile(reportVisibility).label}`;
    const preset = createReportCatalogPreset({
      title: presetTitle,
      audience: reportAudience,
      visibility: reportVisibility,
      templateId: reportTemplateId,
      summary: `${getReportStandardTemplateProfile(reportTemplateId).title} · ${getReportAudienceProfile(reportAudience).label} · ${getReportVisibilityProfile(reportVisibility).label}`,
    });
    setReportCatalogState((current) => upsertReportCatalogPreset(current, preset));
    setPresetNameDraft(preset.title);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className={`{flex items-center justify-between border-b ${UI_SURFACES.borderPanel} px-3 py-1.5}`}>
        <span className={`text-[10px] ${UI_SURFACES.textSoft}`}>
          {aiReport ? "AI Report" : "Markdown Report"}
        </span>
        <div className="flex items-center gap-1.5">
        <div className={`{flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} p-0.5}`}>
            <button type="button"
              onClick={() => setReportMode("single")}
              className={`rounded px-2 py-0.5 text-[9px] ${reportMode === "single" ? "${UI_SURFACES.bgPanel} text-white" : "${UI_SURFACES.textMuted5}"}`}
            >
              Technical
            </button>
            <button type="button"
              onClick={() => setReportMode("plain")}
              className={`rounded px-2 py-0.5 text-[9px] ${reportMode === "plain" ? "${UI_SURFACES.bgPanel} text-white" : "${UI_SURFACES.textMuted5}"}`}
            >
              Plain Language
            </button>
            <button type="button"
              onClick={() => setReportMode("compare")}
              className={`rounded px-2 py-0.5 text-[9px] ${reportMode === "compare" ? "${UI_SURFACES.bgPanel} text-white" : "${UI_SURFACES.textMuted5}"}`}
            >
              Before/After
            </button>
        </div>
          <div className={`{min-w-[22rem] rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} p-2}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className={`text-[9px] font-semibold uppercase tracking-[0.14em] ${UI_SURFACES.textBody}`}>Catalog</div>
                <div className={`text-[8px] ${UI_SURFACES.textSoftDim}`}>Saved quick-apply presets and the active standards template.</div>
              </div>
              <div className="flex items-center gap-1">
                <input
                  value={presetNameDraft}
                  onChange={(event) => setPresetNameDraft(event.target.value)}
                  aria-label="Preset name"
                  className={`w-32 rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1 text-[9px] ${UI_SURFACES.textBody2}`}
                />
                <button
                  type="button"
                  onClick={handleSaveCatalogPreset}
                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-200 transition-colors hover:bg-emerald-500/15"
                >
                  Save preset
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {reportCatalog.filter((preset) => !preset.isCustom).map((preset) => {
                const selected = preset.id === selectedCatalogPreset?.id;
                const visibility = getReportVisibilityProfile(preset.visibility);
                const template = getReportStandardTemplateProfile(preset.templateId);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyCatalogPreset(preset.id)}
                    className={`min-w-[10rem] rounded px-2 py-1 text-left text-[9px] transition-colors ${
                      selected
                        ? "border border-sky-500/40 bg-sky-500/10 text-sky-100"
                        : `border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} ${UI_SURFACES.textSoftMuted} hover:border-[#2f3650] hover:text-white`
                    }`}
                  >
                    <div className="font-semibold uppercase tracking-[0.14em]">{preset.title}</div>
                    <div className={`mt-0.5 text-[8px] ${UI_SURFACES.textSoftDim}`}>
                      {getReportAudienceProfile(preset.audience).label} · {visibility.label} · {template.title}
                    </div>
                    <div className={`mt-1 text-[8px] ${UI_SURFACES.textSoftDim}`}>{preset.summary}</div>
                  </button>
                );
              })}
            </div>
            {reportCatalog.some((preset) => preset.isCustom) ? (
              <div className={`{mt-2 border-t ${UI_SURFACES.borderPanel} pt-2}`}>
                <div className={`mb-1 text-[8px] uppercase tracking-[0.14em] ${UI_SURFACES.textSoftDim}`}>Saved presets</div>
                <div className="flex flex-wrap gap-1.5">
                  {reportCatalog.filter((preset) => preset.isCustom).map((preset) => {
                    const selected = preset.id === selectedCatalogPreset?.id;
                    const visibility = getReportVisibilityProfile(preset.visibility);
                    const template = getReportStandardTemplateProfile(preset.templateId);
                    return (
                      <div
                        key={preset.id}
                        className={`min-w-[10rem] rounded border px-2 py-1 text-left text-[9px] ${
                          selected
                            ? "border-sky-500/40 bg-sky-500/10 text-sky-100"
                            : `${UI_SURFACES.borderThin} ${UI_SURFACES.card} ${UI_SURFACES.textSoftMuted}`
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleApplyCatalogPreset(preset.id)}
                          className="w-full text-left"
                        >
                          <div className="font-semibold uppercase tracking-[0.14em]">{preset.title}</div>
                          <div className={`mt-0.5 text-[8px] ${UI_SURFACES.textSoftDim}`}>
                            {getReportAudienceProfile(preset.audience).label} · {visibility.label} · {template.title}
                          </div>
                          <div className={`mt-1 text-[8px] ${UI_SURFACES.textSoftDim}`}>{preset.summary}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportCatalogState((current) => removeReportCatalogPreset(current, preset.id))}
                          className="mt-1 text-[8px] uppercase tracking-[0.12em] text-[#fca5a5] transition-colors hover:text-white"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <label className={`{flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5}}`}>
            Template
            <select
              value={reportTemplateId}
              onChange={(event) => {
                const nextTemplateId = event.target.value as ReportStandardTemplateId;
                setReportTemplateId(nextTemplateId);
                syncCatalogSelection(reportAudience, reportVisibility, nextTemplateId);
              }}
              className={`rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-0.5 text-[9px] ${UI_SURFACES.textBody2}`}
            >
              {availableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
          </label>
          <label className={`{flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5}}`}>
            Audience
            <select
              value={reportAudience}
              onChange={(event) => {
                const nextAudience = event.target.value as ReportAudience;
                setReportAudience(nextAudience);
                syncCatalogSelection(nextAudience, reportVisibility, reportTemplateId);
              }}
              className={`rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-0.5 text-[9px] ${UI_SURFACES.textBody2}`}
            >
            <option value="operator">Operator</option>
            <option value="consultant">Security Consultant</option>
            <option value="facilities_director">Facilities Director</option>
            <option value="auditor">Auditor</option>
            <option value="insurer">Insurer</option>
            <option value="installer">Installer</option>
            <option value="operations_manager">Operations Manager</option>
            <option value="privacy_reviewer">Privacy reviewer</option>
          </select>
          </label>
          <label className={`{flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5}}`}>
            Visibility
            <select
              value={reportVisibility}
              onChange={(event) => {
                const nextVisibility = event.target.value as ReportVisibility;
                setReportVisibility(nextVisibility);
                syncCatalogSelection(reportAudience, nextVisibility, reportTemplateId);
              }}
              className={`rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-0.5 text-[9px] ${UI_SURFACES.textBody2}`}
            >
              <option value="internal">Operator evidence</option>
              <option value="shared">Historical baseline</option>
              <option value="privacy_safe">Privacy safe</option>
            </select>
          </label>
          <div className={`{flex flex-wrap items-center gap-2 rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5}}`}>
            <span className={`font-semibold ${UI_SURFACES.textBody}`}>Redactions:</span>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={!!redactionPolicy.redactCameraIps}
                onChange={(e) => setRedactionPolicy((p) => ({ ...p, redactCameraIps: e.target.checked }))}
                className={`rounded ${UI_SURFACES.borderThin} ${UI_SURFACES.card} text-sky-500 focus:ring-0`}
              />
              <span>Camera IPs</span>
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={!!redactionPolicy.redactGpsCoordinates}
                onChange={(e) => setRedactionPolicy((p) => ({ ...p, redactGpsCoordinates: e.target.checked }))}
                className={`rounded ${UI_SURFACES.borderThin} ${UI_SURFACES.card} text-sky-500 focus:ring-0`}
              />
              <span>GPS Coordinates</span>
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={!!redactionPolicy.redactPatrolRoutes}
                onChange={(e) => setRedactionPolicy((p) => ({ ...p, redactPatrolRoutes: e.target.checked }))}
                className={`rounded ${UI_SURFACES.borderThin} ${UI_SURFACES.card} text-sky-500 focus:ring-0`}
              />
              <span>Patrol Routes</span>
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={!!redactionPolicy.maskVulnerabilities}
                onChange={(e) => setRedactionPolicy((p) => ({ ...p, maskVulnerabilities: e.target.checked }))}
                className={`rounded ${UI_SURFACES.borderThin} ${UI_SURFACES.card} text-sky-500 focus:ring-0`}
              />
              <span>Mask Vulnerabilities</span>
            </label>
          </div>
          <div className={`{rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5}}`}>
            <div className={`font-semibold uppercase tracking-[0.14em] ${UI_SURFACES.textBody}`}>Audience Policy</div>
            <div className={`mt-0.5 ${UI_SURFACES.textSoftMid}`}>
              {audienceProfile.disclosureLevel.replace(/_/g, " ")} · {audienceProfile.disclosureSummary}
            </div>
            <div className={`mt-1 ${UI_SURFACES.textSoftMid}`}>Visible: {audienceProfile.visibleSections.join(", ")}</div>
            <div className={`${UI_SURFACES.textSoftMid}`}>Withheld: {audienceProfile.withheldSections.length > 0 ? audienceProfile.withheldSections.join(", ") : "none"}</div>
          </div>
          <button type="button"
            onClick={handleGenerateAI}
            disabled={isGenerating || !result}
            className={`{inline-flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} px-2 py-1 text-[9px] text-emerald-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 disabled:opacity-40}`}
          >
            {isGenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {isGenerating ? "Generating..." : aiReport ? "Regenerate" : "Generate AI"}
          </button>
          <div className="flex gap-1.5">
            <button type="button"
              onClick={() => { setAiReport(null); }}
              className={`{rounded border ${UI_SURFACES.borderPanel} px-2 py-1 text-[9px] ${UI_SURFACES.textSoft} transition-colors hover:text-white}`}
            >
              Default
            </button>
            <button type="button"
              onClick={() => {
                void handleExportPdf();
              }}
              className="flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 text-[9px] font-semibold text-cyan-300 shadow-sm transition-all hover:border-cyan-400 hover:bg-cyan-900/50 hover:text-white"
            >
              <FileText className="h-3 w-3" /> Export Audit PDF
            </button>
            <button type="button"
              onClick={handleExportEvidenceBundle}
              className="flex items-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-950/40 px-2.5 py-1 text-[9px] font-semibold text-indigo-300 shadow-sm transition-all hover:border-indigo-400 hover:bg-indigo-900/50 hover:text-white"
            >
              <Database className="h-3 w-3" /> Export Evidence Bundle
            </button>
            <button type="button"
              onClick={handleExportMarkdown}
              className={`{flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5} transition-colors ${UI_SURFACES.hoverBorderMid} hover:text-white}`}
            >
              <FileText className="h-3 w-3" /> Export Markdown
            </button>
            <button type="button"
              onClick={handleExportHtml}
              className={`{flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5} transition-colors ${UI_SURFACES.hoverBorderMid} hover:text-white}`}
            >
              <Globe className="h-3 w-3" /> Export HTML
            </button>
            <button type="button"
              onClick={handleExportProvenance}
              disabled={!result}
              className={`{flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5} transition-colors ${UI_SURFACES.hoverBorderMid} hover:text-white disabled:opacity-40}`}
            >
              <Database className="h-3 w-3" /> Export Provenance
            </button>
            <button type="button"
              onClick={handlePrint}
              className={`{flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5} transition-colors ${UI_SURFACES.hoverBorderMid} hover:text-white}`}
            >
              <Printer className="h-3 w-3" /> Print
            </button>
            <button type="button"
              onClick={copy}
              className={`{flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5} transition-colors ${UI_SURFACES.hoverBorderMid} hover:text-white}`}
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
            <button type="button"
              onClick={() => void writeClipboardText(installerHandoffMarkdown)}
              className={`{flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5} transition-colors ${UI_SURFACES.hoverBorderMid} hover:text-white}`}
            >
              <Copy className="h-3 w-3" /> Copy Installer Handoff
            </button>
            <button type="button"
              onClick={() => void writeClipboardText(commissioningChecklistMarkdown)}
              className={`{flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5} transition-colors ${UI_SURFACES.hoverBorderMid} hover:text-white}`}
            >
              <Copy className="h-3 w-3" /> Copy Commissioning
            </button>
          <button type="button"
            onClick={() => {
              void shareCompareLink();
            }}
            disabled={reportMode !== "compare" || !snapshotA || !snapshotB}
            className="flex items-center gap-1 rounded border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-[9px] text-sky-100 transition-colors hover:bg-sky-500/15 disabled:opacity-40"
          >
            <Share2 className="h-3 w-3" /> Share compare link
          </button>
          <button type="button"
            onClick={() => {
              void copyCompareLink();
            }}
            disabled={reportMode !== "compare" || !snapshotA || !snapshotB}
              className={`{flex items-center gap-1 rounded border ${UI_SURFACES.borderPanel} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5} transition-colors ${UI_SURFACES.hoverBorderMid} hover:text-white disabled:opacity-40}`}
            >
              <Copy className="h-3 w-3" /> Copy compare link
            </button>
          </div>
        </div>
      </div>
      <div className={`{border-b ${UI_SURFACES.borderPanel} px-3 py-1.5 text-[9px] ${UI_SURFACES.textSoftDim}}`}>
        {reportMode === "compare" ? (
          compareSelectionProvenanceNote ? (
            <span>Compare provenance: {compareSelectionProvenanceNote}</span>
          ) : (
            <span>Scene Intelligence can seed the exact/derived checkpoint provenance for the active compare pair.</span>
          )
        ) : (
          <span>Switch to compare mode to carry checkpoint provenance through the report handoff.</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {reportVisibility !== "internal" ? (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <div className="text-[10px] font-semibold text-amber-300">Data Disclosure Warning</div>
            <div className="text-[9px] text-amber-200/80">
              {reportVisibility === "privacy_safe"
                ? "Operational evidence, confidence notes, and truth ladder details are fully redacted in Privacy Safe mode."
                : "Confidence notes are softened and some operational evidence is truncated in Shared mode."}
            </div>
          </div>
        ) : null}
        {((reportMode === "single" ? singleExportReport : compareExportReport)?.template?.regulatoryMandates?.length ?? 0) > 0 ? (
          <div className="mb-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-indigo-300">Regulatory Mandates Active</div>
            <div className="grid gap-1.5 text-[10px] text-indigo-200/90">
              {((reportMode === "single" ? singleExportReport : compareExportReport)?.template?.regulatoryMandates ?? []).map((m) => (
                <div key={`${m.authority}-${m.articleOrSection}`} className={`rounded-lg border border-indigo-500/20 ${UI_SURFACES.bgCardDeep}/80 px-2.5 py-1.5`}>
                  <span className="font-semibold text-indigo-200">[{m.authority} {m.articleOrSection}] {m.keyRequirement}</span> · Retention: {m.retentionLimitDays}d
                  {m.mandatoryRedactions.length > 0 ? (
                    <div className="mt-0.5 text-[9px] text-indigo-300/80">Mandatory Redactions: {m.mandatoryRedactions.join(", ")}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {((reportMode === "single" ? singleExportReport : compareExportReport)?.redactionsApplied?.length ?? 0) > 0 ? (
          <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-rose-300">Policy Redactions Applied</div>
            <div className="text-[10px] text-rose-200/90">
              {((reportMode === "single" ? singleExportReport : compareExportReport)?.redactionsApplied ?? []).join(" · ")}
            </div>
          </div>
        ) : null}
        {!result && reportMode === "single" ? (
          <RunSimulationPrompt
            className={`rounded-xl border border-dashed ${UI_SURFACES.borderDark} ${UI_SURFACES.panel} px-3 py-4`}
            message="Run the shared simulation to generate a report and security outcome."
          />
        ) : null}
        {reportSummary ? (
          <div className={`{mb-3 rounded-xl border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelAlt} p-3}`}>
            <div className={`{mb-2 flex items-center justify-between gap-2 rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgDeep} px-2 py-1.5 text-[9px] ${UI_SURFACES.textSoftBright}}`}>
              <div className="flex items-center gap-2">
                <span className={`font-semibold uppercase tracking-[0.14em] ${UI_SURFACES.textBody}`}>Truth:</span>
                <TruthBadge label="computed" />
              </div>
              <div className="max-w-[28rem] truncate text-right" title={truthLabelDetail("computed")}>{truthLabelDetail("computed")}</div>
            </div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className={`text-[9px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted5}`}>Report Summary</div>
                <div className={`text-[9px] ${UI_SURFACES.textSoftMid}`}>Four bullet executive summary from the latest run.</div>
                <div className={`text-[9px] ${UI_SURFACES.textSoftMid}`}>Audience framing: {audienceProfile.label} · {audienceProfile.framing}</div>
                <div className={`text-[9px] ${UI_SURFACES.textSoftMid}`}>Visibility framing: {visibilityProfile.label} · {visibilityProfile.framing}</div>
                <div className={`text-[9px] ${UI_SURFACES.textSoftMid}`}>Standards template: {getReportStandardTemplateProfile(reportTemplateId).title} · {getReportStandardTemplateProfile(reportTemplateId).summary}</div>
              </div>
              <button
                type="button"
                onClick={() => setReportMode("single")}
                className={`rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1 text-[9px] ${UI_SURFACES.textMuted5} transition-colors ${UI_SURFACES.hoverBorderSubtle} hover:text-white`}
              >
                Latest Run
              </button>
            </div>
            <div className={`grid gap-1.5 text-[10px] ${UI_SURFACES.textNearAlt}`}>
              {reportSummary.map((line) => (
                <div key={line.label} className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgCardDeep} px-2.5 py-2}`}>
                  <span
                    className={`font-semibold ${
                      line.label === "Critical Issue"
                        ? "text-red-300"
                        : line.label === "Primary Cause"
                          ? "text-amber-300"
                          : line.label === "Impact"
                            ? "text-slate-200"
                            : "text-blue-300"
                    }`}
                  >
                    {line.label}:
                  </span>{" "}
                  {line.text}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className={`{mb-3 rounded-xl border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelAlt} p-3}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className={`text-[9px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted5}`}>Truth Ladder</div>
              <div className={`text-[9px] ${UI_SURFACES.textSoftMid}`}>Node review, source trace, and geometry validity status for the current scene.</div>
            </div>
            <div className="flex items-center gap-2">
              <TruthBadge label="inferred" />
              <span className="text-[9px] text-sky-200">{truthLadder.summary}</span>
            </div>
          </div>
          <div className={`grid gap-1.5 text-[10px] ${UI_SURFACES.textNearAlt} md:grid-cols-2 xl:grid-cols-3`}>
            {[
              { label: "Nodes", value: truthLadder.nodeCount },
              { label: "Reviewed Nodes", value: `${truthLadder.reviewedNodeCount} (${truthLadder.reviewedCoveragePct.toFixed(1)}%)` },
              { label: "Verified Nodes", value: truthLadder.verifiedNodeCount },
              { label: "Source Traces", value: `${truthLadder.sourceTraceCount} (${truthLadder.sourceTraceCoveragePct.toFixed(1)}%)` },
              { label: "Suspect Geometry", value: truthLadder.suspectGeometryCount },
              { label: "Invalid Geometry", value: truthLadder.invalidGeometryCount },
            ].map((item) => (
              <div key={item.label} className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgCardDeep} px-2.5 py-2}`}>
                <span className="font-semibold text-sky-300">{item.label}:</span> {item.value}
              </div>
            ))}
          </div>
        </div>
        <div className={`{mb-3 rounded-xl border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelAlt} p-3}`}>
          <div className={`mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted5}`}>Infrastructure Estimate</div>
          <div className={`grid gap-1.5 text-[10px] ${UI_SURFACES.textNearAlt} md:grid-cols-2 xl:grid-cols-4`}>
            <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgCardDeep} px-2.5 py-2}`}><span className="font-semibold text-sky-300">Bandwidth:</span> {infrastructureEstimate.bandwidthMbps} Mbps</div>
            <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgCardDeep} px-2.5 py-2}`}><span className="font-semibold text-sky-300">Storage:</span> {infrastructureEstimate.storageTb} TB / {infrastructureEstimate.retentionDays}d</div>
            <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgCardDeep} px-2.5 py-2}`}><span className="font-semibold text-sky-300">PoE:</span> {infrastructureEstimate.poeEstimatedW}W est / {infrastructureEstimate.poeBudgetW}W budget</div>
            <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgCardDeep} px-2.5 py-2}`}><span className="font-semibold text-sky-300">Cable + NVR:</span> {infrastructureEstimate.cableEstimateM}m · {infrastructureEstimate.nvrChannels}ch</div>
          </div>
        </div>
        <div className={`{mb-3 rounded-xl border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelAlt} p-3}`}>
          <div className={`mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted5}`}>Zone Compliance</div>
          {zoneComplianceRows.length === 0 ? (
            <div className={`text-[10px] ${UI_SURFACES.textMuted5}`}>No critical zones available for compliance summary.</div>
          ) : (
            <div className={`grid gap-1 text-[10px] ${UI_SURFACES.textNearAlt}`}>
              {zoneComplianceRows.map((row) => (
                <div key={row.id} className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.bgCardDeep} px-2.5 py-2}`}>
                  <span className={`font-semibold ${row.pass ? "text-emerald-300" : "text-rose-300"}`}>{row.label}:</span> required {row.required}, actual {row.actual} ({row.status})
                </div>
              ))}
            </div>
          )}
        </div>
        {activePathId ? (
          <div className={`{mb-3 rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelAlt} px-3 py-2 text-[10px] ${UI_SURFACES.textMuted5}}`}>
            Route evidence is tied to the selected active path.
          </div>
        ) : (
          <div className={`{mb-3 rounded-lg border border-dashed ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelAlt} px-3 py-2 text-[10px] ${UI_SURFACES.textMuted5}}`}>
            Select a path in Scenario / Path to include route evidence in report summaries and exports.
          </div>
        )}
        <div className={`{mb-3 rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelAlt} p-3 text-[10px] ${UI_SURFACES.textNearAlt}}`}>
          Security Outcome: {outcome.summary.status.replace(/_/g, " ")} · Coverage {outcome.summary.coveragePct == null ? "n/a" : `${Math.round(outcome.summary.coveragePct)}%`} · Critical Zones {outcome.summary.criticalZonesPassing}/{outcome.summary.criticalZonesTotal} · Issues {outcome.summary.issueCount}
        </div>
        {reportMode === "compare" ? (
          <div className={`{mb-3 rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelAlt} p-3}`}>
            <div className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted5}`}>Compare Export Context</div>
            {compareSelectionMissing ? (
              <div className={`mb-2 rounded-lg border border-dashed ${UI_SURFACES.borderMidAlt} bg-[#091018] px-3 py-2 text-[10px] text-[#8a97af]`}>
                Select both snapshots to generate compare exports. The report keeps the comparison explicit instead of auto-picking the newest saves.
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className={`text-[9px] ${UI_SURFACES.textSoftMuted}`}>
                  Snapshot A
                  <select
                    value={snapshotA?.id ?? ""}
                    onChange={(event) => setSnapshotAId(event.target.value)}
                    className={`mt-1 w-full rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1 text-[10px] ${UI_SURFACES.textBody2}`}
                  >
                    <option value="" disabled>
                      Select snapshot
                    </option>
                    {snapshots.map((snapshot) => (
                      <option key={snapshot.id} value={snapshot.id}>{snapshot.label}</option>
                    ))}
                  </select>
                </label>
                <label className={`text-[9px] ${UI_SURFACES.textSoftMuted}`}>
                  Snapshot B
                  <select
                    value={snapshotB?.id ?? ""}
                    onChange={(event) => setSnapshotBId(event.target.value)}
                    className={`mt-1 w-full rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1 text-[10px] ${UI_SURFACES.textBody2}`}
                  >
                    <option value="" disabled>
                      Select snapshot
                    </option>
                    {snapshots.map((snapshot) => (
                      <option key={snapshot.id} value={snapshot.id}>{snapshot.label}</option>
                    ))}
                  </select>
                </label>
            </div>
            <div className={`mt-2 text-[9px] ${UI_SURFACES.textMuted5}`}>
              {hasCompareSimulation
                ? "Compare report includes before/after deltas and zone-level change table."
                : "Selected snapshots must both have simulation results for compare export."}
            </div>
            <div className={`mt-1 text-[9px] ${UI_SURFACES.textMuted5}`}>
              {visuals
                ? "Using captured Compare canvas images as visual evidence."
                : "No fresh captured Compare canvases found for this pair; fallback generated evidence will be used."}
            </div>
          </div>
        ) : null}
        {isGenerating ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[11px] text-amber-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating AI report...
          </div>
        ) : (
          <pre className={`whitespace-pre-wrap font-mono text-[9px] leading-relaxed ${UI_SURFACES.textMuted5}`}>
            {currentReportMarkdown || "Run simulation to generate report."}
          </pre>
        )}
      </div>
    </div>
  );
}

function buildAiReportMarkdown(report: SecurityReport): string {
  const lines = [
    `# ${report.title}`,
    `**Site:** ${report.siteName}`,
    `**Generated:** ${new Date(report.generatedAt).toLocaleString()}`,
    "",
    "## Executive Summary",
    report.executiveSummary,
    "",
    ...report.sections.flatMap((section) => {
      const sectionLines = [`## ${section.title}`];
      if (section.type === "list") {
        sectionLines.push(...section.content.split("\n").map((l) => `- ${l}`));
      } else {
        sectionLines.push(section.content);
      }
      sectionLines.push("");
      return sectionLines;
    }),
    "## Recommendations",
    ...report.recommendations.map((r) => `- ${r}`),
    "",
    "## Assumptions",
    ...report.assumptions.map((a) => `- ${a}`),
    "",
    "## Limitations",
    ...report.limitations.map((l) => `- ${l}`),
  ];
  return lines.join("\n");
}



function buildHtmlReport(
  scene: ReturnType<typeof useStudioStore.getState>["scene"],
  result: NonNullable<ReturnType<typeof useStudioStore.getState>["simulationResult"]>,
  aiReport: SecurityReport | null,
  temporalProfile: ReturnType<typeof useStudioStore.getState>["temporalProfile"],
  operationalEvidenceEvents: ReturnType<typeof useStudioStore.getState>["operationalEvidenceEvents"],
  snapshots: ReturnType<typeof useStudioStore.getState>["snapshots"],
  audienceProfile: ReturnType<typeof getReportAudienceProfile>,
  visibilityProfile: ReturnType<typeof getReportVisibilityProfile>,
  reportView?: unknown,
): string {
  const isAi = aiReport != null;
  const title = isAi ? aiReport!.title : "SentinelTwin Coverage Report";
  const passing = result.criticalZoneResults.filter((z) => z.status === "pass").length;
  const totalZones = result.criticalZoneResults.length;
  const temporalTwin = summarizeOperationalEvidenceTemporalTwin(operationalEvidenceEvents, scene);
  const analyticsModel = buildSecurityAnalyticsModel({
    scene,
    simulationResult: result,
    temporalProfile,
    evidenceEvents: operationalEvidenceEvents,
    snapshots,
  });
  const analyticsSection = buildAnalyticsReportSection(analyticsModel);
  const template = reportView && typeof reportView === "object" && "template" in reportView
    ? (reportView as {
        template: {
          title: string;
          standardLabel: string;
          summary: string;
          audienceHint: string;
          focusAreas: string[];
          evidenceAnchors: string[];
        };
      }).template
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — ${escapeHtml(scene.name)}</title>
  <style>
    @page { margin: 20mm 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a2e;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 { font-size: 20pt; margin-bottom: 4px; color: #0f172a; }
    h2 { font-size: 14pt; margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; color: #1e293b; }
    h3 { font-size: 11pt; margin-top: 16px; margin-bottom: 6px; color: #334155; }
    .meta { color: #64748b; font-size: 10pt; margin-bottom: 16px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; margin: 12px 0; }
    .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
    .summary-card .value { font-size: 16pt; font-weight: 700; }
    .summary-card .label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-top: 2px; }
    .issue { padding: 8px 10px; margin: 4px 0; border-radius: 6px; font-size: 10pt; }
    .issue.critical { background: #fef2f2; border-left: 3px solid #ef4444; }
    .issue.high { background: #fff7ed; border-left: 3px solid #f97316; }
    .issue.medium { background: #eff6ff; border-left: 3px solid #3b82f6; }
    .issue.low { background: #f8fafc; border-left: 3px solid #94a3b8; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    .pass { color: #16a34a; font-weight: 600; }
    .fail { color: #dc2626; font-weight: 600; }
    .rec { padding: 6px 8px; margin: 4px 0; background: #f0fdf4; border-left: 3px solid #22c55e; font-size: 10pt; }
    footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #94a3b8; text-align: center; }
    @media print { body { padding: 0; } }
${ANALYTICS_REPORT_STYLES}
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Scene: ${escapeHtml(scene.name)} &middot; ${new Date().toLocaleDateString()} &middot; DORI: ${scene.assumptions.doriStandard.toUpperCase()}</div>
  <div class="meta">Audience: ${escapeHtml(audienceProfile.label)} · ${escapeHtml(audienceProfile.framing)}</div>
  <div class="meta">Audience Policy: ${escapeHtml(audienceProfile.disclosureLevel.replace(/_/g, " "))} · ${escapeHtml(audienceProfile.disclosureSummary)}</div>
  <div class="meta">Visible Sections: ${escapeHtml(audienceProfile.visibleSections.join(", "))}</div>
  <div class="meta">Withheld Sections: ${escapeHtml(audienceProfile.withheldSections.length > 0 ? audienceProfile.withheldSections.join(", ") : "none")}</div>
  <div class="meta">Visibility: ${escapeHtml(visibilityProfile.label)} · ${escapeHtml(visibilityProfile.framing)}</div>
  ${template ? `
  <div class="meta">Standards Template: ${escapeHtml(template.title)} · ${escapeHtml(template.standardLabel)}</div>
  <div class="meta">Template Summary: ${escapeHtml(template.summary)}</div>
  <div class="meta">Template Focus: ${escapeHtml(template.focusAreas.join(", "))}</div>
  ` : ""}

  <h2>Summary</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="value" style="color:#16a34a">${result.totalCoveragePct.toFixed(1)}%</div><div class="label">Total Coverage</div></div>
    <div class="summary-card"><div class="value" style="color:#2563eb">${result.recognitionAreaPct.toFixed(1)}%</div><div class="label">Recognition Area</div></div>
    <div class="summary-card"><div class="value" style="color:#7c3aed">${result.identificationAreaPct.toFixed(1)}%</div><div class="label">Identification Area</div></div>
    <div class="summary-card"><div class="value" style="color:${passing === totalZones ? "#16a34a" : "#dc2626"}">${passing}/${totalZones}</div><div class="label">Zones Passing</div></div>
  </div>

  ${isAi ? buildAiReportHtml(aiReport!) : buildDefaultHtml(result)}

  ${analyticsSection}

  <h2>Temporal Operational Twin</h2>
  <table>
    <thead><tr><th>Field</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Scene Events</td><td>${temporalTwin.totalEvents}</td></tr>
      <tr><td>Reconstructable Checkpoints</td><td>${temporalTwin.checkpointCount}</td></tr>
      <tr><td>Published Checkpoints</td><td>${temporalTwin.publishedCheckpointCount}</td></tr>
      <tr><td>Branch Heads</td><td>${temporalTwin.branchHeadCount}</td></tr>
      <tr><td>Current Scene</td><td>${escapeHtml(temporalTwin.currentSceneSummary?.detail ?? "Unavailable.")}</td></tr>
      <tr><td>Latest Checkpoint</td><td>${escapeHtml(temporalTwin.latestCheckpoint ? `${temporalTwin.latestCheckpoint.title} (${temporalTwin.latestCheckpoint.branchLabel})` : "Unavailable.")}</td></tr>
      <tr><td>Checkpoint Age</td><td>${temporalTwin.latestCheckpointAgeMs != null ? `${Math.max(1, Math.round(temporalTwin.latestCheckpointAgeMs / 60000))}m` : "Unavailable."}</td></tr>
      <tr><td>Checkpoint Delta</td><td>${escapeHtml(temporalTwin.currentVsLatestCheckpointDelta ? `cameras ${temporalTwin.currentVsLatestCheckpointDelta.cameras >= 0 ? "+" : ""}${temporalTwin.currentVsLatestCheckpointDelta.cameras}, zones ${temporalTwin.currentVsLatestCheckpointDelta.zones >= 0 ? "+" : ""}${temporalTwin.currentVsLatestCheckpointDelta.zones}, sensors ${temporalTwin.currentVsLatestCheckpointDelta.sensors >= 0 ? "+" : ""}${temporalTwin.currentVsLatestCheckpointDelta.sensors}` : "Unavailable.")}</td></tr>
      <tr><td>Latest Published Checkpoint</td><td>${escapeHtml(temporalTwin.latestPublishedCheckpoint ? `${temporalTwin.latestPublishedCheckpoint.title} (${temporalTwin.latestPublishedCheckpoint.branchLabel})` : "Unavailable.")}</td></tr>
      <tr><td>Published Age</td><td>${temporalTwin.latestPublishedCheckpointAgeMs != null ? `${Math.max(1, Math.round(temporalTwin.latestPublishedCheckpointAgeMs / 60000))}m` : "Unavailable."}</td></tr>
      <tr><td>Published Delta</td><td>${escapeHtml(temporalTwin.currentVsLatestPublishedCheckpointDelta ? `cameras ${temporalTwin.currentVsLatestPublishedCheckpointDelta.cameras >= 0 ? "+" : ""}${temporalTwin.currentVsLatestPublishedCheckpointDelta.cameras}, zones ${temporalTwin.currentVsLatestPublishedCheckpointDelta.zones >= 0 ? "+" : ""}${temporalTwin.currentVsLatestPublishedCheckpointDelta.zones}, sensors ${temporalTwin.currentVsLatestPublishedCheckpointDelta.sensors >= 0 ? "+" : ""}${temporalTwin.currentVsLatestPublishedCheckpointDelta.sensors}` : "Unavailable.")}</td></tr>
    </tbody>
  </table>

  <h2>Advanced Risk Signals</h2>
  <table>
    <thead><tr><th>Algorithm</th><th>Output</th></tr></thead>
    <tbody>
      <tr><td>Coverage Stability</td><td>${result.fragilitySummary ? `${Math.round(result.fragilitySummary.meanFragility * 100)}% mean fragility across ${result.fragilitySummary.totalCells} cells` : "Not computed"}</td></tr>
      <tr><td>Backup Coverage</td><td>${result.kRobustness ? `K=${result.kRobustness.kRobustness} / ${result.kRobustness.totalCameras}` : "Not computed"}</td></tr>
      <tr><td>Recommended Mount Points</td><td>${result.placementOracle?.bestCandidate ? `${result.placementOracle.bestCandidate.mountType} @ ${result.placementOracle.bestCandidate.position[0].toFixed(1)}, ${result.placementOracle.bestCandidate.position[2].toFixed(1)}` : "Not computed"}</td></tr>
      <tr><td>Time-Based Weaknesses</td><td>${temporalProfile?.anomalyWindows?.length ? `${temporalProfile.anomalyWindows.length} windows` : "None detected or not computed"}</td></tr>
      <tr><td>Occlusion Blame</td><td>${result.occlusionBlame?.length ? `${result.occlusionBlame.length} zones` : "Not computed"}</td></tr>
      <tr><td>Blind Spot Topology</td><td>${result.blindRegions?.length ? `${result.blindRegions.length} regions` : "None detected"}</td></tr>
    </tbody>
  </table>

  ${result.occlusionBlame?.length ? `
  <h2>Occlusion Blame</h2>
  ${result.occlusionBlame.map((zone) => `
    <h3>${escapeHtml(zone.zoneLabel)} (${zone.baselineQuality})</h3>
    <table>
      <thead><tr><th>Obstruction</th><th>Blame</th><th>Quality Without</th><th>Improvement</th></tr></thead>
      <tbody>
        ${zone.obstructions.map((obstruction) => `
          <tr>
            <td>${escapeHtml(obstruction.label)}</td>
            <td>${(obstruction.blameFraction * 100).toFixed(0)}%</td>
            <td>${obstruction.qualityWithout}</td>
            <td>+${obstruction.qualityImprovement.toFixed(1)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `).join("")}
  ` : ""}
  
  ${buildPrivacyComplianceSection(scene, result)}

  <h2>Changes Applied</h2>
  ${scene.changeLog?.length
    ? `<ol>${scene.changeLog.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ol>`
    : "<p>No changes have been applied to this scene.</p>"}

  <footer>Generated by SentinelTwin Studio &middot; ${new Date().toISOString()} &middot; Standards: IEC 62676-4:2025 (OODPCVS)</footer>
</body>
</html>`;
}

function buildPrivacyComplianceSection(
  scene: ReturnType<typeof useStudioStore.getState>["scene"],
  result: NonNullable<ReturnType<typeof useStudioStore.getState>["simulationResult"]>,
): string {
  const privacyZones = scene.privacyZones ?? [];
  const privacyViolations = result.issues.filter((i) => i.category === "privacy");

  const RESTRICTION_LABEL: Record<string, string> = {
    no_video: "No Video",
    restricted_view: "Restricted View",
    blindspot_required: "Blindspot Required",
  };

  const articleRows = [
    { article: "Art. 5(1)(c)", principle: "Data Minimisation", description: "Cameras limited to necessary coverage areas only", check: privacyZones.length > 0 || scene.cameras.length <= 8 },
    { article: "Art. 25", principle: "Privacy by Design", description: "Privacy zones defined before deployment", check: privacyZones.length > 0 },
    { article: "Art. 25(2)", principle: "Privacy by Default", description: "Default settings protect personal data", check: privacyViolations.length === 0 },
    { article: "Art. 32", principle: "Security of Processing", description: "Coverage engine produces verifiable simulation output", check: true },
    { article: "Art. 35", principle: "DPIA Readiness", description: "Simulation run documents camera-to-zone coverage evidence", check: result.cameraResults.length > 0 },
  ];

  const passCount = articleRows.filter((r) => r.check).length;
  const complianceScore = Math.round((passCount / articleRows.length) * 100);

  const cameraZoneMatrix = scene.cameras.map((cam) => {
    const zonesCovered = result.criticalZoneResults
      .filter((z) => z.coveringCameras.includes(cam.id))
      .map((z) => z.label);
    const isPrivacyRisk = privacyViolations.some((v) => v.affectedCameras.includes(cam.id));
    return { id: cam.id, label: cam.name ?? cam.id, zones: zonesCovered, isPrivacyRisk };
  });

  return `
  <h2>Privacy &amp; Compliance (GDPR)</h2>
  <p>Privacy compliance assessment based on ${privacyZones.length} defined privacy zone(s) and ${privacyViolations.length} detected violation(s). Score: <strong>${complianceScore}%</strong> (${passCount}/${articleRows.length} checks passed).</p>

  <h3>Privacy Zone Inventory</h3>
  ${privacyZones.length > 0
    ? `<table>
    <thead><tr><th>Zone</th><th>Restriction</th><th>Regulation</th><th>Status</th></tr></thead>
    <tbody>
      ${privacyZones.map((pz) => {
        const violated = privacyViolations.some((v) => v.affectedZones.includes(pz.id));
        return `<tr>
          <td>${escapeHtml(pz.label)}</td>
          <td>${RESTRICTION_LABEL[pz.restriction] ?? pz.restriction}</td>
          <td>${escapeHtml(pz.regulation)}</td>
          <td class="${violated ? "fail" : "pass"}">${violated ? "VIOLATION" : "COMPLIANT"}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>`
    : "<p>No privacy zones defined. Add privacy zones to enable GDPR coverage mapping.</p>"}

  <h3>GDPR Article 25 — Privacy by Design Checklist</h3>
  <table>
    <thead><tr><th>Article</th><th>Principle</th><th>Requirement</th><th>Status</th></tr></thead>
    <tbody>
      ${articleRows.map((r) => `
      <tr>
        <td>${r.article}</td>
        <td>${r.principle}</td>
        <td>${r.description}</td>
        <td class="${r.check ? "pass" : "fail"}">${r.check ? "PASS" : "REVIEW"}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  <h3>Camera — Restricted Zone Matrix</h3>
  <table>
    <thead><tr><th>Camera</th><th>Zones Covered</th><th>Privacy Risk</th></tr></thead>
    <tbody>
      ${cameraZoneMatrix.map((c) => `
      <tr>
        <td>${escapeHtml(c.label)}</td>
        <td>${c.zones.length > 0 ? c.zones.map(escapeHtml).join(", ") : "—"}</td>
        <td class="${c.isPrivacyRisk ? "fail" : "pass"}">${c.isPrivacyRisk ? "YES" : "No"}</td>
      </tr>`).join("")}
    </tbody>
  </table>
  ${privacyViolations.length > 0
    ? `<p><strong>Action required:</strong> ${privacyViolations.length} camera(s) capture footage within restricted privacy zones. Review placement or add exclusion masks before deployment.</p>`
    : ""}`;
}

function buildAiReportHtml(report: SecurityReport): string {
  return `
  <h2>Executive Summary</h2>
  <p>${escapeHtml(report.executiveSummary)}</p>
  
  ${report.sections.map((s) => `
    <h2>${escapeHtml(s.title)}</h2>
    <p>${escapeHtml(s.content)}</p>
  `).join("")}
  
  <h2>Recommendations</h2>
  ${report.recommendations.map((r) => `<div class="rec">${escapeHtml(r)}</div>`).join("")}
  
  <h2>Assumptions</h2>
  <ul>${report.assumptions.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>
  
  <h2>Limitations</h2>
  <ul>${report.limitations.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
}

function buildDefaultHtml(result: NonNullable<ReturnType<typeof useStudioStore.getState>["simulationResult"]>): string {
  return `
  <h2>Issues (${result.issues.length})</h2>
  ${result.issues.map((i) => `<div class="issue ${i.severity}"><strong>${i.severity.toUpperCase()}</strong>: ${escapeHtml(i.description)}</div>`).join("")}
  ${result.issues.length === 0 ? "<p>No issues found.</p>" : ""}
  
  <h2>Critical Zones</h2>
  <table>
    <thead><tr><th>Zone</th><th>Required</th><th>Actual</th><th>Status</th><th>Covering Cameras</th></tr></thead>
    <tbody>
      ${result.criticalZoneResults.map((z) => `
        <tr>
          <td>${escapeHtml(z.label)}</td>
          <td>${z.requiredQuality}</td>
          <td>${z.actualQuality}</td>
          <td class="${z.status === "pass" ? "pass" : "fail"}">${z.status.toUpperCase()}</td>
          <td>${z.coveringCameras.join(", ")}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  
  <h2>Cameras</h2>
  <table>
    <thead><tr><th>Camera</th><th>Coverage</th><th>Best Zone Quality</th><th>Zones Failed</th><th>Zones Covered</th></tr></thead>
    <tbody>
      ${result.cameraResults.map((c) => `
        <tr>
          <td>${escapeHtml(c.cameraId)}</td>
          <td>${c.coveragePct.toFixed(1)}%</td>
          <td>${escapeHtml(Object.values(c.qualityByZone ?? {}).reduce((best, quality) => (
            QUALITY_RANK[quality as keyof typeof QUALITY_RANK] > QUALITY_RANK[best as keyof typeof QUALITY_RANK] ? quality : best
          ), "none"))}</td>
          <td>${c.criticalZonesFailed.length}</td>
          <td>${c.criticalZonesCovered.join(", ")}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  
  <h2>Recommendations</h2>
  ${result.recommendations.map((r) => `<div class="rec"><strong>${r.verified ? "✓ Verified" : "○ Unverified"}</strong>: ${escapeHtml(r.description)}<br><small>${escapeHtml(r.estimatedImpact)}</small></div>`).join("")}
  ${result.recommendations.length === 0 ? "<p>No recommendations.</p>" : ""}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
