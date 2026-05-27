# architecture
- For OODPCVS implementation: use OODPCVS 7-level quality names directly on cells (no backward-compat mapping to DORI equivalents). Update all downstream consumers properly instead of using compatibility layers. Confidence: 0.70

# git
- Never run mutating, destructive, or history-altering git commands (stash, reset, checkout, rebase, merge, push, branch delete, etc.) without explicit user permission — follow motto_v2.md Section 3 rules. Confidence: 0.97
