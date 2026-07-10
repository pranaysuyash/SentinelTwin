import { useState } from "react";
import { CameraNode } from "@/schema/security-scene";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
export function CameraSpecImport({
  camera,
  updateNode,
}: {
  camera: CameraNode;
  updateNode: (id: string, partial: Partial<CameraNode>) => void;
}) {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleImport = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setStatusMessage(null);

    // Simulated parsing of spec sheet JSON/text
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      let parsed: Partial<Pick<CameraNode, "fovHorizontalDeg" | "resolutionMP" | "focalLengthMm" | "irRangeM">>;
      try {
        parsed = JSON.parse(rawText) as Partial<Pick<CameraNode, "fovHorizontalDeg" | "resolutionMP" | "focalLengthMm" | "irRangeM">>;
      } catch {
        // Simple heuristic parsing if not valid JSON
        parsed = {};
        const fovMatch = rawText.match(/FOV.*?(\d+)/i);
        if (fovMatch) parsed.fovHorizontalDeg = Number(fovMatch[1]);
        
        const resMatch = rawText.match(/(\d+)MP/i);
        if (resMatch) parsed.resolutionMP = Number(resMatch[1]);

        const lensMatch = rawText.match(/Lens.*?(\d+\.?\d*)/i);
        if (lensMatch) parsed.focalLengthMm = Number(lensMatch[1]);

        const irMatch = rawText.match(/IR.*?(\d+)/i);
        if (irMatch) parsed.irRangeM = Number(irMatch[1]);
      }

      const patch: Partial<CameraNode> = {};
      
      if (parsed.fovHorizontalDeg != null) patch.fovHorizontalDeg = Number(parsed.fovHorizontalDeg);
      if (parsed.resolutionMP != null) patch.resolutionMP = Number(parsed.resolutionMP);
      if (parsed.focalLengthMm != null) patch.focalLengthMm = Number(parsed.focalLengthMm);
      if (parsed.irRangeM != null) patch.irRangeM = Number(parsed.irRangeM);
      
      if (Object.keys(patch).length > 0) {
        updateNode(camera.id, patch);
        setStatusMessage(`Successfully imported ${Object.keys(patch).length} specs.`);
        setRawText("");
      } else {
        setStatusMessage("Could not identify any specs in the provided text.");
      }
    } catch (e) {
      setStatusMessage("Failed to parse specifications.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5`}>
      <div className="mb-2 flex items-center justify-between">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${UI_SURFACES.textSoftMid}`}>Spec Import</span>
      </div>
      <div className="space-y-2">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste JSON or raw spec sheet text (e.g. '4MP Lens: 2.8mm FOV: 110 IR: 30m')"
          className={`h-16 w-full resize-none rounded-md border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} p-2 text-[10px] ${UI_SURFACES.textBody4} placeholder:${UI_SURFACES.textMuted} focus:border-blue-500/50 focus:outline-none`}
        />
        <div className="flex items-center justify-between">
          <span className={`text-[9px] ${UI_SURFACES.textDimMid}`}>
            {statusMessage ?? ""}
          </span>
          <button
            type="button"
            onClick={handleImport}
            disabled={loading || !rawText.trim()}
            className="rounded bg-blue-500/20 px-3 py-1 text-[10px] font-medium text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
          >
            {loading ? "Parsing..." : "Apply Specs"}
          </button>
        </div>
      </div>
    </div>
  );
}
