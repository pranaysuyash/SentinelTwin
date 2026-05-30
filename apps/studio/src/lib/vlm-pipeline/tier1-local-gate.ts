import type {
  Tier1Output,
  ImageQuality,
  SceneType,
  CoarseRoom,
  OcrText,
} from "./types";

export interface Tier1Provider {
  id: string;
  name: string;
  assessImageQuality(dataUrl: string): Promise<ImageQuality>;
  classifyScene(dataUrl: string): Promise<{ sceneType: SceneType; confidence: number }>;
  extractOcr(dataUrl: string): Promise<OcrText[]>;
  detectRooms(dataUrl: string): Promise<{ rooms: CoarseRoom[]; roomCount: number }>;
}

// ── Blur assessment (edge-based, no model required) ──

function assessBlurLaplacian(
  gray: Uint8Array,
  width: number,
  height: number,
): { isBlurry: boolean; blurScore: number } {
  let sum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian =
        gray[idx] * 4 -
        gray[idx - 1] -
        gray[idx + 1] -
        gray[idx - width] -
        gray[idx + width];
      sum += Math.abs(laplacian);
      count++;
    }
  }
  const variance = count > 0 ? sum / count : 0;
  const blurScore = Math.min(1, variance / 50);
  return { isBlurry: blurScore < 0.15, blurScore };
}

function assessExposure(
  gray: Uint8Array,
): { lowLight: boolean; overexposed: boolean } {
  let darkPixels = 0;
  let brightPixels = 0;
  const total = gray.length;
  for (let i = 0; i < total; i++) {
    if (gray[i] < 30) darkPixels++;
    if (gray[i] > 225) brightPixels++;
  }
  return {
    lowLight: darkPixels / total > 0.35,
    overexposed: brightPixels / total > 0.25,
  };
}

function computeQualityScore(
  blurScore: number,
  lowLight: boolean,
  overexposed: boolean,
  widthPx: number,
  heightPx: number,
): number {
  let score = 1 - blurScore;
  if (lowLight) score *= 0.6;
  if (overexposed) score *= 0.6;
  const resolutionOk = widthPx >= 320 && heightPx >= 240;
  if (!resolutionOk) score *= 0.3;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

function computeOcrConfidence(entries: OcrText[]): number {
  if (entries.length === 0) return 0;
  return entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length;
}

// ── ModelProvider-backed Tier1 (for real scene classification) ──

export class ModelTier1Provider implements Tier1Provider {
  id = "model-tier1";
  name = "Model Tier 1 (scene classification)";

  constructor(private provider: import("@/agents/providers/ModelProvider").ModelProvider) {}

  async assessImageQuality(dataUrl: string): Promise<ImageQuality> {
    const content: import("@/agents/providers/ModelProvider").MessageContentPart[] = [
      { type: "text", text: "Assess this image for: blurriness, low light, overexposure, resolution. Return JSON with: isBlurry (bool), blurScore (0-1), lowLight (bool), overexposed (bool), resolutionSufficient (bool), qualityScore (0-1)." },
      { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
    ];

    try {
      const response = await this.provider.complete({
        system: "You are an image quality assessor. Return only valid JSON.",
        messages: [{ role: "user", content }],
      });
      const parsed = JSON.parse(response.content);
      return {
        isBlurry: parsed.isBlurry ?? false,
        blurScore: parsed.blurScore ?? 0.5,
        lowLight: parsed.lowLight ?? false,
        overexposed: parsed.overexposed ?? false,
        resolutionSufficient: parsed.resolutionSufficient ?? true,
        qualityScore: parsed.qualityScore ?? 0.5,
      };
    } catch {
      return { isBlurry: false, blurScore: 0.7, lowLight: false, overexposed: false, resolutionSufficient: true, qualityScore: 0.6 };
    }
  }

  async classifyScene(dataUrl: string): Promise<{ sceneType: SceneType; confidence: number }> {
    const content: import("@/agents/providers/ModelProvider").MessageContentPart[] = [
      { type: "text", text: "Classify this image scene type. Return JSON with: sceneType (one of: retail, warehouse, office, residential, industrial, outdoor, unknown), confidence (0-1)." },
      { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
    ];

    try {
      const response = await this.provider.complete({
        system: "You are a scene classifier. Return only valid JSON.",
        messages: [{ role: "user", content }],
      });
      const parsed = JSON.parse(response.content);
      const validTypes = ["retail", "warehouse", "office", "residential", "industrial", "outdoor", "unknown"];
      return {
        sceneType: validTypes.includes(parsed.sceneType) ? parsed.sceneType : "unknown",
        confidence: parsed.confidence ?? 0.4,
      };
    } catch {
      return { sceneType: "unknown", confidence: 0.3 };
    }
  }

  async extractOcr(dataUrl: string): Promise<OcrText[]> {
    const content: import("@/agents/providers/ModelProvider").MessageContentPart[] = [
      { type: "text", text: "Extract any visible text in this image. Return JSON with: texts (array of {text: string, boundingBox?: [x1,y1,x2,y2], confidence: 0-1}). Bound normalized 0-1." },
      { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
    ];

    try {
      const response = await this.provider.complete({
        system: "You are an OCR extractor. Return only valid JSON.",
        messages: [{ role: "user", content }],
      });
      const parsed = JSON.parse(response.content);
      return (parsed.texts ?? []).map((t: { text: string; boundingBox?: [number, number, number, number]; confidence: number }) => ({
        text: t.text,
        boundingBox: t.boundingBox,
        confidence: t.confidence ?? 0.5,
      }));
    } catch {
      return [];
    }
  }

  async detectRooms(dataUrl: string): Promise<{ rooms: CoarseRoom[]; roomCount: number }> {
    const content: import("@/agents/providers/ModelProvider").MessageContentPart[] = [
      { type: "text", text: "Detect rooms or distinct spatial zones in this image. Return JSON with: rooms (array of {index: number, label: string, boundingBox?: [x1,y1,x2,y2]}), roomCount (number). Coordinates normalized 0-1." },
      { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
    ];

    try {
      const response = await this.provider.complete({
        system: "You are a room detector. Return only valid JSON.",
        messages: [{ role: "user", content }],
      });
      const parsed = JSON.parse(response.content);
      return {
        rooms: parsed.rooms ?? [],
        roomCount: parsed.roomCount ?? 0,
      };
    } catch {
      return { rooms: [], roomCount: 0 };
    }
  }
}

export function createModelTier1Provider(provider?: import("@/agents/providers/ModelProvider").ModelProvider | null): Tier1Provider {
  if (provider) return new ModelTier1Provider(provider);
  return new StubTier1Provider();
}

// ── Stub Tier1Provider (for development / testing) ──

export class StubTier1Provider implements Tier1Provider {
  id = "stub-tier1";
  name = "Stub Local Gate (no real VLM)";

  async assessImageQuality(_dataUrl: string): Promise<ImageQuality> {
    return {
      isBlurry: false,
      blurScore: 0.65,
      lowLight: false,
      overexposed: false,
      resolutionSufficient: true,
      qualityScore: 0.72,
    };
  }

  async classifyScene(_dataUrl: string): Promise<{ sceneType: SceneType; confidence: number }> {
    return { sceneType: "retail", confidence: 0.55 };
  }

  async extractOcr(_dataUrl: string): Promise<OcrText[]> {
    return [
      { text: "Room 101", boundingBox: [10, 10, 200, 40], confidence: 0.7 },
      { text: "5.0m x 4.0m", boundingBox: [10, 50, 300, 80], confidence: 0.5 },
    ];
  }

  async detectRooms(_dataUrl: string): Promise<{ rooms: CoarseRoom[]; roomCount: number }> {
    return {
      rooms: [
        { index: 0, label: "main_floor", boundingBox: [0, 0, 640, 480] },
      ],
      roomCount: 1,
    };
  }
}

// ── Canvas-based heuristic gate (runs in-browser, no model call) ──

export async function runTier1Heuristic(
  dataUrl: string,
  fileName: string,
): Promise<Tier1Output> {
  const img = await loadImage(dataUrl);
  const gray = canvasToGrayscale(img);
  const { isBlurry, blurScore } = assessBlurLaplacian(gray, img.width, img.height);
  const { lowLight, overexposed } = assessExposure(gray);
  const resolutionSufficient = img.width >= 320 && img.height >= 240;
  const qualityScore = computeQualityScore(
    blurScore,
    lowLight,
    overexposed,
    img.width,
    img.height,
  );

  const imageQuality: ImageQuality = {
    isBlurry,
    blurScore: Math.round(blurScore * 100) / 100,
    lowLight,
    overexposed,
    resolutionSufficient,
    qualityScore,
  };

  const sceneType: SceneType = inferSceneTypeFromImage(gray, img.width, img.height);
  const sceneTypeConfidence = 0.45;

  const ocrTexts: OcrText[] = [];
  const { rooms, roomCount } = inferCoarseRooms(gray, img.width, img.height);

  const ambiguityFlags: string[] = [];
  if (isBlurry) ambiguityFlags.push("blurry");
  if (lowLight) ambiguityFlags.push("low_light");
  if (overexposed) ambiguityFlags.push("overexposed");
  if (!resolutionSufficient) ambiguityFlags.push("low_resolution");
  if (sceneType === "unknown") ambiguityFlags.push("unknown_scene_type");
  if (roomCount === 0) ambiguityFlags.push("no_rooms_detected");

  const overallConfidence =
    qualityScore * 0.4 +
    sceneTypeConfidence * 0.3 +
    computeOcrConfidence(ocrTexts) * 0.1 +
    Math.min(1, roomCount / 5) * 0.2;

  return {
    imageQuality,
    sceneType,
    sceneTypeConfidence,
    roomCount,
    rooms,
    ocrTexts,
    overallConfidence: Math.round(overallConfidence * 100) / 100,
    ambiguityFlags,
  };
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

function canvasToGrayscale(img: HTMLImageElement): Uint8Array {
  const canvas = document.createElement("canvas");
  const maxDim = 1024;
  let w = img.width;
  let h = img.height;
  if (w > maxDim || h > maxDim) {
    const scale = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < canvas.width * canvas.height; i++) {
    const offset = i * 4;
    gray[i] = Math.round(
      0.299 * imageData.data[offset] +
        0.587 * imageData.data[offset + 1] +
        0.114 * imageData.data[offset + 2],
    );
  }
  return gray;
}

function inferSceneTypeFromImage(
  _gray: Uint8Array,
  width: number,
  height: number,
): SceneType {
  const aspectRatio = width / height;
  if (aspectRatio > 1.8) return "outdoor";
  if (aspectRatio > 1.3) return "retail";
  return "unknown";
}

function inferCoarseRooms(
  _gray: Uint8Array,
  width: number,
  height: number,
): { rooms: CoarseRoom[]; roomCount: number } {
  const rooms: CoarseRoom[] = [
    { index: 0, label: "primary_space", boundingBox: [0, 0, width, height] },
  ];
  return { rooms, roomCount: 1 };
}
