import { z } from "zod";

import { normalizeWorkspaceAccessState } from "@/lib/workspace-access";
import { normalizeWorkspaceGovernance, type WorkspaceSceneStatus } from "@/lib/workspace-governance";
import { normalizeWorkspaceAccountProfile } from "@/lib/workspace-catalog";
import { corsJson, corsNoContent } from "@/lib/api-cors";
import { db } from "@/lib/backend-database";
import type { SceneRecord } from "@sentineltwin/core";
import { mapLocalGovernanceToSceneRecord, generateAuditLogForGovernanceTransition } from "@/lib/governance-backend-mapper";

import { NextRequest } from "next/server";

const WorkspaceControlPlaneRequestSchema = z.object({
  source: z.string().min(1).default("governance-tab"),
  sceneId: z.string().min(1),
  sceneName: z.string().min(1),
  access: z.unknown(),
  governance: z.unknown(),
  account: z.unknown(),
});

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["GET", "POST", "OPTIONS"] });
}

export async function GET(request: NextRequest) {
  return corsJson({ ok: true, message: "Use POST to sync governance state" }, request, undefined, {
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

    const { sceneId, sceneName, source, access, governance, account } = parsed.data;
    const normAccess = normalizeWorkspaceAccessState(access);
    const normGov = normalizeWorkspaceGovernance(governance);
    const normAcc = normalizeWorkspaceAccountProfile(account);

    const authId = normAcc.ownerName || "anonymous";

    let sceneRecord = db.getSceneRecord(sceneId);
    if (!sceneRecord) {
      sceneRecord = {
        id: sceneId,
        siteId: crypto.randomUUID(),
        name: sceneName,
        version: 1,
        status: "draft",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        publishedAt: null,
        publishedBy: null,
        sceneDataId: crypto.randomUUID(),
      };
    }

    const mappedUpdates = mapLocalGovernanceToSceneRecord(normGov, sceneRecord);
    const nextRecord = { ...sceneRecord, ...mappedUpdates };

    db.saveSceneRecord(nextRecord as SceneRecord);

    const auditLog = generateAuditLogForGovernanceTransition(
      "workspace-mock-id",
      authId,
      sceneId,
      { ...normGov, sceneStatus: sceneRecord.status as WorkspaceSceneStatus },
      normGov
    );

    if (auditLog) {
      db.addAuditLog(auditLog);
    }

    if (normGov.reviewNotes.length > 0) {
      const latestNote = normGov.reviewNotes[normGov.reviewNotes.length - 1];
      db.addComment({
        id: crypto.randomUUID(),
        targetType: "scene",
        targetId: sceneId,
        authorId: authId,
        content: latestNote,
        resolved: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return corsJson({ ok: true, synced: true, sceneStatus: nextRecord.status }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });
  } catch (err) {
    return corsJson({ ok: false, error: "Failed to parse control-plane payload." }, request, { status: 400 }, {
      methods: ["GET", "POST", "OPTIONS"],
    });
  }
}
