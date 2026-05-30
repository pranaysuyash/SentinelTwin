# Phase 13: Persistent Identity & Governance

**Status:** Not started
**Priority:** P2 (Medium)
**Dependencies:** Phase 11 (Monorepo Packages)

---

## Goal

Transform the current archive-first, local-only governance model into a persistent multi-operator system with real RBAC/ABAC semantics, membership management, approval routing, and conflict resolution.

---

## Current State

The Camera Studio has extensive governance surfaces:
- `WorkspaceGovernanceRecord` / `ApprovalRecord` / `GovernanceCheckpoint` types
- `governanceDecision` store actions
- Timeline with governance events
- Archive fetching via `/api/governance-archive` (stubs)

But these are all **local-only, archive-first**. There is no:
- Real multi-user identity
- Remote approval routing
- Role-based access control
- Durable cross-service identity
- Persistent backend for governance state

---

## Deliverables

### 1. Identity Model

- `UserIdentity` schema (id, displayName, email, role, publicKey)
- `Organization` schema (id, name, members[], settings)
- `WorkspaceMembership` (userId, workspaceId, role, permissions[])
- Local-first with optional sync to backend

### 2. Role Model

| Role | Permissions |
|------|------------|
| Owner | Full control, billing, team management |
| Admin | Edit scenes, run simulation, approve changes |
| Operator | Edit scenes, run simulation, propose changes |
| Reviewer | View scenes, view reports, approve/reject |
| Viewer | Read-only access |

### 3. Approval Workflow

- Change proposal → approval request → notification → approve/reject → apply/revert
- Multi-step approval chains (optional)
- Approval deadline / auto-escalation
- Audit trail linking each change to the approving operator

### 4. Conflict Resolution

- Detect concurrent edits to the same scene
- Three-way merge with visual diff
- Branch-based workflow for significant changes
- Rebase/merge strategy options

### 5. Backend Contracts

- RESTful API or WebSocket for governance state sync
- Endpoints:
  - `POST /api/membership` — invite/join
  - `GET /api/membership` — list members
  - `POST /api/approval` — submit approval request
  - `GET /api/approval/:id` — check approval status
  - `POST /api/approval/:id/respond` — approve/reject
  - `GET /api/governance/events` — event stream
- These are currently stubs — implement the real backend

---

## Implementation Order

1. Identity & Organization schemas (local-first)
2. Role model with permission checks
3. Approval workflow engine (local)
4. Backend API for governance sync
5. Conflict resolution for concurrent edits
6. UI for membership management and approval flows

---

## Success Criteria

- Two operators can collaborate on the same workspace
- One operator proposes a change, the other approves it
- Concurrent edits are detected and resolved
- All governance actions are audited and replayable
- Schema changes persist and sync correctly

---

## Related Docs

- `apps/studio/src/schema/organization.ts` — existing org schema
- `apps/studio/src/schema/workspace-invite.ts` — existing invite schema
- `apps/studio/src/lib/workspace-governance.ts` — existing governance logic
- `Docs/architecture/01_DATA_MODEL_SECURITY_SCENE.md`
