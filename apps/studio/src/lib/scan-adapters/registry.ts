import type { ObjectDetectionAdapter, SegmentationAdapter, DepthEstimationAdapter, ScaleAnchoringAdapter, MultiPhotoCorrespondenceAdapter, StructuralExtractionAdapter, ScanAdapterSet } from "@/lib/scan-adapters/types";
import { StubObjectDetectionAdapter } from "@/lib/scan-adapters/adapters/stub-detection-adapter";
import { StubDepthEstimationAdapter } from "@/lib/scan-adapters/adapters/stub-depth-adapter";
import { StubScaleAnchoringAdapter } from "@/lib/scan-adapters/adapters/stub-scale-anchoring-adapter";
import { StubSegmentationAdapter } from "@/lib/scan-adapters/adapters/stub-segmentation-adapter";
import { DepthAnythingV2Adapter, createOnnxRuntimeInference } from "@/lib/scan-adapters/adapters/depth-anything-v2-adapter";
import { SAM2Adapter, createSAM2OnnxRuntimeInference } from "@/lib/scan-adapters/adapters/sam2-adapter";
import { VlmObjectDetectionAdapter, VlmStructuralExtractionAdapter } from "@/lib/vlm-pipeline/vlm-adapter";

const stubObjectDetection = new StubObjectDetectionAdapter();
const stubDepthEstimation = new StubDepthEstimationAdapter();
const stubScaleAnchoring = new StubScaleAnchoringAdapter();
const stubSegmentation = new StubSegmentationAdapter();

// The Depth Anything V2 adapter is wired lazily so the cost of
// loading the model file (and the ~3MB onnxruntime-web dependency)
// is only paid when an operator explicitly opts into real CV
// depth estimation.
//
// The registry returns a stub adapter synchronously. To get the
// real wired adapter, callers can `await ensureDepthAnythingV2Ready()`
// before scanning; the resulting adapter is also cached as the
// singleton that `getDepthAnythingV2Adapter()` returns on
// subsequent calls.
const DEPTH_ANYTHING_MODEL_URL =
  process.env.NEXT_PUBLIC_SENTINELTWIN_DEPTH_MODEL_URL ?? "/models/depth-anything-v2/depth_anything_v2_small.onnx";

let depthAnythingV2AdapterSingleton: DepthAnythingV2Adapter | null = null;
let depthAnythingV2InitPromise: Promise<DepthAnythingV2Adapter> | null = null;

export async function ensureDepthAnythingV2Ready(): Promise<DepthAnythingV2Adapter> {
  if (depthAnythingV2AdapterSingleton) return depthAnythingV2AdapterSingleton;
  if (depthAnythingV2InitPromise) return depthAnythingV2InitPromise;
  depthAnythingV2InitPromise = (async () => {
    try {
      const runInference = await createOnnxRuntimeInference(DEPTH_ANYTHING_MODEL_URL);
      const adapter = new DepthAnythingV2Adapter({
        modelUrl: DEPTH_ANYTHING_MODEL_URL,
        runInference,
      });
      depthAnythingV2AdapterSingleton = adapter;
      return adapter;
    } catch (error) {
      // If ONNX runtime fails to load (e.g. SSR, missing file),
      // we return a stub adapter that produces :fallback
      // results. The error surfaces via the singleton's
      // estimateDepth return value.
      const adapter = new DepthAnythingV2Adapter();
      depthAnythingV2AdapterSingleton = adapter;
      return adapter;
    }
  })();
  return depthAnythingV2InitPromise;
}

function getDepthAnythingV2Adapter(): DepthAnythingV2Adapter {
  return depthAnythingV2AdapterSingleton ?? new DepthAnythingV2Adapter();
}

// SAM2 mirrors the Depth Anything V2 lazy-init pattern. The
// segmentation adapter is the second scan-time adapter that
// needs substantial runtime; same trade-offs apply.
const SAM2_MODEL_URL =
  process.env.NEXT_PUBLIC_SENTINELTWIN_SAM2_MODEL_URL ?? "/models/sam2/sam2_small.onnx";

let sam2AdapterSingleton: SAM2Adapter | null = null;
let sam2InitPromise: Promise<SAM2Adapter> | null = null;

export async function ensureSAM2Ready(): Promise<SAM2Adapter> {
  if (sam2AdapterSingleton) return sam2AdapterSingleton;
  if (sam2InitPromise) return sam2InitPromise;
  sam2InitPromise = (async () => {
    try {
      const runInference = await createSAM2OnnxRuntimeInference(SAM2_MODEL_URL);
      const adapter = new SAM2Adapter({ modelUrl: SAM2_MODEL_URL, runInference });
      sam2AdapterSingleton = adapter;
      return adapter;
    } catch {
      const adapter = new SAM2Adapter();
      sam2AdapterSingleton = adapter;
      return adapter;
    }
  })();
  return sam2InitPromise;
}

function getSAM2Adapter(): SAM2Adapter {
  return sam2AdapterSingleton ?? new SAM2Adapter();
}

const vlmObjectDetection = new VlmObjectDetectionAdapter();
const vlmStructuralExtraction = new VlmStructuralExtractionAdapter();

export function getDefaultAdapterSet(): ScanAdapterSet {
  return {
    objectDetection: [stubObjectDetection, vlmObjectDetection],
    segmentation: [stubSegmentation, getSAM2Adapter()],
    depthEstimation: [stubDepthEstimation, getDepthAnythingV2Adapter()],
    scaleAnchoring: [stubScaleAnchoring],
    multiPhoto: [],
    structuralExtraction: [vlmStructuralExtraction],
  };
}

export function getStubAdapterSet(): ScanAdapterSet {
  return {
    objectDetection: [stubObjectDetection],
    segmentation: [stubSegmentation],
    depthEstimation: [stubDepthEstimation],
    scaleAnchoring: [stubScaleAnchoring],
    multiPhoto: [],
    structuralExtraction: [],
  };
}

export function getSegmentationAdapters(): SegmentationAdapter[] {
  return [stubSegmentation, getSAM2Adapter()];
}

export function getVlmAdapters(): { objectDetection: VlmObjectDetectionAdapter; structuralExtraction: VlmStructuralExtractionAdapter } {
  return { objectDetection: vlmObjectDetection, structuralExtraction: vlmStructuralExtraction };
}

export function getObjectDetectionAdapters(): ObjectDetectionAdapter[] {
  return [stubObjectDetection];
}

export function getDepthEstimationAdapters(): DepthEstimationAdapter[] {
  return [stubDepthEstimation];
}

export function getScaleAnchoringAdapters(): ScaleAnchoringAdapter[] {
  return [stubScaleAnchoring];
}

export function findObjectDetectionAdapter(id: string): ObjectDetectionAdapter | undefined {
  return getObjectDetectionAdapters().find((a) => a.id === id);
}

export function findDepthEstimationAdapter(id: string): DepthEstimationAdapter | undefined {
  return getDepthEstimationAdapters().find((a) => a.id === id);
}

export function hasAnyAdapters(adapters: ScanAdapterSet): boolean {
  return (
    adapters.objectDetection.length > 0 ||
    adapters.segmentation.length > 0 ||
    adapters.depthEstimation.length > 0 ||
    adapters.scaleAnchoring.length > 0 ||
    adapters.multiPhoto.length > 0 ||
    adapters.structuralExtraction.length > 0
  );
}

export function adapterSummary(adapters: ScanAdapterSet): string {
  const parts: string[] = [];
  if (adapters.objectDetection.length > 0) parts.push(`${adapters.objectDetection.length} detection`);
  if (adapters.segmentation.length > 0) parts.push(`${adapters.segmentation.length} segmentation`);
  if (adapters.depthEstimation.length > 0) parts.push(`${adapters.depthEstimation.length} depth`);
  if (adapters.scaleAnchoring.length > 0) parts.push(`${adapters.scaleAnchoring.length} scale`);
  if (adapters.multiPhoto.length > 0) parts.push(`${adapters.multiPhoto.length} correspondence`);
  if (adapters.structuralExtraction.length > 0) parts.push(`${adapters.structuralExtraction.length} structural`);
  return parts.length > 0 ? parts.join(", ") : "No adapters registered";
}
