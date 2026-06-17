# architecture
- For OODPCVS implementation: use OODPCVS 7-level quality names directly on cells (no backward-compat mapping to DORI equivalents). Update all downstream consumers properly instead of using compatibility layers. Confidence: 0.70

# scan-adapters
- For ML model adapters (depth, segmentation, etc.): use lazy-init registry pattern with `ensureXxxReady()` async function that resolves to wired adapter. Cache singleton in module scope so model file is fetched once per process. Return stub or error-result adapter synchronously from getter while init is pending. Confidence: 0.80
- For heavy ML dependencies (onnxruntime-web, etc.): use dynamic `import()` inside a factory function rather than top-level static import. Cast through `unknown` to a local minimal interface if the package's `.d.ts` doesn't resolve under the project's tsconfig. Confidence: 0.75
- For adapter contracts: document the contract in JSDoc on the helper file (when to use, when not to use) and add structural tests that grep the file for required wording. This makes the contract a code-review guardrail rather than tribal knowledge. Confidence: 0.70
- For real ML adapter implementations: never bundle the model file — operators must provision it at a documented path (e.g. `/public/models/...`). The adapter returns a structured error result (e.g. `modelUsed: ":error"`) on missing model so callers can detect and route to the stub. Confidence: 0.75
- For browser-only types (ImageData, HTMLCanvasElement) used in adapter options interfaces: define named function-type aliases (e.g. `LoadImageFn = (photo) => Promise<ImageData>`) instead of inline types like `(photo) => Promise<ImageData>`. Bun v1.3.x mis-parses inline function types containing two generic identifiers in the same member. Confidence: 0.75

# bun-test
- When testing adapter classes that depend on browser-only globals (ImageData, HTMLCanvasElement, document): inject a synthetic ImageData stand-in (1x1 Uint8ClampedArray with colorSpace) and stubbed runInference in test fixtures. Inject via constructor options, not via top-level mocking. The runtime path stays in the same file as test-friendly stubs. Confidence: 0.72

# git
- Never run mutating, destructive, or history-altering git commands (stash, reset, checkout, rebase, merge, push, branch delete, etc.) without explicit user permission — follow motto_v2.md Section 3 rules. The user has reinforced this rule multiple times after seeing violations; treat it as a hard constraint, not a guideline. Confidence: 0.99
- Standard allowed git operations: `git status`, `git log`, `git diff`, `git add`, `git commit` (with descriptive message), `git push` (after commit). These need no per-call approval; everything else does. Confidence: 0.85

# code-style
- Fix all discovered errors immediately — do not defer them as "pre-existing" or out-of-scope. Follow motto_v3 §6: knowing about an issue is a mandate to fix it in the same session. Confidence: 0.72
- For file naming collisions across packages: rename the ambiguous file rather than adding compat shims or aliases. Update all import sites and add a structural test that asserts the old name no longer appears. Confidence: 0.70
- When a test assertion contradicts its own comment or the function's documented contract (e.g. comment says "all stages become ready" but assertion expects "blocked"): the test is wrong, not the function. Fix the assertion to match the actual contract. Verify the fix by running the test in isolation AND in the full suite — stale test state can mask real failures. Confidence: 0.72
- When investigating a reported test failure that doesn't reproduce in isolation: check if the failure is stale state from a prior session, then find the actual root cause (often a different test file with a stale assertion) before fixing. Run the full suite to see the real failure pattern. Confidence: 0.70

# workflow
See [workflow/taste.md](workflow/taste.md)
# commit-style
- For initiative commits (I-number), the commit message body should have these labelled sections in order: CHANGES (what files), VERIFICATION (test/typecheck numbers), FIRST-PRINCIPLES / LONG-TERM ASSESSMENT (why this is the right design), NOT IN SCOPE (deferred items with reason), CONTEXT (initiative ID, owner, evidence tier). This is the canonical commit format for this project; follow it on every initiative commit. Confidence: 0.80

# testing
- For spec-compliance work: write a contract test that reads the source file and asserts spec-section wording appears verbatim (e.g. expect(source).toMatch(/Coverage Time Budget/), expect(labels).toContain("2MP Indoor Dome")). This guards against future refactors silently dropping a spec'd label or section. Behavior tests cover the runtime; contract tests cover the spec. Confidence: 0.75
- For Zod schema or store-slice additions: write a focused unit test file (one describe block per slice) that covers default state, each action, and the round-trip (set then reset). The test is the contract; the slice is the implementation. Keep slice tests separate from any UI that consumes the slice. Confidence: 0.72
