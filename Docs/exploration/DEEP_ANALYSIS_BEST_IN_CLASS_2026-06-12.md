# SentinelTwin Deep Analysis — Best-In-Class Assessment and Build Direction

**Date:** 2026-06-12
**Mode:** Full-repo audit (code + docs + runtime), followed by same-session implementation of the two highest-leverage gaps.
**Evidence tier:** Tier 4 for everything marked "verified" (runtime-observed in the production build); Tier 1–2 elsewhere, marked inline.

## 1) What the app actually is today (verified)

SentinelTwin is substantially past "promising prototype." Direct audit confirms:

- A deterministic simulation engine (`packages/simulation`) with BVH raycasting, DORI/OODPCVS scoring, temporal 24h profiling, adversarial-path analysis, and seven-plus novel algorithms (fragility, k-robustness, placement oracle, entropy, uncertainty, posture, occlusion blame, blind-spot fingerprinting). This is the moat. No competitor in the prosumer segment ships deterministic, explainable coverage verification with this breadth.
- A canonical `SecurityScene` truth model with Zod schemas, provenance graph, append-only operational evidence ledger, temporal twin reconstruction, and governance surfaces.
- A complete studio shell: map/camera/wall/replay/compare/report view modes, scan/AI/floor-plan/JSON intake compilers, report exports with audience modes, and trust-audit regression tests.
- 920 passing tests, clean typecheck, production build green (all verified this session after repairing the environment — see §5).

## 2) Where it stands vs. its class

Reference points from the competitive landscape docs and current market reality:

- **Enterprise design tools** (System Surveyor, SecuritySpecifiers-class, JVSG CCTV design software): strong on device libraries and BOM workflows, weak on *verification* — they draw frustums, they do not simulate occlusion, lighting, time, or failure modes deterministically.
- **VMS vendors' planners** (Axis Site Designer, Hanwha, Genetec planning tools): vendor-locked catalogs, no adversarial/temporal analysis, no provenance.
- **Game-engine one-offs** (Unity/Omniverse-based digital twins): heavy, consulting-shaped, not product.

SentinelTwin's differentiation is already real: **deterministic verification + explainability + evidence memory**. The "AI proposes, simulation verifies, evidence remembers" loop is not marketing copy — it is implemented in code.

What was missing for best-in-class, in order of leverage:

1. **A decision surface.** The analysis power was scattered across 19 bottom-panel tabs. Nothing answered "how secure is this site, what changed, what next?" in one glance. Best-in-class tools lead with a command center.
2. **Main-thread honesty.** The engine was worker-safe by mandate (rule 3) but never actually ran in a worker; every recompute (plus a full 96-snapshot temporal profile) blocked the canvas. Best-in-class interactivity requires the sim off-thread.
3. (Still open) The platform slices already mapped in `FULL_VISION_GAP_INVENTORY.md` §7 — org/accounts, live fusion depth, integrations.

## 3) What was built this session (both verified Tier 4)

### 3.1 Security Analytics Dashboard (`analytics` view mode)
- `src/lib/security-analytics.ts` — pure derivation model over canonical state (simulation result, temporal profile, evidence ledger, snapshots). Headless, engine-tested, portable to reports/worker later.
- `src/components/view/AnalyticsDashboardView.tsx` — interactive command center:
  - KPI cards (coverage, zones, identification, issues, k-robustness, fragility, vulnerability windows) with tone semantics and one-click drill into the canonical explaining surface.
  - Interactive 24h coverage chart: hover inspects any time slice, click scrubs the actual scene (`setTemporalScrub`) and opens the 24H profile tab.
  - DORI quality distribution bar, issue-severity bars, blind-spot summary.
  - Camera leaderboard → click opens that camera in Camera View (verified in browser).
  - Occlusion offenders → click selects the obstruction and opens counterfactual analysis.
  - Placement Oracle callout, snapshot coverage trend sparkline, evidence-ledger activity, resilience panel.
- Honest empty states (no simulation → run CTA; no temporal profile → compute CTA; blank scene renders zeros, never fabricated data). Truth label: "Truth: Simulated · deterministic engine output".
- Reachable via ViewModeBar, key `7`, `?mode=analytics`, and View Settings.

### 3.2 Simulation Web Worker offload
- `src/workers/simulation.worker.ts` + `src/lib/simulation-runner.ts` + `src/lib/simulation-run-core.ts`.
- The worker computes the coverage result **and** the 24h temporal profile in one round-trip; the store no longer recomputes the temporal profile synchronously after every run (previously the largest hidden main-thread cost).
- Deterministic fallback to `simulateStudioAsync` for SSR/tests/worker-failure; execution path recorded in the runtime incident trail.
- Verified: production build bundles the worker (Turbopack `new Worker(new URL(...))`), and a browser-instrumented `postMessage` confirmed the scene payload flows through the worker on Recompute.

### 3.3 Latent bug fixed along the way
- `setViewMode` silently let the preset layout overwrite the requested view mode — invisible until a mode without a 1:1 preset existed. Now the requested mode always wins (D-301).

## 4) Potential — where this goes from here

Priority-ordered, consistent with the gap inventory's layer discipline:

1. **Analytics → Report convergence.** `buildSecurityAnalyticsModel` is UI-free; embed the same model into report exports so the handoff artifact carries the dashboard story (charts as inline SVG). Low effort, high trust payoff.
2. **Worker protocol → progress + cancellation.** Request ids already exist; add progress messages so big scenes show a real progress bar, and cancel stale runs instead of discarding results post-hoc.
3. **Multi-site / org analytics.** Once the org/account slice (gap inventory §8) lands, the analytics model aggregates across workspaces — the "security intelligence OS" claim becomes a screen.
4. **Live fusion into analytics.** Sensor/camera live events already land in the evidence ledger; the dashboard's activity panel is the natural home for live health deltas (simulated vs observed).
5. **Comparative analytics.** The trend sparkline is the seed: snapshot-over-snapshot KPI deltas, regression alerts when a scene edit reduces coverage ("coverage CI").

## 5) Environment repairs this session (operational note)

- The workspace had **no node_modules anywhere** (76 test failures were pure module-resolution noise). Canonical install is `pnpm install` at repo root (`packageManager: pnpm@11.4.0`), not bun install.
- The machine hit **ENOSPC twice**. Cleared only rebuildable caches per disk-pressure policy: VS Code ShipIt update cache (~1.0G), npm cache (~680M), uv cache (~3.8G), pnpm store prune (~1.2G), `.next/cache`. **Not touched:** `~/.cache/huggingface` (69 GB, re-downloadable but expensive — needs owner approval), OS-update snapshots, active code-sign clones (Codex/Atlas in use).
- The Data volume is at ~100% (881/926 GiB). This will keep breaking builds/tests until addressed.

## 6) Confidence statement (motto v3 §0.2)

- Verified (Tier 4): dashboard rendering + interactivity with real demo data, worker execution, build, 920/920 tests, typecheck.
- Inferred (Tier 1): competitive positioning (from repo docs + general market knowledge; no fresh web research this session — network-restricted shell).
- Not verified: worker behavior on very large scenes (>50k cells); analytics dashboard on the `light` UI theme; mobile/compact viewport polish for the dashboard.
