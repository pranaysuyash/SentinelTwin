# Governance & Audit Trail System — Deep Dive

**Date:** 2026-07-11  
**Thread:** 161  
**Status:** Documentation complete

---

## Executive Summary

SentinelTwin implements a **five-layer governance and audit trail system** that tracks every change to a security scene from creation through publication. The system provides role-based approval workflows, snapshot-based comparison, truth ladder provenance, operational evidence journaling, and trust surface auditing — all designed to produce compliance-ready audit evidence.

**Core principle:** Every edit, review, approval, and publication leaves an immutable evidence trail. No change is invisible.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GOVERNANCE & AUDIT TRAIL                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Snapshot    │  │   Truth      │  │  Workspace   │             │
│  │   Slice       │  │   Ladder     │  │  Governance  │             │
│  │              │  │              │  │              │             │
│  │  saveSnap    │  │  reviewStats │  │  8 roles     │             │
│  │  simSnap     │  │  geoValid    │  │  approval    │             │
│  │  compare     │  │  sourceTrace │  │  routing     │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                 │                       │
│         ▼                 ▼                 ▼                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Operational Evidence Journal                    │   │
│  │                                                             │   │
│  │  40+ event kinds · append-only · localStorage + archive     │   │
│  │  timeline reconstruction · branch comparison · merge        │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│         ┌───────────────────┼───────────────────┐                  │
│         ▼                   ▼                   ▼                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  Governance  │  │  Trust Audit │  │  Report      │            │
│  │  Archive     │  │  (CI Gate)   │  │  Integration │            │
│  │              │  │              │  │              │            │
│  │  webhook     │  │  45 surfaces │  │  truth ladder│            │
│  │  archive     │  │  required/   │  │  provenance  │            │
│  │  manual      │  │  forbidden   │  │  evidence    │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Snapshot Slice

**File:** `apps/studio/src/store/slices/core/snapshot-slice.ts` (~200 lines)

### Purpose
Capture point-in-time snapshots of the scene for comparison, re-simulation, and report handoff.

### Key Types

```typescript
type SnapshotSlice = {
  snapshots: SceneSnapshot[];
  addSnapshot: (label: string, result: SimulationResult) => void;
  saveSnapshot: (label: string) => void;
  simulateSnapshot: (snapshotId: string) => boolean;
};
```

### Snapshot Structure

```typescript
interface SceneSnapshot {
  id: string;              // "snap_<timestamp_base36>"
  label: string;           // User-provided label
  createdAt: number;       // Date.now()
  scene: SecurityScene;    // Deep clone of scene at capture time
  simulation?: SimulationResult;  // Optional pre-computed result
}
```

### Operations

| Operation | What It Does | Evidence Event |
|-----------|-------------|----------------|
| `addSnapshot(label, result)` | Creates snapshot with pre-computed simulation | `snapshot_saved` (confidence: 0.9) |
| `saveSnapshot(label)` | Creates snapshot + runs simulation | `snapshot_saved` + `performance_trace` |
| `simulateSnapshot(id)` | Re-runs simulation on existing snapshot | `snapshot_saved` (actor: "system") |

### Evidence Integration

Every snapshot operation:
1. **Creates an `OperationalEvidenceEvent`** with before/after scene summaries
2. **Appends to `changeLog`** with formatted evidence line
3. **Persists to localStorage** via `serializeOperationalEvidenceJournal`
4. **Records performance trace** (duration in ms)
5. **Updates scene intelligence graph** with snapshot count

### Change Log Line Format

```
Evidence: Jul 11, 02:30 PM | Snapshot saved | Saved snapshot "Baseline" for comparison and report handoff. | High
```

---

## Layer 2: Truth Ladder

**File:** `apps/studio/src/lib/truth-ladder.ts` (~90 lines)

### Purpose
Quantify the trustworthiness of every node in the scene by tracking review status, geometry validity, and source traces.

### Truth Ladder Summary

```typescript
interface SceneTruthLadderSummary {
  nodeCount: number;
  reviewedNodeCount: number;
  verifiedNodeCount: number;
  sourceTraceCount: number;
  suspectGeometryCount: number;
  invalidGeometryCount: number;
  reviewStatusCounts: Record<ReviewStatus, number>;
  geometryValidityCounts: Record<GeometryValidity, number>;
  sourceCounts: Record<string, number>;
  reviewedCoveragePct: number;
  sourceTraceCoveragePct: number;
  geometryValidityCoveragePct: number;
  summary: string;
}
```

### Node Trust Dimensions

#### Review Status (5 levels)

| Status | Meaning | Trust Level |
|--------|---------|-------------|
| `unreviewed` | Default, no human verification | Lowest |
| `accepted` | Human reviewed, no changes needed | Medium |
| `corrected` | Human found and fixed errors | Medium-High |
| `calibrated` | Precision-adjusted (e.g., camera position) | High |
| `verified` | Full verification with evidence | Highest |

#### Geometry Validity (3 levels)

| Status | Meaning | Impact |
|--------|---------|--------|
| `valid` | Geometry passes all checks | Full confidence |
| `suspect` | Potential issues detected | Reduced confidence |
| `invalid` | Known geometry errors | Minimum confidence |

#### Source Trace

Every node has a `sourceTrace` field — a free-text explanation of where the node came from:

```typescript
// From node-factory.ts
sourceTrace: options?.sourceTrace ?? "",
// From IFC parser
sourceTrace: `IFC entity #${entity.id} — ${entity.type}`,
// From AI draft
sourceTrace: "AI-generated placement with manual review",
```

### Coverage Metrics

```typescript
reviewedCoveragePct = reviewedNodeCount / nodeCount * 100;
sourceTraceCoveragePct = sourceTraceCount / nodeCount * 100;
geometryValidityCoveragePct = validGeometryCount / nodeCount * 100;
```

### Integration Points

- **Reports:** `truthLadder` section in every `ReportData`
- **UI:** `SceneIntelligenceTab` shows truth ladder summary
- **Confidence:** `packages/simulation/src/confidence.ts` uses geometry validity for confidence scoring
- **Export:** `export-templates.ts` includes truth ladder in Markdown/HTML output

---

## Layer 3: Workspace Governance

**File:** `apps/studio/src/lib/workspace-governance.ts` (~200 lines)

### Purpose
Role-based approval workflows for scene publication with context-aware routing.

### 8 Workspace Roles

| Role | Can Approve | Can Publish | Typical User |
|------|------------|-------------|--------------|
| `operator` | No | Yes (open mode) | Field technician |
| `reviewer` | Yes | Yes | Security consultant |
| `auditor` | No | Yes | Compliance officer |
| `installer` | No | No | Camera installer |
| `insurer` | No | No | Insurance assessor |
| `privacy_reviewer` | No | Yes (if privacy zones) | Data protection officer |
| `operations_manager` | No | Yes | Facility manager |
| `admin` | Yes | Yes | System administrator |

### Scene Status Lifecycle

```
draft → review_requested → approved → published
                ↓
            rejected → draft
                ↓
            recovered → draft
```

### Approval Routing Matrix

The system automatically determines who must approve based on scene content:

```typescript
function resolveApprovalRoute(governance, scene) {
  // Open mode: anyone can publish
  if (governance.approvalMode === "open") return ["operator", "reviewer", "admin"];
  
  // High-priority zones or emergency scenarios → admin required
  const requiresAdmin = hasHighPriorityCriticalZone(scene) || requiresScenarioEscalation(scene);
  
  // Privacy zones present → privacy_reviewer required
  const requiresPrivacyReview = hasPrivacyExposure(scene);
  
  if (requiresAdmin) {
    return requiresPrivacyReview ? ["admin", "privacy_reviewer"] : ["admin"];
  }
  
  return requiresPrivacyReview 
    ? ["privacy_reviewer", "reviewer", "admin"] 
    : ["reviewer", "admin"];
}
```

### Context-Aware Escalation Triggers

| Trigger | Condition | Escalation |
|---------|-----------|------------|
| High-priority zones | `zone.priority === "critical"` or `"high"` | Admin required |
| Privacy exposure | `privacyZones.length > 0` | Privacy reviewer required |
| Emergency scenario | `operationalContext.isEmergencyWindow` | Admin required |
| VIP visit | `scope === "vip_visit"` | Admin required |
| Incident response | `scope === "incident_response"` | Admin required |

### Governance State

```typescript
interface WorkspaceGovernanceState {
  activeRole: WorkspaceRole;
  approvalMode: "open" | "review_required";
  sceneStatus: WorkspaceSceneStatus;
  requestedAt: number | null;
  requestedBy: WorkspaceRole | null;
  reviewedAt: number | null;
  reviewedBy: WorkspaceRole | null;
  publishedAt: number | null;
  publishedBy: WorkspaceRole | null;
  reviewNotes: string[];
}
```

---

## Layer 4: Operational Evidence Journal

**File:** `apps/studio/src/lib/operational-evidence.ts` (~1,400 lines)

### Purpose
Immutable, append-only journal of every significant action in the workspace — the backbone of the audit trail.

### Event Architecture

#### 40+ Event Kinds

| Category | Event Kinds |
|----------|-------------|
| **Scene Lifecycle** | `scene_initialized`, `scene_imported`, `scene_created`, `scene_updated`, `scene_reverted`, `scene_published`, `scene_merged` |
| **Node Operations** | `node_added`, `node_updated`, `node_removed` |
| **Governance** | `scene_review_requested`, `scene_review_approved`, `scene_review_rejected`, `scene_comment_added`, `governance_role_changed`, `governance_policy_changed` |
| **Workspace** | `workspace_member_selected`, `workspace_access_policy_changed`, `workspace_membership_synced`, `workspace_approval_routed`, `workspace_identity_conflict_resolved` |
| **Sensors** | `sensor_added`, `sensor_updated`, `sensor_removed`, `sensor_triggered`, `sensor_heartbeat`, `sensor_faulted`, `sensor_restored` |
| **Camera** | `camera_metadata_updated`, `camera_live_connection_updated` |
| **Snapshots** | `snapshot_saved` |
| **Simulation** | `simulation_completed`, `counterfactual_completed` |
| **Drafts** | `draft_proposed`, `draft_applied` |
| **Scans** | `scan_session_started`, `scan_session_compiled`, `scan_compiled` |

#### Event Structure

```typescript
interface OperationalEvidenceEvent {
  id: string;                    // "kind:sceneId:timestamp:uuid"
  kind: OperationalEvidenceEventKind;
  title: string;
  details: string;
  actor: "system" | "user" | "ai";
  source: SceneSource | "system";
  sceneId: string;
  sceneName: string;
  revisionDepth: number;
  affectedNodeIds: string[];
  confidence: number;            // 0.0 - 1.0
  timestamp: number;
  branchId?: string;
  branchLabel?: string;
  lifecycleStage?: OperationalEvidenceLifecycleStage;
  parentEventId?: string;
  published?: boolean;
  beforeSummary?: string;
  afterSummary?: string;
  sceneSnapshot?: SecurityScene;
  previousSceneSnapshot?: SecurityScene;
  simulation?: {
    totalCoveragePct: number;
    issueCount: number;
    failedZoneCount: number;
    deltaCoveragePct?: number;
  };
  notes?: string[];
  liveCameraConnectionContinuity?: CameraLiveConnectionArchiveRecord[];
  sensorIngestContinuity?: SensorIngestArchiveRecord[];
}
```

### Lifecycle Stages (8 stages)

```typescript
const OPERATIONAL_EVIDENCE_LIFECYCLE_STAGES = [
  "draft",      // Scene being edited
  "review",     // Under review/approval
  "published",  // Officially published
  "recovered",  // Restored from archive
  "imported",   // From external source
  "scanned",    // From phone scan
  "simulated",  // Simulation results
  "manual",     // Manual edits
] as const;
```

### Timeline Reconstruction

The system can reconstruct the scene at any point in time:

```typescript
function resolveOperationalEvidenceSceneAtTime(
  events: OperationalEvidenceEvent[],
  timestamp: number,
  scene?: SecurityScene
): SecurityScene | null {
  // 1. Build chronological timeline
  const timeline = buildOperationalEvidenceTimeline(events, scene);
  
  // 2. Find latest entry at or before timestamp
  const selectedEntry = [...timeline.entries]
    .reverse()
    .find(entry => entry.event.timestamp <= timestamp);
  
  // 3. Find nearest snapshot source
  let sourceEntry = null;
  for (let index = selectedEntry.index; index >= 0; index--) {
    if (timeline.entries[index].event.sceneSnapshot) {
      sourceEntry = timeline.entries[index];
      break;
    }
  }
  
  // 4. Return cloned snapshot
  return sourceEntry?.event.sceneSnapshot 
    ? structuredClone(sourceEntry.event.sceneSnapshot) 
    : null;
}
```

### Branch Comparison

The system supports comparing two branches of the evidence timeline:

```typescript
function compareOperationalEvidenceBranches(
  events: OperationalEvidenceEvent[],
  leftEventId: string,
  rightEventId: string
): OperationalEvidenceBranchComparison | null {
  // 1. Trace lineage for both branches
  const leftLineage = traceOperationalEvidenceLineage(events, leftEventId);
  const rightLineage = traceOperationalEvidenceLineage(events, rightEventId);
  
  // 2. Find common ancestor
  const rightIds = new Set(rightLineage.map(step => step.event.id));
  const commonAncestor = [...leftLineage].reverse()
    .find(step => rightIds.has(step.event.id));
  
  // 3. Reconstruct scenes at each point
  const leftScene = reconstructSceneFromEvidence(events, leftEventId);
  const rightScene = reconstructSceneFromEvidence(events, rightEventId);
  const ancestorScene = commonAncestor 
    ? reconstructSceneFromEvidence(events, commonAncestor.event.id) 
    : null;
  
  // 4. Compute delta
  return {
    left, right, commonAncestor,
    leftScene, rightScene, ancestorScene,
    delta: {
      cameras: rightScene.cameras.length - leftScene.cameras.length,
      lights: rightScene.securityLights.length - leftScene.securityLights.length,
      // ... etc
    }
  };
}
```

### Merge Readiness Assessment

```typescript
function assessOperationalEvidenceMergeReadiness(
  comparison: OperationalEvidenceBranchComparison
): OperationalEvidenceMergeReadiness {
  // Status: "same" | "fast_forward_left" | "fast_forward_right" | "diverged" | "unrelated"
  
  if (comparison.left.event.id === comparison.right.event.id) {
    return { status: "same", recommendation: "Both selections point at the same branch head." };
  }
  
  if (!comparison.commonAncestor) {
    return { status: "unrelated", recommendation: "These branches do not share a reconstructable ancestor." };
  }
  
  const leftDistance = comparison.left.depth - commonAncestor.depth;
  const rightDistance = comparison.right.depth - commonAncestor.depth;
  
  if (leftDistance === 0) {
    return { status: "fast_forward_left", recommendation: "Left branch is the ancestor side." };
  }
  
  return { status: "diverged", recommendation: "The branches diverged and would need a real merge policy." };
}
```

### 3-Way Merge

```typescript
function mergeOperationalEvidenceBranchScenes(
  comparison: OperationalEvidenceBranchComparison
): OperationalEvidenceSceneMergeResult | null {
  // 1. Start with left scene as base
  const baseScene = structuredClone(comparison.leftScene);
  
  // 2. Merge each collection (walls, cameras, zones, etc.)
  for (const collection of COLLECTIONS) {
    const mergeResult = mergeSceneCollection(
      collection,
      ancestor[collection],
      comparison.leftScene[collection],
      comparison.rightScene[collection]
    );
    baseScene[collection] = mergeResult.items;
    conflicts.push(...mergeResult.conflicts);
  }
  
  // 3. Merge scalar fields (name, assumptions, etc.)
  for (const field of TOP_LEVEL_FIELDS) {
    baseScene[field] = mergeSceneScalar(field, ancestor[field], left[field], right[field], conflicts);
  }
  
  return { mergedScene: baseScene, conflicts, mergedCollections };
}
```

### Persistence

- **localStorage:** `sentineltwin_operational_evidence_v1`
- **Serialization:** `serializeOperationalEvidenceJournal()` handles delta updates
- **Archive:** `governance-archive.ts` for external dispatch

---

## Layer 5: Trust Audit (CI Gate)

**File:** `apps/studio/src/lib/truth-audit.ts` (~350 lines)

### Purpose
Automated verification that critical UI surfaces contain required phrases and avoid forbidden stubs.

### 45 Audit Surfaces

| Surface | File | Required Phrases | Forbidden Phrases |
|---------|------|------------------|-------------------|
| Project launcher | `ProjectStartLauncher.tsx` | "Scan site with phone photos", "Open seeded retail baseline" | "Coming Soon", "fake", "stub" |
| Governance control plane | `GovernanceTab.tsx` | 50+ phrases (role selectors, approval routing, conflict resolution) | "stub" |
| TruthBadge component | `TruthBadge.tsx` | "simulated", "inferred", "real", "placeholder" | "stub" |
| Site intake hub | `SiteIntakeHub.tsx` | "Guided capture + manual review", "Draft-gated" | "automatic reconstruction" |
| Novel algorithms | `NovelAlgorithmsTab.tsx` | 15+ data wiring phrases | "stub", "hardcoded", "FAKE_DATA" |
| Report truth labeling | `ReportLiteTab.tsx` | "TruthBadge", "computed", "inferred" | "placeholder", "stub" |
| Debug diagnostics | `DebugTab.tsx` | 80+ phrases (bundle, archive, restore, audit) | "stub" |

### Audit Report Structure

```typescript
interface TrustAuditReport {
  ok: boolean;
  rootDir: string;
  issues: TrustAuditIssue[];
  surfaces: Array<TrustAuditSurface & {
    status: "pass" | "fail";
    missingRequiredPhrases: string[];
    forbiddenMatches: string[];
  }>;
}

interface TrustAuditIssue {
  surface: string;
  file: string;
  kind: "missing_file" | "missing_required_phrase" | "forbidden_phrase";
  phrase?: string;
}
```

### Usage

```bash
# Run trust audit from project root
npx tsx tools/truth-audit.ts

# Output:
# Trust audit for /Users/pranay/Projects/SentinelTwin
# Status: PASS (or FAIL with N issues)
# 
# PASS  Project launcher scan flow
#   File: src/components/launcher/ProjectStartLauncher.tsx
# 
# FAIL  Governance control plane
#   File: src/components/bottom-panel/GovernanceTab.tsx
#   Missing:
#     - "Dispatch Governance"
#   Forbidden:
#     - "stub"
```

---

## Integration with Reports

### Report Data Structure

```typescript
interface ReportData {
  // ... other fields
  provenance: {
    sceneSourceLabel: string;
    sceneSource: string;
    nodeCount: number;
    edgeCount: number;
    revisionDepth: number;
    snapshotCount: number;
    sourceCounts: Record<string, number>;
    sourceNotes: string[];
    confidenceNotes: string[];
  };
  truthLadder: {
    nodeCount: number;
    reviewedNodeCount: number;
    reviewedCoveragePct: number;
    verifiedNodeCount: number;
    sourceTraceCount: number;
    sourceTraceCoveragePct: number;
    suspectGeometryCount: number;
    invalidGeometryCount: number;
    summary: string;
  };
  evidenceTrail: {
    totalEvents: number;
    checkpointCount: number;
    publishedCheckpointCount: number;
    // ...
  };
}
```

### Truth Ladder in Reports

```markdown
## Truth Ladder

- **Nodes:** 47
- **Reviewed Nodes:** 32 (68.1%)
- **Verified Nodes:** 18
- **Source Traces:** 41 (87.2%)
- **Suspect Geometry:** 3
- **Invalid Geometry:** 0
- **Summary:** 47 nodes · 32 reviewed · 18 verified · 41 traced · 3 suspect geometry · dominant source manual
```

### Provenance in Reports

```markdown
## Provenance

- **Scene Source:** manual (manual)
- **Graph Nodes:** 47
- **Graph Edges:** 63
- **Revision Depth:** 12
- **Snapshots Tracked:** 3
- **Source Counts:** manual:38 · ifc:6 · ai:3
```

---

## File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `apps/studio/src/store/slices/core/snapshot-slice.ts` | 200 | Snapshot creation, simulation, comparison |
| `apps/studio/src/lib/truth-ladder.ts` | 90 | Node trust quantification |
| `apps/studio/src/lib/workspace-governance.ts` | 200 | Role-based approval workflows |
| `apps/studio/src/lib/truth-audit.ts` | 350 | CI trust surface verification |
| `apps/studio/src/lib/governance-archive.ts` | 200 | External governance dispatch |
| `apps/studio/src/lib/operational-evidence.ts` | 1,400 | Evidence journal, timeline, merge |
| `apps/studio/src/store/slices/enterprise/governance-slice.ts` | 500+ | Zustand governance state |
| `apps/studio/src/components/bottom-panel/GovernanceTab.tsx` | 1,000+ | Governance UI |
| `apps/studio/src/components/bottom-panel/SceneIntelligenceTab.tsx` | 800+ | Truth ladder + evidence UI |
| `packages/report/src/index.ts` | 1,200+ | Report generation with truth/provenance |
| `packages/report/src/export-templates.ts` | 600+ | Markdown/HTML export with truth labels |

---

## Gaps & Future Work

| Gap | Impact | Priority |
|-----|--------|----------|
| No server-side evidence persistence | localStorage-only, loses data on clear | High |
| No cryptographic signing of evidence events | Tamper evidence trail | Medium |
| No cross-device evidence sync | Single-device audit trail | Medium |
| No evidence event compression/pruning | localStorage bloat over time | Low |
| No automated trust audit in CI | Manual only | Medium |
| No evidence-based access control | Role-based but not evidence-validated | Low |

---

## Related Exploration Threads

- Thread 159: Report Generation System (provenance + truth ladder integration)
- Thread 156: Feature Deep Dives (snapshot comparison, counterfactual analysis)
- Thread 157: Coverage Engine (confidence scoring uses truth ladder)
