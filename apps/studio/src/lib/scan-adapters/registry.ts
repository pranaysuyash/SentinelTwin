import type { ObjectDetectionAdapter, SegmentationAdapter, DepthEstimationAdapter, ScaleAnchoringAdapter, MultiPhotoCorrespondenceAdapter, StructuralExtractionAdapter, ScanAdapterSet } from "@/lib/scan-adapters/types";
import { StubObjectDetectionAdapter } from "@/lib/scan-adapters/adapters/stub-detection-adapter";
import { StubDepthEstimationAdapter } from "@/lib/scan-adapters/adapters/stub-depth-adapter";
import { StubScaleAnchoringAdapter } from "@/lib/scan-adapters/adapters/stub-scale-anchoring-adapter";

const stubObjectDetection = new StubObjectDetectionAdapter();
const stubDepthEstimation = new StubDepthEstimationAdapter();
const stubScaleAnchoring = new StubScaleAnchoringAdapter();

export function getDefaultAdapterSet(): ScanAdapterSet {
  return {
    objectDetection: [stubObjectDetection],
    segmentation: [],
    depthEstimation: [stubDepthEstimation],
    scaleAnchoring: [stubScaleAnchoring],
    multiPhoto: [],
    structuralExtraction: [],
  };
}

export function getStubAdapterSet(): ScanAdapterSet {
  return {
    objectDetection: [stubObjectDetection],
    segmentation: [],
    depthEstimation: [stubDepthEstimation],
    scaleAnchoring: [stubScaleAnchoring],
    multiPhoto: [],
    structuralExtraction: [],
  };
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
