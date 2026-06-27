import { z } from "zod";
import { NextRequest } from "next/server";

import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";
import { db } from "@/lib/backend-database";
import { getOrganizationManager } from "@/lib/organization-store";
import { guardOwnershipTransfer } from "@/lib/entitlement-guards";
import {
  createOwnershipTransferEvent,
  acceptOwnershipTransfer,
  cancelOwnershipTransfer,
} from "@/schema/workspace-invite";

const OwnershipTransferRequestSchema = z.object({
  action: z.enum(["request", "complete", "cancel", "get"]),
  workspaceId: z.string().min(1),
  fromOwnerId: z.string().min(1).optional(),
  toOwnerId: z.string().min(1).optional(),
  transferId: z.string().uuid().optional(),
});

function envelope(data: Record<string, unknown>) {
  return { ok: true as const, ...data };
}

function requireOwnershipTransferEntitlement() {
  const guard = guardOwnershipTransfer();
  if (!guard.allowed) {
    return apiJson(
      undefined,
      { ok: false, error: guard.reason, errorCode: "entitlement_denied" },
      { status: 403 },
      { methods: API_METHODS },
    );
  }
  return null;
}

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: API_METHODS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return apiJson(
      request,
      { ok: false, error: "workspaceId is required.", errorCode: "missing_params" },
      { status: 400 },
      { methods: API_METHODS },
    );
  }

  const transfer = db.getActiveOwnershipTransferForWorkspace(workspaceId);
  return apiJson(request, envelope({ transfer: transfer ?? null }), undefined, { methods: API_METHODS });
}

export async function POST(request: NextRequest) {
  const parsed = await parseValidatedJsonBody(request, OwnershipTransferRequestSchema, {
    validationErrorMessage: "Invalid ownership transfer payload.",
    parseErrorMessage: "Failed to parse ownership transfer payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const { action, workspaceId, transferId } = parsed.data;

  if (action === "get") {
    const transfer = db.getActiveOwnershipTransferForWorkspace(workspaceId);
    return apiJson(request, envelope({ transfer: transfer ?? null }), undefined, { methods: API_METHODS });
  }

  const denied = requireOwnershipTransferEntitlement();
  if (denied) {
    return denied;
  }

  if (action === "request") {
    const { fromOwnerId, toOwnerId } = parsed.data;
    if (!fromOwnerId || !toOwnerId) {
      return apiJson(
        request,
        { ok: false, error: "fromOwnerId and toOwnerId are required.", errorCode: "missing_params" },
        { status: 400 },
        { methods: API_METHODS },
      );
    }

    const existing = db.getActiveOwnershipTransferForWorkspace(workspaceId);
    if (existing) {
      return apiJson(
        request,
        { ok: false, error: "Ownership transfer already in progress.", errorCode: "duplicate_transfer" },
        { status: 409 },
        { methods: API_METHODS },
      );
    }

    const event = createOwnershipTransferEvent(workspaceId, fromOwnerId, toOwnerId);
    db.createOwnershipTransfer(event);
    return apiJson(request, envelope({ transfer: event }), undefined, { methods: API_METHODS });
  }

  if (!transferId) {
    return apiJson(
      request,
      { ok: false, error: "transferId is required for this action.", errorCode: "missing_params" },
      { status: 400 },
      { methods: API_METHODS },
    );
  }

  const event = db.getOwnershipTransfer(transferId);
  if (!event) {
    return apiJson(
      request,
      { ok: false, error: "Ownership transfer not found.", errorCode: "not_found" },
      { status: 404 },
      { methods: API_METHODS },
    );
  }

  if (event.workspaceId !== workspaceId) {
    return apiJson(
      request,
      { ok: false, error: "Transfer does not match workspace.", errorCode: "forbidden" },
      { status: 403 },
      { methods: API_METHODS },
    );
  }

  if (event.status !== "requested") {
    return apiJson(
      request,
      { ok: false, error: `Transfer is already ${event.status}.`, errorCode: "invalid_state" },
      { status: 409 },
      { methods: API_METHODS },
    );
  }

  if (action === "complete") {
    const updated = acceptOwnershipTransfer(event);
    const saved = db.updateOwnershipTransfer(updated);
    if (!saved) {
      return apiJson(
        request,
        { ok: false, error: "Failed to complete transfer.", errorCode: "internal_error" },
        { status: 500 },
        { methods: API_METHODS },
      );
    }

    const orgMgr = getOrganizationManager();
    const org = orgMgr.getOrganization(parsed.data.workspaceId);
    if (org && org.ownerId === event.fromOwnerId) {
      orgMgr.updateOrganization(org.id, { name: org.name });
    }

    return apiJson(request, envelope({ transfer: saved }), undefined, { methods: API_METHODS });
  }

  if (action === "cancel") {
    const updated = cancelOwnershipTransfer(event);
    const saved = db.updateOwnershipTransfer(updated);
    if (!saved) {
      return apiJson(
        request,
        { ok: false, error: "Failed to cancel transfer.", errorCode: "internal_error" },
        { status: 500 },
        { methods: API_METHODS },
      );
    }
    return apiJson(request, envelope({ transfer: saved }), undefined, { methods: API_METHODS });
  }

  return apiJson(
    request,
    { ok: false, error: "Unknown action.", errorCode: "invalid_action" },
    { status: 400 },
    { methods: API_METHODS },
  );
}
