"use client";

import { useEffect, useRef } from "react";
import { useStudioStore } from "@/store/studio-store";
import { useProductViewStore } from "@/store/product-view-store";
import { parseArchiveHandoffLink } from "@/lib/archive-handoff-link";
import { parseCompareShareLink } from "@/lib/compare-share-link";
import { parseTimelineShareLink } from "@/lib/timeline-share-link";

export function useStudioBootstrap() {
  const scene = useStudioStore((s) => s.scene);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);
  const runSimulationFromStore = useStudioStore((s) => s.runSimulation);
  const refreshSavedScenesList = useStudioStore((s) => s.refreshSavedScenesList);
  const recordRuntimeIncident = useStudioStore((s) => s.recordRuntimeIncident);
  const setArchiveHandoffRequest = useStudioStore((s) => s.setArchiveHandoffRequest);
  const setTimelineFocusRequest = useStudioStore((s) => s.setTimelineFocusRequest);
  const setCompareReportSelection = useStudioStore((s) => s.setCompareReportSelection);
  const setLaunchNotice = useStudioStore((s) => s.setLaunchNotice);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const navigate = useProductViewStore((s) => s.navigate);

  const bootstrapRef = useRef(false);
  const currentResult = simulationResult ?? scene.simulation ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onError = (event: ErrorEvent) => {
      recordRuntimeIncident({
        category: "runtime_failure",
        severity: "error",
        title: event.message || "Unhandled runtime error",
        details: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : "Unhandled browser runtime error.",
        stack: event.error instanceof Error ? event.error.stack : null,
        action: "window_error",
        path: window.location.pathname,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason : new Error(typeof event.reason === "string" ? event.reason : "Unhandled promise rejection");
      recordRuntimeIncident({
        category: "runtime_failure",
        severity: "error",
        title: "Unhandled promise rejection",
        details: reason.message,
        stack: reason.stack,
        action: "window_unhandledrejection",
        path: window.location.pathname,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [recordRuntimeIncident]);

  useEffect(() => {
    refreshSavedScenesList();
    const { scene, savedScenes, setScene } = useStudioStore.getState();
    if (scene.name === "Untitled Scene" && scene.cameras.length === 0 && scene.changeLog.length === 0 && savedScenes.length > 0) {
      const sorted = [...savedScenes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      if (sorted[0]) {
        setScene(sorted[0]);
      }
    }
  }, [refreshSavedScenesList]);

  useEffect(() => {
    if (bootstrapRef.current) return;
    bootstrapRef.current = true;
    if (currentResult || !simulationDirty || scene.source !== "demo") return;
    runSimulationFromStore();
  }, [currentResult, scene, scene.source, runSimulationFromStore, simulationDirty]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search;
    const archiveRequest = parseArchiveHandoffLink(search);
    const focusRequest = parseTimelineShareLink(search);
    const compareRequest = parseCompareShareLink(search);

    if (archiveRequest) {
      queueMicrotask(() => {
        setArchiveHandoffRequest(archiveRequest);
        navigate("studio");
        setWorkspacePreset("debug");
        setViewMode("map");
        setBottomTab("debug");
        setLaunchNotice(
          `Archive handoff opened for ${archiveRequest.archive.scene.name || "Untitled Scene"} in ${archiveRequest.restoreBranch} branch preflight.`,
        );
      });
      return;
    }

    if (compareRequest) {
      queueMicrotask(() => {
        setCompareReportSelection({
          snapshotAId: compareRequest.snapshotAId,
          snapshotBId: compareRequest.snapshotBId,
          provenanceNote: compareRequest.provenanceNote ?? null,
        });
        navigate("studio");
        if (compareRequest.mode === "report") {
          setWorkspacePreset("report");
          setViewMode("report");
          setBottomTab("report");
        } else {
          setWorkspacePreset("compare");
          setViewMode("compare");
          setBottomTab("beforeafter");
        }
      });
      return;
    }

    if (focusRequest) {
      queueMicrotask(() => {
        setTimelineFocusRequest(focusRequest);
        navigate("studio");
        setWorkspacePreset("coverage");
        setViewMode("map");
        setBottomTab("timeline");
      });
    }
  }, [
    navigate,
    setArchiveHandoffRequest,
    setBottomTab,
    setCompareReportSelection,
    setLaunchNotice,
    setTimelineFocusRequest,
    setViewMode,
    setWorkspacePreset,
  ]);
}
