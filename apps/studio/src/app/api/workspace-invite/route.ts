import { z } from "zod";
import { NextRequest } from "next/server";

import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";
import { db } from "@/lib/backend-database";
import { getOrganizationManager } from "@/lib/organization-store";
import { guardInvite, guardMemberCountQuota } from "@/lib/entitlement-guards";
import {
  createWorkspaceInvite,
  isWorkspaceInviteExpired,
  workspaceInviteSchema,
  type WorkspaceInvite,
} from "@/schema/workspace-invite";

function mapOrgRoleToUserRole(role: "owner" | "admin" | "operator" | "viewer"): import("@/schema/workspace-invite").WorkspaceInvite["role"] {
  switch (role) {
    case "owner":
    case "admin":
      return "admin";
    case "operator":
      return "operator";
    case "viewer":
    default:
      return "auditor";
  }
}

const InviteRequestSchema = z.object({
  action: z.enum(["create", "accept", "decline", "revoke", "expire", "list"]),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  inviterId: z.string().min(1).optional(),
  inviteeEmail: z.string().email().optional(),
  role: z.enum(["owner", "admin", "operator", "viewer"]).optional(),
  inviteId: z.string().uuid().optional(),
});

function envelope(data: Record<string, unknown>) {
  return { ok: true as const, ...data };
}

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: API_METHODS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const organizationId = searchParams.get("organizationId");
  if (!workspaceId || !organizationId) {
    return apiJson(
      request,
      { ok: false, error: "workspaceId and organizationId are required.", errorCode: "missing_params" },
      { status: 400 },
      { methods: API_METHODS },
    );
  }

  const invites = db.listInvitesForWorkspace(workspaceId);
  return apiJson(request, envelope({ invites }), undefined, { methods: API_METHODS });
}

export async function POST(request: NextRequest) {
  const parsed = await parseValidatedJsonBody(request, InviteRequestSchema, {
    validationErrorMessage: "Invalid workspace invite payload.",
    parseErrorMessage: "Failed to parse workspace invite payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const { action, workspaceId, organizationId } = parsed.data;

  if (action === "list") {
    const invites = db.listInvitesForWorkspace(workspaceId);
    return apiJson(request, envelope({ invites }), undefined, { methods: API_METHODS });
  }

  if (action === "create") {
    const { inviterId, inviteeEmail, role } = parsed.data;
    if (!inviterId || !inviteeEmail) {
      return apiJson(
        request,
        { ok: false, error: "inviterId and inviteeEmail are required.", errorCode: "missing_params" },
        { status: 400 },
        { methods: API_METHODS },
      );
    }

    const inviteGuard = guardInvite();
    if (!inviteGuard.allowed) {
      return apiJson(
        request,
        { ok: false, error: inviteGuard.reason, errorCode: "entitlement_denied" },
        { status: 403 },
        { methods: API_METHODS },
      );
    }

    const orgMgr = getOrganizationManager();
    const org = orgMgr.getOrganization(organizationId);
    const currentMembers = org?.members.length ?? 0;
    const quotaGuard = guardMemberCountQuota(currentMembers);
    if (!quotaGuard.allowed) {
      return apiJson(
        request,
        { ok: false, error: quotaGuard.reason, errorCode: "quota_exceeded" },
        { status: 403 },
        { methods: API_METHODS },
      );
    }

    const existing = db.getInviteByEmail(workspaceId, inviteeEmail);
    if (existing && existing.status === "pending" && !isWorkspaceInviteExpired(existing)) {
      return apiJson(
        request,
        { ok: false, error: "Pending invite already exists for this email.", errorCode: "duplicate_invite" },
        { status: 409 },
        { methods: API_METHODS },
      );
    }

    const invite = createWorkspaceInvite(workspaceId, organizationId, inviterId, inviteeEmail, mapOrgRoleToUserRole(role ?? "operator"));
    db.createInvite(invite);
    return apiJson(request, envelope({ invite }), undefined, { methods: API_METHODS });
  }

  const { inviteId } = parsed.data;
  if (!inviteId) {
    return apiJson(
      request,
      { ok: false, error: "inviteId is required for this action.", errorCode: "missing_params" },
      { status: 400 },
      { methods: API_METHODS },
    );
  }

  const invite = db.getInvite(inviteId);
  if (!invite) {
    return apiJson(
      request,
      { ok: false, error: "Invite not found.", errorCode: "not_found" },
      { status: 404 },
      { methods: API_METHODS },
    );
  }

  if (invite.workspaceId !== workspaceId || invite.organizationId !== organizationId) {
    return apiJson(
      request,
      { ok: false, error: "Invite does not match workspace/organization.", errorCode: "forbidden" },
      { status: 403 },
      { methods: API_METHODS },
    );
  }

  const nextInvite = { ...invite };

  if (action === "accept") {
    if (invite.status !== "pending") {
      return apiJson(
        request,
        { ok: false, error: `Invite is already ${invite.status}.`, errorCode: "invalid_state" },
        { status: 409 },
        { methods: API_METHODS },
      );
    }
    if (isWorkspaceInviteExpired(invite)) {
      nextInvite.status = "expired";
      db.updateInvite(nextInvite);
      return apiJson(
        request,
        { ok: false, error: "Invite has expired.", errorCode: "invite_expired" },
        { status: 410 },
        { methods: API_METHODS },
      );
    }

    const orgMgr = getOrganizationManager();
    const org = orgMgr.getOrganization(organizationId);
    const currentMembers = org?.members.length ?? 0;
    const quotaGuard = guardMemberCountQuota(currentMembers);
    if (!quotaGuard.allowed) {
      return apiJson(
        request,
        { ok: false, error: quotaGuard.reason, errorCode: "quota_exceeded" },
        { status: 403 },
        { methods: API_METHODS },
      );
    }

    nextInvite.status = "accepted";
  }

  if (action === "decline") {
    if (invite.status !== "pending") {
      return apiJson(
        request,
        { ok: false, error: `Invite is already ${invite.status}.`, errorCode: "invalid_state" },
        { status: 409 },
        { methods: API_METHODS },
      );
    }
    nextInvite.status = "declined";
  }

  if (action === "revoke") {
    if (invite.status !== "pending") {
      return apiJson(
        request,
        { ok: false, error: `Invite is already ${invite.status}.`, errorCode: "invalid_state" },
        { status: 409 },
        { methods: API_METHODS },
      );
    }
    nextInvite.status = "revoked";
  }

  if (action === "expire") {
    if (invite.status !== "pending") {
      return apiJson(
        request,
        { ok: false, error: `Invite is already ${invite.status}.`, errorCode: "invalid_state" },
        { status: 409 },
        { methods: API_METHODS },
      );
    }
    nextInvite.status = "expired";
  }

  const updated = db.updateInvite(nextInvite);
  if (!updated) {
    return apiJson(
      request,
      { ok: false, error: "Failed to update invite.", errorCode: "internal_error" },
      { status: 500 },
      { methods: API_METHODS },
    );
  }

  return apiJson(request, envelope({ invite: updated }), undefined, { methods: API_METHODS });
}
