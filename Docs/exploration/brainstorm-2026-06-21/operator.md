# OPERATOR ANALYSIS: SentinelTwin Consultant Workflow
## Wide-Open Brainstorm Session — Role: Operator
### Date: 2026-06-21

---

## 1. FULL CONSULTANT WORKFLOW END-TO-END

### Phase 0: Sales / Scoping (Before First Site Visit)
1. Client calls with a problem: "We had a theft incident," or "Insurance is requiring a security audit," or "We're moving to a new facility."
2. Consultant quotes scope: number of zones, hours, deliverable format (report for insurer, remediation plan, both).
3. Consultant asks for floor plan, address, and any existing camera specs.
4. Consultant creates a workspace shell in SentinelTwin, drops in whatever floor plan exists, notes open questions.

**Current friction:** This pre-visit setup is entirely manual. No workspace template matched to client type (retail vs. warehouse vs. office). No prompt that says "you said retail — here are the 8 zones that typically matter."

### Phase 1: Pre-Visit Intelligence
5. Consultant uploads floor plan → reviews AI-generated draft scene.
6. Marks known camera positions from client-supplied camera inventory (if any).
7. Runs preliminary simulation to see obvious blind spots before setting foot on site.
8. Generates a field checklist: "These 3 zones have zero coverage — walk them specifically. These 2 camera positions look wrong for the space — verify mounting height."

**Current friction:** The field checklist does not exist as a product output. The consultant has to mentally translate simulation gaps into visit tasks.

### Phase 2: Site Visit
9. Consultant arrives on site with tablet/phone. Site contact walks them through.
10. Consultant photographs rooms, marks actual camera positions, notes mounting heights, notes obstructions not on floor plan (shelving, columns, partitions).
11. Notes guard routes, access control points, lighting conditions.
12. Takes reference frame photos of camera feeds for verification.

**Current friction:** The site visit is disconnected from the product. There is no "field mode" — no mobile-optimized capture flow, no way to mark "this is what I actually saw" versus "this is what the floor plan says."

### Phase 3: Scene Creation / Refinement
13. Back at desk, consultant refines the draft scene: moves cameras to actual positions, adjusts wall segments for partitions not on the plan, adds obstructions found on site.
14. Sets lighting conditions based on site visit notes (schedule editor).
15. Runs full simulation.
16. Identifies failure zones. Runs adversarial path simulation to find the worst-case intruder route.
17. Runs temporal profile to find overnight/weekend vulnerability windows.

**Current friction:** Step 13 is the most time-consuming step and the one where errors compound. Moving 8 cameras to their real positions takes 20-40 minutes. There is no "bulk position correction" flow.

### Phase 4: Counterfactual / Fix Analysis
18. Consultant identifies the 2-3 cheapest fixes: reposition camera X to cover zone Y, add one camera at entry Z, replace analog camera with IR-capable unit.
19. Uses compare mode to show before/after coverage delta.
20. Prices fixes using client's existing camera model or specifies a new model requirement.
21. Prioritizes fixes by cost-impact ratio.

**Current friction:** Pricing is entirely out of band. Compare mode shows the coverage delta but there is no cost field on a camera node, no "cheapest fix" ranker, no output that says "repositioning camera 3 is free and buys you 12% coverage improvement."

### Phase 5: Report Generation
22. Generates multi-audience report: executive summary for security director, technical appendix for IT/facilities, compliance checklist for insurer/legal.
23. Exports PDF. Annotates with photos from site visit.
24. Delivers to client.

**Current friction:** Report generation is good but generic. The report does not automatically match the client's stated purpose (insurance audit vs. design review vs. incident investigation). Photos from the site visit cannot be attached inside the product.

### Phase 6: Client Review / Revisions
25. Client reviews report. Asks "what if we add a camera here?" or "our budget is $5K — what does that buy us?"
26. Consultant re-opens workspace, makes the change, re-runs simulation, regenerates report section.
27. Second delivery.

**Current friction:** The revision loop is a full product session. There is no "client review link" that lets a client annotate a read-only version. Revision tracking is manual.

### Phase 7: Ongoing / Return Visit
28. Client implements recommended fixes.
29. Consultant does a verification visit (optional, paid add-on).
30. One year later: client moves partitions, changes operating hours, gets a new insurer, or has another incident. Calls consultant again.

---

## 2. FIVE MICRO-DECISIONS THE PRODUCT MUST MAKE EASIER

### Micro-decision 1: "Where does my camera actually cover from that mount point?"
The consultant places a camera and has to manually set field of view, range, height, and orientation to match the real device. That is 4-6 knob adjustments per camera. With 12 cameras on site, that is 50-70 individual value entries. The product should let a consultant pick a camera model from a library and position it once. Manufacturer specs auto-populate the optics. Product then suggests the best aim direction given the room geometry.

### Micro-decision 2: "Which zone failure is actually the most dangerous?"
After simulation runs, there can be 4-6 failing zones. The product shows them as equal-weight failures. The product should score zones by consequence (entry point proximity, historical incident type, asset value) and surface the #1 risk finding first without the consultant having to read every zone card.

### Micro-decision 3: "What is the cheapest fix?"
Compare mode shows what a fix does but not what it costs or how it ranks against other fixes. The consultant does the cost math offline. The product should expose a fix-ranker: "These 3 remediations are free (reposition/reorient). These 2 cost $800-$1,200 each. This one requires new hardware at $3,500. Ranked by coverage gain per dollar: reposition camera 3 first."

### Micro-decision 4: "Is this good enough for the insurer?"
Insurance underwriters and ESRM frameworks have specific checklists (UL 2050, ISO 31000, SOC 2 physical). The consultant currently has to manually map simulation results to the applicable standard. The product should let the consultant select a compliance profile on intake and auto-map findings to that standard's checklist.

### Micro-decision 5: "What changed since I was last here?"
When a client returns 12 months later, the consultant has to figure out what has changed in the physical space, in the threat environment, in the compliance requirements. The product has provenance/timeline features but no "audit delta" — no view that says "here is what changed between your last audit and today, and here is what that change means for your coverage score."

---

## 3. FRICTION POINTS WHERE THE PRODUCT WILL LOSE USERS

### Friction 1: Time-to-first-useful-output is too long
A security consultant new to the product will spend 30-45 minutes on data entry before seeing any simulation output that means something to them. The product needs a path where a consultant can upload a floor plan, confirm the room count, and see a preliminary simulation in under 5 minutes.

### Friction 2: Camera placement is a precision task on a medium-resolution canvas
Moving cameras to exact real-world positions requires pixel-precision dragging on a 2D canvas. Consultants will estimate rather than be precise, which makes the simulation meaningless. The product needs numeric coordinate input or snap-to-grid matching real measurement conventions (meters from nearest wall/corner).

### Friction 3: The report requires a product expert to interpret
"Zone 3: 28% DORI Identify coverage at 2.8 PPM" means nothing to an HR director, CFO, or insurer. The executive summary needs plain-language translation: not "DORI Identify at 2.8 PPM" but "Camera 4 cannot clearly identify a person standing at the cash register during nighttime operation."

### Friction 4: No mobile story for the site visit
The site visit is the moment of maximum data collection and the product is entirely absent from it. A consultant spending 2 hours on site with no product support will capture disorganized notes that require 90 minutes of cleanup to translate into a scene. This is the single biggest time sink and the product does not touch it.

### Friction 5: The AI command bar has no memory of the site context
The AI command bar is useful for one-off queries but has no context about the consultant's actual intent: who the client is, what the audit scope is, what standard applies, what the budget ceiling is. Without that context, the AI gives generic answers. A consultant who has to re-explain client context every time will stop using it.

---

## 4. WORKFLOW SHORTCUTS THAT CUT TIME-ON-TASK BY 50%

1. **Camera model library with auto-spec populate.** Consultant picks "Hikvision DS-2CD2143G2-I" from a dropdown and the camera node auto-populates focal length, horizontal FoV, max IR range, max day range, resolution. Eliminates 6 manual entries per camera. On a 12-camera site: saves ~30 min.

2. **Field-to-scene voice/photo log.** On mobile: consultant speaks "camera mount, 3 meters high, southeast corner, Hikvision DS-2CD2143G2-I, aimed at entry." Product transcribes and queues the placement for desktop review. Eliminates the manual re-entry step after site visit.

3. **Compliance profile selector on intake.** Consultant picks "Insurance Audit — UL 2050" at intake. Product automatically weights zones, selects the right report template, and maps findings to the applicable checklist. Eliminates 45 minutes of manual mapping.

4. **Fix-ranker as a first-class panel.** One-click "Show Cheapest Fixes" generates a ranked list of remediations sorted by coverage-gain-per-dollar. Each fix shows: type (reposition/reorient/add), camera affected, zone gained, estimated cost range. Eliminates offline cost analysis.

5. **Client review link (read-only shareable).** Consultant sends client a link to a read-only version of the scene and report with annotation support. Client drops pins and asks questions without a synchronous call. Eliminates the revision loop session for 80% of change requests.

6. **One-click "update to current conditions."** When reopening a site from 12 months ago, product prompts: "What has changed since last audit?" Consultant answers 3-5 questions (new partitions? same cameras? hours changed?). Product generates a delta scene and re-runs simulation.

7. **Smart default zone classification.** When a consultant imports a retail floor plan, product suggests: "This area near the entrance is likely an Entry zone. This walled enclosure is likely a Cash Handling zone. Confirm or relabel." Eliminates manual zone drawing for standard layouts.

---

## 5. WHAT "VERSION 2 OF A SITE TWIN" LOOKS LIKE

A client returns 12 months later. Three things have changed:
- They added a partition wall separating two zones.
- They extended operating hours to 11pm (previously 9pm).
- Their insurer changed and the new insurer requires ISO 31000 compliance mapping.

Version 2 is not a new scene — it is a delta on top of version 1.

1. Consultant re-opens the v1 site twin. It shows "Last audited: 2025-06-10" banner.
2. Consultant runs the "What changed?" intake flow: marks the new partition (drag one wall segment), updates operating hours (2 fields), switches compliance profile to ISO 31000.
3. Product re-runs simulation. Shows diff: "Coverage in Zone 4 dropped from 78% to 61% due to new partition. Vulnerability window extended by 2 hours due to new operating schedule. 3 additional ISO 31000 checklist items now fail."
4. Consultant generates a "Re-audit Report" that includes the diff summary, current state, and updated remediation list.

The site twin is not a snapshot — it is a living model. The value of version 2 is that the marginal cost of a re-audit is 90% lower because the first scene already exists. The consultant only updates what changed.

Upsell: "Annual site twin maintenance" as a recurring engagement at lower cost than the original audit.

---

## 6. TIME HORIZON PASS

### 6 months: Most valuable operational shortcut
**Camera model library with auto-spec populate.**

This single feature removes the most per-session manual time (30-45 min per site) and improves simulation accuracy simultaneously. A camera placed with correct manufacturer specs produces a simulation result defensible to a client. A camera placed with estimated specs produces a result the consultant cannot stand behind in a report.

Implementation: build a JSON library of the 30 most common commercial camera models (Hikvision, Dahua, Axis, Hanwha, Bosch). Each entry: model name, horizontal FoV degrees, vertical FoV degrees, max day range (meters), max IR range (meters), resolution class. Wire into the camera inspector as a "Load from model library" button. This is a 2-3 day implementation task.

### 12 months: Integration that unlocks the biggest workflow gain
**Floor plan ingestion from CAD/BIM sources (PDF, DXF, IFC).**

The real floor plan workflow for commercial facilities is that the client has an AutoCAD DXF or a Revit IFC file. Those files contain exact wall coordinates, room labels, door positions, and sometimes existing camera schedules. Parsing a DXF into a SecurityScene turns a 40-minute manual editor session into a 5-minute review-and-confirm flow. It also makes the site twin defensible — geometry came from the architect's file, not from a consultant's hand-traced approximation.

### 24 months: The "SentinelTwin professional workflow" as a repeatable process
**Site Twin as a subscription asset — the consultant sells the twin, not just the report.**

The repeatable workflow:
1. Initial audit: consultant builds and delivers the first site twin (4-8 hours billable).
2. Annual maintenance: client pays a retainer for annual re-audit using the delta update flow (1-2 hours billable).
3. Incident response: when an incident occurs, consultant re-opens the twin, replays the adversarial path against the incident date/time, generates an incident analysis report for the insurer (1-2 hours billable).
4. Expansion: client adds a new facility, consultant clones the site twin template, adapts it to the new space (2-4 hours billable instead of starting from scratch).

The product enables a recurring revenue model for security consultants instead of a one-time project model.

The platform move: SentinelTwin offers a "client portal" where clients can view their live site twin between audits, see coverage scores update when they change operating hours, and see a notification when a new compliance requirement changes their pass/fail status. The consultant retains ownership. The client pays the consultant for the ongoing subscription. SentinelTwin is the rails.

### Leapfrog: What workflow assumption could we abandon entirely?
**Abandon: the consultant models the scene first, then runs simulation.**

Current assumption: complete scene → accurate simulation → accurate report. The scene is the bottleneck.

Leapfrog alternative: **start from adversarial questions, not from scene completion.**

"A shoplifter wants to walk out with $500 of merchandise undetected. Which route is viable right now, with the cameras as positioned today?" The product runs the adversarial path simulation on whatever partial scene exists — even one with only 4 cameras placed and 2 zones marked — and gives an answer. The consultant then refines the scene to improve confidence in that answer.

This is the difference between "complete the model, then get insights" and "get insights as you build the model." The second workflow is 3x faster and produces the same deliverable because the consultant stops adding detail when the key risk question is answered.

The product already has adversarial path simulation. The leapfrog is a UX shift: surface it as the primary entry point, not a feature buried in simulation results. "Ask a risk question. Build enough to answer it."

---

## 7. THREE STRONGEST WORKFLOW IDEAS

### Idea 1: The Field Capture Log
A mobile-first session mode where a consultant on-site logs camera observations as voice notes + photos. Each log entry captures: location (room/zone name spoken or selected), camera identifier, mount height, model, aim direction. The product queues these as "unplaced cameras" for desktop review. The site visit becomes 40 minutes of data collection instead of 2 hours.

Why it is the strongest: it attacks the highest-friction step in the entire workflow (the disconnected site visit) with a simple capture pattern that does not require the product to be fully functional in the field. The capture can be rough. The refinement happens at the desk.

### Idea 2: The Fix Ranker
A dedicated panel triggered after any simulation run: "Cheapest Fixes to Improve Your Score." The product runs N quick counterfactual simulations (reposition each camera through 8 candidate aim vectors, estimate adding one camera at each high-traffic node) and produces a ranked list: fix, cost category (free/low/medium), coverage gain, zone gained. The consultant picks from this list rather than manually probing what-if scenarios one at a time.

Why it is the strongest: it directly produces the deliverable the client actually wants ("what should I do and what does it cost?") instead of producing a simulation result that the consultant must manually interpret into recommendations.

### Idea 3: The Living Twin Subscription Flow
A structured workflow for annual re-audits. When a consultant opens a site twin that is more than 6 months old, the product prompts: "This site twin was last audited 8 months ago. Run a delta update?" The delta flow walks through: what changed in the physical space, what changed in operating schedule, what changed in compliance requirements. Output: a re-audit comparison report showing what changed, what the impact is, what the updated recommendations are.

Why it is the strongest: it converts a one-time transaction into a recurring engagement. The consultant's return visit cost is 80% lower than the original audit but the deliverable is still billable. It also makes the site twin the client's asset, not just a report — which increases retention.

---

## 8. THE THING MOST PEOPLE MISS ABOUT THIS

**The thing most people miss about this: the security consultant's real product is confidence, not coverage percentages.**

When a consultant hands a report to a client's security director or their insurer, the question is not "what is your DORI Identify coverage?" The question is: "Can you defend this security posture if something goes wrong?"

The report is not the deliverable — the defensibility is the deliverable.

This means the product's north star is not "make simulation more accurate" or "add more features." It is "make the consultant's position more defensible." Every feature should be evaluated against: does this help the consultant stand behind their recommendation under adversarial questioning?

The fix ranker matters not just because it saves time — it matters because the consultant can say "we evaluated 23 possible interventions, ranked them by coverage gain per dollar, and recommended the top 3." The camera model library matters not because it is faster — it matters because the consultant can say "specifications came from the manufacturer datasheet, not from estimates." The adversarial path matters not because it is novel — it matters because the consultant can say "we tested the scenario a real intruder would use."

Every feature that makes a simulation output more auditable, more traceable, more defensible against a challenge is worth more than a feature that adds a new analysis mode. The governance spine, the evidence ledger, the provenance system — these are not enterprise nice-to-haves. They are the core product for a consultant who might be deposed after a client incident.

Build for defensibility. Everything else is secondary.
