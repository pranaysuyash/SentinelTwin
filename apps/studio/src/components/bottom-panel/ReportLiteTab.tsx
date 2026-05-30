"use client";

import { Copy, Database, FileText, Globe, Loader2, Printer, Share2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { SecurityReport } from "@/agents/ReportAgent";
import { buildCompareShareLink } from "@/lib/compare-share-link";
import { shareLinkOrCopy } from "@/lib/share-link";
import { useAiCommand } from "@/hooks/use-ai-command";
import { buildSecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";
import { exportTextAsPdf } from "@/lib/pdf-export";
import { buildReportEvidenceBundle, stringifyReportEvidenceBundle } from "@/lib/report-evidence-bundle";
import { summarizeOperationalEvidenceTemporalTwin } from "@/lib/operational-evidence";
import {
  applyReportVisibility,
  buildCompareReportData,
  buildReportData,
  exportCompareAsHtml,
  exportCompareAsMarkdown,
  exportAsMarkdown,
  getReportAudienceProfile,
  getReportExportPresets,
  getReportVisibilityProfile,
  type ReportAudience,
  type ReportVisibility,
} from "@/report";
import { summarizeSceneTruthLadder } from "@/lib/truth-ladder";
import { QUALITY_RANK } from "@/lib/quality-display";
import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import { useStudioStore } from "@/store/studio-store";
import { buildReportSummaryLines } from "@/lib/report-summary";
import { truthLabelDetail } from "@/lib/truth-labels";

export function ReportLiteTab() {
  const result = useStudioStore((s) => s.simulationResult);
  const scene = useStudioStore((s) => s.scene);
  const snapshots = useStudioStore((s) => s.snapshots);
  const temporalProfile = useStudioStore((s) => s.temporalProfile);
  const operationalEvidenceEvents = useStudioStore((s) => s.operationalEvidenceEvents);
  const compareVisualEvidence = useStudioStore((s) => s.compareVisualEvidence);
  const compareReportSelection = useStudioStore((s) => s.compareReportSelection);
  const activePathId = useStudioStore((s) => s.activePathId);
  const { runReportGeneration } = useAiCommand();
  const [aiReport, setAiReport] = useState<SecurityReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportMode, setReportMode] = useState<"single" | "compare">(compareReportSelection ? "compare" : "single");
  const [reportAudience, setReportAudience] = useState<ReportAudience>("operator");
  const [reportVisibility, setReportVisibility] = useState<ReportVisibility>("internal");
  const [snapshotAId, setSnapshotAId] = useState<string | null>(null);
  const [snapshotBId, setSnapshotBId] = useState<string | null>(null);
  const activePath = scene.paths.find((path) => path.id === activePathId) ?? null;
  const outcome = buildSecurityOutcomeModel(scene, result, activePath);
  const truthLadder = useMemo(() => summarizeSceneTruthLadder(scene), [scene]);
  const audienceProfile = useMemo(() => getReportAudienceProfile(reportAudience), [reportAudience]);
  const visibilityProfile = useMemo(() => getReportVisibilityProfile(reportVisibility), [reportVisibility]);
  const reportCatalog = useMemo(() => getReportExportPresets(), []);
  const singleReport = useMemo(
    () =>
      (result
        ? buildReportData(scene, result, {
            operationalEvidenceEvents,
            audience: reportAudience,
            visibility: reportVisibility,
          })
        : null),
    [operationalEvidenceEvents, reportAudience, reportVisibility, result, scene],
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

  // Build markdown from either AI report or simulation data
  const singleSceneMarkdown = result
    ? (aiReport ? buildAiReportMarkdown(aiReport) : defaultMarkdown(result, scene, temporalProfile, operationalEvidenceEvents, audienceProfile))
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
        { audience: reportAudience, visibility: reportVisibility },
      );
    },
    [hasCompareSimulation, reportAudience, reportVisibility, snapshotA, snapshotB],
  );
  const compareExportReport = useMemo(
    () => (compareReport ? applyReportVisibility(compareReport, reportVisibility) : null),
    [compareReport, reportVisibility],
  );
  const compareMarkdown = compareExportReport ? exportCompareAsMarkdown(compareExportReport) : "";
  const currentReportMarkdown = reportMode === "compare"
    ? (hasCompareSimulation ? compareMarkdown : "Select two simulated snapshots to preview compare markdown.")
    : (singleExportReport ? exportAsMarkdown(singleExportReport) : singleSceneMarkdown);

  useEffect(() => {
    if (compareReportSelection) {
      setReportMode("compare");
    }
  }, [compareReportSelection]);

  const copy = () => navigator.clipboard.writeText(currentReportMarkdown);
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
    await navigator.clipboard.writeText(link);
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
    const html = buildHtmlReport(scene, result, aiReport, temporalProfile, operationalEvidenceEvents, audienceProfile, visibilityProfile, singleExportReport);
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
    const html = buildHtmlReport(scene, result, aiReport, temporalProfile, operationalEvidenceEvents, audienceProfile, visibilityProfile, singleExportReport);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-[#1e2130] px-3 py-1.5">
        <span className="text-[10px] text-[#68738a]">
          {aiReport ? "AI Report" : "Markdown Report"}
        </span>
        <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 rounded border border-[#1e2130] bg-[#0f141f] p-0.5">
            <button
              onClick={() => setReportMode("single")}
              className={`rounded px-2 py-0.5 text-[9px] ${reportMode === "single" ? "bg-[#1d2738] text-white" : "text-[#8090a8]"}`}
            >
              Single Scene
            </button>
            <button
              onClick={() => setReportMode("compare")}
              className={`rounded px-2 py-0.5 text-[9px] ${reportMode === "compare" ? "bg-[#1d2738] text-white" : "text-[#8090a8]"}`}
            >
              Before/After
            </button>
        </div>
          <div className="flex flex-wrap gap-1.5 rounded border border-[#1e2130] bg-[#0f141f] p-1">
            {reportCatalog.map((preset) => {
              const selected = preset.audience === reportAudience && preset.visibility === reportVisibility;
              const visibility = getReportVisibilityProfile(preset.visibility);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setReportAudience(preset.audience);
                    setReportVisibility(preset.visibility);
                  }}
                  className={`min-w-[10rem] rounded px-2 py-1 text-left text-[9px] transition-colors ${
                    selected
                      ? "border border-sky-500/40 bg-sky-500/10 text-sky-100"
                      : "border border-[#24283a] bg-[#111521] text-[#9aa6bf] hover:border-[#2f3650] hover:text-white"
                  }`}
                >
                  <div className="font-semibold uppercase tracking-[0.14em]">{preset.title}</div>
                  <div className="mt-0.5 text-[8px] text-[#70809c]">
                    {getReportAudienceProfile(preset.audience).label} · {visibility.label}
                  </div>
                  <div className="mt-1 text-[8px] text-[#70809c]">{preset.summary}</div>
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-1 rounded border border-[#1e2130] bg-[#0f141f] px-2 py-1 text-[9px] text-[#8090a8]">
            Audience
            <select
              value={reportAudience}
              onChange={(event) => setReportAudience(event.target.value as ReportAudience)}
              className="rounded border border-[#24283a] bg-[#111521] px-2 py-0.5 text-[9px] text-[#d2d9e8]"
            >
              <option value="operator">Operator</option>
              <option value="auditor">Auditor</option>
              <option value="insurer">Insurer</option>
              <option value="installer">Installer</option>
              <option value="privacy_reviewer">Privacy reviewer</option>
            </select>
          </label>
          <label className="flex items-center gap-1 rounded border border-[#1e2130] bg-[#0f141f] px-2 py-1 text-[9px] text-[#8090a8]">
            Visibility
            <select
              value={reportVisibility}
              onChange={(event) => setReportVisibility(event.target.value as ReportVisibility)}
              className="rounded border border-[#24283a] bg-[#111521] px-2 py-0.5 text-[9px] text-[#d2d9e8]"
            >
              <option value="internal">Internal</option>
              <option value="shared">Shared</option>
              <option value="privacy_safe">Privacy safe</option>
            </select>
          </label>
          <div className="rounded border border-[#1e2130] bg-[#0f141f] px-2 py-1 text-[9px] text-[#8090a8]">
            <div className="font-semibold uppercase tracking-[0.14em] text-[#c7d0e4]">Audience Policy</div>
            <div className="mt-0.5 text-[#6f7f9d]">
              {audienceProfile.disclosureLevel.replace(/_/g, " ")} · {audienceProfile.disclosureSummary}
            </div>
            <div className="mt-1 text-[#6f7f9d]">Visible: {audienceProfile.visibleSections.join(", ")}</div>
            <div className="text-[#6f7f9d]">Withheld: {audienceProfile.withheldSections.length > 0 ? audienceProfile.withheldSections.join(", ") : "none"}</div>
          </div>
          <button
            onClick={handleGenerateAI}
            disabled={isGenerating || !result}
            className="inline-flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-[9px] text-emerald-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 disabled:opacity-40"
          >
            {isGenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {isGenerating ? "Generating..." : aiReport ? "Regenerate" : "Generate AI"}
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => { setAiReport(null); }}
              className="rounded border border-[#1e2130] px-2 py-1 text-[9px] text-[#68738a] transition-colors hover:text-white"
            >
              Default
            </button>
            <button
              onClick={handleExportMarkdown}
              className="flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-[9px] text-[#8090a8] transition-colors hover:border-[#2a3045] hover:text-white"
            >
              <FileText className="h-3 w-3" /> Export Markdown
            </button>
            <button
              onClick={handleExportHtml}
              className="flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-[9px] text-[#8090a8] transition-colors hover:border-[#2a3045] hover:text-white"
            >
              <Globe className="h-3 w-3" /> Export HTML
            </button>
            <button
              onClick={handleExportEvidenceBundle}
              className="flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-[9px] text-[#8090a8] transition-colors hover:border-[#2a3045] hover:text-white"
            >
              <Database className="h-3 w-3" /> Export Evidence Bundle
            </button>
            <button
              onClick={() => {
                void handleExportPdf();
              }}
              className="flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-[9px] text-[#8090a8] transition-colors hover:border-[#2a3045] hover:text-white"
            >
              <FileText className="h-3 w-3" /> Export PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-[9px] text-[#8090a8] transition-colors hover:border-[#2a3045] hover:text-white"
            >
              <Printer className="h-3 w-3" /> Print
            </button>
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-[9px] text-[#8090a8] transition-colors hover:border-[#2a3045] hover:text-white"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          <button
            onClick={() => {
              void shareCompareLink();
            }}
            disabled={reportMode !== "compare" || !snapshotA || !snapshotB}
            className="flex items-center gap-1 rounded border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-[9px] text-sky-100 transition-colors hover:bg-sky-500/15 disabled:opacity-40"
          >
            <Share2 className="h-3 w-3" /> Share compare link
          </button>
          <button
            onClick={() => {
              void copyCompareLink();
            }}
            disabled={reportMode !== "compare" || !snapshotA || !snapshotB}
              className="flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-[9px] text-[#8090a8] transition-colors hover:border-[#2a3045] hover:text-white disabled:opacity-40"
            >
              <Copy className="h-3 w-3" /> Copy compare link
            </button>
          </div>
        </div>
      </div>
      <div className="border-b border-[#1e2130] px-3 py-1.5 text-[9px] text-[#74809a]">
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
        {!result && reportMode === "single" ? (
          <RunSimulationPrompt
            className="rounded-xl border border-dashed border-[#2a3246] bg-[#0b0f17] px-3 py-4"
            message="Run the shared simulation to generate a report and security outcome."
          />
        ) : null}
        {reportSummary ? (
          <div className="mb-3 rounded-xl border border-[#1e2130] bg-[#0b1018] p-3">
            <div
              className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[#1e2130] bg-[#0f141f] px-2 py-1.5 text-[9px] text-[#8b96ab]"
              aria-label="Truth: Computed"
              title="Derived from the current scene and simulation state."
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase tracking-[0.14em] text-[#c7d0e4]">Truth:</span>
                <span className="rounded border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-sky-200">Computed</span>
              </div>
              <div className="max-w-[28rem] truncate text-right" title={truthLabelDetail("computed")}>{truthLabelDetail("computed")}</div>
            </div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#7f8da8]">Report Summary</div>
                <div className="text-[9px] text-[#6f7f9d]">Four bullet executive summary from the latest run.</div>
                <div className="text-[9px] text-[#6f7f9d]">Audience framing: {audienceProfile.label} · {audienceProfile.framing}</div>
                <div className="text-[9px] text-[#6f7f9d]">Visibility framing: {visibilityProfile.label} · {visibilityProfile.framing}</div>
              </div>
              <button
                type="button"
                onClick={() => setReportMode("single")}
                className="rounded border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] text-[#8090a8] transition-colors hover:border-[#32384d] hover:text-white"
              >
                Latest Run
              </button>
            </div>
            <div className="grid gap-1.5 text-[10px] text-[#b9c7df]">
              {reportSummary.map((line) => (
                <div key={line.label} className="rounded-lg border border-[#1e2130] bg-[#101521] px-2.5 py-2">
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
        <div className="mb-3 rounded-xl border border-[#1e2130] bg-[#0b1018] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#7f8da8]">Truth Ladder</div>
              <div className="text-[9px] text-[#6f7f9d]">Node review, source trace, and geometry validity status for the current scene.</div>
            </div>
            <div className="rounded border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[9px] text-sky-200">
              {truthLadder.summary}
            </div>
          </div>
          <div className="grid gap-1.5 text-[10px] text-[#b9c7df] md:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Nodes", value: truthLadder.nodeCount },
              { label: "Reviewed Nodes", value: `${truthLadder.reviewedNodeCount} (${truthLadder.reviewedCoveragePct.toFixed(1)}%)` },
              { label: "Verified Nodes", value: truthLadder.verifiedNodeCount },
              { label: "Source Traces", value: `${truthLadder.sourceTraceCount} (${truthLadder.sourceTraceCoveragePct.toFixed(1)}%)` },
              { label: "Suspect Geometry", value: truthLadder.suspectGeometryCount },
              { label: "Invalid Geometry", value: truthLadder.invalidGeometryCount },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-[#1e2130] bg-[#101521] px-2.5 py-2">
                <span className="font-semibold text-sky-300">{item.label}:</span> {item.value}
              </div>
            ))}
          </div>
        </div>
        {activePathId ? (
          <div className="mb-3 rounded-lg border border-[#1e2130] bg-[#0b1018] px-3 py-2 text-[10px] text-[#8090a8]">
            Route evidence is tied to the selected active path.
          </div>
        ) : (
          <div className="mb-3 rounded-lg border border-dashed border-[#1e2130] bg-[#0b1018] px-3 py-2 text-[10px] text-[#8090a8]">
            Select a path in Scenario / Path to include route evidence in report summaries and exports.
          </div>
        )}
        <div className="mb-3 rounded-lg border border-[#1e2130] bg-[#0b1018] p-3 text-[10px] text-[#b9c7df]">
          Security Outcome: {outcome.summary.status.replace(/_/g, " ")} · Coverage {outcome.summary.coveragePct == null ? "n/a" : `${Math.round(outcome.summary.coveragePct)}%`} · Critical Zones {outcome.summary.criticalZonesPassing}/{outcome.summary.criticalZonesTotal} · Issues {outcome.summary.issueCount}
        </div>
        {reportMode === "compare" ? (
          <div className="mb-3 rounded-lg border border-[#1e2130] bg-[#0b1018] p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7f8da8]">Compare Export Context</div>
            {compareSelectionMissing ? (
              <div className="mb-2 rounded-lg border border-dashed border-[#243048] bg-[#091018] px-3 py-2 text-[10px] text-[#8a97af]">
                Select both snapshots to generate compare exports. The report keeps the comparison explicit instead of auto-picking the newest saves.
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="text-[9px] text-[#9aa6bf]">
                  Snapshot A
                  <select
                    value={snapshotA?.id ?? ""}
                    onChange={(event) => setSnapshotAId(event.target.value)}
                    className="mt-1 w-full rounded border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] text-[#d2d9e8]"
                  >
                    <option value="" disabled>
                      Select snapshot
                    </option>
                    {snapshots.map((snapshot) => (
                      <option key={snapshot.id} value={snapshot.id}>{snapshot.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[9px] text-[#9aa6bf]">
                  Snapshot B
                  <select
                    value={snapshotB?.id ?? ""}
                    onChange={(event) => setSnapshotBId(event.target.value)}
                    className="mt-1 w-full rounded border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] text-[#d2d9e8]"
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
            <div className="mt-2 text-[9px] text-[#8090a8]">
              {hasCompareSimulation
                ? "Compare report includes before/after deltas and zone-level change table."
                : "Selected snapshots must both have simulation results for compare export."}
            </div>
            <div className="mt-1 text-[9px] text-[#8090a8]">
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
          <pre className="whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-[#8090a8]">
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

function defaultMarkdown(
  result: NonNullable<ReturnType<typeof useStudioStore.getState>["simulationResult"]>,
  scene: ReturnType<typeof useStudioStore.getState>["scene"],
  temporalProfile: ReturnType<typeof useStudioStore.getState>["temporalProfile"],
  operationalEvidenceEvents: ReturnType<typeof useStudioStore.getState>["operationalEvidenceEvents"],
  audienceProfile: ReturnType<typeof getReportAudienceProfile>,
): string {
  const obstructionMaterialById = new Map<string, { material: string; transmission?: number }>();
  for (const wall of scene.walls) {
    obstructionMaterialById.set(wall.id, { material: wall.material, transmission: wall.visionTransmission });
  }
  for (const obstruction of scene.obstructions) {
    obstructionMaterialById.set(obstruction.id, { material: obstruction.material, transmission: obstruction.visionTransmission });
  }
  for (const windowNode of scene.windows) {
    obstructionMaterialById.set(windowNode.id, { material: windowNode.state, transmission: windowNode.visionTransmission });
  }
  const failingZones = result.criticalZoneResults.filter((zone) => zone.status !== "pass");
  const verifiedRecommendations = result.recommendations.filter((rec) => rec.verified);
  const topRecommendations = (verifiedRecommendations.length > 0 ? verifiedRecommendations : result.recommendations).slice(0, 5);
  const kRobustness = result.kRobustness;
  const placementOracle = result.placementOracle;
  const anomalies = temporalProfile?.anomalyWindows ?? [];
  const occlusion = result.occlusionBlame ?? [];
  const blindRegions = result.blindRegions ?? [];
  const evidenceEntries = (scene.changeLog ?? [])
    .filter((entry) => entry.startsWith("Evidence: "))
    .map((entry) => parseEvidenceEntry(entry))
    .filter((entry): entry is { when: string; title: string; details: string; confidence: string } => entry !== null);
  const sensorEvidenceCount = evidenceEntries.filter((entry) => /sensor/i.test(`${entry.title} ${entry.details}`)).length;
  const temporalTwin = summarizeOperationalEvidenceTemporalTwin(operationalEvidenceEvents, scene);
  const truthLadder = summarizeSceneTruthLadder(scene);
  const averagePathVisibility = result.pathResults.length > 0
    ? result.pathResults.reduce((acc, path) => {
        const total = Math.max(path.totalDurationS, 1);
        return acc + ((path.visibleDurationS / total) * 100);
      }, 0) / result.pathResults.length
    : 0;
  const averagePathLost = result.pathResults.length > 0
    ? result.pathResults.reduce((acc, path) => {
        const total = Math.max(path.totalDurationS, 1);
        return acc + ((path.lostDurationS / total) * 100);
      }, 0) / result.pathResults.length
    : 0;
  const lines = [
    "# SentinelTwin Coverage Report",
    "## Scene: " + scene.name,
    "Generated: " + new Date().toLocaleString(),
    "",
    "### Assumptions",
    "- DORI Model: " + scene.assumptions.doriStandard,
    "- Person Height: " + scene.assumptions.personHeightM + "m",
    "- Vehicle Height: " + scene.assumptions.vehicleHeightM + "m",
    "- PPM Thresholds: " + [
      scene.assumptions.pixelsPerMeter.detection,
      scene.assumptions.pixelsPerMeter.observation,
      scene.assumptions.pixelsPerMeter.recognition,
      scene.assumptions.pixelsPerMeter.identification,
    ].join(" / "),
    "",
    "### Camera Setup",
    `- Cameras Modeled: ${scene.cameras.length}`,
    ...scene.cameras.slice(0, 6).map((camera) => (
      `- ${camera.name}: ${camera.mountType} mount, ${camera.fovHorizontalDeg}° FOV, ${camera.rangeM}m range, status ${camera.status}`
    )),
    ...(scene.cameras.length > 6 ? [`- ...${scene.cameras.length - 6} additional cameras not shown in this summary.`] : []),
    "",
    "### Summary",
    `- Audience: ${audienceProfile.label} (${audienceProfile.framing})`,
    `- Audience Policy: ${audienceProfile.disclosureLevel.replace(/_/g, " ")} · ${audienceProfile.disclosureSummary}`,
    `- Visible Sections: ${audienceProfile.visibleSections.join(", ")}`,
    `- Withheld Sections: ${audienceProfile.withheldSections.length > 0 ? audienceProfile.withheldSections.join(", ") : "none"}`,
    "- Total Coverage: " + result.totalCoveragePct.toFixed(1) + "%",
    "- Recognition Area: " + result.recognitionAreaPct.toFixed(1) + "%",
    "- Identification Area: " + result.identificationAreaPct.toFixed(1) + "%",
    "- Critical Zones: " + result.criticalZoneResults.filter((z) => z.status === "pass").length + "/" + result.criticalZoneResults.length + " passing",
    "- Issues Found: " + result.issues.length,
    "- Verified Recommendations: " + result.recommendations.filter((r) => r.verified).length + "/" + result.recommendations.length,
    "",
    "### Coverage Analysis",
    `- Worst Area Quality: ${result.worstAreaQuality}`,
    `- Average Walkable Quality Score: ${result.averageWalkableQuality.toFixed(2)}`,
    "",
    "### Blindspot Summary",
    `- Blindspot Area: ${result.blindspotPct.toFixed(1)}% of modeled walkable cells`,
    `- Blind Regions Detected: ${blindRegions.length}`,
    ...(result.blindSpotFingerprint
      ? [
          `- Blind Spot Fingerprint: ${result.blindSpotFingerprint.fingerprint}`,
          `- Largest Blind Region: ${result.blindSpotFingerprint.largestRegionAreaSqM.toFixed(1)} m²`,
        ]
      : []),
    "",
    "### Path Replay Coverage",
    `- Paths Modeled: ${result.pathResults.length}`,
    `- Average Path Visibility: ${averagePathVisibility.toFixed(1)}%`,
    `- Average Path Lost Time: ${averagePathLost.toFixed(1)}%`,
    ...(result.pathResults.slice(0, 4).map((path) => {
      const total = Math.max(path.totalDurationS, 1);
      const visiblePct = (path.visibleDurationS / total) * 100;
      const lostPct = (path.lostDurationS / total) * 100;
      return `- ${path.pathId}: visible ${visiblePct.toFixed(1)}%, lost ${lostPct.toFixed(1)}%`;
    })),
    "",
    "### Truth Ladder",
    "- Nodes: " + truthLadder.nodeCount,
    "- Reviewed Nodes: " + truthLadder.reviewedNodeCount + ` (${truthLadder.reviewedCoveragePct.toFixed(1)}%)`,
    "- Verified Nodes: " + truthLadder.verifiedNodeCount,
    "- Source Traces: " + truthLadder.sourceTraceCount + ` (${truthLadder.sourceTraceCoveragePct.toFixed(1)}%)`,
    "- Suspect Geometry: " + truthLadder.suspectGeometryCount,
    "- Invalid Geometry: " + truthLadder.invalidGeometryCount,
    "- Summary: " + truthLadder.summary,
    "",
    "### Issues",
    ...result.issues.map((i) => "- [" + i.severity + "] " + i.description),
    "",
    "### Zones Needing Hardening",
    ...(failingZones.length > 0
      ? failingZones.map((z) => `- ${z.label}: required ${z.requiredQuality}, actual ${z.actualQuality} (${z.status})`)
      : ["- All modeled critical zones are currently passing."]),
    "",
    "### Immediate Action Plan",
    ...(topRecommendations.length > 0
      ? topRecommendations.map((r, index) => `${index + 1}. ${r.description} (${r.estimatedImpact})`)
      : ["1. No recommendations generated yet. Review assumptions and rerun simulation."]),
    "",
    "### Before / After Compare Guidance",
    "- Use the Report tab Compare mode to export before/after deltas for baseline vs proposed scenarios.",
    "- Recommended baseline sequence: Baseline -> Moved Obstruction -> Cam 2 Rotated -> Night Mode.",
    "",
    "### Changes Applied",
    ...(scene.changeLog?.length ? scene.changeLog.map((entry, index) => `${index + 1}. ${entry}`)
      : ["No changes have been applied to this scene."]),
    "",
    "### Operational Evidence",
    `- Change Log Entries: ${scene.changeLog.length}`,
    `- Evidence Entries: ${evidenceEntries.length}`,
    `- Sensor-related Evidence: ${sensorEvidenceCount}`,
    ...(evidenceEntries.length > 0
      ? [
          "- Recent Evidence Entries:",
          ...evidenceEntries.slice(-5).reverse().map((entry) => `  - ${entry.when} · ${entry.title} · ${entry.details} · ${entry.confidence}`),
        ]
      : ["- Recent Evidence Entries: none"]),
    "",
    "### Temporal Operational Twin",
    `- Scene Events: ${temporalTwin.totalEvents}`,
    `- Reconstructable Checkpoints: ${temporalTwin.checkpointCount}`,
    `- Published Checkpoints: ${temporalTwin.publishedCheckpointCount}`,
    `- Branch Heads: ${temporalTwin.branchHeadCount}`,
    `- Current Scene: ${temporalTwin.currentSceneSummary?.detail ?? "Unavailable."}`,
    `- Latest Checkpoint: ${temporalTwin.latestCheckpoint ? `${temporalTwin.latestCheckpoint.title} (${temporalTwin.latestCheckpoint.branchLabel})` : "Unavailable."}`,
    `- Checkpoint Age: ${temporalTwin.latestCheckpointAgeMs != null ? `${Math.max(1, Math.round(temporalTwin.latestCheckpointAgeMs / 60000))}m` : "Unavailable."}`,
    `- Checkpoint Delta: ${temporalTwin.currentVsLatestCheckpointDelta
      ? `cameras ${temporalTwin.currentVsLatestCheckpointDelta.cameras >= 0 ? "+" : ""}${temporalTwin.currentVsLatestCheckpointDelta.cameras}, zones ${temporalTwin.currentVsLatestCheckpointDelta.zones >= 0 ? "+" : ""}${temporalTwin.currentVsLatestCheckpointDelta.zones}, sensors ${temporalTwin.currentVsLatestCheckpointDelta.sensors >= 0 ? "+" : ""}${temporalTwin.currentVsLatestCheckpointDelta.sensors}`
      : "Unavailable."}`,
    `- Latest Published Checkpoint: ${temporalTwin.latestPublishedCheckpoint ? `${temporalTwin.latestPublishedCheckpoint.title} (${temporalTwin.latestPublishedCheckpoint.branchLabel})` : "Unavailable."}`,
    `- Published Age: ${temporalTwin.latestPublishedCheckpointAgeMs != null ? `${Math.max(1, Math.round(temporalTwin.latestPublishedCheckpointAgeMs / 60000))}m` : "Unavailable."}`,
    `- Published Delta: ${temporalTwin.currentVsLatestPublishedCheckpointDelta
      ? `cameras ${temporalTwin.currentVsLatestPublishedCheckpointDelta.cameras >= 0 ? "+" : ""}${temporalTwin.currentVsLatestPublishedCheckpointDelta.cameras}, zones ${temporalTwin.currentVsLatestPublishedCheckpointDelta.zones >= 0 ? "+" : ""}${temporalTwin.currentVsLatestPublishedCheckpointDelta.zones}, sensors ${temporalTwin.currentVsLatestPublishedCheckpointDelta.sensors >= 0 ? "+" : ""}${temporalTwin.currentVsLatestPublishedCheckpointDelta.sensors}`
      : "Unavailable."}`,
    "",
    "### Recommendations",
    ...result.recommendations.map((r) => "- [" + (r.verified ? "verified" : "unverified") + "] " + r.description + " :: " + r.estimatedImpact),
    "",
    "### Novel Algorithms",
    "- Coverage Fragility: " + (result.fragilitySummary ? `${Math.round(result.fragilitySummary.meanFragility * 100)}% mean fragility across ${result.fragilitySummary.totalCells} cells` : "not computed"),
    "- K-Robustness: " + (kRobustness ? `K=${kRobustness.kRobustness} from ${kRobustness.totalCameras} cameras` : "not computed"),
    "- Placement Oracle: " + (placementOracle?.bestCandidate
      ? `${placementOracle.bestCandidate.mountType} @ ${placementOracle.bestCandidate.position[0].toFixed(1)}, ${placementOracle.bestCandidate.position[2].toFixed(1)}`
      : "not computed"),
    "- Temporal Anomalies: " + (anomalies.length > 0 ? `${anomalies.length} windows` : "none detected"),
    "- Occlusion Blame: " + (occlusion.length > 0 ? `${occlusion.length} zones` : "none"),
    "- Blind Spot Topology: " + (blindRegions.length > 0 ? `${blindRegions.length} regions` : "none"),
    "",
    ...(occlusion.length > 0
      ? [
          "### Occlusion Blame",
          ...occlusion.flatMap((zone) => [
            `- ${zone.zoneLabel} (${zone.baselineQuality})`,
            ...zone.obstructions.map(
              (obstruction) => {
                const materialInfo = obstructionMaterialById.get(obstruction.obstructionId);
                const materialLabel = materialInfo ? `${materialInfo.material}${materialInfo.transmission != null ? ` (${Math.round(materialInfo.transmission * 100)}% transmission)` : ""}` : "unknown";
                return `  - ${obstruction.label}: ${(obstruction.blameFraction * 100).toFixed(0)}% blame, ${obstruction.qualityWithout} without, +${obstruction.qualityImprovement.toFixed(1)} improvement, material ${materialLabel}`;
              },
            ),
          ]),
          "",
        ]
      : []),
    "### Limitations",
    "- This output is a deterministic simulation estimate based on current scene assumptions.",
    "- It is not a legal, forensic, or certified compliance determination.",
    "- Real-world operations can differ due to lighting, motion, environment changes, and hardware behavior.",
    "",
    "_Planning indicator only: modeled outcomes depend on assumptions and are not legal/forensic guarantees._",
  ];
  return lines.join("\n");
}

function parseEvidenceEntry(entry: string) {
  const payload = entry.slice("Evidence: ".length);
  const parts = payload.split(" | ");
  if (parts.length < 4) return null;
  const [when, title, ...rest] = parts;
  const confidence = rest.pop();
  if (!confidence) return null;
  return {
    when,
    title,
    details: rest.join(" | "),
    confidence,
  };
}

function buildHtmlReport(
  scene: ReturnType<typeof useStudioStore.getState>["scene"],
  result: NonNullable<ReturnType<typeof useStudioStore.getState>["simulationResult"]>,
  aiReport: SecurityReport | null,
  temporalProfile: ReturnType<typeof useStudioStore.getState>["temporalProfile"],
  operationalEvidenceEvents: ReturnType<typeof useStudioStore.getState>["operationalEvidenceEvents"],
  audienceProfile: ReturnType<typeof getReportAudienceProfile>,
  visibilityProfile: ReturnType<typeof getReportVisibilityProfile>,
  reportView?: unknown,
): string {
  const isAi = aiReport != null;
  const title = isAi ? aiReport!.title : "SentinelTwin Coverage Report";
  const passing = result.criticalZoneResults.filter((z) => z.status === "pass").length;
  const totalZones = result.criticalZoneResults.length;
  const temporalTwin = summarizeOperationalEvidenceTemporalTwin(operationalEvidenceEvents, scene);

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

  <h2>Summary</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="value" style="color:#16a34a">${result.totalCoveragePct.toFixed(1)}%</div><div class="label">Total Coverage</div></div>
    <div class="summary-card"><div class="value" style="color:#2563eb">${result.recognitionAreaPct.toFixed(1)}%</div><div class="label">Recognition Area</div></div>
    <div class="summary-card"><div class="value" style="color:#7c3aed">${result.identificationAreaPct.toFixed(1)}%</div><div class="label">Identification Area</div></div>
    <div class="summary-card"><div class="value" style="color:${passing === totalZones ? "#16a34a" : "#dc2626"}">${passing}/${totalZones}</div><div class="label">Zones Passing</div></div>
  </div>

  ${isAi ? buildAiReportHtml(aiReport!) : buildDefaultHtml(result)}

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

  <h2>Novel Algorithms</h2>
  <table>
    <thead><tr><th>Algorithm</th><th>Output</th></tr></thead>
    <tbody>
      <tr><td>Coverage Fragility</td><td>${result.fragilitySummary ? `${Math.round(result.fragilitySummary.meanFragility * 100)}% mean fragility across ${result.fragilitySummary.totalCells} cells` : "Not computed"}</td></tr>
      <tr><td>K-Robustness</td><td>${result.kRobustness ? `K=${result.kRobustness.kRobustness} / ${result.kRobustness.totalCameras}` : "Not computed"}</td></tr>
      <tr><td>Placement Oracle</td><td>${result.placementOracle?.bestCandidate ? `${result.placementOracle.bestCandidate.mountType} @ ${result.placementOracle.bestCandidate.position[0].toFixed(1)}, ${result.placementOracle.bestCandidate.position[2].toFixed(1)}` : "Not computed"}</td></tr>
      <tr><td>Temporal Anomalies</td><td>${temporalProfile?.anomalyWindows?.length ? `${temporalProfile.anomalyWindows.length} windows` : "None detected or not computed"}</td></tr>
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
  
  <h2>Changes Applied</h2>
  ${scene.changeLog?.length
    ? `<ol>${scene.changeLog.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ol>`
    : "<p>No changes have been applied to this scene.</p>"}
  
  <footer>Generated by SentinelTwin Studio &middot; ${new Date().toISOString()} &middot; Standards: IEC 62676-4:2025 (OODPCVS)</footer>
</body>
</html>`;
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
