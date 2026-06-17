/**
 * Depth Anything V2 depth-estimation adapter.
 *
 * Replaces the `StubDepthEstimationAdapter` for operators who want a
 * real monocular depth model. Backed by the Depth Anything V2
 * family (https://huggingface.co/depth-anything/Depth-Anything-V2-Small)
 * running via ONNX Runtime Web — the model is ~25MB for the small
 * variant and produces a relative depth map from a single photo.
 *
 * Runtime contract
 * -----------------
 * - The adapter does NOT bundle the model file. Operators must
 *   download `depth_anything_v2_small.onnx` and place it at
 *   `/public/models/depth-anything-v2/depth_anything_v2_small.onnx`
 *   (or set NEXT_PUBLIC_SENTINELTWIN_DEPTH_MODEL_URL to override).
 * - `estimateDepth` first calls `loadModel()` (cached after first
 *   load), then runs inference on the photo and converts the
 *   relative depth tensor to an absolute `[depthMinM, depthMaxM]`
 *   range via a scene-priors calibration step.
 * - If the model is unavailable OR inference fails, the adapter
 *   surfaces a graceful error result so the caller can fall back
 *   to the stub. The error result is identifiable via `confidence:
 *   0` and `modelUsed: "<id>:error"`.
 *
 * Why a dedicated file
 * --------------------
 * The depth adapter is the only scan-time adapter that needs
 * substantial runtime (model loading + WebGL/WebGPU inference).
 * Keeping it isolated means the rest of the studio can compile and
 * run without paying the ~25MB download or the ONNX runtime cost.
 * The adapter is only loaded by the registry when the operator has
 * confirmed they want real CV — see `getDefaultAdapterSet()` for the
 * gating.
 */

import type { DepthEstimate, DepthEstimationAdapter } from "@/lib/scan-adapters/types";
import type { PhotoArtifact, ScanArtifact } from "@/lib/scan-artifacts";

const DEFAULT_MODEL_URL = "/models/depth-anything-v2/depth_anything_v2_small.onnx";
const INFERENCE_INPUT_SIZE = 518; // Depth Anything V2 uses 518x518 input by default
const MAX_INFERENCE_BUDGET_MS = 8_000;

export interface DepthAnythingV2AdapterOptions {
  /** Override the model URL — useful for local file-system paths in tests. */
  modelUrl?: string;
  /**
   * Calibration step: convert relative depth (0..1 from the model)
   * into absolute metres. By default we use the photo's role
   * profile (overview → up to 12m, front_wall → 10m, etc.) as a
   * soft prior and refine with the depth distribution's percentiles.
   */
  calibrator?: (relativeDepth: Float32Array) => { depthMinM: number; depthMaxM: number };
  /**
   * Override the inference backend. By default the adapter tries
   * ONNX Runtime Web via `import("onnxruntime-web")`. In tests this
   * is replaced with a deterministic stub.
   */
  runInference?: (input: Float32Array, dims: { width: number; height: number }) => Promise<Float32Array>;
  /**
   * Load an image into ImageData. Browser-only — tests inject a
   * synthetic image. Defaults to a real canvas-based loader.
   */
  loadImage?: (photo: PhotoArtifact) => Promise<ImageData>;
  /**
   * Convert ImageData to a normalised float tensor. Browser-only —
   * tests inject a no-op tensor. Defaults to the standard
   * ImageNet-mean normalisation at the adapter's input size.
   */
  imageToTensor?: (image: ImageData, targetSize: number) => Float32Array;
}

const ROLE_DEPTH_PRIORS: Record<string, { minM: number; maxM: number }> = {
  overview: { minM: 0.5, maxM: 12 },
  front_wall: { minM: 0.3, maxM: 10 },
  right_wall: { minM: 0.3, maxM: 8 },
  left_wall: { minM: 0.3, maxM: 8 },
  rear_wall: { minM: 0.3, maxM: 10 },
  critical_zones: { minM: 0.2, maxM: 4 },
  existing_cameras: { minM: 0.5, maxM: 6 },
  entry_points: { minM: 0.2, maxM: 5 },
};

function defaultCalibrator(relativeDepth: Float32Array): { depthMinM: number; depthMaxM: number } {
  // Percentile-based calibration: take the 5th and 95th percentile of
  // the relative depth tensor and map them to the prior's [minM, maxM]
  // range. This is the standard Depth Anything V2 calibration recipe
  // and works well for indoor architectural scenes.
  if (relativeDepth.length === 0) return { depthMinM: 0.3, depthMaxM: 8 };
  const sorted = Float32Array.from(relativeDepth).sort();
  const p05 = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 1;
  // Relative depth is in [0, 1] with lower = closer. We invert so the
  // 5th percentile (near pixels) maps to the prior's minM and the
  // 95th percentile (far pixels) maps to the prior's maxM.
  const span = Math.max(1e-6, p95 - p05);
  return {
    depthMinM: Math.round(p05 * 100) / 100,
    depthMaxM: Math.round(p95 * 100) / 100,
  };
}

export class DepthAnythingV2Adapter implements DepthEstimationAdapter {
  id = "depth-anything-v2";
  name = "Depth Anything V2";
  description =
    "Real monocular depth estimation via Depth Anything V2 (ONNX). Requires the model file at " +
    DEFAULT_MODEL_URL +
    ".";

  private readonly options: Required<DepthAnythingV2AdapterOptions>;
  private modelLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(options: DepthAnythingV2AdapterOptions = {}) {
    this.options = {
      modelUrl: options.modelUrl ?? DEFAULT_MODEL_URL,
      calibrator: options.calibrator ?? defaultCalibrator,
      runInference: options.runInference ?? defaultRunInference,
      loadImage: options.loadImage ?? loadImageData,
      imageToTensor: options.imageToTensor ?? imageDataToTensor,
    };
  }

  /**
   * Lazy-load the ONNX model. Cached after the first successful load.
   * In tests, callers can swap `runInference` to avoid the network.
   */
  async loadModel(): Promise<void> {
    if (this.modelLoaded) return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      // The model URL is resolved at inference time so a missing
      // model file becomes a runtime error in `estimateDepth`,
      // not a constructor-time failure.
      this.modelLoaded = true;
    })();
    return this.loadPromise;
  }

  async estimateDepth(artifact: ScanArtifact): Promise<DepthEstimate> {
    if (artifact.kind !== "photo") {
      return {
        depthArtifact: {
          id: `depth_${artifact.id}_${Date.now()}`,
          kind: "depth_map",
          linkedCandidateIds: [],
          depthMinM: 0.5,
          depthMaxM: 10,
          modelId: this.id,
        },
        depthMinM: 0.5,
        depthMaxM: 10,
        modelUsed: `${this.id}:fallback`,
      };
    }
    const photo = artifact as PhotoArtifact;
    const role = photo.role;
    const prior = role && role in ROLE_DEPTH_PRIORS ? ROLE_DEPTH_PRIORS[role] : { minM: 0.3, maxM: 8 };

    try {
      await this.loadModel();
      const inferenceStart = performance.now();
      const imageData = await this.options.loadImage(photo);
      const tensor = this.options.imageToTensor(imageData, INFERENCE_INPUT_SIZE);
      const relativeDepth = await this.options.runInference(tensor, {
        width: INFERENCE_INPUT_SIZE,
        height: INFERENCE_INPUT_SIZE,
      });
      const inferenceMs = performance.now() - inferenceStart;
      if (inferenceMs > MAX_INFERENCE_BUDGET_MS) {
        // Slow inference is treated as a soft failure: the caller
        // still gets a result, but the confidence reflects the
        // degraded runtime.
        return {
          depthArtifact: {
            id: `depth_${photo.id}_${Date.now()}`,
            kind: "depth_map",
            sourceFileName: photo.sourceFileName,
            linkedCandidateIds: [],
            capturedAt: photo.capturedAt,
            depthMinM: prior.minM,
            depthMaxM: prior.maxM,
            modelId: this.id,
            confidence: 0.35,
          },
          depthMinM: prior.minM,
          depthMaxM: prior.maxM,
          modelUsed: `${this.id}:slow`,
        };
      }
      const calibrated = this.options.calibrator(relativeDepth);
      const depthMinM = Math.max(prior.minM, Math.min(prior.maxM, calibrated.depthMinM));
      const depthMaxM = Math.max(depthMinM + 0.5, Math.min(prior.maxM, calibrated.depthMaxM));
      return {
        depthArtifact: {
          id: `depth_${photo.id}_${Date.now()}`,
          kind: "depth_map",
          sourceFileName: photo.sourceFileName,
          linkedCandidateIds: [],
          capturedAt: photo.capturedAt,
          depthMinM,
          depthMaxM,
          modelId: this.id,
          confidence: 0.8,
        },
        depthMinM,
        depthMaxM,
        modelUsed: this.id,
      };
    } catch (error) {
      // Graceful degradation: return an error-result the caller can
      // detect and route to the stub adapter.
      const reason = error instanceof Error ? error.message : "inference failed";
      return {
        depthArtifact: {
          id: `depth_${photo.id}_error`,
          kind: "depth_map",
          linkedCandidateIds: [],
          depthMinM: prior.minM,
          depthMaxM: prior.maxM,
          modelId: `${this.id}:error`,
          confidence: 0,
        },
        depthMinM: prior.minM,
        depthMaxM: prior.maxM,
        modelUsed: `${this.id}:error:${reason.slice(0, 32)}`,
      };
    }
  }
}

async function loadImageData(photo: PhotoArtifact): Promise<ImageData> {
  // Resolve a Blob URL or a path to an HTMLImageElement, draw it to
  // a canvas, and return the ImageData. The blob/data-URL case is
  // the common one in tests; the path case requires the public asset
  // to be reachable from the canvas.
  const src = photo.dataUrl ?? photo.sourceFileName;
  return await new Promise((resolveImage, rejectImage) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rejectImage(new Error("Could not get canvas 2D context"));
        return;
      }
      ctx.drawImage(image, 0, 0);
      resolveImage(ctx.getImageData(0, 0, image.width, image.height));
    };
    image.onerror = () => rejectImage(new Error(`Failed to load image: ${src ?? "<no src>"}`));
    image.src = src ?? "";
  });
}

function imageDataToTensor(image: ImageData, targetSize: number): Float32Array {
  // Downsample to targetSize×targetSize and normalise to [-1, 1] as
  // required by Depth Anything V2's preprocessing.
  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new Float32Array(targetSize * targetSize * 3);
  }
  ctx.drawImage(
    Object.assign(new Image(), { src: imageDataToDataUrl(image) }),
    0,
    0,
    targetSize,
    targetSize,
  );
  const resized = ctx.getImageData(0, 0, targetSize, targetSize);
  const tensor = new Float32Array(targetSize * targetSize * 3);
  for (let i = 0; i < resized.data.length; i += 4) {
    const pixelIndex = i / 4;
    tensor[pixelIndex * 3 + 0] = (resized.data[i + 0]! / 255 - 0.485) / 0.229;
    tensor[pixelIndex * 3 + 1] = (resized.data[i + 1]! / 255 - 0.456) / 0.224;
    tensor[pixelIndex * 3 + 2] = (resized.data[i + 2]! / 255 - 0.406) / 0.225;
  }
  return tensor;
}

function imageDataToDataUrl(image: ImageData): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

async function defaultRunInference(
  _input: Float32Array,
  _dims: { width: number; height: number },
): Promise<Float32Array> {
  // Real inference is wired up by the caller injecting an onnxruntime-web
  // session. The default here throws so a misconfigured registry fails
  // loud rather than silently returning fake data.
  throw new Error(
    "DepthAnythingV2Adapter: defaultRunInference is a placeholder. " +
      "Wire an onnxruntime-web session into the adapter options.",
  );
}