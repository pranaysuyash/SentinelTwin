import { z } from "zod";

import { normalizeWorkspaceAccessState } from "@/lib/workspace-access";
import { normalizeWorkspaceGovernance } from "@/lib/workspace-governance";
import { normalizeWorkspaceAccountProfile } from "@/lib/workspace-catalog";
import { appendWorkspaceControlPlaneSnapshot, loadWorkspaceControlPlaneHistory } from "@/lib/workspace-control-plane-history";
import { corsJson, corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

const WorkspaceControlPlaneRequestSchema = z.object({
  source: z.string().min(1).default("governance-tab"),
  sceneId: z.string().min(1),
  sceneName: z.string().min(1),
  capturedAt: z.number().int().nonnegative().optional(),
  access: z.unknown(),
  governance: z.unknown(),
  account: z.unknown(),
});

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["GET", "POST", "OPTIONS"] });
}

export async function GET(request: NextRequest) {
  const history = loadWorkspaceControlPlaneHistory();
  return corsJson({ ok: true, history, historyCount: history.length, latest: history[0] ?? null }, request, undefined, {
    methods: ["GET", "POST", "OPTIONS"],
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = WorkspaceControlPlaneRequestSchema.safeParse(body);

    if (!parsed.success) {
      return corsJson({
        ok: false,
        error: "Invalid control-plane payload.",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      }, request, { status: 400 }, { methods: ["GET", "POST", "OPTIONS"] });
    }

    const capturedAt = parsed.data.capturedAt ?? Date.now();
    const snapshot = {
      id: `${parsed.data.sceneId}:${capturedAt}`,
      sceneId: parsed.data.sceneId,
      sceneName: parsed.data.sceneName,
      source: parsed.data.source,
      capturedAt,
      access: normalizeWorkspaceAccessState(parsed.data.access),
      governance: normalizeWorkspaceGovernance(parsed.data.governance),
      account: normalizeWorkspaceAccountProfile(parsed.data.account),
    };

    const history = appendWorkspaceControlPlaneSnapshot(snapshot);
    return corsJson({ ok: true, snapshot, historyCount: history.length }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });
  } catch {
    return corsJson({ ok: false, error: "Failed to parse control-plane payload." }, request, { status: 400 }, {
      methods: ["GET", "POST", "OPTIONS"],
    });
  }
}
