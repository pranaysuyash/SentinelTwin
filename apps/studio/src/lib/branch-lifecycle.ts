/**
 * Branch lifecycle state machine for SentinelTwin collaboration and governance.
 *
 * Enforces the canonical draft→review→approved→published transition chain,
 * with reject and revert-to-draft escape hatches.
 *
 * Valid transitions:
 *   draft       --submit_for_review-->  review
 *   review      --approve------------>  approved
 *   review      --reject------------->  rejected
 *   approved    --publish------------>  published
 *   rejected    --revert_to_draft---->  draft
 *   approved    --revert_to_draft---->  draft
 */

export type BranchState = "draft" | "review" | "approved" | "published" | "rejected";

export type BranchAction =
  | "submit_for_review"
  | "approve"
  | "reject"
  | "publish"
  | "revert_to_draft";

export type BranchRecord = {
  id: string;
  label: string;
  state: BranchState;
  createdAt: number;
  updatedAt: number;
  authorId: string;
  reviewerId?: string;
  publishedAt?: number;
  notes?: string;
};

// ---------------------------------------------------------------------------
// Valid transition table
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<BranchState, Partial<Record<BranchAction, BranchState>>> = {
  draft: {
    submit_for_review: "review",
  },
  review: {
    approve: "approved",
    reject: "rejected",
  },
  approved: {
    publish: "published",
    revert_to_draft: "draft",
  },
  published: {
    // Published branches are terminal — they cannot be re-opened from within the lifecycle.
    // A new draft branch should be created from a published snapshot instead.
  },
  rejected: {
    revert_to_draft: "draft",
  },
};

// ---------------------------------------------------------------------------
// Core state machine
// ---------------------------------------------------------------------------

/**
 * Transitions a branch to the next state for the given action.
 *
 * Returns a new `BranchRecord` with the updated state, `updatedAt`, and
 * any associated metadata side-effects (e.g. `publishedAt`, `reviewerId`).
 *
 * @throws {Error} when the requested transition is not valid for the current state.
 */
export function transitionBranch(
  branch: BranchRecord,
  action: BranchAction,
  actorId: string,
): BranchRecord {
  const allowedTransitions = VALID_TRANSITIONS[branch.state];
  const nextState = allowedTransitions?.[action];

  if (!nextState) {
    throw new Error(
      `Invalid branch transition: cannot "${action}" a branch that is currently "${branch.state}". ` +
        `Valid actions from "${branch.state}": [${Object.keys(allowedTransitions ?? {}).join(", ") || "none"}].`,
    );
  }

  const now = Date.now();

  return {
    ...branch,
    state: nextState,
    updatedAt: now,
    reviewerId: action === "approve" || action === "reject" ? actorId : branch.reviewerId,
    publishedAt: nextState === "published" ? now : branch.publishedAt,
  };
}

// ---------------------------------------------------------------------------
// Human-readable descriptions
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable description of what the transition does.
 */
export function describeBranchTransition(from: BranchState, action: BranchAction): string {
  const descriptions: Record<BranchAction, string> = {
    submit_for_review: `Submits the "${from}" branch for peer review. The branch is now locked for further editing until a decision is made.`,
    approve: `Approves the "${from}" branch. The branch can now be published to the live workspace.`,
    reject: `Rejects the "${from}" branch. The author can revert it to draft for further edits.`,
    publish: `Publishes the "${from}" branch to the live workspace. This action is final — create a new draft to continue iterating.`,
    revert_to_draft: `Reverts the "${from}" branch back to draft. The author can now make further changes before re-submitting.`,
  };
  return descriptions[action] ?? `Transitions the branch from "${from}" via action "${action}".`;
}

/**
 * Returns the canonical human-readable label for a branch state.
 */
export function branchStateLabel(state: BranchState): string {
  const labels: Record<BranchState, string> = {
    draft: "Draft",
    review: "In Review",
    approved: "Approved",
    published: "Published",
    rejected: "Rejected",
  };
  return labels[state];
}

/**
 * Returns true when the given action is valid for the given state.
 */
export function canTransitionBranch(state: BranchState, action: BranchAction): boolean {
  return action in (VALID_TRANSITIONS[state] ?? {});
}

/**
 * Returns all valid actions from the given state.
 */
export function validActionsFromState(state: BranchState): BranchAction[] {
  return Object.keys(VALID_TRANSITIONS[state] ?? {}) as BranchAction[];
}
