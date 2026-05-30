# Phase 16: Cross-Device Sync

**Status:** Not started  
**Priority:** P3 (Low)  
**Dependencies:** Phase 13 (Persistent Identity & Governance)

---

## Goal

Enable a user's SentinelTwin workspace, scenes, and settings to synchronize across devices — allowing seamless transitions between desktop, tablet, and team workspace environments.

---

## Current State

Everything is local-only:
- Scene persistence via IndexedDB
- No cloud storage
- No sync primitives
- No offline/online state management
- Conflict-resolution seam hardening now avoids false positives from property-order drift in semantically identical scene payloads.

---

## Deliverables

### 1. Sync Primitives

- Sync engine interface:
  - `push(localChanges)` → remote
  - `pull()` → local
  - `resolveConflicts(local, remote)` → merged
- Conflict resolution strategy:
  - Last-write-wins for non-conflicting fields
  - Three-way merge for scene structure changes
  - User-prompted resolution for significant conflicts
- Sync status tracking per scene:
  - `synced` / `pending` / `conflict` / `offline`
- Background sync with retry and backoff

### 2. Storage Backend

- Abstraction layer: `StorageProvider` interface
- Implementations:
  - `IndexedDBStorageProvider` (local, exists)
  - `S3StorageProvider` (cloud, S3/R2-compatible)
  - `RestAPIStorageProvider` (custom backend)
- Scene → blob serialization for cloud storage
- Metadata index for quick scene listing without full download

### 3. Offline Support

- Queue edits made while offline
- Sync when connection restores
- Visual indicator of sync status (pending/synced/conflict)
- Graceful degradation: full functionality offline, sync when online

### 4. Workspace Sync

- Organization workspace syncs across members
- Permission model governs read/write access
- Activity feed shows cross-device edits
- Invite/join flow for team workspaces

---

## Implementation Order

1. Sync engine interface and state management
2. IndexedDB ↔ cloud sync adapter
3. Offline edit queue
4. Conflict resolution UI
5. Workspace sync with permission model

---

## Success Criteria

- Scene edited on Device A appears on Device B after sync
- Offline edits are queued and pushed when connection restores
- Conflicting edits are detected and resolved
- Sync status is visible in the UI

---

## Related Docs

- `Docs/architecture/01_DATA_MODEL_SECURITY_SCENE.md`
- `Docs/todos/PHASE_13_PERSISTENT_IDENTITY_GOVERNANCE.md`
