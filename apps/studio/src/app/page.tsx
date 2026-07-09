"use client";

import { Suspense, useEffect } from "react";

import { ProductViewRouter } from "@/components/product/ProductViewRouter";
import { useStudioNavigation } from "@/hooks/use-studio-navigation";
import { useProductViewStore } from "@/store/product-view-store";
import { useStudioStore } from "@/store/studio-store";

/**
 * DemoSceneLoader — dev-only `?demoScene=<id>` deep link (runtime-QA gap).
 *
 * Lets the Playwright QA probe (and any developer) deep-link into a loaded
 * reference scene + studio entry, bypassing the intake flow. Without this,
 * runtime-verification of L1/L2 (which require a real simulation diff) is
 * blocked on non-interactive navigation. Gated by NODE_ENV so it never ships.
 *
 * Usage: http://localhost:3099/?demoScene=small-retail-shop
 */
function DemoSceneLoader() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const params = new URLSearchParams(window.location.search);
    const sceneId = params.get("demoScene");
    if (!sceneId) return;
    const studio = useStudioStore.getState();
    // Match by exact id first, then by a friendly slug (e.g. "small-retail-shop"
    // maps to "scene_small_retail_shop") so QA URLs stay human-typable.
    const slugToId = (s: string) => `scene_${s.replace(/-/g, "_")}`;
    const scene = studio.loadReferenceScene(sceneId)
      ?? studio.loadReferenceScene(slugToId(sceneId));
    // Defer to the next tick so ProductViewRouter has mounted and subscribed
    // to the product-view store before we navigate — otherwise the state
    // change fires before the subscription is live and the router misses it.
    queueMicrotask(() => {
      if (scene) {
        studio.setScene(scene);
        studio.setDockCollapsed("bottom", false);
        useProductViewStore.getState().navigate("studio");
        setTimeout(() => useStudioStore.getState().runSimulation(), 400);
      }
    });
  }, []);
  return null;
}

function StudioPageContent() {
  const handlers = useStudioNavigation();

  return (
    <>
      <DemoSceneLoader />
      <ProductViewRouter handlers={handlers} />

      {handlers.fileInputRef ? (
        <input
          ref={handlers.fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handlers.handleFileChange}
        />
      ) : null}

      {handlers.importError ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-red-400/25 bg-red-500/12 px-4 py-2 text-xs text-red-200 shadow-lg">
          {handlers.importError}
        </div>
      ) : null}
    </>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioPageContent />
    </Suspense>
  );
}
