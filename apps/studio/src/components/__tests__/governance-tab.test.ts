import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const governanceTabPath = join(import.meta.dir, "../bottom-panel/GovernanceTab.tsx");

describe("GovernanceTab", () => {
  test("exposes the role, approval, publish, and annotation control plane", () => {
    const source = readFileSync(governanceTabPath, "utf8");

    expect(source).toContain("Role Selector");
    expect(source).toContain("Workspace Team");
    expect(source).toContain("Routing Matrix");
    expect(source).toContain("Action Gate");
    expect(source).toContain("Route posture");
    expect(source).toContain("Governance Trail");
    expect(source).toContain("Governance Handoff");
    expect(source).toContain("Workspace Membership Handoff");
    expect(source).toContain("Approval Routing");
    expect(source).toContain("Latest action");
    expect(source).toContain("Review requests");
    expect(source).toContain("Approvals");
    expect(source).toContain("Rejections");
    expect(source).toContain("Annotations");
    expect(source).toContain("Policy changes");
    expect(source).toContain("Approval routes");
    expect(source).toContain("Latest route");
    expect(source).toContain("Dispatch Governance");
    expect(source).toContain("Refresh Governance Archive");
    expect(source).toContain("Remote governance webhook");
    expect(source).toContain("Dispatch Membership");
    expect(source).toContain("Refresh Membership Archive");
    expect(source).toContain("Sync Membership Snapshot");
    expect(source).toContain("Remote membership webhook");
    expect(source).toContain("Latest membership snapshot");
    expect(source).toContain("Active member drift");
    expect(source).toContain("Team size drift");
    expect(source).toContain("Policy drift");
    expect(source).toContain("Route status");
    expect(source).toContain("Route reason");
    expect(source).toContain("Resolve Approval Route");
    expect(source).toContain("Membership reconciliation is needed");
    expect(source).toContain("Membership snapshot is aligned");
    expect(source).toContain("Single-user access");
    expect(source).toContain("Shared workspace");
    expect(source).toContain("Review required");
    expect(source).toContain("Publish or request review");
    expect(source).toContain("Add note");
    expect(source).toContain("Request review");
    expect(source).toContain("Active route");
    expect(source).toContain("Reviewer target");
    expect(source).toContain("Scene posture");
    expect(source).toContain("Allowed");
    expect(source).toContain("Blocked");
  });
});
