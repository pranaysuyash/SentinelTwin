import type { DepthMapArtifact, MaskArtifact, ScanArtifact, ScanCandidate, ScanCaptureSession } from "@/lib/scan-artifacts";

export type DetectionResult = {
  candidates: ScanCandidate[];
  artifacts: ScanArtifact[];
  confidence: number;
  warnings: string[];
};

export type SegmentationResult = {
  maskArtifact: MaskArtifact;
  boundingBox: [number, number, number, number];
  confidence: number;
};

export type DepthEstimate = {
  depthArtifact: DepthMapArtifact;
  depthValues?: Float32Array;
  depthMinM: number;
  depthMaxM: number;
  modelUsed: string;
};

export type ScaleAnchor = {
  label: string;
  valueM: number;
  source: "user" | "estimated" | "model";
  confidence: number;
  sourceArtifactId?: string;
};

export type CorrespondenceMatch = {
  sourceArtifactIdA: string;
  sourceArtifactIdB: string;
  candidateId: string;
  matchConfidence: number;
  homography?: number[][];
};

export type StructuralElement = {
  kind: "wall" | "door" | "window" | "floor" | "ceiling" | "corner";
  imagePoint?: [number, number];
  polygon2D?: [number, number][];
  estimatedPosition?: [number, number, number];
  estimatedDimensions?: [number, number, number];
  confidence: number;
  sourceArtifactIds: string[];
};

export type StructuralExtractionResult = {
  elements: StructuralElement[];
  roomDimensions?: { widthM?: number; depthM?: number; heightM?: number };
  confidence: number;
  warnings: string[];
};

export interface ObjectDetectionAdapter {
  id: string;
  name: string;
  description: string;
  detect(artifact: ScanArtifact, session: ScanCaptureSession): Promise<DetectionResult>;
}

export interface SegmentationAdapter {
  id: string;
  name: string;
  description: string;
  segment(artifact: ScanArtifact, point: [number, number]): Promise<SegmentationResult>;
  segmentBox(artifact: ScanArtifact, box: [number, number, number, number]): Promise<SegmentationResult>;
  segmentPrompt(artifact: ScanArtifact, textPrompt: string): Promise<SegmentationResult>;
}

export interface DepthEstimationAdapter {
  id: string;
  name: string;
  description: string;
  estimateDepth(artifact: ScanArtifact): Promise<DepthEstimate>;
}

export interface ScaleAnchoringAdapter {
  id: string;
  name: string;
  description: string;
  suggestAnchors(artifact: ScanArtifact, session: ScanCaptureSession): Promise<ScaleAnchor[]>;
  refineWithAnchor(depth: DepthEstimate, anchor: ScaleAnchor): Promise<{
    adjustedDepth: DepthEstimate;
    scalingFactor: number;
  }>;
}

export interface MultiPhotoCorrespondenceAdapter {
  id: string;
  name: string;
  description: string;
  findCorrespondences(artifacts: ScanArtifact[], candidates: ScanCandidate[]): Promise<CorrespondenceMatch[]>;
  linkStructures(artifacts: ScanArtifact[], session: ScanCaptureSession): Promise<{
    matches: CorrespondenceMatch[];
    wallRelations: Array<{ wallA: string; wallB: string; adjacency: "left" | "right" | "opposite" | "same" }>;
  }>;
}

export interface StructuralExtractionAdapter {
  id: string;
  name: string;
  description: string;
  extractStructures(artifacts: ScanArtifact[], session: ScanCaptureSession): Promise<StructuralExtractionResult>;
}

export type ScanAdapterSet = {
  objectDetection: ObjectDetectionAdapter[];
  segmentation: SegmentationAdapter[];
  depthEstimation: DepthEstimationAdapter[];
  scaleAnchoring: ScaleAnchoringAdapter[];
  multiPhoto: MultiPhotoCorrespondenceAdapter[];
  structuralExtraction: StructuralExtractionAdapter[];
};

export interface VisionProvider {
  canHandleImage(): boolean;
  extractStructured<T>(input: {
    image?: string;
    text: string;
    schema: Record<string, unknown>;
  }): Promise<T>;
  describeImage(image: string, prompt: string): Promise<string>;
}
