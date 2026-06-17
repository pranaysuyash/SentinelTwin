import { z } from "zod";

import { normalizeWorkspaceGovernance, type WorkspaceSceneStatus } from "@/lib/workspace-governance";
import { normalizeWorkspaceAccountProfile } from "@/lib/workspace-catalog";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";
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
  return corsNoContent(request, { methods: API_METHODS });
}

export async function GET(request: NextRequest) {
  return apiJson(request, { ok: true, message: "Use POST to sync governance state" }, undefined, {
    methods: API_METHODS,
  });
}

export async function POST(request: NextRequest) {
  const parsed = await parseValidatedJsonBody(request, WorkspaceControlPlaneRequestSchema, {
    validationErrorMessage: "Invalid control-plane payload.",
    parseErrorMessage: "Failed to parse control-plane payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const { sceneId, sceneName, governance, account } = parsed.data;
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

    return apiJson(request, { ok: true, synced: true, sceneStatus: nextRecord.status }, undefined, { methods: API_METHODS });
  } catch (err) {
    return apiJson(
      request,
      {
        ok: false,
        error: "Failed to sync control-plane payload.",
        errorCode: "internal_error",
      },
      { status: 500 },
      {
        methods: API_METHODS,
      },
    );
  }
}
