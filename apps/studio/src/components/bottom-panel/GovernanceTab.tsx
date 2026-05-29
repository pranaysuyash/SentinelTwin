"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/shared/Badge";
import { cn } from "@/lib/cn";
import {
  canPublishWorkspaceScene,
  summarizeWorkspaceGovernance,
  WORKSPACE_ROLES,
} from "@/lib/workspace-governance";
import {
  canPerformWorkspaceAction,
  summarizeWorkspaceAccess,
  summarizeWorkspaceAccessRoutes,
  type WorkspaceAction,
} from "@/lib/workspace-access";
import {
  summarizeOperationalGovernanceTrail,
} from "@/lib/operational-evidence";
import type { GovernanceArchiveRecord } from "@/lib/governance-archive";
import {
  summarizeWorkspaceApprovalRouting,
  summarizeWorkspaceMembershipDrift,
} from "@/lib/workspace-membership-routing";
import type { WorkspaceMembershipArchiveRecord } from "@/lib/workspace-membership-types";
import { useStudioStore } from "@/store/studio-store";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">{title}</div>
      {children}
    </div>
  );
}

function PillButton({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[9px] transition-colors",
        active
          ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
          : "border-[#1e2130] bg-[#0f141f] text-[#8090a8] hover:border-[#2a3245] hover:text-white",
        disabled && "cursor-not-allowed opacity-50 hover:border-[#1e2130] hover:text-[#8090a8]",
      )}
    >
      {children}
    </button>
  );
}

function statusTone(status: string) {
  switch (status) {
    case "published":
      return "green";
    case "approved":
      return "blue";
    case "review_requested":
      return "amber";
    case "rejected":
      return "red";
    case "recovered":
      return "gray";
    default:
      return "gray";
  }
}

export function GovernanceTab() {
  const scene = useStudioStore((s) => s.scene);
  const operationalEvidenceEvents = useStudioStore((s) => s.operationalEvidenceEvents);
  const workspaceAccess = useStudioStore((s) => s.workspaceAccess);
  const workspaceGovernance = useStudioStore((s) => s.workspaceGovernance);
  const publishCurrentScene = useStudioStore((s) => s.publishCurrentScene);
  const setWorkspaceActiveMember = useStudioStore((s) => s.setWorkspaceActiveMember);
  const setWorkspaceAccessMode = useStudioStore((s) => s.setWorkspaceAccessMode);
  const setWorkspaceRole = useStudioStore((s) => s.setWorkspaceRole);
  const setWorkspaceApprovalMode = useStudioStore((s) => s.setWorkspaceApprovalMode);
  const syncWorkspaceMembershipSnapshot = useStudioStore((s) => s.syncWorkspaceMembershipSnapshot);
  const recordOperationalEvidenceEvent = useStudioStore((s) => s.recordOperationalEvidenceEvent);
  const requestSceneReview = useStudioStore((s) => s.requestSceneReview);
  const approveSceneReview = useStudioStore((s) => s.approveSceneReview);
  const rejectSceneReview = useStudioStore((s) => s.rejectSceneReview);
  const addSceneAnnotation = useStudioStore((s) => s.addSceneAnnotation);
  const [governanceArchiveReport, setGovernanceArchiveReport] = useState<(GovernanceArchiveRecord & { historyCount: number }) | null>(null);
  const [governanceArchiveLoading, setGovernanceArchiveLoading] = useState(false);
  const [governanceArchiveError, setGovernanceArchiveError] = useState<string | null>(null);
  const [remoteGovernanceArchiveHistory, setRemoteGovernanceArchiveHistory] = useState<GovernanceArchiveRecord[]>([]);
  const [remoteGovernanceArchiveHistoryLoading, setRemoteGovernanceArchiveHistoryLoading] = useState(false);
  const [remoteGovernanceArchiveHistoryError, setRemoteGovernanceArchiveHistoryError] = useState<string | null>(null);
  const [governanceArchiveEndpointDraft, setGovernanceArchiveEndpointDraft] = useState("");
  const [workspaceMembershipArchiveReport, setWorkspaceMembershipArchiveReport] = useState<(WorkspaceMembershipArchiveRecord & { historyCount: number }) | null>(null);
  const [workspaceMembershipArchiveLoading, setWorkspaceMembershipArchiveLoading] = useState(false);
  const [workspaceMembershipArchiveError, setWorkspaceMembershipArchiveError] = useState<string | null>(null);
  const [remoteWorkspaceMembershipArchiveHistory, setRemoteWorkspaceMembershipArchiveHistory] = useState<WorkspaceMembershipArchiveRecord[]>([]);
  const [remoteWorkspaceMembershipArchiveHistoryLoading, setRemoteWorkspaceMembershipArchiveHistoryLoading] = useState(false);
  const [remoteWorkspaceMembershipArchiveHistoryError, setRemoteWorkspaceMembershipArchiveHistoryError] = useState<string | null>(null);
  const [workspaceMembershipArchiveEndpointDraft, setWorkspaceMembershipArchiveEndpointDraft] = useState("");
  const [workspaceMembershipSyncNotice, setWorkspaceMembershipSyncNotice] = useState<string | null>(null);
  const [annotation, setAnnotation] = useState("");

  const summary = useMemo(() => summarizeWorkspaceGovernance(workspaceGovernance), [workspaceGovernance]);
  const accessSummary = useMemo(() => summarizeWorkspaceAccess(workspaceAccess), [workspaceAccess]);
  const accessRoutes = useMemo(() => summarizeWorkspaceAccessRoutes(workspaceAccess, scene), [workspaceAccess, scene]);
  const governanceTrail = useMemo(
    () => summarizeOperationalGovernanceTrail(operationalEvidenceEvents, scene.id),
    [operationalEvidenceEvents, scene.id],
  );
  const canPublish = canPublishWorkspaceScene(workspaceGovernance);
  const publishDecision = canPerformWorkspaceAction(workspaceAccess, scene, "publish");
  const approveDecision = canPerformWorkspaceAction(workspaceAccess, scene, "approve");
  const refreshGovernanceArchive = async () => {
    setRemoteGovernanceArchiveHistoryLoading(true);
    setRemoteGovernanceArchiveHistoryError(null);
    try {
      const response = await fetch("/api/governance-archive");
      if (!response.ok) {
        throw new Error(`Governance archive failed with HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as {
        ok: true;
        history: GovernanceArchiveRecord[];
        historyCount: number;
      };
      setRemoteGovernanceArchiveHistory(payload.history);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Governance archive failed.";
      setRemoteGovernanceArchiveHistoryError(message);
    } finally {
      setRemoteGovernanceArchiveHistoryLoading(false);
    }
  };

  const refreshWorkspaceMembershipArchive = async () => {
    setRemoteWorkspaceMembershipArchiveHistoryLoading(true);
    setRemoteWorkspaceMembershipArchiveHistoryError(null);
    try {
      const response = await fetch("/api/workspace-membership-archive");
      if (!response.ok) {
        throw new Error(`Workspace membership archive failed with HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as {
        ok: true;
        history: WorkspaceMembershipArchiveRecord[];
        historyCount: number;
      };
      setRemoteWorkspaceMembershipArchiveHistory(payload.history);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workspace membership archive failed.";
      setRemoteWorkspaceMembershipArchiveHistoryError(message);
    } finally {
      setRemoteWorkspaceMembershipArchiveHistoryLoading(false);
    }
  };

  useEffect(() => {
    void refreshGovernanceArchive();
    void refreshWorkspaceMembershipArchive();
  }, []);

  const actionGates = useMemo(() => {
    const actions: Array<{ action: WorkspaceAction; label: string }> = [
      { action: "edit", label: "Edit" },
      { action: "annotate", label: "Annotate" },
      { action: "request_review", label: "Request review" },
      { action: "approve", label: "Approve" },
      { action: "reject", label: "Reject" },
      { action: "publish", label: "Publish" },
      { action: "recover", label: "Restore" },
    ];
    return actions.map((entry) => ({
      ...entry,
      decision: canPerformWorkspaceAction(workspaceAccess, scene, entry.action),
    }));
  }, [scene, workspaceAccess]);
  const latestWorkspaceMembershipArchive = remoteWorkspaceMembershipArchiveHistory[0] ?? null;
  const approvalRoute = useMemo(
    () => summarizeWorkspaceApprovalRouting(
      scene,
      workspaceAccess,
      workspaceGovernance,
      latestWorkspaceMembershipArchive?.workspaceAccessState ?? null,
    ),
    [scene, latestWorkspaceMembershipArchive, workspaceAccess, workspaceGovernance],
  );
  const latestApprovalRouteEvent = useMemo(
    () => operationalEvidenceEvents
      .filter((event) => event.sceneId === scene.id && event.kind === "workspace_approval_routed")
      .sort((left, right) => right.timestamp - left.timestamp)[0] ?? null,
    [operationalEvidenceEvents, scene.id],
  );
  const membershipDrift = latestWorkspaceMembershipArchive
    ? summarizeWorkspaceMembershipDrift(workspaceAccess, latestWorkspaceMembershipArchive.workspaceAccessState)
    : null;
  const membershipReconciliationNeeded = Boolean(membershipDrift && (membershipDrift.activeMemberChanged || membershipDrift.teamSizeChanged || membershipDrift.policyChanged));

  const submitAnnotation = () => {
    if (addSceneAnnotation(annotation)) {
      setAnnotation("");
    }
  };

  const dispatchGovernanceArchive = async () => {
    const trimmedEndpoint = governanceArchiveEndpointDraft.trim();
    if (trimmedEndpoint) {
      try {
        new URL(trimmedEndpoint);
      } catch {
        const message = "Governance archive endpoint must be a valid URL.";
        setGovernanceArchiveError(message);
        return;
      }
    }

    const destinations = [
      { label: "Local relay", mode: "archive" as const },
      ...(trimmedEndpoint
        ? [{ label: "Remote governance webhook", endpoint: trimmedEndpoint, mode: "webhook" as const }]
        : []),
    ];

    setGovernanceArchiveLoading(true);
    setGovernanceArchiveError(null);
    try {
      const response = await fetch("/api/governance-archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "governance-panel",
          submittedAt: Date.now(),
          sceneId: scene.id,
          sceneName: scene.name || "Untitled Scene",
          workspaceAccessSummary: accessSummary,
          workspaceGovernanceSummary: summary,
          governanceTrail,
          destinations,
        }),
      });

      if (!response.ok) {
        throw new Error(`Governance archive failed with HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as GovernanceArchiveRecord & { historyCount: number };
      setGovernanceArchiveReport(payload);
      void refreshGovernanceArchive();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Governance archive failed.";
      setGovernanceArchiveError(message);
    } finally {
      setGovernanceArchiveLoading(false);
    }
  };

  const dispatchWorkspaceMembershipArchive = async () => {
    const trimmedEndpoint = workspaceMembershipArchiveEndpointDraft.trim();
    if (trimmedEndpoint) {
      try {
        new URL(trimmedEndpoint);
      } catch {
        const message = "Workspace membership archive endpoint must be a valid URL.";
        setWorkspaceMembershipArchiveError(message);
        return;
      }
    }

    const destinations = [
      { label: "Local relay", mode: "archive" as const },
      ...(trimmedEndpoint
        ? [{ label: "Remote membership webhook", endpoint: trimmedEndpoint, mode: "webhook" as const }]
        : []),
    ];

    setWorkspaceMembershipArchiveLoading(true);
    setWorkspaceMembershipArchiveError(null);
    try {
      const response = await fetch("/api/workspace-membership-archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "governance-panel",
          submittedAt: Date.now(),
          sceneId: scene.id,
          sceneName: scene.name || "Untitled Scene",
          workspaceAccessState: workspaceAccess,
          workspaceGovernanceState: workspaceGovernance,
          destinations,
        }),
      });

      if (!response.ok) {
        throw new Error(`Workspace membership archive failed with HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as WorkspaceMembershipArchiveRecord & { historyCount: number };
      setWorkspaceMembershipArchiveReport(payload);
      void refreshWorkspaceMembershipArchive();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workspace membership archive failed.";
      setWorkspaceMembershipArchiveError(message);
    } finally {
      setWorkspaceMembershipArchiveLoading(false);
    }
  };

  const syncWorkspaceMembershipArchive = () => {
    if (!latestWorkspaceMembershipArchive) {
      setWorkspaceMembershipSyncNotice("No archived membership snapshot is available to sync.");
      return;
    }

    const synced = syncWorkspaceMembershipSnapshot({
      workspaceAccessState: latestWorkspaceMembershipArchive.workspaceAccessState,
      workspaceGovernanceState: latestWorkspaceMembershipArchive.workspaceGovernanceState,
    });

    setWorkspaceMembershipSyncNotice(
      synced
        ? `Synced workspace identity from ${latestWorkspaceMembershipArchive.sceneName}.`
        : "Workspace identity already matches the latest archived snapshot.",
    );
    void refreshWorkspaceMembershipArchive();
  };

  const resolveWorkspaceApprovalRoute = () => {
    const route = summarizeWorkspaceApprovalRouting(
      scene,
      workspaceAccess,
      workspaceGovernance,
      latestWorkspaceMembershipArchive?.workspaceAccessState ?? null,
    );

    recordOperationalEvidenceEvent({
      kind: "workspace_approval_routed",
      title: "Workspace approval route resolved",
      details: route.routeReason,
      actor: "user",
      source: scene.source,
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: operationalEvidenceEvents.length,
      affectedNodeIds: [],
      confidence: route.routeStatus === "reconcile_before_route" ? 0.86 : 0.94,
      branchLabel: "review",
      lifecycleStage: "review",
      beforeSummary: `${scene.name || "Untitled Scene"} · ${route.activeMemberLabel}`,
      afterSummary: `${scene.name || "Untitled Scene"} · ${route.targetReviewerLabel}`,
      notes: [
        `Route status: ${route.routeStatus}.`,
        `Current policy: ${route.currentPolicyLabel}.`,
        `Archived policy: ${route.archivedPolicyLabel}.`,
        route.drift
          ? `Membership drift: active member ${route.drift.activeMemberChanged ? "changed" : "matched"}, team size ${route.drift.teamSizeChanged ? "changed" : "matched"}, policy ${route.drift.policyChanged ? "changed" : "matched"}.`
          : "No archived membership snapshot was available for comparison.",
        route.hasPrivacyExposure
          ? "Privacy-sensitive scene detected during approval routing."
          : "Standard scene routed through the approval control plane.",
      ],
    });
  };

  return (
    <div className="flex h-full gap-4 overflow-y-auto px-3 py-2">
      <div className="min-w-[250px] space-y-2.5">
        <Section title="Current Authority">
          <div className="space-y-1.5 text-[9px]">
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Role</span>
              <Badge variant="blue">{summary.roleLabel}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Active member</span>
              <Badge variant="gray">{accessSummary.activeMemberLabel}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Approval</span>
              <Badge variant={summary.needsApproval ? "amber" : "green"}>{summary.approvalModeLabel}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Scene status</span>
              <Badge variant={statusTone(workspaceGovernance.sceneStatus)}>{summary.sceneStatusLabel}</Badge>
            </div>
          </div>
          <div className="mt-2 text-[9px] leading-4 text-[#6f7c96]">
            SentinelTwin treats publish as an auditable control action. If approval is required, publish will convert into a review request until a reviewer or admin approves it.
          </div>
        </Section>

        <Section title="Workspace Team">
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {workspaceAccess.members.map((member) => (
                <PillButton
                  key={member.id}
                  active={workspaceAccess.activeMemberId === member.id}
                  onClick={() => setWorkspaceActiveMember(member.id)}
                >
                  {member.displayName}
                </PillButton>
              ))}
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5 text-[9px] text-[#d2d9e8]">
              <div className="flex items-center justify-between">
                <span className="text-[#556076] uppercase tracking-[0.18em]">Mode</span>
                <span className="font-semibold">{accessSummary.modeLabel}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[#556076] uppercase tracking-[0.18em]">Routing</span>
                <span className="font-semibold">{accessSummary.reviewRouteLabel}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[#556076] uppercase tracking-[0.18em]">Publish</span>
                <span className="font-semibold">{accessSummary.publishRouteLabel}</span>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Routing Matrix">
          <div className="space-y-1.5">
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5 text-[9px] text-[#d2d9e8]">
              <div className="flex items-center justify-between">
                <span className="text-[#556076] uppercase tracking-[0.18em]">Active route</span>
                <span className="font-semibold">{accessRoutes.activeMemberLabel}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[#556076] uppercase tracking-[0.18em]">Reviewer target</span>
                <span className="font-semibold">{accessRoutes.requiredReviewerLabel}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[#556076] uppercase tracking-[0.18em]">Scene posture</span>
                <span className="font-semibold">{accessRoutes.hasPrivacyExposure ? "Privacy-sensitive" : "Standard"}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {accessRoutes.memberRoutes.map((route) => (
                <div key={route.memberId} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-[#edf2ff]">{route.displayName}</div>
                    <Badge variant={route.canPublish ? "green" : route.canReview ? "blue" : "gray"}>{route.routeLabel}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{route.role.replace(/_/g, " ")}</Badge>
                    <Badge variant="gray">{route.clearance.replace(/_/g, " ")}</Badge>
                    <Badge variant={route.canPublish ? "green" : "gray"}>Publish {route.canPublish ? "Yes" : "No"}</Badge>
                    <Badge variant={route.canReview ? "blue" : "gray"}>Review {route.canReview ? "Yes" : "No"}</Badge>
                    <Badge variant={route.canRestore ? "amber" : "gray"}>Restore {route.canRestore ? "Yes" : "No"}</Badge>
                  </div>
                  <div className="mt-1 text-[9px] text-[#8b96ab]">{route.reason}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {route.matchedAttributes.map((attribute) => (
                      <Badge key={attribute} variant="gray">{attribute}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Action Gate">
          <div className="space-y-1.5">
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5 text-[9px] text-[#d2d9e8]">
              <div className="flex items-center justify-between">
                <span className="text-[#556076] uppercase tracking-[0.18em]">Route posture</span>
                <span className="font-semibold">{summary.needsApproval ? "Approval required" : "Open publish"}</span>
              </div>
              <div className="mt-1 text-[#8b96ab]">
                {accessSummary.reviewRouteLabel} · {accessSummary.publishRouteLabel}
              </div>
            </div>
            <div className="space-y-1.5">
              {actionGates.map((gate) => (
                <div key={gate.action} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-[#edf2ff]">{gate.label}</div>
                    <Badge variant={gate.decision.allowed ? "green" : "gray"}>{gate.decision.allowed ? "Allowed" : "Blocked"}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant={gate.decision.allowed ? "green" : "gray"}>
                      {gate.decision.requiredReviewerRole ? gate.decision.requiredReviewerRole.replace(/_/g, " ") : "No reviewer"}
                    </Badge>
                    {gate.decision.matchedAttributes.map((attribute) => (
                      <Badge key={`${gate.action}-${attribute}`} variant="gray">{attribute}</Badge>
                    ))}
                  </div>
                  <div className="mt-1 text-[9px] text-[#8b96ab]">{gate.decision.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Role Selector">
          <div className="flex flex-wrap gap-1.5">
            {WORKSPACE_ROLES.map((role) => (
              <PillButton key={role} active={workspaceGovernance.activeRole === role} onClick={() => setWorkspaceRole(role)}>
                {role.replace(/_/g, " ")}
              </PillButton>
            ))}
          </div>
        </Section>

        <Section title="Approval Mode">
          <div className="flex flex-wrap gap-1.5">
            <PillButton
              active={workspaceGovernance.approvalMode === "review_required"}
              onClick={() => setWorkspaceApprovalMode("review_required")}
            >
              Review required
            </PillButton>
            <PillButton active={workspaceGovernance.approvalMode === "open"} onClick={() => setWorkspaceApprovalMode("open")}>
              Open publish
            </PillButton>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <PillButton active={workspaceAccess.policy.mode === "single_user"} onClick={() => setWorkspaceAccessMode("single_user")}>
              Single-user access
            </PillButton>
            <PillButton active={workspaceAccess.policy.mode === "shared"} onClick={() => setWorkspaceAccessMode("shared")}>
              Shared workspace
            </PillButton>
          </div>
        </Section>
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        <Section title="Publish Control">
          <div className="flex flex-wrap gap-1.5">
            <PillButton active={false} onClick={() => requestSceneReview("Requesting approval before publish.")}>
              Request review
            </PillButton>
            <PillButton active={false} disabled={!approveDecision.allowed} onClick={() => approveSceneReview("Approved for publish.")}>
              Approve
            </PillButton>
            <PillButton active={false} disabled={!approveDecision.allowed} onClick={() => rejectSceneReview("Returned for revision.")}>
              Reject
            </PillButton>
            <PillButton active={canPublish && publishDecision.allowed} onClick={() => publishCurrentScene()}>
              {summary.needsApproval ? "Publish or request review" : "Publish now"}
            </PillButton>
          </div>
          <div className="mt-2 grid gap-1.5 md:grid-cols-3">
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Review owner</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.reviewerLabel ?? "None"}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Review age</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.reviewAgeLabel ?? "—"}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Scene</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{scene.name || "Untitled Scene"}</div>
            </div>
          </div>
          <div className="mt-2 rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5 text-[9px] text-[#d2d9e8]">
            <div className="flex items-center justify-between">
              <span className="text-[#556076] uppercase tracking-[0.18em]">Publish route</span>
              <span className="font-semibold">{publishDecision.requiredReviewerRole?.replace(/_/g, " ") ?? "None"}</span>
            </div>
            <div className="mt-1 text-[#8b96ab]">{publishDecision.reason}</div>
          </div>
        </Section>

        <Section title="Annotation Lane">
          <div className="space-y-2">
            <textarea
              value={annotation}
              onChange={(event) => setAnnotation(event.target.value)}
              rows={3}
              placeholder="Write a review note or approval comment..."
              className="w-full rounded-md border border-[#1f2536] bg-[#0f141f] px-2 py-1.5 text-[10px] text-[#d7deed] outline-none transition-colors placeholder:text-[#58647a] focus:border-sky-400/40"
            />
            <div className="flex items-center gap-1.5">
              <PillButton active={false} onClick={submitAnnotation}>
                Add note
              </PillButton>
              <div className="text-[9px] text-[#6f7c96]">
                Notes become evidence events and stay in the audit trail.
              </div>
            </div>
          </div>
        </Section>

        <Section title="Governance Trail">
          <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              {governanceTrail.latestEvent
                ? `${governanceTrail.totalEvents} governance events recorded`
                : "No governance events recorded yet."}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Latest action</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{governanceTrail.latestEvent?.title ?? "None"}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Review requests</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{governanceTrail.requestCount}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Approvals</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{governanceTrail.approvalCount}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Rejections</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{governanceTrail.rejectionCount}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Annotations</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{governanceTrail.annotationCount}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Policy changes</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{governanceTrail.policyChangeCount}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Approval routes</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{governanceTrail.routeCount}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Latest route</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{latestApprovalRouteEvent?.title ?? "None"}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {governanceTrail.recentEvents.length > 0 ? governanceTrail.recentEvents.map((event) => (
                <div key={event.id} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-[#edf2ff]">{event.title}</div>
                    <Badge variant={event.kind === "scene_review_approved" || event.kind === "scene_published" ? "green" : event.kind === "scene_review_rejected" ? "red" : event.kind === "scene_review_requested" ? "amber" : "blue"}>
                      {event.branchLabel ?? event.lifecycleStage ?? "review"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[9px] text-[#8b96ab]">{event.details}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{event.kind.replace(/_/g, " ")}</Badge>
                    <Badge variant="gray">{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    {event.notes?.length ? <Badge variant="gray">{event.notes.length} note{event.notes.length === 1 ? "" : "s"}</Badge> : null}
                  </div>
                </div>
              )) : (
                <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                  No governance trail yet. Request review, add notes, or change approval mode to create an auditable trail.
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="Approval Routing">
          <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              Resolve publish routing against the live workspace and the latest archived membership snapshot before approval crosses the control plane.
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={resolveWorkspaceApprovalRoute}
                className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[9px] text-sky-100 hover:border-sky-400/30 hover:bg-sky-500/20"
              >
                Resolve Approval Route
              </button>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5 text-[9px] text-[#d2d9e8]">
              <div className="flex items-center justify-between">
                <span className="text-[#556076] uppercase tracking-[0.18em]">Route status</span>
                <Badge variant={approvalRoute.routeStatus === "reconcile_before_route" ? "amber" : approvalRoute.routeStatus === "review_required" ? "blue" : "green"}>
                  {approvalRoute.routeStatus.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="mt-1 font-semibold text-[#edf2ff]">{approvalRoute.routeLabel}</div>
              <div className="mt-1">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Route reason</div>
                <div className="mt-0.5 text-[#8b96ab]">{approvalRoute.routeReason}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Target reviewer</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{approvalRoute.targetReviewerLabel}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Latest archived snapshot</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{latestWorkspaceMembershipArchive?.sceneName ?? "No archived snapshot"}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Current policy</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{approvalRoute.currentPolicyLabel}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Archived policy</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{approvalRoute.archivedPolicyLabel}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Active member</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{approvalRoute.activeMemberLabel}</div>
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Archived member</div>
                <div className="mt-0.5 font-semibold text-[#d2d9e8]">{approvalRoute.archivedMemberLabel}</div>
              </div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#556076] uppercase tracking-[0.18em]">Membership drift</span>
                <Badge variant={approvalRoute.drift ? "amber" : "green"}>{approvalRoute.drift ? "Detected" : "Aligned"}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="gray">{approvalRoute.hasPrivacyExposure ? "privacy-sensitive" : "standard"}</Badge>
                <Badge variant="gray">{approvalRoute.drift?.activeMemberChanged ? "active-member changed" : "active-member matched"}</Badge>
                <Badge variant="gray">{approvalRoute.drift?.teamSizeChanged ? "team-size changed" : "team-size matched"}</Badge>
                <Badge variant="gray">{approvalRoute.drift?.policyChanged ? "policy changed" : "policy matched"}</Badge>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Governance Handoff">
          <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              Dispatch the latest approval trail into the governance archive so remote approval routing can be tested against a canonical queue.
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              Paste a remote webhook URL to exercise actual fan-out. Leave it blank to keep the run local and queued.
            </div>
            <input
              type="url"
              value={governanceArchiveEndpointDraft}
              onChange={(event) => setGovernanceArchiveEndpointDraft(event.target.value)}
              placeholder="https://example.com/governance-webhook"
              className="w-full rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1 text-[9px] text-[#d2d9e8] outline-none placeholder:text-[#556076] focus:border-sky-400/40"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={dispatchGovernanceArchive}
                className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[9px] text-sky-100 hover:border-sky-400/30 hover:bg-sky-500/20"
              >
                {governanceArchiveLoading ? "Dispatching..." : "Dispatch Governance"}
              </button>
              <button
                type="button"
                onClick={() => setGovernanceArchiveReport(null)}
                className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
              >
                Clear Handoff Result
              </button>
              <button
                type="button"
                onClick={() => void refreshGovernanceArchive()}
                className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
              >
                {remoteGovernanceArchiveHistoryLoading ? "Refreshing..." : "Refresh Governance Archive"}
              </button>
            </div>
            {governanceArchiveError ? (
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                {governanceArchiveError}
              </div>
            ) : null}
            {governanceArchiveReport ? (
              <div className="space-y-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                  {governanceArchiveReport.summary}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Archive status</div>
                    <div className="mt-0.5 font-semibold text-[#d2d9e8]">{governanceArchiveReport.archiveStatus}</div>
                  </div>
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Delivered</div>
                    <div className="mt-0.5 font-semibold text-[#d2d9e8]">{governanceArchiveReport.deliveredCount}</div>
                  </div>
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Queued</div>
                    <div className="mt-0.5 font-semibold text-[#d2d9e8]">{governanceArchiveReport.queuedCount}</div>
                  </div>
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Failed</div>
                    <div className="mt-0.5 font-semibold text-[#d2d9e8]">{governanceArchiveReport.failedCount}</div>
                  </div>
                </div>
              </div>
            ) : null}
            {remoteGovernanceArchiveHistoryError ? (
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                {remoteGovernanceArchiveHistoryError}
              </div>
            ) : null}
            <div className="space-y-1.5">
              {remoteGovernanceArchiveHistory.length > 0 ? remoteGovernanceArchiveHistory.slice(0, 3).map((record) => (
                <div key={`${record.receivedAt}-${record.historyId}-${record.storedAt}`} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-[#edf2ff]">{record.sceneName ?? "Untitled scene"}</div>
                    <Badge variant={record.archiveStatus === "server archive" ? "green" : "amber"}>{record.archiveStatus}</Badge>
                  </div>
                  <div className="mt-1 text-[9px] text-[#8b96ab]">{record.summary}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{record.deliveredCount} delivered</Badge>
                    <Badge variant="gray">{record.queuedCount} queued</Badge>
                    <Badge variant="gray">{record.failedCount} failed</Badge>
                    <Badge variant="gray">{new Date(record.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                  </div>
                </div>
              )) : (
                <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                  No governance archive yet. Dispatch a review trail to create the routing history.
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="Workspace Membership Handoff">
          <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              Archive the current workspace roster, active member, and routing policy so backend identity can be exercised as a canonical membership record.
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              Paste a remote webhook URL to exercise actual membership fan-out. Leave it blank to keep the run local and queued.
            </div>
            <input
              type="url"
              value={workspaceMembershipArchiveEndpointDraft}
              onChange={(event) => setWorkspaceMembershipArchiveEndpointDraft(event.target.value)}
              placeholder="https://example.com/membership-webhook"
              className="w-full rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1 text-[9px] text-[#d2d9e8] outline-none placeholder:text-[#556076] focus:border-sky-400/40"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={dispatchWorkspaceMembershipArchive}
                className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[9px] text-sky-100 hover:border-sky-400/30 hover:bg-sky-500/20"
              >
                {workspaceMembershipArchiveLoading ? "Dispatching..." : "Dispatch Membership"}
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMembershipArchiveReport(null)}
                className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
              >
                Clear Membership Result
              </button>
              <button
                type="button"
                onClick={() => void refreshWorkspaceMembershipArchive()}
                className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
              >
                {remoteWorkspaceMembershipArchiveHistoryLoading ? "Refreshing..." : "Refresh Membership Archive"}
              </button>
              <button
                type="button"
                onClick={syncWorkspaceMembershipArchive}
                disabled={!latestWorkspaceMembershipArchive}
                className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-100 hover:border-emerald-400/30 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sync Membership Snapshot
              </button>
            </div>
            {workspaceMembershipArchiveError ? (
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                {workspaceMembershipArchiveError}
              </div>
            ) : null}
            {workspaceMembershipSyncNotice ? (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-100">
                {workspaceMembershipSyncNotice}
              </div>
            ) : null}
            {workspaceMembershipArchiveReport ? (
              <div className="space-y-1.5">
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                  {workspaceMembershipArchiveReport.summary}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Archive status</div>
                    <div className="mt-0.5 font-semibold text-[#d2d9e8]">{workspaceMembershipArchiveReport.archiveStatus}</div>
                  </div>
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Active member</div>
                    <div className="mt-0.5 font-semibold text-[#d2d9e8]">{workspaceMembershipArchiveReport.activeMemberLabel}</div>
                  </div>
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Team size</div>
                    <div className="mt-0.5 font-semibold text-[#d2d9e8]">{workspaceMembershipArchiveReport.teamSize}</div>
                  </div>
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Policy</div>
                    <div className="mt-0.5 font-semibold text-[#d2d9e8]">{workspaceMembershipArchiveReport.policyMode === "shared" ? "Shared workspace" : "Single-user workspace"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Archived active member</div>
                    <div className="mt-0.5 font-semibold text-[#d2d9e8]">{workspaceMembershipArchiveReport.activeMemberLabel}</div>
                  </div>
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Archived team size</div>
                    <div className="mt-0.5 font-semibold text-[#d2d9e8]">{workspaceMembershipArchiveReport.workspaceAccessState.members.length}</div>
                  </div>
                  <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Archived policy</div>
                    <div className="mt-0.5 font-semibold text-[#d2d9e8]">{workspaceMembershipArchiveReport.workspaceAccessState.policy.mode === "shared" ? "Shared workspace" : "Single-user workspace"}</div>
                  </div>
                </div>
              </div>
            ) : null}
            {remoteWorkspaceMembershipArchiveHistoryError ? (
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
                {remoteWorkspaceMembershipArchiveHistoryError}
              </div>
            ) : null}
            <div className="space-y-1.5">
              {latestWorkspaceMembershipArchive ? (
                <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-[#edf2ff]">Latest membership snapshot</div>
                    <Badge variant={latestWorkspaceMembershipArchive.archiveStatus === "server archive" ? "green" : "amber"}>{latestWorkspaceMembershipArchive.archiveStatus}</Badge>
                  </div>
                  <div className="mt-1 text-[9px] text-[#8b96ab]">{latestWorkspaceMembershipArchive.summary}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{latestWorkspaceMembershipArchive.activeMemberLabel}</Badge>
                    <Badge variant="gray">{latestWorkspaceMembershipArchive.workspaceAccessState.members.length} members</Badge>
                    <Badge variant="gray">{latestWorkspaceMembershipArchive.workspaceAccessState.policy.mode === "shared" ? "shared" : "single-user"}</Badge>
                    <Badge variant="gray">{new Date(latestWorkspaceMembershipArchive.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                  </div>
	                  {membershipDrift ? (
	                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <div className="rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1">
                        <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Active member drift</div>
                        <div className="mt-0.5 font-semibold text-[#d2d9e8]">{membershipDrift.activeMemberChanged ? "Changed" : "Matched"}</div>
                      </div>
                      <div className="rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1">
                        <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Team size drift</div>
                        <div className="mt-0.5 font-semibold text-[#d2d9e8]">{membershipDrift.teamSizeChanged ? "Changed" : "Matched"}</div>
                      </div>
                      <div className="rounded-md border border-[#1a2030] bg-[#0b0f17] px-2 py-1">
                        <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Policy drift</div>
                        <div className="mt-0.5 font-semibold text-[#d2d9e8]">{membershipDrift.policyChanged ? "Changed" : "Matched"}</div>
	                      </div>
	                    </div>
	                  ) : null}
	                  <div className={membershipReconciliationNeeded ? "mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[9px] text-amber-100" : "mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-100"}>
	                    {membershipReconciliationNeeded
	                      ? "Membership reconciliation is needed before the current workspace can be considered in sync with the archived identity record."
	                      : "Membership snapshot is aligned with the archived identity record."}
	                  </div>
	                </div>
	              ) : null}
              {remoteWorkspaceMembershipArchiveHistory.length > 0 ? remoteWorkspaceMembershipArchiveHistory.slice(0, 3).map((record) => (
                <div key={`${record.receivedAt}-${record.historyId}-${record.storedAt}`} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-[#edf2ff]">{record.sceneName ?? "Untitled scene"}</div>
                    <Badge variant={record.archiveStatus === "server archive" ? "green" : "amber"}>{record.archiveStatus}</Badge>
                  </div>
                  <div className="mt-1 text-[9px] text-[#8b96ab]">{record.summary}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="gray">{record.activeMemberLabel}</Badge>
                    <Badge variant="gray">{record.teamSize} members</Badge>
                    <Badge variant="gray">{record.policyMode === "shared" ? "shared" : "single-user"}</Badge>
                    <Badge variant="gray">{new Date(record.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                  </div>
                </div>
              )) : (
                <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                  No membership archive yet. Dispatch a workspace roster to create the backend identity record.
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="Access Rules">
          <div className="grid gap-1.5 md:grid-cols-2">
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5 text-[9px] text-[#d2d9e8]">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Can approve</div>
              <div className="mt-0.5 font-semibold">{approveDecision.allowed ? "Yes" : "No"}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5 text-[9px] text-[#d2d9e8]">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Can publish</div>
              <div className="mt-0.5 font-semibold">{canPublish ? "Yes" : "No"}</div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
