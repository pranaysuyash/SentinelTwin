/**
 * Product Lifecycle Selector Hook — derives ProductLifecycleState from the
 * studio store. Re-renders only when the underlying inputs change.
 *
 * @see ~/lib/product-lifecycle.ts for the pure derivation logic.
 */

import { useMemo } from "react";
import { useStudioStore } from "@/store/studio-store";
import {
  deriveProductLifecycleState,
  type ProductLifecycleState,
} from "@/lib/product-lifecycle";

/**
 * Derive the current product lifecycle state from the store.
 * Memoized so consumers don't re-render on unrelated store changes.
 */
export function useProductLifecycle(): ProductLifecycleState {
  const scene = useStudioStore((s) => s.scene);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const governance = useStudioStore((s) => s.workspaceGovernance);

  // Check for report generation — the report catalog tracks published reports.
  const reportCatalog = useStudioStore((s) => s.reportCatalog);
  const hasReport =
    reportCatalog?.selectedPresetId != null &&
    (reportCatalog?.customPresets?.length ?? 0) > 0;
  const lastReportAt =
    reportCatalog?.customPresets?.[0]?.savedAt ?? null;

  return useMemo(
    () =>
      deriveProductLifecycleState({
        scene,
        simulationResult,
        governance,
        hasReport,
        lastReportAt,
      }),
    [scene, simulationResult, governance, hasReport, lastReportAt],
  );
}
