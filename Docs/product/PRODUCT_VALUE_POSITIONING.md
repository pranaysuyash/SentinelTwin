# Product Value — What SentinelTwin Actually Does For People

**Status:** First-principles analysis — 2026-05-25
**Purpose:** Nail the value proposition. Know what job we're doing, who we're doing it for,
what pain we're replacing, and how to pitch it in 10 seconds.

---

## The Three Jobs SentinelTwin Does

### Job 1: Save Time
The current alternative is manual. A security professional manually:
- Walks the site (1–3 hours)
- Draws a rough floor plan
- Places camera icons on paper
- Eyeballs coverage ("looks about right")
- Writes a report from scratch (2–4 hours)
- Does it again after any changes

SentinelTwin replaces the eyeball + paper with a simulation that:
- Verifies coverage in seconds, not hours
- Reruns automatically when anything changes
- Generates the report automatically

**Time saved per audit:** 4–8 hours → 30 minutes.
For a security agency doing 50 audits/year: 200–400 hours → 25 hours.

### Job 2: Reduce Friction in Decision-Making
The hardest thing about security planning is the "what if" question.
"Can we skip adding a third camera if we just move this shelf?"
Currently: guess, implement, find out later if it worked.
With SentinelTwin: test before committing. Instant before/after.

**Friction removed:** the risk of expensive mistakes (wrong camera placement, unnecessary equipment).

### Job 3: Automate Evidence
Insurance, compliance, client proposals, post-incident reports — all need documentation.
Currently: manually write everything from notes.
With SentinelTwin: simulation output → auto-generated report.

**Work automated:** 2–4 hours of report writing per audit → auto-generated, standards-compliant output.

---

## The Primary Value Hierarchy

**For security agencies / CCTV installers:**
1. **Time:** audits that take a day now take 30 minutes
2. **Credibility:** "SentinelTwin shows..." is more persuasive than "I think..."
3. **Revenue:** more audits per day, higher-value proposals, less re-work

**For facility managers:**
1. **Risk reduction:** know gaps before an incident, not after
2. **Cost efficiency:** spend on cameras where they actually matter
3. **Compliance:** GDPR, insurance, internal audit requirements met

**For small business owners:**
1. **Simplicity:** don't need to be a security expert
2. **Confidence:** "I know my register is actually covered"
3. **Cost:** know what they actually need, don't overspend

---

## The 10-Second Pitches

**For security agencies:**
> "SentinelTwin turns a multi-hour manual site audit into a 30-minute simulation.
> You get a before/after comparison and a standards-compliant report automatically."

**For facility managers:**
> "SentinelTwin shows you where your cameras actually fail — and what it would take to fix it —
> before an incident forces you to find out the hard way."

**For insurers / compliance:**
> "SentinelTwin produces IEC 62676-4:2025 compliant coverage attestations for commercial properties.
> Your clients can prove their cameras cover what they claim they cover."

**For small businesses (retail):**
> "SentinelTwin tells you in 5 minutes whether your register is actually covered,
> or just looks covered. Moving one shelf might be all it takes."

---

## The Emotional Job: Confidence vs. False Confidence

The problem SentinelTwin solves is not primarily a technology problem.
It's a confidence problem.

Security managers, facility owners, and CCTV installers operate with a _false sense of coverage_.
They believe their cameras cover their space because:
- The cameras are installed and running
- The footage looks fine during a quick check
- Nobody has complained about blind spots

The reality:
- A camera "seeing" an area is not the same as that camera providing useful evidence
- The shelf that was moved 6 months ago is blocking Camera 2
- The night mode has been misconfigured since installation
- Camera 1 would capture an incident, but only at detection quality — not identification quality

When an incident happens and the footage is useless, the cost is enormous:
- No insurance payout without identifiable evidence
- No prosecution without usable footage
- Reputational damage ("they had cameras but couldn't even identify the person")

SentinelTwin converts "I think we're covered" into "I know we're covered, here's the evidence."

That is the emotional job. And it's worth paying for.

---

## What We Are NOT

**We are not a camera brand selector.** We don't tell you which brand to buy.
(Future: the verified camera dataset makes us better at "which specs you need.")

**We are not a VMS (Video Management System).** We don't manage live feeds or recordings.
(Future V2: we verify real feeds match the simulation.)

**We are not a security guard service.** We don't monitor in real time.
(Future: temporal simulation helps plan guard patrol schedules.)

**We are not a compliance consultant.** We don't give legal advice.
(We generate evidence. Interpretation is the professional's job.)

---

## The "Before / After" as the Core UX Primitive

Every product interaction should reinforce the before/after contrast.

The moment that sells SentinelTwin to any user is:
1. They see their current coverage ("looks OK")
2. They see what happens when Camera 1 goes offline ("cash counter has zero coverage")
3. They see what the adversarial path analysis reveals ("an actor can reach the safe undetected")
4. They apply one fix ("rotate Camera 2 15 degrees")
5. They see the after state ("coverage passes all requirements, adversarial path blocked")

This sequence takes 3 minutes in the demo. It's irreversible once someone sees it.

---

## The Value Staircase

Different users climb different rungs of the value staircase:

```
Level 5: Operational Intelligence
        Temporal security profile + guard patrol optimization
        "Here's when you're most vulnerable and why"

Level 4: Adversarial Security
        Red team simulation + verified counterfactuals
        "Here's the attack path. Here's how to close it."

Level 3: Audit & Compliance
        Standards-compliant reports + insurance attestation
        "Here's your documented security posture"

Level 2: Coverage Understanding
        Heatmap + zone analysis + camera view
        "Here's what your cameras actually see"

Level 1: Coverage Verification
        Basic yes/no on "is this zone covered?"
        "Your cash counter is not covered at night"
```

Every user starts at Level 1. The product's job is to show them Level 2 exists,
and that Level 2 is worth paying for. Then Level 3, and so on.

The free tier covers Level 1 (basic verification).
Professional tier covers Levels 2–3.
Enterprise tier covers Levels 4–5.

---

## GTM Priority — Who to Acquire First

**Acquire first:** CCTV installers and security agencies in India and Southeast Asia.
- High volume
- Currently underserved by existing tools
- Price-sensitive but ROI is immediate ("I can do 3x more audits per day")
- The small retail shop story resonates deeply

**Acquire second:** Security consultants doing compliance audits in UK/EU.
- GDPR + IEC 62676-4:2025 compliance is mandatory
- They need professional-grade reports
- Higher willingness to pay

**Acquire third:** Enterprise facility managers (US, EU, AU).
- Insurance + NDAA compliance drivers
- Larger deal sizes
- Slower sales cycle

**Avoid initially:** Government / military (procurement cycles too slow), pure hardware installers (don't value software), large integrators (build their own tools).

---

## The India-First Story

This is the primary demo story. Not because it is the only market, but because it is
the most authentic and the most immediate.

India has an estimated 20+ million CCTV cameras installed, with tens of millions more
being added annually through retail expansion, smart city programs, school security
mandates, and warehouse growth. The vast majority are installed by local integrators
using CP Plus, Hikvision, Dahua, and TVT hardware, with no simulation or coverage planning.
A site walk and a gut check is the standard audit method.

The specific story that sells:
> A shop owner in Bangalore had a theft near the cash counter.
> The camera existed. It was running. The footage was useless.
> The thief was never identified because the view was blocked by a shelf
> and the camera angle was too high and too far.
> The owner didn't know this until after the incident.

This is not a hypothetical. It happens daily. SentinelTwin's answer to this story is concrete:
- Show that the camera technically covers the counter but at observation quality, not identification
- Show the shelf blocking the useful angle
- Show that moving the shelf (cost: zero) would have changed the outcome
- Generate the before/after as evidence for an insurance claim

**Product implications for India-first:**
- Free tier must be genuinely useful standalone, not just a trial gimmick
- Camera preset library needs CP Plus, TVT, Dahua models (the most common in India)
- Demo scene should default to an Indian small shop layout, not a generic Western store
- Text-to-scene input matters more here than a sophisticated floor plan editor
- Price point: freemium base, professional tier at a price Indian agencies can pay
- Mobile-first UI matters: many audits happen on a tablet or phone on-site

---

## The Security Evidence Twin — A Second Product Frame

See Thread 24 in EXPLORATION_MAP.md for full exploration.

In addition to being planning software, SentinelTwin can be evidence software:
"prove your coverage met the required standard."

The evidence frame changes the buyer: compliance officers, insurers, post-incident
legal teams, enterprise procurement. These are mandatory purchase drivers, not discretionary.

The report layer should be designed from day one with this in mind:
- Every report references the standard used (IEC 62676-4:2025, DORI)
- Every report shows assumptions explicitly and is timestamped
- Every report includes a methodology statement
- Output formats should be attachable to insurance and compliance documentation

This does not change V0.1 scope. It changes how the report layer is designed.
