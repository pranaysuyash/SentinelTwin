import { ImportAdapter, ImportAdapterOptions, ImportAdapterResult } from "../types";
import { loadImageToData, extractFloorPlan, createSceneFromFloorPlan, validateFloorPlan } from "../../floor-plan-import";
import { getFloorPlanExtractionConfig } from "../../../components/scan-to-scene/floor-plan-extraction-config";
import { compileFloorPlanToSiteResult, compileToSiteTwinDraft } from "../../site-compiler";

export class ImageFloorPlanAdapter implements ImportAdapter {
  id = "image-floor-plan";
  name = "Image Floor Plan Extraction";
  description = "Extracts walls, doors, and windows from raster images (PNG, JPG, WebP) using AI.";
  accepts = ["image/png", "image/jpeg", "image/webp"];

  canHandle(file: File): boolean {
    return this.accepts.includes(file.type);
  }

  async process(file: File, options: ImportAdapterOptions): Promise<ImportAdapterResult> {
    try {
      const imageData = await loadImageToData(file);
      
      const config = getFloorPlanExtractionConfig({
        heightM: (options.heightM as number) || 3,
        floorPlanScalePixelsPerMeter: (options.scalePixelsPerMeter as number) || 50,
      });

      const floorPlanResult = await extractFloorPlan(imageData, config);
      const { warnings: validationWarnings } = validateFloorPlan(floorPlanResult);
      
      const scene = createSceneFromFloorPlan(options.fileName || "Imported Image Scene", floorPlanResult);
      
      const siteCompilerResult = compileFloorPlanToSiteResult(
        scene, 
        floorPlanResult.confidence,
        [`Extracted from ${options.fileName}`],
        null
      );

      const draft = compileToSiteTwinDraft(siteCompilerResult, [options.fileName]);
      
      return {
        drafts: [draft],
        warnings: validationWarnings,
      };
    } catch (err) {
      return {
        drafts: [],
        errors: [err instanceof Error ? err : new Error(String(err))]
      };
    }
  }
}
