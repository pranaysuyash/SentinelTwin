# Site Intake Pipeline Architecture

**Status:** Living document — 2026-05-31
**Author:** Codebuff (from site-compiler.ts analysis)

---

## 1. Overview

The site intake pipeline transforms raw scene source material into an active `SecurityScene`
that can be passed to the coverage engine. It spans from source selection through compilation,
review, approval, and activation.

```
Source Material
  → Intake Session (SiteIntakeSession)
  → Compile Draft (SiteTwinDraft / SiteCompilerResult)
  → Review & Approve (SiteDraftApprovalResult)
  → Activate (active SecurityScene in store)
  → Simulation ready
```

This pipeline is the bridge between Layer 1 (Space Creation) and Layer 2 (Scene Model) in the
five-layer architecture. It handles all scene creation paths: blank, scan reconstruction,
AI draft, floor plan import, JSON import, camera evidence, and footage verification.

---

## 2. Source Types

The pipeline supports 6 canonical sources (defined in `site-compiler.ts`), plus 3 legacy aliases
that map to canonical types:

| Source | Description | Maturity | Entry Point |
|---|---|---|---|
| `scan` | AI-assisted reconstruction from photos | Working | `createSiteIntakeSession(scene, "scan", artifacts)` |
| `ai_prompt` | Text-prompted AI layout draft | Preview | `createSiteIntakeSession(scene, "ai_prompt")` |
| `floor_plan` | Imported floor plan image/PDF | Preview | `createSiteIntakeSession(scene, "floor_plan")` |
| `json_import` | Imported SecurityScene JSON | Working | `createSiteIntakeSession(scene, "json", artifacts)` |
| `manual` | Hand-built scene from scratch | Working | `createSiteIntakeSession(scene, "manual")` |
| `camera_evidence` | Camera metadata + live verification | Prototype | `createSiteIntakeSession(scene, "camera_evidence")` |
| `footage_verify` | Footage review verification | Prototype | `createSiteIntakeSession(scene, "footage_verify")` |

**Legacy aliases** (auto-normalized): `guided_scan → scan`, `json_import → json`, `footage_verify → camera_evidence`

---

## 3. Core Data Types

### SiteIntakeSession

Defined in `lib/site-compiler.ts`. The single entry point for all intake flows.

```typescript
type SiteIntakeSession = {
  id: string;
  source: SiteIntakeSource;          // which pipeline path
  scene: SecurityScene;              // cloned candidate (immutable during intake)
  draft: SiteTwinDraft;              // compiled draft (populated at createSession)
  stage: SiteIntakeStage;            // lifecycle stage
  artifacts: string[];               // source artifact references
  createdAt: number;
};
```

### SiteIntakeStage (7-stage lifecycle)

```typescript
type SiteIntakeStage =
  | "choose_source"
  | "capture_or_upload"   // or "mark_or_generate" for AI/scan sources
  | "review"              // current default landing stage
  | "compile"             // re-compile after edits
  | "validated"           // passed quality gates
  | "handoff"             // ready for activation
  | "activated";          // promoted to active scene
```

### SiteTwinDraft

The compiler output — a self-contained draft with provenance, assumptions, and next actions.

```typescript
type SiteTwinDraft = {
  id: string;
  source: SiteIntakeSource;
  scene: SecurityScene;
  warnings: ActionableWarning[];
  confidence: number;
  assumptions: CompilationAssumption[];
  nextActions: SuggestedNextAction[];
  missingPrerequisites: MissingPrerequisite[];
  baselineReady: boolean;
  provenance: {
    source: SiteIntakeSource;
    sourceArtifacts: string[];
    notes: string[];
    compiledAt: number;
    compileVersion: string;
  };
};
```

### SiteDraftApprovalResult

The activation gate output.

```typescript
type SiteDraftApprovalResult = {
  approved: boolean;
  scene: SecurityScene | null;
  valid: boolean;
  errors?: string[];
};
```

---

## 4. Pipeline Flow

### 4.1 Entry: `createSiteIntakeSession()`

Located in `lib/site-compiler.ts`. Called from `page.tsx` line 201.

1. Clones the candidate scene (prevents mutation of source)
2. Dispatches to the correct compile function based on source:
   - `blank` → `compileBlankToSiteResult()`
   - `scan` → `compileScanToSiteResult()` (via scan-to-scene) or `compileReconstructionToSiteResult()` (via scan-reconstruction)
   - `ai_prompt` → delegates to `ai-layout-draft.ts`
   - `floor_plan` → delegates to `scan-to-scene.ts`
   - `json` → `compileJsonToSiteResult()`
   - `camera_evidence` → `compileCameraEvidenceToSiteResult()`
   - `footage_verify` → `compileFootageVerifyToSiteResult()`
3. Wraps result into `SiteTwinDraft` via `compileToSiteTwinDraft()`
4. Returns full `SiteIntakeSession` with nullable `draft` (null if compilation fails)
5. Always lands at `stage: "review"` — the user reviews before activation

### 4.2 Stage Progression: `advanceSessionStage()`

Located in `lib/site-compiler.ts`. Advances a session through its lifecycle.

```typescript
function advanceSessionStage(
  session: SiteIntakeSession,
  targetStage: SiteIntakeStage,
  options?: StageAdvanceOptions,
): SiteIntakeSession
```

**Validation gates per transition:**
- `review → compile`: Draft must exist
- `compile → validated`: No blocking warnings; cameras + critical zones present
- `validated → handoff`: Baseline simulation ready
- `handoff → activated`: Must call `promoteToActiveScene()` (not a direct stage advance)

**Options:**
```typescript
type StageAdvanceOptions = {
  force?: boolean;                     // skip validation gates
  recompile?: boolean;                 // re-run compilation before advancing
};
```

### 4.3 Activation: `promoteToActiveScene()`

Located in `lib/site-draft-approval.ts`. The final gate.

1. Validates: session must be at stage `"handoff"`
2. Validates: draft must exist and be baseline-ready
3. Clones the approved scene (immutability contract)
4. Tags scene with activation provenance:
   - `changeLog` entry with source, draft ID, and timestamp
   - `reviewStatus: "active"` on all entities with `reviewStatus`
5. Returns `SiteDraftApprovalResult` with the activated scene
6. Returns `PromoteToActiveSceneResult` with both `result: SiteDraftApprovalResult` and `updatedSession: SiteIntakeSession` (stage set to `"activated"`)
7. Caller (page.tsx) stores the activated scene, persists the updated session stage, then clears the intake session

### 4.4 Reconstruction-Specific Pipeline

For `scan` source via reconstruction (photo-based), the pipeline is:

```
ScanCaptureSession
  → compileReconstructionToScene()    # scan-reconstruction.ts
    → returns { scene, compilerResult, compileWarnings }
  → compileReconstructionToSiteResult() # convenience wrapper — returns SiteCompilerResult
  → compileReconstructionToSiteTwinDraft() # returns SiteTwinDraft with full provenance
```

The `compileReconstructionToScene()` function:
1. Compiles accepted candidates into SecurityScene nodes
2. Merges entry points (explicit + door-derived, deduplicated)
3. Runs schema validation via `safeParseSecurityScene()`
4. Generates `SiteCompilerResult` via `compileScanToSiteResult()`
5. Returns full compilation output with warnings, acceptance counts

---

## 5. Compile Functions (per source)

| Function | Location | Input | Output |
|---|---|---|---|
| `compileBlankToSiteResult()` | site-compiler.ts | SecurityScene | SiteCompilerResult |
| `compileScanToSiteResult()` | site-compiler.ts | SecurityScene + notes | SiteCompilerResult |
| `compileReconstructionToSiteResult()` | scan-reconstruction.ts | ScanCaptureSession | SiteCompilerResult |
| `compileReconstructionToSiteTwinDraft()` | scan-reconstruction.ts | ScanCaptureSession | SiteTwinDraft |
| `compileAiDraftToSiteResult()` | site-compiler.ts | SecurityScene + prompt | SiteCompilerResult |
| `compileFloorPlanToSiteResult()` | site-compiler.ts | SecurityScene | SiteCompilerResult |
| `compileJsonToSiteResult()` | site-compiler.ts | SecurityScene | SiteCompilerResult |
| `compileCameraEvidenceToSiteResult()` | site-compiler.ts | SecurityScene | SiteCompilerResult |
| `compileFootageVerifyToSiteResult()` | site-compiler.ts | SecurityScene + evidence | SiteCompilerResult |

---

## 6. Warnings Engine

### 6.1 Warning Severity Levels

```typescript
type WarningSeverity = "blocking" | "warning" | "info";
```

| Severity | Meaning | Gate Effect |
|---|---|---|
| `blocking` | Cannot proceed to validation | Blocks `compile → validated` |
| `warning` | Should address before activation | Does not block, surfaced in review |
| `info` | Informational note only | No effect, displayed as guidance |

### 6.2 Severity Mapping Consistency

**Important:** The severity mapping for identical warning codes must be consistent across
all pipeline stages. The following mapping is canonical:

| Code | Severity | Condition |
|---|---|---|
| `NO_CAMERA` | `blocking` | Zero cameras in the compiled scene |
| `NO_ZONES` | `warning` | Zero critical zones |
| `VALIDATION_FAILED` | `blocking` | Schema validation fails |
| `NO_WALLS` | `warning` | No wall markers in reconstruction |
| `NO_CAMERAS` | `warning` | No camera candidates in reconstruction session |

The `NO_CAMERA` code is `blocking` in all contexts — both in `site-compiler.ts` (`makeSiteCompilerWarnings`)
and in `scan-to-scene.ts` (`compileScanSessionToCompilerResult`).

### 6.3 Default Warnings (Reconstruction)

Generated by `computeDefaultWarnings()` in `scan-reconstruction.ts`:
- `NO_CAMERAS` — no camera candidates found (warning)
- `NO_CRITICAL_ZONES` — no zone candidates found (warning)
- `DIMENSIONS_UNANCHORED` — no user-provided scale anchor (info)
- `SINGLE_PHOTO_ONLY` — only one photo captured (info)

---

## 7. Progression Engine

The `advanceSessionStage()` function implements a state machine for intake sessions.

### Valid Transitions

```
choose_source → capture_or_upload → review → compile → validated → handoff → activated
```

### Jump Transitions (allowed)

Any forward jump is permitted (e.g., `review → handoff`), with validation applied for the
destination stage. Backward transitions are not supported — callers must create a new session.

### Validation Rules

| Transition | Gate | Blocking If |
|---|---|---|
| → `review` | None (always allowed) | — |
| → `compile` | `draft != null` | Draft is null |
| → `validated` | `!hasBlockingWarnings && draft.baselineReady` | Blocking warnings or not baseline-ready |
| → `handoff` | Same as `validated` | Same as `validated` |
| → `activated` | Must use `promoteToActiveScene()` | Not at `handoff` stage |

---

## 8. Activation Contract

### Current flow (page.tsx)

```typescript
// 1. Create intake session
const session = createSiteIntakeSession(scene, source, sourceArtifacts);
setSiteIntakeSession(session);

// 2. User reviews in SiteDraftReview component

// 3. On approval:
const promotion = promoteToActiveScene(session);
if (!promotion.result.success) {
  setLaunchNotice(`Draft approval blocked: ${promotion.result.error}`);
  return;
}

const approvedScene = promotion.result.scene;
approvedScene.changeLog = [...approvedScene.changeLog, ...promotion.result.provenanceLog];
setScene(approvedScene);
setSiteIntakeSession(promotion.updatedSession);  // stage = "activated"
// Dismiss session after store operations complete
setSiteIntakeSession(null);

// 4. On rejection:
setSiteIntakeSession(null);
```

---

## 9. Key Files

| File | Purpose |
|---|---|
| `lib/site-compiler.ts` | Core types, compile functions, warnings engine, stage progression |
| `lib/site-draft-approval.ts` | Approval gate, scene activation |
| `lib/scan-to-scene.ts` | Scan/floor-plan compile pipeline |
| `lib/scan-reconstruction.ts` | Photo reconstruction compile pipeline |
| `lib/ai-layout-draft.ts` | AI text-prompt draft generation |
| `lib/scan-artifacts.ts` | Scan capture session, candidates, artifacts |
| `lib/camera-metadata-live-ingest.ts` | Camera metadata + live connection ingest |
| `lib/scene-skeleton.ts` | `createBlankSecurityScene()` |
| `app/page.tsx` | Activation flow (create → review → approve/reject) |
| `components/site-intake/SiteDraftReview.tsx` | Draft review UI |

---

## 10. Known Gaps & Future Work

| Gap | Status | Priority |
|---|---|---|
| Stage progression engine only used by `advanceSessionStage()` — needs UI integration | Not started | Medium |
| `camera_evidence` compile does not extract camera metadata from evidence | Not started | Low |
| `footage_verify` is a thin wrapper — needs verification-specific logic | Not started | Low |
| Stage progression early stages (`choose_source`, `capture_or_upload`, `mark_or_generate`) are infrastructure-only — need intake wizard UI | Not started | Medium |
| No auto-advance from `review → compile` on edit | Not started | Low |
| Activation flow in `page.tsx` has grown organically — could use a dedicated `useActivationFlow()` hook | Not started | Low |
