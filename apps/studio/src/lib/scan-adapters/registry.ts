import type { ObjectDetectionAdapter, SegmentationAdapter, DepthEstimationAdapter, ScaleAnchoringAdapter, MultiPhotoCorrespondenceAdapter, StructuralExtractionAdapter, ScanAdapterSet } from "@/lib/scan-adapters/types";
import { StubObjectDetectionAdapter } from "@/lib/scan-adapters/adapters/stub-detection-adapter";
import { StubDepthEstimationAdapter } from "@/lib/scan-adapters/adapters/stub-depth-adapter";
import { StubScaleAnchoringAdapter } from "@/lib/scan-adapters/adapters/stub-scale-anchoring-adapter";
import { StubSegmentationAdapter } from "@/lib/scan-adapters/adapters/stub-segmentation-adapter";
import { DepthAnythingV2Adapter } from "@/lib/scan-adapters/adapters/depth-anything-v2-adapter";
import { VlmObjectDetectionAdapter, VlmStructuralExtractionAdapter } from "@/lib/vlm-pipeline/vlm-adapter";

const stubObjectDetection = new StubObjectDetectionAdapter();
const stubDepthEstimation = new StubDepthEstimationAdapter();
const stubScaleAnchoring = new StubScaleAnchoringAdapter();
const stubSegmentation = new StubSegmentationAdapter();

// The Depth Anything V2 adapter is instantiated lazily so the cost of
// loading the model file (and the ~25MB ONNX asset) is only paid when
// an operator explicitly opts into real CV depth estimation.
let depthAnythingV2Singleton: DepthAnythingV2Adapter | null = null;
function getDepthAnythingV2Adapter(): DepthAnythingV2Adapter {
  if (!depthAnythingV2Singleton) {
    depthAnythingV2Singleton = new DepthAnythingV2Adapter();
  }
  return depthAnythingV2Singleton;
}

const vlmObjectDetection = new VlmObjectDetectionAdapter();
const vlmStructuralExtraction = new VlmStructuralExtractionAdapter();

export function getDefaultAdapterSet(): ScanAdapterSet {
  return {
    objectDetection: [stubObjectDetection, vlmObjectDetection],
    segmentation: [stubSegmentation],
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
  return [stubSegmentation];
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
