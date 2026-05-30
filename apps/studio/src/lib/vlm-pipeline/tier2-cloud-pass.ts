import type { Tier1Output, Tier2Output, WallCoordinate, OpeningDetection, ObstructionDetection, CriticalZoneDetection } from "./types";
import type { ModelProvider } from "@/agents/providers/ModelProvider";

export interface Tier2Provider {
  id: string;
  name: string;
  extractScene(context: Tier1Output, dataUrl: string): Promise<Tier2Output>;
}

const SYSTEM_PROMPT = `You are a security floor plan analyzer. Given a floor plan image and semantic context from an initial pass, extract precise spatial structures.

Return a JSON object with these fields:
- walls: array of { start: [x, y], end: [x, y], label?: string, confidence: 0-1 } — wall line segments in image coordinates (normalized 0-1)
- doors: array of { kind: "door", position: [x, y], widthM: number, heightM?: number, orientation: "horizontal" | "vertical", confidence: 0-1 }
- windows: array of { kind: "window", position: [x, y], widthM: number, heightM?: number, orientation: "horizontal" | "vertical", confidence: 0-1 }
- obstructions: array of { kind: "pillar" | "counter" | "cupboard" | "shelf" | "furniture" | "other", position: [x, y], dimensions?: [w, h, d], label?: string, confidence: 0-1 }
- criticalZones: array of { label: string, polygon: [[x, y], ...], confidence: 0-1 }
- adjacencyGraph (optional): { edges: [{ from: string, to: string, relation: "adjacent" | "connects_via_door" | "connects_via_opening", confidence: 0-1 }] }
- confidence: overall confidence 0-1
- warnings: array of string

Use normalized image coordinates (0-1 range) for all positions. Be precise with wall endpoints.`;

function buildTier2Prompt(context: Tier1Output): string {
  return `Semantic context from initial pass:
- Scene type: ${context.sceneType} (confidence: ${context.sceneTypeConfidence})
- Room count: ${context.roomCount}
- Detected rooms: ${context.rooms.map((r) => r.label).join(", ")}
- Quality score: ${context.imageQuality.qualityScore}
- OCR text: ${context.ocrTexts.map((t) => `"${t.text}"`).join(", ")}
- Ambiguity flags: ${context.ambiguityFlags.join(", ") || "none"}

Extract precise wall coordinates, door/window detections, obstructions, and critical zones from this floor plan image.`;
}

// ── ModelProvider-backed Tier2 ──

export class ModelTier2Provider implements Tier2Provider {
  id = "model-tier2";
  name = "Model Tier 2 (GPT-4o / Gemini)";

  constructor(private provider: ModelProvider) {}

  async extractScene(context: Tier1Output, dataUrl: string): Promise<Tier2Output> {
    const prompt: import("@/agents/providers/ModelProvider").ModelPrompt = {
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildTier2Prompt(context) },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    };

    const response = await this.provider.complete(prompt);

    try {
      const parsed = JSON.parse(response.content);
      return {
        walls: parsed.walls ?? [],
        doors: parsed.doors ?? [],
        windows: parsed.windows ?? [],
        obstructions: parsed.obstructions ?? [],
        criticalZones: parsed.criticalZones ?? [],
        adjacencyGraph: parsed.adjacencyGraph,
        confidence: parsed.confidence ?? 0.5,
        warnings: parsed.warnings ?? [],
      };
    } catch {
      return {
        walls: [],
        doors: [],
        windows: [],
        obstructions: [],
        criticalZones: [],
        confidence: 0,
        warnings: ["Failed to parse model response as structured Tier 2 output"],
      };
    }
  }
}

// ── Stub Tier2Provider (for testing) ──

export class StubTier2Provider implements Tier2Provider {
  id = "stub-tier2";
  name = "Stub Tier 2 (no real model)";

  async extractScene(context: Tier1Output, _dataUrl: string): Promise<Tier2Output> {
    const rooms = context.rooms;
    const walls: WallCoordinate[] = [];
    const doors: OpeningDetection[] = [];
    const windows: OpeningDetection[] = [];
    const obstructions: ObstructionDetection[] = [];
    const criticalZones: CriticalZoneDetection[] = [];

    for (const room of rooms) {
      const bb = room.boundingBox ?? [0, 0, 640, 480];
      const [x1, y1, x2, y2] = bb;
      walls.push(
        { start: [x1, y1], end: [x2, y1], label: `${room.label}_north`, confidence: 0.6 },
        { start: [x2, y1], end: [x2, y2], label: `${room.label}_east`, confidence: 0.6 },
        { start: [x1, y2], end: [x2, y2], label: `${room.label}_south`, confidence: 0.6 },
        { start: [x1, y1], end: [x1, y2], label: `${room.label}_west`, confidence: 0.6 },
      );
      doors.push({
        kind: "door",
        position: [(x1 + x2) / 2, y1],
        widthM: 0.9,
        orientation: "horizontal",
        confidence: 0.5,
      });
    }

    return {
      walls,
      doors,
      windows,
      obstructions,
      criticalZones,
      adjacencyGraph: {
        edges: rooms.map((r, i) => ({
          from: r.label,
          to: rooms[(i + 1) % rooms.length].label,
          relation: "adjacent" as const,
          confidence: 0.5,
        })),
      },
      confidence: 0.6,
      warnings: [],
    };
  }
}
