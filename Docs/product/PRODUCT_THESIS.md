# Product Thesis

**Status:** Stable — 2026-05-25

---

## The One Sentence

SentinelTwin is a live physical security simulation environment where every camera, light,
obstruction, access point, and environmental condition is an editable variable in a continuous
risk model — and every change shows the security impact.

---

## The Problem

Most security camera setups are installed with a false sense of coverage.

A camera may technically "see" an area, but:
- Can it **detect** a person? Observe their activity? **Recognize** them? **Identify** them on footage?
- What happens at night?
- What happens when this shelf blocks the view?
- What happens if Camera 1 goes offline?
- What happens at 2 AM when the exterior lights cut out?
- Where would a motivated actor walk to stay out of useful camera range?

Existing tools answer "where does the camera point?" SentinelTwin answers "what security outcome
does this setup actually produce?"

---

## The Core Insight

**Coverage is not binary.** A camera either covers or doesn't cover is wrong.
Coverage is a quality spectrum: detection → observation → recognition → identification.
The same camera, from 8m vs 20m, in day vs night, with a clean vs dirty lens — produces
dramatically different security outcomes. The industry standard is DORI (Detection/Observation/
Recognition/Identification). We make it interactive and visual.

**AI proposes, geometry verifies.** Security recommendations must be trustworthy.
No AI model recommends moving a camera and claims it will improve coverage without the
simulation actually testing it. Numbers shown to clients come from deterministic geometry
computation, not language model inference.

**Every edit changes the risk map.** The simulation must feel alive.
When a security planner moves a shelf, coverage recomputes. When they tilt a camera,
the heatmap updates. The space behaves like a living model of security reality.

---

## What's Genuinely New

In approximate order of novelty:

**1. Adversarial path simulation.** No existing tool computes the path a motivated actor
would take through a space to minimize camera exposure. SentinelTwin's red team analysis
shows security planners exactly which route exploits their current coverage gaps. When they
fix coverage, the route changes. This is red team vs blue team as an interactive simulation.

**2. Temporal security profile.** No existing tool runs a 24-hour simulation to find when
a space is most vulnerable. Combining lighting schedules, guard patrols, occupancy, and
access control produces a peak-vulnerability timeline. "Your facility's highest-risk window
is 2 AM–4 AM when perimeter lights cut out and Camera 3's IR range doesn't reach the loading bay."

**3. Verified counterfactuals.** "Camera cannot move — what can we change?" is the question
security agencies deal with constantly. SentinelTwin generates 3–5 candidate fixes, tests
each against the simulation, and presents ranked before/after comparisons with verified numbers.
Not guesses — verified geometry outcomes.

**4. DORI quality in interactive 3D.** DORI calculators exist as static web calculators.
No one has made it live and interactive: pick a camera, drag its position, watch the
identification-quality radius update in real time on the floor heatmap.

**5. Three-layer object model (vision vs physics vs visual).** Glass walls block people but
not cameras. Grills partially block vision. Curtains degrade night coverage. This distinction
between physics collider and vision collider makes the simulation credible versus toy
cone-plotters that treat all objects identically.

---

## Target Users

**Primary (build for these):**
- CCTV installers — designing new installations, proving coverage to clients
- Security agencies — auditing existing setups, investigating incidents
- Facility managers — verifying coverage, running what-if scenarios

**Secondary (will use when product matures):**
- Insurance risk auditors
- Smart building consultants
- Physical security consultants
- Construction/site planners (during design phase)

**Not the target (defensive framing maintains this):**
- Anyone looking to avoid cameras or plan unauthorized access

---

## Positioning

SentinelTwin is not a CCTV planner. Those exist (Axis Site Designer, JVSG, IPVM).
They show static camera coverage fields of view.

SentinelTwin is a **physical security intelligence platform**. The difference:

| CCTV planner | SentinelTwin |
|---|---|
| Show camera FOV | Show DORI quality at every point |
| Static coverage map | Live simulation, every edit updates |
| Manual analysis | Adversarial path analysis |
| Day/night toggle | 24h temporal security profile |
| Designer's recommendation | Verified counterfactual testing |
| Subjective report | Quantified before/after metrics |

The closest product analogy is not a CCTV tool — it's what flight simulators are to aviation:
a high-fidelity environment where you test failure modes safely before they happen in reality.

---

## Long-Term Vision

V1: The Security Digital Twin
A facility manager creates a complete digital twin of their site. Every camera, light,
obstruction, door, and window is modeled. They run weekly adversarial analysis. When
anything changes in the physical space (new shelf, camera adjustment), they update the
twin and verify coverage.

V2: Real Feed Verification
Each camera in the twin is linked to its real recording. The system continuously compares
expected vs actual coverage. When a camera is accidentally obscured or tilted, an alert fires.
The twin becomes runtime security monitoring infrastructure, not just planning software.

V3: Incident Reconstruction
After an incident, the security agency reconstructs the event in the twin. Which cameras
should have seen the subject? Where were the coverage failures? What changes would have
prevented the incident? The twin becomes a forensic and prevention tool.

V4+: Security Intelligence Platform
Multi-site, compliance reporting, guard scheduling integration, insurance audit mode,
crowd simulation, privacy compliance overlay.
