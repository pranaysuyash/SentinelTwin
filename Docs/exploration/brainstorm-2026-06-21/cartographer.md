# SentinelTwin — Cartographer's Map
## Wide-Open Brainstorm: Navigation, Spatial Systems, and Organizing Metaphors

---

## I. THE NAVIGATOR'S OVERVIEW (10,000 Feet)

The fundamental cartographic problem with physical security tools is that they collapse a four-dimensional object — space × time × adversary × confidence — into a flat two-dimensional camera plan. The user loses three dimensions the moment they open the tool.

SentinelTwin's highest-altitude view should be a **Security Posture Globe**: not a floor plan, not a dashboard, but a live compositional overview that answers one question at a glance: *where is this site vulnerable right now, and why?*

At 10,000 feet, the user sees:

**The Posture State**: A single composite health signal — not a score from 0-100 (too reductive) but a four-quadrant readout showing spatial coverage quality, temporal exposure windows, adversarial path penetration depth, and compliance conformance. Think of a ship's radar with four rings. Each ring pulses if that dimension has an active alert.

**The Risk Terrain**: The floor plan rendered as a topographic heat map, but the contours represent *adversarial exposure depth* — how far into the facility a determined intruder can penetrate before being detected. This is inverted from typical camera coverage maps. Standard maps ask "what do cameras see?" SentinelTwin asks "what does the adversary see that cameras don't?" The terrain rises where danger concentrates and falls where coverage is strong.

**The Time Axis**: A 24-hour band running along the bottom — thin like a film strip, not a full calendar. Dark bands are vulnerability windows. The current simulated time is marked with a vertical cursor. The user can drag this cursor left and right to time-travel the scene — every other element in the view responds: the heat map shifts, the adversarial path updates, the radar rings pulse differently.

**The Evidence Spine**: A thin vertical sidebar showing the provenance chain — the last N changes, who or what made them (human edit vs. AI proposal vs. sensor import), and the trust tier of the current report. This is the "instrument panel" that tells the user the simulation's epistemic state, not just its output.

At 10,000 feet, everything above is simultaneously visible. The user isn't navigating — they're orienting. They can see the whole thing without choosing what to look at first.

---

## II. THE WORKING ALTITUDE VIEWS (1,000 Feet)

At 1,000 feet, the product splits into four major **workspaces** — not tabs but spatial *modes*, each with a distinct ambient character. Switching modes feels like changing rooms, not clicking settings.

### Workspace 1: The Chart Room
*Primary scene editor + coverage simulation*

The Chart Room is where security architects build and modify the physical scene. It's dominated by the 3D/2D canvas but the canvas here is clearly an *instrument*, not just a viewport. Overlaid on the scene: the live DORI quality grid, wall geometry, zone delineations, and — always visible, never hidden — the adversarial path as a ghosted red trace across the floor. The adversarial path doesn't live in a separate tab. It lives here, haunting the scene like an X-ray of intent.

The left panel holds scene structure: cameras, walls, sensors, obstructions, zones. Organized not by type but by *security function* — detection layer, deterrence layer, delay layer, response layer. This forces the user to think in defense-in-depth, not equipment categories.

The right panel is the AI command bar and context panel. It shows the AI's last explanation alongside the current selected element's properties. The AI doesn't disappear when you're editing — it stays in peripheral vision commenting on what you're doing.

### Workspace 2: The Ops Bridge
*Temporal simulation + vulnerability window analysis*

The Ops Bridge is the workspace for understanding how security changes over time. The floor plan is here too, but it's subordinate — the primary view is a **temporal cross-section**: a 2D chart where the X-axis is the 24-hour clock and the Y-axis is a zonal breakdown of the facility. Each cell shows detection probability for that zone at that time. The result looks like a heat matrix that reads like sheet music: patterns, rhythms, gaps.

The Bridge also shows the **Shift Handoff Points** — moments in the 24-hour simulation where patrol coverage changes or sensor sensitivities change, and whether those transitions create vulnerability seams. These are shown as vertical orange lines cutting through the heat matrix.

The user can click any cell in the temporal matrix and the floor plan minimap (bottom-left corner) instantly highlights which spatial zone corresponds to that cell. Time and space are now linked — clicking a time-zone cell drills you to a place-and-moment. This bidirectional link is the thing that makes the temporal simulation feel like navigation rather than reporting.

### Workspace 3: The War Room
*Adversarial path simulation + counterfactual testing*

The War Room is deliberately darker in ambient tone — lower contrast, more tactical. Its primary view is an overhead floor plan with the Dijkstra minimum-exposure path rendered as a thick red trace, and the *shadow network* of alternative paths rendered as fainter traces behind it. The user can see not just the best adversarial route but the second and third best options — the fallback routes that activate if one path is blocked.

The War Room has a unique navigation mechanic: **The Adversary Cursor**. Like scrubbing through a video, the user can drag the adversary cursor along the path — at each point, the camera feeds panel on the right shows what each camera *would* see at that exact point in the intrusion. This creates the visceral experience of watching the intrusion unfold from the defender's perspective in real time. It's not a playback button — it's a scrubber. The difference matters: playback suggests passive watching; scrubbing implies active investigation.

At the top of the War Room: **The Counterfactual Bar** — a row of quick-add recommendations from the AI. Each recommendation is a button: "Add camera at column B-7" or "Close door in corridor 2." Clicking any button applies the change to a shadow copy of the scene and immediately re-runs the adversarial simulation. The main scene and the shadow copy are shown split-screen. The user sees both the original vulnerability and the fixed version simultaneously.

### Workspace 4: The Evidence Room
*Report generation + compliance + client export*

The Evidence Room is the quietest space visually. It looks like a legal document workspace rather than a simulation tool. The left panel is a structured document tree: the report being generated, organized by audience (operator brief, full audit, insurer summary, privacy review). The center is the live document with inline evidence callouts that link back to specific simulation results. The right panel is the provenance viewer — every claim in the document is traced to the simulation event that generated it.

The key navigation move here is **Source-Tracing**: the user can click any sentence in the report and the tool highlights the specific camera, path segment, time window, or coverage cell that the sentence derives from. Then they can click through to the relevant workspace (Chart Room, Bridge, or War Room) to inspect that underlying evidence. Report and simulation are not separate products — they are the same product at different levels of abstraction.

---

## III. GROUND-LEVEL NAVIGATION FLOWS

Ground-level navigation is where most tools fail. They give users powerful views but require too many clicks to move between them with context intact. SentinelTwin should operate on a principle: **context never resets**.

### Flow 1: Risk-to-Camera Jump
User is looking at the risk terrain heat map. They see a hot spot in zone C. They click it. The view doesn't switch tabs — instead, the scene zooms to that zone and a panel slides in from the right showing: which cameras cover this zone, their DORI quality scores at that zone's cells, and the AI's explanation of why this zone scores poorly. From that panel, the user can click any camera to select it in the scene editor and immediately adjust it. One gesture from insight to edit.

### Flow 2: Temporal Cursor to Spatial Evidence
User is in the Ops Bridge, looking at the temporal matrix. They see a vulnerability window at 03:00-04:00 AM in Zone D. They click that cell. The floor plan minimap expands to full view and highlights Zone D at that time. The adversarial path trace updates to show what the optimal intrusion path looks like at 3 AM specifically — not the all-day average path but the time-specific path. The user is now simultaneously looking at a spatial zone and a temporal moment as a single compound object.

### Flow 3: Report Claim to Simulation Evidence
User is in the Evidence Room reviewing the insurer report. A claim reads: "Camera CR-07 provides insufficient detection probability for the server room entrance." The user clicks the claim. The Evidence Room doesn't close — instead, a simulation panel slides in overlaying 40% of the screen, showing the coverage cell coverage for the server room entrance and the specific DORI quality score. The user can adjust the camera directly from this overlay, the simulation re-runs, and the report sentence updates automatically.

### Flow 4: Counterfactual to Recommendation to Budget
User sees a counterfactual in the War Room that eliminating a specific vulnerability requires adding two cameras. From the War Room, they open the "Budget Impact" sidebar — which appears as a compact inline panel, not a new page — showing the estimated hardware cost and labor for the recommended fix, and the change in risk score. This is the "cheapest fix" recommendation made spatially immediate.

### The Breadcrumb Chain
Every workspace maintains a persistent breadcrumb chain in the bottom status bar: Zone > Camera > Simulation Run > Report Section. The user always knows where they are in the compound space of (geometry, time, simulation, evidence). Clicking any breadcrumb segment jumps back to that context without resetting the work in the current workspace.

---

## IV. FIVE ORGANIZING METAPHORS

### Metaphor 1: The Sea Chart (Primary)

Navigation charts don't show you everything equally. They encode danger — depth contours, hazard markers, traffic separation schemes. Looking at a sea chart, a captain sees not just geography but a model of risk encoded into the landscape.

What this reveals: SentinelTwin's floor plan should feel like a navigation chart, not an architectural drawing. The floor plan *is* the risk model. The walls aren't just geometry — they're depth contours. Dead zones aren't voids — they're shoals. Adversarial paths are traffic lanes. Coverage quality is water depth. The cartographic metaphor immediately makes the user think like a navigator rather than a building administrator.

What "camera coverage tool" hides: that the floor plan itself *is* the adversary's map. Navigation charts exist because the sea doesn't care about your intentions — neither does an adversary. The chart metaphor forces the user to think from the attacker's point of view, not the defender's wishful thinking.

### Metaphor 2: The Medical Scan

A radiologist doesn't look at a photograph of a patient — they look at a cross-section that reveals internal structure invisible from the surface. Different scan types (MRI, CT, PET) emphasize different tissue properties.

What this reveals: Different simulation views of SentinelTwin are like different scan modalities. The coverage heat map is the MRI — showing structural coverage quality. The adversarial path is the PET scan — showing metabolic activity of risk, the live paths of potential threat. The temporal simulation is a time-lapse scan — watching how the body changes over a cycle. Each scan reveals a truth the others obscure.

What "camera coverage tool" hides: that you can't diagnose with one modality. The reason audits fail is that they produce one type of evidence (usually coverage %) and call it complete. The scan metaphor makes multi-modal analysis the default expectation, not a bonus feature.

### Metaphor 3: The Ship's Bridge

A modern warship's bridge integrates sonar, radar, navigation charts, communications, and helm control into one operational environment. No single officer sees everything; each station covers a domain. The captain has the integrated overview.

What this reveals: SentinelTwin's AI is the sonar operator, not the captain. The AI processes the raw sensor data (simulation results) and translates it into tactical intelligence. The human operator makes decisions based on that translated intelligence. This metaphor clarifies the product's positioning — the AI is expert staff, not autonomous system. It also clarifies the UI: the captain's chair (the overview) needs to be distinct from the sonar station (AI analysis) and the helm (scene editor).

What "camera coverage tool" hides: that security work is coordination between human judgment and mechanical sensing. Treating the tool as a "camera viewer" collapses the collaborative intelligence model into passive observation.

### Metaphor 4: The Intelligence File

Cold case detectives and intelligence analysts work with evidence files — folders where fragments of information are organized, cross-referenced, and annotated until a pattern emerges. The file is both the artifact and the process.

What this reveals: SentinelTwin's provenance spine isn't a compliance checkbox — it's an intelligence file. Every simulation run, every camera adjustment, every AI recommendation is a piece of evidence that accumulates over time. The security posture of a site isn't a snapshot — it's a case file that builds. This metaphor makes the temporal dimension meaningful: the file gets richer over time, and you can see exactly when and why the security picture changed.

What "camera coverage tool" hides: that physical security is an ongoing investigative practice, not a one-time installation review. The intelligence file metaphor makes SentinelTwin a living record, not a point-in-time report.

### Metaphor 5: The Wargame Board

Military wargames use physical boards where players set up forces, run scenarios, and test whether their deployments hold under adversarial pressure. The board is both the planning surface and the test environment.

What this reveals: The War Room workspace is literally a wargame board. The adversary is a simulated player making optimal moves. The security designer is the opposing player. The counterfactual bar is the move-testing mechanic. This metaphor makes the adversarial simulation feel like a game being played rather than a report being generated — it's immediately kinetic and engaging, which is important for user adoption among people who might otherwise be skeptical of simulation tools.

What "camera coverage tool" hides: that security design is an adversarial optimization problem, not an aesthetic coverage exercise. The wargame metaphor makes the adversarial nature of security design viscerally obvious.

---

## V. MISSING VIEWS THAT WOULD ORIENT USERS FASTER

### 1. The Perimeter Walk
A sequential first-person walkthrough of the facility's perimeter from an adversary's point of view. Not VR — just a guided sequence of "as seen from position X looking toward Y." The user sees what the adversary sees: which cameras are visible, which create deterrence, which are blind-spotted by obstructions. This view is missing from most tools and would immediately reorient users who think in terms of "where are my cameras" to "what does my adversary see."

### 2. The Confidence Map
A view that shows not just simulation results but the simulation's *epistemic confidence* in those results — where the model has high-quality input data versus where it's extrapolating. This would be rendered as a translucency overlay: areas where the model is confident are rendered normally; areas where it's uncertain are rendered with a soft fog overlay. Users could see at a glance where they need to gather more data (physical measurements, sensor calibration, patrol schedule detail) to harden the simulation.

### 3. The Delta View
A before/after view comparing two simulation states: the current scene versus the scene at a specific prior point (last audit, after last camera add, etc.). Shown as a difference overlay — green where coverage improved, red where it degraded. This is critical for the compliance audience who needs to show year-over-year improvement. It's also critical for the internal user who wants to verify that a recent change actually improved things and didn't create a new vulnerability elsewhere.

### 4. The Audience Lens
A view-switching mechanism where the user can see the scene through the eyes of a specific audience: the insurer sees cost-risk metrics overlaid on the floor plan; the privacy reviewer sees PII-exposure zones; the installer sees mounting points and cable runs; the patrol officer sees the patrol route with coverage gaps highlighted. Each audience lens is a different rendering pass over the same underlying scene. This prevents the report generation stage from being a separate workflow — the user can preview how the scene will appear to each audience in real time.

### 5. The Minimum Viable Secure Configuration
A derived view: given the current scene geometry and the user's declared security objectives, what is the minimum camera/sensor/patrol configuration that achieves baseline compliance? Rendered as a sparse overlay on the floor plan — only showing the minimum required elements. This gives users a lower bound to compare against their current configuration. If they're significantly overbuilt, that's a cost optimization conversation. If they're significantly underbuilt, that's an immediate action item.

---

## VI. ADVERSARIAL PATH AND TEMPORAL SIMULATION AS NAVIGATION DIMENSIONS

The most important spatial design decision in SentinelTwin is this: adversarial path and temporal simulation must not be tabs. They are orthogonal axes of the same space.

The scene has three navigable dimensions that users should be able to traverse simultaneously:

**Dimension 1: Spatial position** — where in the floor plan
**Dimension 2: Temporal position** — what time in the 24-hour cycle
**Dimension 3: Adversarial depth** — how far into the intrusion scenario

The product should support compound navigation across all three dimensions at once. The cursor on the floor plan shows a spatial position. The time scrubber at the bottom shows a temporal position. The adversary scrubber on the War Room path shows the adversarial depth position. All three scrubbers are linked — moving any one updates all three views simultaneously.

This creates a truly three-dimensional navigation space. A user can ask: "What does Camera 7 see when the adversary is in Zone C at 2 AM?" and navigate to that compound state directly — not by clicking through three separate tabs and re-orienting three times, but by setting three cursor positions and seeing the composite answer immediately.

The technical term for this in scientific visualization is a **coordinate cursor** — a multi-dimensional position indicator that allows the user to navigate a compound space. SentinelTwin's compound space is (x, y, t, adversary_depth). The coordinate cursor idea is what makes the product feel like a navigation instrument rather than a reporting tool.

---

## VII. ZOOM AND NAVIGATION PATTERNS

**Semantic Zoom (not geometric zoom)**: Zooming in should reveal more intelligence, not just bigger geometry. At low zoom: facility perimeter + overall risk posture. At mid zoom: zone-level detail, camera FOV footprints, primary paths. At high zoom: individual camera frustums, precise DORI quality per cell, specific sensor coverage. Each zoom level is a different *data density*, not just a different scale. The user shouldn't have to switch workspaces to zoom — zooming in from the 10,000-foot view should progressively reveal detail until they're at ground level in the Chart Room.

**Context-Preserving Drill**: When drilling from a high-level view (risk terrain) to a specific element (camera FOV), the transition should preserve context. The surrounding scene should remain visible but reduce in contrast, the zoomed element should expand in place, and a breadcrumb should appear so the user can zoom back out to the same overview context.

**Temporal Scrubbing**: The time axis should be scrubbable from any workspace. A persistent time control at the bottom of the screen — always visible, always active — means that temporal simulation is never "in another view." The user can time-scrub while editing the scene (to see how a change affects different time windows), while reviewing the adversarial path (to see how the optimal intrusion route changes at different times), and while reviewing the report (to preview how the audit findings change with time).

**Side-by-Side Scene Comparison**: The ability to split the canvas into two synchronized panels showing different simulation states side by side. Left panel: current state. Right panel: proposed change / historical state / different time. Both panels respond to the same camera/zoom gestures. This is the primary navigation pattern for "did my change actually help?" workflows.

**Keyboard Navigation for Power Users**: The Adversary Cursor should be drivable with arrow keys. Time scrubbing with left/right arrows. Workspace switching with number keys. Camera selection with tab cycling. For a professional user who will spend 40-hour weeks in this tool, keyboard-first navigation is not optional.

---

## VIII. TIME HORIZON PASS

### 6 Months: The Oriented Navigator
Navigation should feel continuous and spatial: the compound cursor (space x time x adversary) as the primary navigation primitive. The perimeter walk view added as a first-person orientation tool. Semantic zoom implemented as progressive detail revelation.

### 12 Months: The Intelligence Analyst
The Delta View shows how posture has changed since last audit. The Confidence Map shows where the model needs more data. The Audience Lens previews reports for each stakeholder without leaving the simulation. The Evidence Room's source-tracing is bidirectional — from simulation to report and from report to simulation.

### 24 Months: Multi-Site Cartography
A portfolio view: multiple sites shown as a spatial map (geographic or organizational). Risk posture encoded as color and size at each site. The navigator can see which sites need attention, compare postures across a portfolio, and identify correlated vulnerabilities (e.g., all sites with the same camera model have the same blind-spot geometry). The 10,000-foot view becomes organizational, not just site-level.

### Leapfrog: The Living Threat Model
The adversarial path is no longer static geometry — it's a probabilistic model updated by real-world threat intelligence. Breaking-in techniques evolve; the simulation evolves with them. The "adversarial path" view shows not just the current optimal route but how that route has evolved over the past year as new techniques emerged. The product becomes a living threat model, not a point-in-time simulation. The time axis extends beyond 24 hours to weeks and years.

---

## IX. THREE STRONGEST CARTOGRAPHIC IDEAS

### 1. THE COMPOUND CURSOR
*The coordinate navigator for security space-time*

A single cursor that exists simultaneously in three linked dimensions: floor plan position (x, y), time-of-day (t), and adversarial depth (d). Moving the cursor in any dimension propagates to all views instantly. The Compound Cursor is the product's primary navigation primitive — not a feature but the interaction paradigm.

Why it's strong: It makes the multi-dimensional nature of the simulation kinetic and immediate. Users stop thinking "I need to check the temporal view" and start thinking "let me move the cursor to 3 AM and see what changes." The product becomes navigable space rather than a collection of reports.

### 2. THE ADVERSARY SHADOW
*The ghost that haunts every view*

The adversarial path trace is never hidden in a separate tab. It exists as a semi-transparent overlay in every workspace — a red ghost trace on the floor plan that shows the current optimal intrusion route given the current scene state. When the user edits a camera (Chart Room), moves a wall, or adds a sensor, the ghost trace updates live. The adversary is always watching. The user is never allowed to forget that every design decision has an adversarial response.

Why it's strong: It reframes the entire product from "how do I place cameras" to "how do I make the adversary's path harder." The adversary shadow is a constant antagonist presence that keeps the user's attention on outcomes rather than equipment placement.

### 3. THE TEMPORAL FLOOR
*The 24-hour band as a first-class floor plan layer*

The temporal simulation isn't a separate workspace — it's a rendering mode of the floor plan. The user can fold out the temporal floor by pulling up on the bottom of the canvas: the floor plan "peels" vertically to reveal the 24-hour slice underneath, creating a pseudo-3D view where the Z axis is time. Vulnerability windows appear as vertical cavities in the floor, exposed downward. The user is literally looking at the underside of the security posture and seeing where the floor is thin.

Why it's strong: It makes temporal vulnerability viscerally spatial. Users don't think of time as a dimension until you make it literally physical. The moment you see the floor with holes in it, you understand vulnerability windows in your gut, not just your spreadsheet.

---

## X. THE THING MOST PEOPLE MISS

**The thing most people miss about this: the floor plan is the adversary's map, not the defender's.**

Every physical security tool is built from the defender's point of view — where are my cameras, what do they see, how do I add coverage. The floor plan is "my building."

But the adversary sees the same floor plan as a navigation challenge. They're not asking "where are the cameras" — they're asking "where are the shadows." The adversary's map is an inversion of the defender's map: maximum coverage is a wall to route around; minimum coverage is a corridor to exploit.

SentinelTwin is the first tool that renders the floor plan as the adversary reads it. Every cartographic decision — the heat map showing exposure depth rather than coverage density, the adversary shadow haunting every view, the War Room's intrusion path as the primary element — follows from this inversion.

The cartographic insight is that the same geometry supports two superimposed maps: the defender's coverage map and the adversary's evasion map. Most tools only render one of them. SentinelTwin renders both simultaneously — and the gap between them is where the risk lives.

That gap is the product.
