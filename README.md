# SentinelTwin

**AI-Native Physical Security Digital Twin**

> Not "where does the camera point?" — but "what security outcome does this setup actually achieve?"

---

## What It Is

SentinelTwin is a live simulation environment where cameras, lights, obstructions, access points, time of day, lighting conditions, and human movement paths are all editable variables — and every change updates a continuous risk map.

Security agencies, CCTV installers, facility managers, and site owners can:

- Test camera coverage and blind spots in an interactive 3D scene
- Ask "what if this camera fails?", "what if this shelf moves?", "what if the lighting cuts out?"
- Simulate adversarial paths through the space and find where coverage breaks
- Run 24-hour temporal security profiles to find peak-vulnerability windows
- Generate client-ready audit reports with before/after metrics

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
| Manual coverage check | Adversarial path simulation — finds the gaps a threat actor would exploit |
| Single-state snapshot | 24-hour temporal simulation |
| Designer's report | Verified before/after metrics, not AI hallucinations |

## Architecture Foundation

SentinelTwin is built as a Turborepo monorepo extending [Pascal Editor](https://github.com/pascalorg/editor) (MIT).
Pascal provides the spatial editing layer — walls, rooms, doors, windows, zones, levels.
SentinelTwin adds the security intelligence layer — cameras, coverage, simulation, adversarial analysis, AI agents.

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

**Current: Pre-code. Architecture documentation + data model design.**

Build order:
1. ✅ Architecture docs (this phase)
2. ☐ Pascal fork + monorepo scaffold
3. ☐ SecurityScene data model implementation
4. ☐ Coverage engine (raycast + DORI + heatmap)
5. ☐ Camera + light + obstruction node system
6. ☐ AI command layer + counterfactual engine
7. ☐ Adversarial path simulation
8. ☐ Temporal simulation
9. ☐ Before/after snapshots + report generation
10. ☐ Demo scene (Small Retail Shop)

## Contributing Agents

Read `AGENTS.md` before any implementation work.
