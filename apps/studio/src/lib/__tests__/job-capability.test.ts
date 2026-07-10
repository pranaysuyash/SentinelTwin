import { describe, it, expect } from "bun:test";
import { canPerform, isWriteAction, roleHasPermission } from "../job-capability";
import { JOB_CATALOG } from "@sentineltwin/core";
import type { UserRole, PermissionAction } from "@sentineltwin/core";

const installerJob = JOB_CATALOG.find((j) => j.id === "installer")!;
const insurerJob = JOB_CATALOG.find((j) => j.id === "insurer")!;

describe("isWriteAction", () => {
  it("classifies write actions", () => {
    expect(isWriteAction("create")).toBe(true);
    expect(isWriteAction("update")).toBe(true);
    expect(isWriteAction("delete")).toBe(true);
    expect(isWriteAction("publish")).toBe(true);
  });

  it("classifies read-only actions", () => {
    expect(isWriteAction("read")).toBe(false);
    expect(isWriteAction("approve")).toBe(false);
    expect(isWriteAction("reject")).toBe(false);
  });
});

describe("roleHasPermission", () => {
  it("admin has full access", () => {
    const actions: PermissionAction[] = [
      "create",
      "read",
      "update",
      "delete",
      "publish",
      "approve",
    ];
    for (const a of actions) {
      expect(roleHasPermission("admin", a, "scene")).toBe(true);
    }
  });

  it("read is always allowed for any role", () => {
    const roles: UserRole[] = [
      "installer",
      "operator",
      "auditor",
      "reviewer",
      "privacy_reviewer",
      "insurer",
    ];
    for (const r of roles) {
      expect(roleHasPermission(r, "read", "scene")).toBe(true);
    }
  });

  it("installer and operator can write", () => {
    expect(roleHasPermission("installer", "update", "scene")).toBe(true);
    expect(roleHasPermission("operator", "create", "scene")).toBe(true);
  });

  it("reviewer can approve/reject but not write", () => {
    expect(roleHasPermission("reviewer", "approve", "scene")).toBe(true);
    expect(roleHasPermission("reviewer", "reject", "scene")).toBe(true);
    expect(roleHasPermission("reviewer", "update", "scene")).toBe(false);
  });

  it("auditor can recover but not publish", () => {
    expect(roleHasPermission("auditor", "recover", "scene")).toBe(true);
    expect(roleHasPermission("auditor", "publish", "scene")).toBe(false);
  });

  it("insurer cannot write", () => {
    expect(roleHasPermission("insurer", "update", "scene")).toBe(false);
    expect(roleHasPermission("insurer", "create", "scene")).toBe(false);
  });
});

describe("canPerform", () => {
  const readAction: PermissionAction = "read";
  const writeAction: PermissionAction = "update";

  it("allows read for read-only posture (insurer)", () => {
    expect(canPerform(insurerJob, "insurer", readAction, "scene")).toBe(true);
  });

  // CRITICAL SAFETY PROPERTY — the test that must never regress.
  it("blocks write for read-only posture even when role would allow", () => {
    // insurer lens is read-only. Even if paired with an operator role
    // that has update permission, the posture gate must block it.
    expect(canPerform(insurerJob, "operator", writeAction, "scene")).toBe(false);
  });

  it("allows write for read-write posture when role permits", () => {
    expect(canPerform(installerJob, "installer", writeAction, "scene")).toBe(true);
  });

  it("blocks when posture allows but role does not", () => {
    // reviewer role does not have update on scene (only review actions).
    expect(canPerform(installerJob, "reviewer", writeAction, "scene")).toBe(false);
  });

  it("insurer lens blocks ALL roles from editing scene (UI gate)", () => {
    const roles: UserRole[] = [
      "admin",
      "operator",
      "installer",
      "auditor",
      "reviewer",
      "privacy_reviewer",
      "insurer",
    ];
    for (const role of roles) {
      expect(canPerform(insurerJob, role, "update", "scene")).toBe(false);
    }
  });
});

// Locks the catalog's defaultBottomTab values against the real studio BottomTab
// union so the cast at the binding site in ProductViewRouter is provably safe.
describe("catalog defaultBottomTab values match studio BottomTab union", () => {
  const VALID_BOTTOM_TABS: ReadonlySet<string> = new Set([
    "outcome",
    "metrics",
    "issues",
    "sensors",
    "timeline",
    "beforeafter",
    "report",
    "help",
    "debug",
    "counterfactual",
    "threat",
    "redundancy",
    "temporal",
    "assumptions",
    "governance",
    "provenance",
    "novel",
    "budgeting",
    "scenario",
  ]);

  it("every catalog defaultBottomTab is a valid BottomTab", () => {
    for (const job of JOB_CATALOG) {
      expect(VALID_BOTTOM_TABS.has(job.lens.defaultBottomTab)).toBe(true);
    }
  });
});
