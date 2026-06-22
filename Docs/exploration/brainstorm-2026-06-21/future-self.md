# Retrospective Memo: Physical Security Simulation, December 2027
## From: Someone Who Watched the Category Form

---

I'm writing this eighteen months after the window opened. The category of "physical security simulation" is now real — there are seven serious products, two acqui-hires, one Genetec acquisition, and a graveyard of tools that got the demo right and the distribution wrong.

Here is what I know.

---

## 1. What ALL serious tools have in December 2027 that weren't obvious in 2026

**Regulatory tie-in as the core value loop, not an export tab.**
Every tool that survived integrated directly into the submission workflow for physical security certifications — EN 62676, IEC 62676-4, UL 2050, local fire marshal inspection reports in the US, SIA standards in the UK. Not as a PDF export. As a digitally-signed, machine-readable evidence package that the certifying authority could ingest directly. The tools that treated compliance as a report generation feature are dead or pivoting. The tools that made simulation output *the artifact of record* are winning.

**BIM/IFC round-trip is table stakes.**
By mid-2027, every enterprise prospect is asking "can I import from Revit." The consultants who were doing CAD-to-DXF-to-PDF gymnastics to generate floor plans switched workflows entirely. Any tool without native IFC import — with room metadata, door/window semantics, and wall material inference — lost the enterprise deals to competitors who had it. SentinelTwin had BVH raycasting which was excellent for simulation accuracy; the gap was the upstream data pipeline. The teams that solved "import a live BIM model and have the simulation inherit material properties and access semantics automatically" closed dramatically larger contracts.

**Collaborative, multi-stakeholder review sessions.**
Security design is not a one-person job. By 2027 the tools that won added a collaborative review mode — real-time shared session where the architect, the security integrator, and the building owner could all annotate the simulation simultaneously, leave threaded comments on specific threat corridors, and sign off on coverage decisions. Think Figma multiplayer for threat modeling. This was not obvious in 2026 because the incumbent workflow was "consultant makes PDF, emails it to client." The first tool to make that process live and shared created a defensible product surface that was very hard to replicate.

**Simulation-to-procurement workflow.**
Camera placement outputs became BOMs. Every serious tool now exports directly to integrator procurement systems — a simulated camera placement becomes a line-item quote with specific SKUs from the catalog of Axis, Hanwha, Bosch, Motorola Solutions. This happened faster than anyone predicted because the integrators funded it. They saw margin opportunity. Any tool that added direct SKU linkage to simulation output got co-sell agreements and channel distribution. The tools that stayed "hardware-agnostic" had principles but no pipeline.

**AI-native counterfactual explanation, not just generation.**
The AI command bar was table stakes by 2027. But the tools that stuck had a specific feature: when the simulation found a vulnerability, the AI didn't just describe it — it generated a ranked counterfactual ("if you move camera 3 two meters north, this threat corridor closes without affecting coverage elsewhere, and here's the updated simulation proving it"). The delta had to be explained in simulation-verified terms, not just language model confidence. The teams that kept AI as the interface and geometry as the authority got this right. The teams that let LLMs output coverage numbers directly had a bad year with enterprise customers who tried to validate results.

---

## 2. The integration that became table stakes nobody was focused on in 2026

**Access Control System data as simulation input — not just camera systems.**

Everyone in 2026 was thinking about VMS (Genetec, Milestone). The overlooked integration was the ACS layer: Lenel, Honeywell Pro-Watch, CCURE, Brivo. Here is why this mattered: the adversarial path simulation (which SentinelTwin had and competitors didn't) became dramatically more powerful when it could consume real door-access policies. You don't just simulate the geometry. You simulate the access rules. Door A is only unlocked during business hours. Badge group 4 can enter through the rear corridor. A Dijkstra path that respects the live access policy map finds completely different optimal intruder routes than one that treats all doors as equal. The tools that made adversarial simulation policy-aware dominated the high-security verticals — data centers, pharma, government — where policy complexity is the actual threat surface.

Nobody was building this in 2026. It was treated as a future integration. It turned out to be the fastest path to enterprise contracts.

---

## 3. The customer segment that turned out to be highest-value

**Facility owners, not security consultants.**

This was the mistake almost everyone made, including early SentinelTwin positioning. Security consultants are the obvious early customer — they understand the product, they have the floor plans, they're in the workflow. They're also fragmented, price-sensitive, and they resell their expertise, not software. They have limited interest in tools that make their clients self-sufficient.

The highest-value segment turned out to be **enterprise facility owners with owned security programs** — Fortune 500 corporate real estate, large healthcare networks, higher education, data center operators. These buyers have internal security teams, multi-site portfolios, and a real problem: they can't audit their own coverage quality consistently across 200 locations. They don't want a one-off simulation report. They want a **continuous coverage monitoring platform** tied to their existing hardware inventory.

The key insight: these customers don't need a better consultant tool. They need a system of record for physical security posture that updates when the building changes, when cameras go offline, when access policies are modified. Annual contract, per-site licensing, IT-buyer procurement. Average contract sizes 5–10x what consultants paid.

SentinelTwin's temporal simulation and governance spine were directly relevant to this segment. The mistake was not leading with it.

---

## 4. What every early entrant got wrong

**They solved the wrong fidelity problem.**

Everyone optimized for "make the simulation more accurate." Better raycasting, better DORI models, better adversarial pathing. These were technically correct priorities. The field solved simulation fidelity pretty fast, and then discovered that customers don't buy fidelity. They buy confidence and defensibility.

The tools that won made it easy to **explain why** a coverage decision was made, to **audit it later**, and to **defend it to a third party**. The simulation log — every parameter, every assumption, every camera spec, every wall material coefficient, timestamped and signed — turned out to be the actual product for the enterprise and insurer segments. Customers didn't ask "is this simulation accurate." They asked "if there's an incident and I'm in litigation, can I prove my coverage decisions were reasonable at the time I made them."

Simulation provenance was the product. Most early entrants treated it as a nice-to-have audit trail.

**They underinvested in the import pipeline.**

Getting real floor plans into a simulation tool was painful everywhere. Every team spent time on the rendering and AI layer and underinvested in "how do you get a 180-page Revit model from a building architect into a working simulation." The teams that solved import depth — semantic wall materials, door/window properties, room labels, furniture as occlusion primitives — closed the deals the others lost.

**They shipped AI features before the simulation was trustworthy.**

This killed several products. They showed AI-generated coverage recommendations, got impressive demos, won pilots, and then failed enterprise due diligence when buyers noticed the AI could produce different recommendations on the same scene with slightly different prompts. Enterprise customers do not accept non-determinism in physical security decisions. The tools that kept AI strictly as a natural language interface to a deterministic engine survived. The tools that let AI touch the output numbers did not.

SentinelTwin was architecturally correct here from the start. This was actually a competitive advantage that wasn't fully recognized in the early positioning.

---

## 5. The leapfrog move

**Make the simulation the AHJ submission artifact.**

AHJ = Authority Having Jurisdiction. Every building project requires fire marshal sign-off, local building permit approval, sometimes insurance sign-off on physical security design. These processes are currently done via PDFs, phone calls, and manual review by inspectors who have inconsistent standards and no computational tools.

The leapfrog move is to work directly with AHJ bodies — city permitting offices, insurance underwriters, large property insurers — to make simulation output a recognized, machine-readable evidence format they accept as part of the approval workflow. Not an export. An API endpoint that AHJ reviewers query directly.

This is a regulatory standards play, not a product feature. It takes longer than any engineering sprint. It requires lobbying, standards body participation, and probably a partnership with one of the large insurance carriers. But the team that achieves it owns the category for a decade because every competitor has to certify against the same standard, and the company that helped write the standard has a structural advantage in passing it.

This bypasses the entire "build better simulation → sell to consultants → get acquired by Genetec" arc and instead creates a new category of regulated software. Think of what happened to e-signature after DocuSign partnered with state courts for e-filing. Same category shift.

---

## 6. Time-horizon pass

### 6 months: Rough edges fixed — what competence looks like

The basic simulation is solid. The adversarial path is genuinely novel and defensible. The six-month version has:
- A reliable IFC/DXF import pipeline that doesn't require 3 hours of manual cleanup
- AI counterfactuals that show simulation-verified deltas ("moving camera 3 closes threat corridor B — here's the re-run proving it")
- A proper governance export — one-click package with timestamped simulation parameters, camera specs used, analyst decisions, signed PDF plus JSON

That's the competent product. It closes consulting deals and gets used in production. It is not a category-defining company yet.

### 12 months: Pattern recognition — what smart teams converge on

The consultants who adopted early are now reselling it to their enterprise clients as part of their deliverable package. The enterprise clients start asking "can we run this ourselves." Smart teams launch a **portfolio management tier** — you can have 50 sites, run automated coverage health checks against your own standards, get alerted when a site's adversarial exposure score changes because a camera went offline. MRR starts to compound.

The ACS integration (door policy → adversarial pathing) ships at month 10–12. Teams that shipped it close the first data center and government contracts.

The simulation becomes the source of truth for **post-incident review**: after a security event, the operator loads the incident timestamp, replays what the camera coverage and temporal vulnerability profile looked like at that exact moment. Insurers notice.

### 24 months: Table stakes in a mature market

Every serious tool has:
- BIM/IFC round-trip
- ACS policy-aware adversarial simulation
- Collaborative review sessions
- Procurement BOM export with manufacturer SKU linkage
- Simulation provenance ledger with legal defensibility
- Portfolio-level continuous coverage monitoring

At 24 months, differentiation shifts to vertical depth and regulatory integration. The generalist simulation layer is commoditizing. The winners are the ones who own a vertical — healthcare, data centers, government — and have deep workflow integrations into that vertical's existing systems.

### Leapfrog: bypass the roadmap entirely

Start the AHJ/insurer standards play at month 3, not month 36. It runs in parallel with product development and doesn't compete for engineering resources — it's a business development and policy effort. The first partnership with a major property insurer who agrees to reduce premiums based on simulation-verified coverage scores changes the entire value proposition and unlocks a distribution channel that no competitor can replicate quickly.

The leap is: don't wait until the product is mature to start the regulatory positioning. Start it immediately, because the process takes 18–24 months and you want to finish first.

---

## 7. Optionality and local maxima

**Keeps the most optionality open:**
Build the simulation provenance ledger to be genuinely standards-grade from day one. Don't treat it as an internal audit trail. Design it as an exportable, third-party-verifiable evidence artifact from the start. This costs almost nothing incrementally, and it is the foundation for every high-value path — insurance integration, AHJ submission, litigation support, enterprise CISO reporting. If you build a proprietary audit trail that's useful only within the product, you've closed the door on the paths that pay the most.

The temporal simulation is similarly high-optionality. It's a unique capability that becomes more valuable with every integration added (ACS policy, live camera health, real weather/lighting data). Invest here early and keep the interfaces clean.

**Local maxima to avoid:**

- **Optimizing for consultant UX.** It feels like the right customer because consultants understand the product. It's a local maximum. They are fragmented, price-capped, and have limited incentive to make clients self-sufficient. Consultants are a go-to-market channel, not the end customer.

- **Deep VMS integration before ACS integration.** Genetec and Milestone are obvious partners because they're the big names in physical security. But integrating with VMS gives you live camera feeds for playback and status. Integrating with ACS gives you policy-aware adversarial simulation — which is a novel capability multiplier. The ACS integration is less obvious and more valuable.

- **Building your own AI model.** Multiple early entrants tried to fine-tune or specialize an LLM for security domain knowledge. Wasted effort at this stage. The model capability available from frontier providers is already more than sufficient for the NL interface layer. The moat is the simulation engine and the data, not the model.

- **Treating SOAR integration as V2+.** SOAR playbook validation turned out to be a faster path to IT security budget owners than to physical security budget owners. The buyers who could spend $200K on software without a 12-month procurement cycle were enterprise security architects with unified physical/cyber mandates, and they were already thinking in playbooks. Arriving at that conversation with a physical simulation product that validated playbooks was a conversation-stopper in the right way.

---

## 8. Three strongest future-horizon ideas

### 1. PolicyPath
**Adversarial path simulation with live ACS policy awareness.**
The Dijkstra engine already finds minimum-exposure routes through geometry. PolicyPath ingests the live door-access policy map from the building's ACS and computes minimum-exposure routes that respect actual access rules. The intruder doesn't just avoid cameras — they navigate to a door they know will be unlocked at 2 AM because it's near a loading dock on a 24/7 schedule. PolicyPath makes adversarial simulation a living product that updates automatically as policy changes. For data centers, pharma, and government, this is not a feature request. It's the product.

### 2. CoverageAnchor
**Simulation provenance as a legally-defensible evidence artifact.**
CoverageAnchor is the governance module that turns simulation output into a chain-of-custody artifact for litigation, insurance underwriting, and regulatory submission. Every simulation run is cryptographically signed, timestamped, and locked to the camera specs, floor plan version, and analyst identity used at the time. Post-incident, an attorney or insurer can pull up the CoverageAnchor record for a specific site on a specific date and verify exactly what the operator knew about coverage quality and when they knew it. The first carrier partnership that uses CoverageAnchor scores to price premiums changes the business model entirely.

### 3. PortfolioSentinel
**Continuous coverage health monitoring across a multi-site enterprise estate.**
PortfolioSentinel treats a 200-location enterprise portfolio the way a security operations center treats a network. It runs automated coverage health checks — adversarial exposure score, DORI compliance per zone, temporal vulnerability windows, camera uptime — across every site on a defined schedule, surfaces anomalies, and pushes alerts when a site's posture degrades. The enterprise CISO gets a single pane of glass showing physical security posture, not a folder full of consultant PDFs. Priced per site per year. Annual contract. MRR that compounds as the portfolio grows. This is the product that gets acquired by Microsoft Defender or Palo Alto Networks, not by Genetec.

---

## The thing most people miss about this:

**The value is not the simulation. The value is the decision record.**

The security industry has a massive latent problem nobody talks about openly: when a physical security incident occurs, the first thing that happens is a liability fight over what the building owner knew about coverage quality and when. Today, there is almost no defensible documentation. Decisions were made verbally, the consultant sent a PDF report, the PDF is in someone's email inbox, and nobody can reconstruct what the coverage model showed at the time the camera placement was approved.

The market is not buying a better simulation tool. The highest-value buyers are buying a system that makes their past decisions defensible. The simulation is the mechanism. The signed, timestamped, auditable decision record is the product. The tools that understood this in 2026 built their entire architecture around it. The tools that understood it as an afterthought lost the enterprise market to the ones that did.

Physical security simulation is not a visualization business. It is a decision intelligence and accountability business. The sooner the product is designed around that truth — and positioned around that truth — the faster you reach the segment that pays for it.

---

*Memo ends. Timestamp: December 2027.*
