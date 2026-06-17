# architecture
- For OODPCVS implementation: use OODPCVS 7-level quality names directly on cells (no backward-compat mapping to DORI equivalents). Update all downstream consumers properly instead of using compatibility layers. Confidence: 0.70

# git
- Never run mutating, destructive, or history-altering git commands (stash, reset, checkout, rebase, merge, push, branch delete, etc.) without explicit user permission — follow motto_v2.md Section 3 rules. Confidence: 0.97

# code-style
- Fix all discovered errors immediately — do not defer them as "pre-existing" or out-of-scope. Follow motto_v3 §6: knowing about an issue is a mandate to fix it in the same session. Confidence: 0.72

# workflow
- Prefer complete end-to-end implementation over partial patchwork fixes. When a choice exists between a quick patch and a proper long-term solution, always choose the latter per motto_v3 long-term 1st principles. Confidence: 0.68
