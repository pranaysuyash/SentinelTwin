# SentinelTwin — Outsider Analysis
*Wide-Open Brainstorm: What the Builders Are Blind To*

---

## Opening: The Frame That Isn't Universal

SentinelTwin is built around a seductive premise: that physical security work is fundamentally a *modeling problem*, and that the gap between bad security and good security is primarily one of *visualization and optimization*. That premise is parochial in ways the team hasn't fully examined.

Let's go through this systematically.

---

## 1. What Assumptions Does SentinelTwin Treat as Universal That Are Actually Parochial?

**Assumption 1: The site can be modeled.**

The product presupposes a floor plan exists, is accurate, and can be imported. In the United States, the EU, and parts of Australia, this is often true. A commercial building was built under code, has CAD drawings, maybe a BIM file.

Now go to Lagos. Mumbai. Manila. Jakarta. Cairo. A substantial fraction of commercial real estate in high-growth economies was built informally, renovated repeatedly without permits, and has no accurate floor plan anywhere. The building is the floor plan. The security consultant in these markets — and there are many of them, because crime rates and guard-heavy security cultures are common — will spend two hours with a laser measure and a notebook before anything digital happens. SentinelTwin's import flow is designed for a world where the data pre-exists. That world is a minority of the global market.

**Assumption 2: DORI scoring is a meaningful currency.**

DORI (Detection, Observation, Recognition, Identification) is a European standard, primarily British and Dutch in origin. It has formal status in BS EN 62676-4. Security consultants in the UK, Netherlands, Germany, and Scandinavia will immediately understand it. Consultants in the US will mostly not — they think in terms of PSA standards, ASIS guidelines, and loss-prevention ROI framing. Consultants in Japan will have a completely different framework derived from National Police Agency guidance. In Brazil, the frame is almost entirely around loss prevention for retail and logistics. DORI is not a universal metric — it's a regional technical dialect that has been mistaken for universal because the founders learned it.

**Assumption 3: The consultant is the buyer and the consultant is the operator.**

The product seems to assume one human — a skilled consultant — who also happens to have the technical patience to learn a 3D scene editor. In reality, at most consultancies of any size, assessment and reporting are done by different people. The junior analyst does site walks, the senior consultant writes reports. The sales engineer demos the software. None of these people are the same person. The UX design for a solo expert user may be actively hostile to how actual firms work.

**Assumption 4: Optimization is the bottleneck.**

The entire product is about finding gaps. DORI gaps. Coverage gaps. Adversarial path gaps. This assumes that clients don't already know roughly where the problems are. Most clients — a retail chain, a warehouse operator, a hospital — already know the loading dock has a blind spot. They've had incidents there. What they need isn't discovery; it's defensible documentation and a quote for fixing it. The optimization problem is largely solved in the head of any experienced consultant before they touch software. What they're actually paying for is the artifact: the report that goes to the client. SentinelTwin seems to put 80% of its effort into the tool that produces 20% of the value.

---

## 2. What Mental Model Does the Product Assume That Most Actual Buyers Don't Have?

SentinelTwin assumes the buyer thinks in spatial simulation. They think about coverage cones, raycasting, detection probability as a function of geometry.

Most facilities managers think in incidents and responses. "The last break-in came through the east stairwell." "We had a tailgating incident at reception three times last year." Their mental model is event-driven, not geometry-driven. They don't visualize cameras as coverage cones; they visualize cameras as "the thing that let us identify the guy who stole the laptop."

The cybersecurity-adjacent buyer thinks in attack surfaces and threat models. They would be more comfortable with language like "attack path enumeration" than "adversarial path simulation." They're also immediately suspicious of deterministic geometry tools because they know that real attackers are adaptive, not deterministic, and that the scariest attack isn't the one that minimizes detection — it's the one that exploits a human process failure the geometry can't see.

The insurance buyer thinks in loss history, replacement cost, and liability. They don't care about DORI scores. They care about whether the system meets the standard of care that their underwriting model demands. The product would need to output to their actuarial language, not to a visual simulation, to be relevant to them.

The government and critical infrastructure buyer thinks in compliance checklists. Does this site meet NERC CIP? Does it meet HSPD-12? Is the camera system certified? Simulation is irrelevant to them unless it directly maps to a checkbox they need to fill.

These aren't edge cases. These are the actual buying personas.

---

## 3. What Would a Facilities Manager Without Security Specialization Need?

A facilities manager is usually a generalist with responsibility for HVAC, maintenance, vendor contracts, building access, and occasionally security. They do not know what DORI means. They don't think about cameras as geometric sensors. They think about cameras as "the things that the guard watches" or "the things we submit to insurance."

For this person to use SentinelTwin without a three-day onboarding, the product would need to:

- Accept a rough hand-drawn room sketch and build the model from it, not require a precise CAD import
- Translate all outputs into plain language: "This hallway has a blind spot from 2pm to 6pm when the sun comes through the west window" not "temporal DORI degradation in zone 4B between 14:00-18:00 hours"
- Tell them what to do, not just what the gaps are. A gap without a remediation recommendation is just anxiety.
- Cost no more than a few hundred dollars per audit, because facilities managers have tiny discretionary budgets
- Work on an iPad in the field, because they're never at a desk

Right now the product appears to be none of these things. It is a simulation environment for someone who already thinks like an engineer. The facilities manager who makes the buy-or-don't-buy decision for a mid-sized office building is not that person.

---

## 4. What Would a Cybersecurity Professional Assume?

**Excited response:** "Finally someone is doing adversarial simulation for physical security the way we do threat modeling for networks. This is basically a physical-layer attack surface tool. We could integrate this with access control logs, identity systems, intrusion detection — this could be the physical layer in a unified security operations picture."

**Dismissive response:** "This is a deterministic geometry toy. Real adversaries don't optimize paths — they social-engineer the front desk. The actual threat model for any building I've assessed is 80% people and process, 20% technology and coverage. A raycasting engine tells me nothing about whether the guard is playing on their phone or whether the badge system logs to a SIEM that anyone actually reads. This will give organizations false confidence that the geometry is solved while ignoring the actual attack surface."

The dismissive response is more likely from a senior practitioner, and they're not entirely wrong. The excited response is more likely from someone who wants to build integrations, not pay for audits. Neither is the target buyer. The product needs to be clear about what it explicitly does not solve, or the cybersecurity community — who have loud voices — will dismiss it publicly and damage the brand in adjacent markets.

---

## 5. What Pricing or Distribution Assumption Might Be Fundamentally Wrong?

The implicit model appears to be: sell to security consulting firms, per-project or per-seat. This has several problems.

**Problem A: The consulting firm bottleneck.**

Security consulting firms are small, conservative, and relationship-driven. A two-person consultancy that does 30 site audits a year doesn't have a software procurement process. They buy tools the way a plumber buys a new pipe wrench: when the old one breaks or a trade magazine runs a feature. The sales cycle to consulting firms is measured in years, not months. There is no inbound motion. There is no bottom-up SaaS. The founder needs to be at IFSEC, at ASIS, at every regional security conference, shaking hands.

**Problem B: Selling at the wrong end of the value chain.**

The security consultant doesn't retain the risk. The client retains the risk. The client — the retailer, the hospital, the logistics company — is the one who pays if a break-in happens. They are the ones with budget to spend on liability reduction. Selling a tool to consultants when the end client has the larger budget and the higher pain is selling at the wrong end. What if SentinelTwin sold directly to facilities directors and risk managers, with consultants as an implementation channel? The per-seat economics look completely different when the buyer is a 200-location retail chain versus a three-person consultancy.

**Problem C: Annual subscription may be backwards.**

Site audits are one-time events. A consultant does a site audit, delivers a report, and doesn't return for two years. A subscription model doesn't match the workflow. Per-report or per-site pricing may have lower friction and faster conversion, even if total ACV is lower. The product needs to be honest about whether it's a workflow tool (subscription makes sense) or an audit production tool (per-use makes sense).

---

## 6. What Non-Obvious Buyer Segment Would Find This Immediately Useful Without a Sales Pitch?

**Loss Prevention for Large Retail Chains.**

Retail loss prevention is a massive, underserved market that has its own professional association (RILA), its own conferences, its own KPIs (shrink rate), and enormous budgets. A VP of Loss Prevention at a 500-store chain needs to audit their store configurations systematically, not site by site by consultant. They want a tool that lets their regional LP managers run a standardized camera coverage assessment from the floor plan and flag which stores need a site visit. That's a workflow SentinelTwin could serve directly, at scale, with zero traditional security consultant involvement.

**Real Estate Investment Trusts and Property Management Companies.**

A commercial REIT that owns 300 office buildings needs to assess security posture across the portfolio at the time of acquisition due diligence. Right now this is done manually by walking buildings or by hiring a consulting firm. A tool that lets a junior analyst build a rough model and score coverage gaps in two hours per building — before buying — is immediately valuable. The buyer here is the acquisitions or risk team, not a security professional at all.

**Law Enforcement CPTED Units.**

Police departments that do Crime Prevention Through Environmental Design assessments for businesses and schools would find this immediately useful. They already have the conceptual framework — sightlines, natural surveillance, territorial reinforcement. They don't have a digital tool. The budget path is a grant or a departmental procurement rather than a SaaS subscription, but the need is real and the channel is underexplored.

---

## 7. What Regulatory Environment Creates a Natural Forcing Function Outside GDPR?

**Singapore's Safe Management Measures framework** explicitly requires documented physical security assessments for certain regulated industries. The Singaporean government is aggressive about requiring documented evidence of security planning, not just implemented controls. A tool that produces a defensible, auditable simulation report maps directly to this requirement.

**Japan's NPA guidance on physical security for information facilities** creates a documented assessment requirement for data center operators and financial institutions. Japan also has an unusually high cultural tolerance for procedural documentation — a detailed simulation report fits the Japanese compliance aesthetic better than it fits American or British practice.

**The Gulf Cooperation Council** — UAE, Saudi Arabia, Qatar — has mandatory security consulting requirements for certain infrastructure categories under their Critical National Information Infrastructure frameworks. The UAE in particular has a fast-growing security consulting market, high technology adoption willingness, and a government that actively requires documented security assessments for regulated facilities. The English-language tooling gap in this market is real.

**Australia's Security of Critical Infrastructure Act 2018, amended in 2022,** significantly expanded mandatory security assessment requirements to eleven sectors. Australian critical infrastructure operators now need documented physical security assessments with a frequency and rigor that didn't exist three years ago. This is a market that is actively being created by legislation right now, and the tooling gap is wide open.

---

## 8. What Cultural Assumption About How Security Audits Work Is Being Baked In?

The product assumes that a security audit is conducted by an independent third-party consultant, paid for by the client, resulting in a formal written report, delivered as a discrete bounded engagement. This is the British, American, and Australian consulting model. It is not universal.

In Germany and Austria, security assessments are frequently conducted in-house by a Sicherheitsbeauftragter — a security officer who is an employee, not a consultant. They don't produce external reports; they produce internal documentation. The consulting engagement model barely exists for most of this market.

In Japan, security assessments are often conducted by the security guard company as part of their service contract. The guard company's consultant comes in, looks around, and makes recommendations as a relationship-maintenance activity, not a paid engagement. There is no independent consulting market of the kind SentinelTwin targets.

In Latin America — Brazil, Mexico, Colombia — physical security is heavily dominated by guard-force providers who bundle assessment into their guard contract sales process. The consultant-as-independent-advisor model is nascent and limited to high-end corporate and banking clients.

In India, the market is similarly guard-force dominant, with a thin layer of international consulting firms serving multinationals. Domestic Indian businesses typically rely on the Central Industrial Security Force or state police for guidance rather than private consultants.

The consulting model that SentinelTwin is designed around is essentially a UK, US, Australian phenomenon. It's a real market, but it's not the global market, and the product framing needs to be honest about that scope.

---

## 9. Three Strongest Outsider Challenges

### Challenge 1: "The Map Is Not the Territory" — Fatima Al-Rashidi, Facilities Director, Dubai

"You're building a tool that models a building. But a building's security isn't its geometry — it's its people, its processes, its shift changes, its contractor relationships, its culture. I've managed facilities in five countries. The building that looks worst on your simulation — the one with the most coverage gaps — has had zero incidents for eight years because the head of security has been there for twenty years and knows every face. The building that would score perfectly on your tool had a major theft because we used a new cleaning contractor and they didn't get properly vetted. Your simulation cannot model any of this. So what exactly are you selling me?"

This challenge is not dismissible. The product needs a crisp answer about what it measures and what it explicitly does not claim to measure. "We model geometric coverage, not operational effectiveness" is a defensible answer. But if the product's marketing implies it makes buildings more secure — rather than more geometrically optimized — it's making a claim it cannot support.

### Challenge 2: "Another Tool That Makes Consultants Feel Smart" — Marcus Webb, Head of Insurance Underwriting, London

"I've been writing commercial property and liability policies for twenty years. I've seen consultants bring me reports from every flavor of assessment tool. I do not care about DORI scores. I care about three things: has this building been certified to a recognized standard, has the client had claims history that suggests operational failures rather than equipment gaps, and what's the cost to remediate the gaps. A beautiful simulation report that doesn't map to any of the standards my actuarial team uses is a beautiful PDF that goes into a filing cabinet. If you want insurers to create a forcing function for this product — which would be enormously powerful for your distribution — you need to speak our language, not your own."

This challenge points to a specific product gap: the output formats. Reports that don't map to insurance underwriting criteria, HSE requirements, or specific security standards are aesthetically impressive but commercially inert in the insurance channel. The product's output layer may need entirely different templates for different audiences.

### Challenge 3: "You've Solved the Easy Part" — David Osei, Security Consultant, Accra

"I've done hundreds of site assessments across West Africa. My biggest problem is not that I can't optimize camera placement — I can do that in my head from twenty years of experience. My biggest problem is that my clients can't implement recommendations because the equipment doesn't get imported reliably, the installation contractors are unreliable, and the power grid means cameras go down constantly. My second biggest problem is that I can't charge enough for my time because my clients don't value paper reports. What I actually need is a tool that helps me communicate the business case to a CFO who thinks security is a cost center, in fifteen minutes, without requiring them to understand anything technical. Your tool seems to be designed to impress other security consultants, not to help me convince resistant clients."

This challenge points to a market positioning problem. The product may be designed to demonstrate expertise rather than to close deals. The most powerful version of a security audit tool is one that makes it easier to sell the remediation, not just easier to document the gap.

---

## The Thing Most People Miss About This

The thing most people miss about this: The team is assuming that the security consultant's core workflow problem is technical — that they lack a precise analytical tool — when the actual core workflow problem is commercial: they struggle to communicate technical findings to non-technical clients in a way that justifies the remediation budget.

A raycasting engine and DORI scoring don't solve that problem. A beautifully rendered, plain-language report that says "your loading dock is unprotected for four hours every night and here's what that looks like on a risk-adjusted basis" and then produces a defensible PDF that a CFO can show a board — that solves the problem. The simulation is a means to that end. If the product leads with the simulation, it's leading with the thing consultants find interesting rather than the thing clients will pay for.

The team is probably full of people who find the raycasting engine genuinely exciting. That's the tell. The buyer finds the raycasting engine irrelevant. The buyer finds the signed report with the logo and the liability paragraph at the bottom to be the thing they're paying for.

---

*End of outsider analysis.*
