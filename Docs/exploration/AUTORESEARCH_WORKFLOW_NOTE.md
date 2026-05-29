# Autoresearch Workflow Note

**Status:** Applied as research discipline, not product architecture
**Date:** 2026-05-29
**Related:** `Docs/exploration/EXPLORATION_MAP.md`, `Docs/experiments/V0_2_FLOORPLAN_UNDERSTANDING_BAKEOFF_PLAN.md`

## Why it is useful

Karpathy's autoresearch loop is useful to SentinelTwin as a research-control pattern:

- keep one mutable experiment surface
- measure against one baseline at a time
- keep or discard changes explicitly
- log every run so the next agent can continue without re-deriving context

That maps well to the floorplan-understanding bakeoff, where the real work is not "find a model" but "compare candidate pipelines under the same evaluator and trace the result."

## What we are borrowing

- Strict keep/discard discipline for experiments
- One evaluator, one run history, one repeatable input split
- Intermediate artifacts and run logs that survive the current session
- A bias toward small, understandable changes before larger architectural jumps

## What we are not borrowing

- The MLX training loop itself
- The "edit only train.py" constraint
- The assumption that one mutable file is enough for this project

SentinelTwin needs a multi-stage floorplan pipeline, not a single-file training experiment. The useful part is the operating rhythm, not the model shape.

