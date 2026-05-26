# SentinelTwin

**AI-Native Physical Security Digital Twin**

> Not "where does the camera point?" — but "what security outcome does this setup actually achieve?"

---

## What It Is

SentinelTwin is a live simulation environment where cameras, lights, obstructions, access points, time of day, lighting conditions, and human movement paths are all editable variables — and every change updates a continuous risk map.

Security agencies, CCTV installers, facility managers, and site owners can:

- Test camera coverage and blind spots in an interactive 3D scene
- Ask "what if this camera fails?", "what if this shelf moves?", "what if the lighting cuts out?"
- Run defensive coverage stress tests to show where coverage is most likely to fail first
- Run 24-hour temporal security profiles to find peak-vulnerability windows
- Generate client-ready audit reports with before/after metrics (modeling estimates, not certifications)

## The Core Interaction

```
Move or change something in the scene
→ coverage recomputes
→ risk map updates
→ AI explains what changed
→ system recommends the cheapest practical fix
```

## What Makes It Different

Every CCTV planning tool shows camera fields of view. SentinelTwin runs a security simulation:

| What others do | What SentinelTwin does |
|---|---|
| Show FOV cones | Compute actual visibility with DORI-quality classification |
| Static camera placement | Live counterfactual testing of any change |
| Manual coverage check | Defensive incident replay — finds the lowest-visibility route and critical coverage gaps |
| Single-state snapshot | 24-hour temporal simulation |
| Designer's report | Planning-grade before/after metrics and assumptions, not legal compliance certification |

## Architecture Foundation

SentinelTwin is built as a Turborepo monorepo extending [Pascal Editor](https://github.com/pascalorg/editor) (MIT).
Pascal provides the spatial editing layer — walls, rooms, doors, windows, zones, levels.
SentinelTwin adds the security intelligence layer — cameras, coverage, simulation, defensive incident replay analysis, AI agents.

See `Docs/architecture/` for complete technical design.

## Docs Structure

```
Docs/
├── context/
│   └── origin/           — founding conversations and briefs
├── architecture/         — full technical design (read before coding)
├── exploration/          — living research maps, model investigations, options
├── product/              — product thesis, users, use cases, roadmap
└── decisions/            — architecture decision log + open questions
```

## Development Phase

**Current: Studio alpha implemented under `apps/studio`; Pascal fork/true package split is now deferred to a tracked follow-up.**

Build order:
1. ✅ Architecture docs (this phase)
2. ✅ SecurityScene data model implementation
3. ✅ Coverage engine (raycast + DORI + heatmap)
4. ✅ Camera + light + obstruction node system
5. ✅ AI command layer + counterfactual engine
6. ✅ Coverage stress test / incident replay analysis
7. ✅ Temporal simulation
8. ✅ Before/after snapshots + report generation
9. ✅ Demo scene (Small Retail Shop)
10. ☐ Pascal fork + remaining package-split migration (tracked follow-up)

## Contributing Agents

Read `AGENTS.md` before any implementation work.
