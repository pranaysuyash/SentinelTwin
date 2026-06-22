# SentinelTwin — Skeptic's Brief

**Role:** Voice of restraint. What should NOT be built. What will be ignored. Where this product is walking into a trap.

---

## 1. Features Most Users Will Never Touch

In rough order of abandonment likelihood:

**1a. Governance / RBAC / Evidence Ledger / Branch Sync / Identity Conflict Replay**
This is the largest block of built-but-ignored surface area. Security consultants are typically solo practitioners or small teams doing site audits. They do not have internal approval routing, shared workspace identity conflicts, or multi-member review gates. The entire Governance tab — approval routing, route key metadata, archive-backed replay, workspace membership archive — solves a problem that arises at enterprise SaaS scale, not at "consultant opens laptop at a retail site" scale. These features were built for an imaginary future customer, not the actual early user.

**1b. ONVIF Live Connection Surface**
Sounds critical for legitimacy. In practice: ONVIF device management requires network access to the client's live camera infrastructure, which consultants almost never have during an engagement. They get drawings and photos. Live ONVIF connections during a site visit are an edge case, and "verify real footage" as a workflow step will be skipped in favor of screenshots from the DVR UI.

**1c. Model Eval Suite / Prompt Registry / AI Telemetry / Provider Governance**
This is internal tooling that leaked into the product. A security consultant does not care about prompt lineage, token budgets per AI stage, or which model passed the structured-output fixtures. These features belong in a developer/admin view gated behind a config flag, not surfaced as an analysis tab in the main product.

**1d. Coverage Fragility Field**
A nuanced, differentiated feature — but consultants will report "this zone has 60% coverage" not "this cell is 0.4 units from the DORI threshold." The fragility abstraction is too far from how clients ask questions and how consultants write findings. It will generate confusion in deliverables, not insight.

**1e. 24h Temporal Simulation + Schedule Editor**
Powerful concept. Requires the consultant to accurately encode lighting schedules, occupancy periods, guard patrol rounds, and site location for seasonal lighting. That data is not typically available at audit time. Consultants will leave defaults and the output will be meaningless or undefendable. The feature is only useful if the consultant has months of operational familiarity with the site — at which point they already know the answers intuitively.

**1f. Sensor Fusion Overlay / Sensor Ingest API**
Sensor integration requires backend connectivity to the client's sensor infrastructure that does not exist in typical engagements. The "paste sensor metadata" path is a developer workaround that will never be used by a consultant in the field.

---

## 2. The #1 Complexity Trap

**The product is being built as a platform for everything physical security, rather than as a tool that does one thing decisively well.**

The trap: every time a new dimension of physical security is identified (temporal, governance, sensor fusion, GDPR, adversarial paths, ONVIF), a new feature surface is added. Each surface is individually defensible. Collectively, they produce a product where no one can find the core workflow in under 5 minutes without a guided walkthrough.

The concrete symptom: the product already has a Help tab explaining how to use the product, a Debug tab explaining the provider configuration, an "Explain this panel" button on every analysis tab, maturity labels (Available, Preview, Planned) on entry flows, and a guided walkthrough mode. This is the unmistakable signature of a product that has outrun its own legibility.

When a product needs that much self-documentation infrastructure, the complexity trap has already closed.

---

## 3. Simplest Possible Viable Version — Is It Still In There?

The core viable product is:
1. Import a floor plan.
2. Place cameras and walls.
3. Run BVH coverage simulation.
4. Get a report showing what is covered, what is not, and what placement would fix the gaps.

That flow exists. It is buried under: a launcher with 6 scene-creation methods, a ViewModeBar with 8 modes, a bottom analysis drawer with 10+ tabs, a Governance tab, a Debug tab with Provider Health Dashboard, a Scene Intelligence surface, and a workspace memory retrieval system.

The core is still there. It is not findable by a first-time user without the guided walkthrough.

---

## 4. Top 5 Things Users Will NOT Do

**4a. Configure GDPR Article 25 compliance items themselves.**
Consultants will not audit their own scene against GDPR checklists inside a simulation tool. If they need GDPR output, they want it auto-generated from whatever scene state exists — not a manual checklist workflow. The current implementation generates a checklist; consultants need a paragraph in the report they can copy into their deliverable.

**4b. Use adversarial path simulation as a standalone workflow.**
Dijkstra minimum-exposure pathing is a strong differentiator on paper. In practice, consultants show clients where coverage gaps exist — they do not show clients the specific intruder path through those gaps. "Here is the route a bad actor would take" is a liability conversation that most consultants actively avoid. This feature is a demo showstopper that clients ask about and then never request in the actual report.

**4c. Maintain an accurate 24h schedule.**
The schedule editor will be opened once, the defaults will be left in place, and the temporal simulation output will be treated as approximate-to-meaningless by the consultant. There is no enforcement mechanism to communicate when the schedule is clearly wrong (e.g., no occupancy configured for a retail site during business hours).

**4d. Use workspace memory search / checkpoint branching / timeline branch jumps.**
This is version control for simulation state. Consultants do not think in branches. They will save one scene, run simulation, save a second scene with changes, run simulation again. The checkpoint/branch/archive system adds overhead to a workflow that users want to be linear and disposable.

**4e. Export reports for all 5 audience types for a single engagement.**
Consultants will pick one report format that works and use it for every client. The other 4 formats will bitrot and drift out of alignment with the actual simulation outputs because they are only exercised occasionally. The feature will quietly degrade into "generates a report with some wrong numbers in some modes."

---

## 5. Powerful Demo Feature That Collapses in Real Workflows

**Adversarial path simulation / Dijkstra minimum-exposure replay.**

In a demo: you watch an actor walk the lowest-exposure path through the scene. Dramatic. Specific. Undeniable.

In a consultant workflow: the client asks "what is the intruder path?" The consultant now has to explain Dijkstra, explain what "minimum exposure" means, explain why the path goes through that specific corner, and then defend why the path is realistic rather than an artifact of grid resolution or the specific coverage thresholds used.

The path is highly sensitive to PPM assumptions. Change the threshold slightly and the path changes. The consultant cannot defend a specific path to a skeptical client without becoming a software explainer rather than a security expert.

The demo is also built for a scene designed to make the path look good. Real floor plans produce messy paths that do not read as a clean narrative.

This feature will be switched off or ignored in most real deliverables.

---

## 6. Where the Product Tries to Be Too Many Things At Once

Simulation engine AND report authoring tool AND governance platform AND ONVIF device manager AND AI layout drafting assistant AND GDPR compliance audit tool AND forensic replay tool AND sensor event monitor AND workspace collaboration platform.

The specific collision that hurts most: the product is simultaneously targeting the consultant doing a site audit (field user, time-constrained, wants a deliverable) and the SOC analyst doing ongoing monitoring (ONVIF integration, sensor events, temporal patterns). These are different jobs. Different workflows. Different data access. Different report formats.

The ONVIF integration, sensor ingest, temporal monitoring, and governance surfaces are all SOC analyst features. The floor plan import, DORI coverage, adversarial path, and report export are consultant features. These two user types are being served by the same tool, which means neither is being served cleanly.

---

## 7. Feature That Sounds Great in Strategy But Is a Maintenance Nightmare

**The 5-audience report generation system.**

Each audience type (executive, technical, compliance, client, insurance) requires distinct language, distinct metric emphasis, distinct formatting, and distinct claim framing. As the simulation engine evolves and new metrics are added (fragility field, sensor fusion, temporal coverage), every report audience needs to be updated to either include or deliberately exclude those new metrics.

In practice: the executive report will silently include technical metrics that confuse clients. The compliance report will reference checklists that are six months out of date. The technical report will omit the newest metrics because they were added after the report template was last touched.

Multi-audience report systems require dedicated content maintenance resources. A two-person team does not have those resources. This will either be reduced to one or two actually-maintained formats within 12 months, or it will become a source of embarrassing report bugs in client deliverables.

---

## 8. Competitor Assumption Being Accidentally Copied

**The assumption that more coverage data equals more value.**

Traditional physical security tools (Genetec, Milestone, iOmniscient) produce dashboards full of metrics: coverage percentages, camera health, zone alerts, event counts. These tools are widely criticized by security consultants for producing data that takes 2 hours to explain to a client and still does not answer "are we secure?"

SentinelTwin is adding more metrics (fragility field, temporal coverage, sensor fusion, adversarial exposure, multi-audience reporting) in the same pattern. The differentiation is that the metrics are simulation-derived rather than live-monitoring-derived — but the product is still presenting the consultant with a dashboard of numbers to interpret and explain.

The actual unmet need: a consultant wants a single defensible verdict and a prioritized fix list. "Your three highest-risk gaps are X, Y, Z. Here is what to install and where."

SentinelTwin has the simulation engine to produce that verdict. Instead, it is presenting the raw ingredients and asking the consultant to do the synthesis work. That is exactly what competing tools do, and exactly what consultants complain about.

---

## 9. Three Strongest Skeptical Warnings (Named)

**Warning: The Governance Trap ("Enterprise Features for a Solo Market")**
The governance system — approval routing, RBAC, evidence ledger, identity conflict replay, branch sync — assumes a multi-person organization with compliance mandates. The actual early market is solo consultants and small firms with 2-5 people. These users will feel the governance surface as friction, not safety. Building enterprise infrastructure before the product has enterprise customers is how early-stage tools die with impressive architecture and no users.

**Warning: The Demo-Reality Gap ("The Dijkstra Cliff")**
The product has been built to demo well: adversarial path replay, temporal simulation, AI command bar, multi-camera comparison. Each of these features is compelling in a controlled demo scene. In messy real-world floor plans — irregular geometry, unknown PPM, missing occupancy data, no as-built drawings — these features produce output that is either wrong, undefendable, or too complex to present to a client. The gap between "works in demo" and "works for a real client deliverable" is the most dangerous gap in the product right now, and it is not being actively measured.

**Warning: The Legibility Crisis ("The 10-Tab Problem")**
The bottom analysis drawer has more than 10 tabs. The ViewModeBar has 8 modes. The launcher has 6 scene entry paths. No single user will understand all of these surfaces. When a product requires a guided walkthrough, an Explain button on every panel, and maturity labels to communicate what is actually finished, it has crossed the legibility threshold. Adding more features without removing or hiding existing ones will not fix this — it will accelerate it.

---

## 10. The Thing Most People Miss About This

**The thing most people miss about this:** the product has solved the hard technical problem (deterministic BVH simulation, adversarial pathfinding, temporal modeling) and is now building features that make the technical depth *visible* to users — but consultants do not want to see the depth, they want the answer. Every additional analysis tab, every additional metric surface, every additional governance view is a way of saying "look how much computation happened" instead of "here is what you should do next." The product's biggest risk is not that it lacks capability. It is that it has confused capability with value, and is building more capability when it should be building less surface area and a cleaner answer.

---

*Skeptic output for SentinelTwin Wide-Open Brainstorm session — 2026-06-21*
