# architecture
- For OODPCVS implementation: use OODPCVS 7-level quality names directly on cells (no backward-compat mapping to DORI equivalents). Update all downstream consumers properly instead of using compatibility layers. Confidence: 0.70

# scan-adapters
- For ML model adapters (depth, segmentation, etc.): use lazy-init registry pattern with `ensureXxxReady()` async function that resolves to wired adapter. Cache singleton in module scope so model file is fetched once per process. Return stub or error-result adapter synchronously from getter while init is pending. Confidence: 0.80
- For heavy ML dependencies (onnxruntime-web, etc.): use dynamic `import()` inside a factory function rather than top-level static import. Cast through `unknown` to a local minimal interface if the package's `.d.ts` doesn't resolve under the project's tsconfig. Confidence: 0.75
- For adapter contracts: document the contract in JSDoc on the helper file (when to use, when not to use) and add structural tests that grep the file for required wording. This makes the contract a code-review guardrail rather than tribal knowledge. Confidence: 0.70
- For real ML adapter implementations: never bundle the model file — operators must provision it at a documented path (e.g. `/public/models/...`). The adapter returns a structured error result (e.g. `modelUsed: ":error"`) on missing model so callers can detect and route to the stub. Confidence: 0.75

# git
- Never run mutating, destructive, or history-altering git commands (stash, reset, checkout, rebase, merge, push, branch delete, etc.) without explicit user permission — follow motto_v2.md Section 3 rules. Confidence: 0.97

# code-style
- Fix all discovered errors immediately — do not defer them as "pre-existing" or out-of-scope. Follow motto_v3 §6: knowing about an issue is a mandate to fix it in the same session. Confidence: 0.72
- For file naming collisions across packages: rename the ambiguous file rather than adding compat shims or aliases. Update all import sites and add a structural test that asserts the old name no longer appears. Confidence: 0.70

# workflow
- Prefer complete end-to-end implementation over partial patchwork fixes. When a choice exists between a quick patch and a proper long-term solution, always choose the latter per motto_v3 long-term 1st principles. Confidence: 0.68
- After each initiative (I-number) is done with tests + typecheck: commit with detailed message describing changes, verification, and long-term assessment — then push. Each initiative is one atomic commit. Confidence: 0.75
- Always apply "long-term 1st principles" and "motto_v3" thinking to all work — user invokes these by name as standing rules. Look up motto_v3.md and 1st principles docs when deciding approach, scope, and tradeoffs. Confidence: 0.75
