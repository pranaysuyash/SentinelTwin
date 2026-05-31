"use client";

import { Suspense } from "react";

import { ProductViewRouter } from "@/components/product/ProductViewRouter";
import { useStudioNavigation } from "@/hooks/use-studio-navigation";
import { useStudioBootstrap } from "@/hooks/use-studio-bootstrap";

function StudioPageContent() {
  useStudioBootstrap();
  const handlers = useStudioNavigation();

  return (
    <>
      <ProductViewRouter handlers={handlers} />

      <input
        ref={handlers.fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handlers.handleFileChange}
      />

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
