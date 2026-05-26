
## Dead Code Audit — Sprint 1 Files (2026-05-26)

### Methodology
Followed motto_v2 §7 (supersession), §10 (pattern search), §11 (first principles), §15 (documentation). Loaded `codex` skill for independent second-opinion review via Codex CLI `exec`. Manual + Codex agreement required for dead verdict.

### Results

| Candidate | File | Verdict | First-principles rationale |
|---|---|---|---|
| `useEffect` import | WorkspaceCanvas.tsx:6 | **GENUINELY DEAD** | Imported but never used anywhere in file. No future path (effect logic belongs elsewhere or doesn't exist). |
| `DecorativeShelving` component | WorkspaceCanvas.tsx:107-139 | **GENUINELY DEAD** | Defined but never rendered. Not exported. Was part of original scene decoration but not re-integrated after SharedScene refactoring. |
| `ADVERSARIAL_PATH_DASH` export | SharedScene.tsx:98 | **NOT DEAD (over-exported)** | Used internally by `AdversarialPathLine`. Over-exported but serves as intentional style token for future consumers. |

### Codex second opinion
Used `codex exec` with stdin prompt. Independent analysis agreed on all three verdicts.

### Pending: Dead code removal (deferred for thorough check)
- `useEffect` import in WorkspaceCanvas.tsx:6 — remove
- `DecorativeShelving` function + useMemo shelves array in WorkspaceCanvas.tsx:107-139 — remove
- Run the React best-practices skill/audit alongside removal
