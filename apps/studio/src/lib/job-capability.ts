import type { Job, UserRole, PermissionAction } from "@sentineltwin/core";

/**
 * The SINGLE place where the Job lens and authorization compose.
 *
 *   canPerform = roleHasPermission(role, action, subject)   // the GATE
 *             && postureAllows(job, action)                 // the LENS guard
 *
 * The Job lens NEVER grants capability — it only RESTRICTS via posture.
 * Authorization (roleHasPermission) is unchanged from the existing model.
 * This is the critical safety property from D-331 §6 / spec §6.
 *
 * roleHasPermission is the canonical role→action→subject permission table
 * (single source of truth, motto §11). If the existing Permission schema gains
 * a lookup function later, replace this body with that import (supersession,
 * motto §7) — but keep the exported function signature so callers don't change.
 */
export function isWriteAction(action: PermissionAction): boolean {
  return (
    action === "create" ||
    action === "update" ||
    action === "delete" ||
    action === "publish"
  );
}

export function roleHasPermission(
  role: UserRole,
  action: PermissionAction,
  _subject: string,
): boolean {
  // admin: full access.
  if (role === "admin") return true;
  // Read is always allowed for any authenticated role.
  if (action === "read") return true;

  const writeActions: PermissionAction[] = ["create", "update", "delete", "publish"];
  const isWrite = writeActions.includes(action);

  // Write-capable professional roles.
  if (isWrite && (role === "installer" || role === "operator")) return true;

  // Workflow-stage roles: approve/reject/request_review (NOT create/update/delete/publish).
  const reviewActions: PermissionAction[] = ["approve", "reject", "request_review"];
  if (reviewActions.includes(action) && (role === "reviewer" || role === "privacy_reviewer")) {
    return true;
  }

  // auditor can recover (propose fixes on a copy) but not publish.
  if (action === "recover" && role === "auditor") return true;

  // insurer: read-only professional role. No writes, no approvals.
  return false;
}

export function postureAllows(job: Job, action: PermissionAction): boolean {
  // read-only posture blocks ALL write actions regardless of role.
  if (job.lens.defaultReadPosture === "read_only" && isWriteAction(action)) return false;
  return true;
}

export function canPerform(
  job: Job,
  role: UserRole,
  action: PermissionAction,
  subject: string,
): boolean {
  return roleHasPermission(role, action, subject) && postureAllows(job, action);
}
