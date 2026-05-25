# Open Source Licensing — SentinelTwin Strategy

**Status:** Decision needed — 2026-05-25
**Constraint from Pranay:** Must be fully open source now, fully commercializable later.

---

## The Requirement

Use only open source dependencies that allow:
1. Free use and modification now (hackathon, portfolio, community)
2. Commercial SaaS product later (no relicensing required, no forced source disclosure)
3. No legal risk from mixing licenses

---

## License Comparison

| License | Commercial use | Modify & keep private | SaaS without disclosure | Patent protection | Best for |
|---|---|---|---|---|---|
| **MIT** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | Libraries, maximum adoption |
| **Apache 2.0** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | Enterprise, SaaS backends |
| **BSD 3-Clause** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | Academic, networking |
| GPL v3 | ✅ Yes | ❌ Must disclose | ✅ Yes (loophole) | ❌ No | Academic, research |
| **AGPL v3** | ✅ Yes | ❌ Must disclose | ❌ Must disclose | ❌ No | Maximum copyleft |
| BSL (Business Source) | Restricted | Restricted | Restricted | — | Delayed open source |

**For SentinelTwin's requirement:** MIT or Apache 2.0 only.

- MIT: simplest, broadest adoption, no patent grant
- Apache 2.0: adds explicit patent protection clause — better for enterprise use

**Recommendation: Apache 2.0 for SentinelTwin's own code.**
Rationale: Patent grant protects both contributors and users. Enterprise buyers prefer Apache 2.0.
Still fully permissive — commercial SaaS is allowed, no source disclosure required ever.

---

## SentinelTwin's Own Code License

**License: Apache 2.0**

This means:
- Anyone can use, modify, distribute SentinelTwin
- Anyone can build a commercial product on top
- Contributors grant patent rights (important for security software)
- SentinelTwin can also run as a commercial SaaS without legal issues

---

## Dependency License Audit

Every dependency must be checked. Red flags: GPL, AGPL, LGPL (partial), BSL.

### Pascal Editor (Foundation)
- **License: MIT** ✅ — fork freely, commercialize freely

### Core Simulation Dependencies

| Package | License | Use | Status |
|---|---|---|---|
| three.js | MIT ✅ | 3D rendering | Safe |
| @react-three/fiber | MIT ✅ | R3F | Safe |
| @react-three/drei | MIT ✅ | R3F utilities | Safe |
| three-mesh-bvh | MIT ✅ | BVH raycasting | Safe |
| @react-three/rapier | MIT ✅ | Physics | Safe |
| zustand | MIT ✅ | State | Safe |
| zod | MIT ✅ | Schema validation | Safe |
| gsap | **Custom — check** | Animations | ⚠️ GSAP free tier has restrictions |
| React / Next.js | MIT ✅ | Framework | Safe |
| TypeScript | Apache 2.0 ✅ | Types | Safe |
| Turborepo | MIT ✅ | Monorepo | Safe |
| Bun | MIT ✅ | Runtime | Safe |
| Vitest | MIT ✅ | Tests | Safe |

### GSAP — Important Note

GSAP (GreenSock) uses a custom license:
- Free for personal/non-commercial use
- Free for commercial use only if hosted on a site with ads or revenue via GreenSock's "No Charge" license
- Club GSAP (paid) required for clean commercial SaaS

**Action required:** Either buy Club GSAP license ($99/year) OR replace GSAP with an MIT alternative for animations.

**MIT alternatives to GSAP:**
- `motion` (Framer Motion) — MIT — strong React integration
- `anime.js` — MIT — similar API to GSAP
- CSS transitions + `@motionone/animation` — MIT

For SentinelTwin's use (replay timelines, camera transitions), Framer Motion or anime.js are sufficient.

**Decision: Replace GSAP with `motion` (Framer Motion v11) which is MIT.**
Update architecture/07 and todos if this decision is made.

### AI / Model Dependencies

| Package | License | Use | Status |
|---|---|---|---|
| openai (npm) | Apache 2.0 ✅ | OpenAI API client | Safe |
| @anthropic-ai/sdk | MIT ✅ | Claude SDK | Safe |
| @google/generative-ai | Apache 2.0 ✅ | Gemini SDK | Safe |

### CV / ML Dependencies (Python backend, V0.2+)

| Package | License | Use | Status |
|---|---|---|---|
| Depth Anything V2 | Apache 2.0 ✅ | Depth estimation | Safe |
| SAM 2 | Apache 2.0 ✅ | Segmentation | Safe |
| SAM 3 | Apache 2.0 ✅ | Segmentation | Safe |
| Florence-2 | **MIT** ✅ | Detection | Safe |
| Qwen2.5-VL | Apache 2.0 ✅ | Vision understanding | Safe |
| VGGT | MIT ✅ | Multi-photo 3D | Safe — verify |
| DUSt3R | **CC BY-NC-SA 4.0** ❌ | 3D reconstruction | **NON-COMMERCIAL** |
| MASt3R | **CC BY-NC-SA 4.0** ❌ | 3D reconstruction | **NON-COMMERCIAL** |
| SpatialLM | Apache 2.0 ✅ | Point cloud → room | Safe — verify |
| Open3D | MIT ✅ | Point cloud | Safe |
| Trimesh | MIT ✅ | Mesh processing | Safe |
| Shapely | BSD ✅ | 2D geometry | Safe |
| FastAPI | MIT ✅ | Python backend | Safe |
| PyTorch | BSD ✅ | ML framework | Safe |

### Critical Flags

**DUSt3R and MASt3R are CC BY-NC-SA 4.0 — non-commercial.**
Cannot be used in a commercial product without explicit permission from the authors.

**Options:**
1. Use VGGT instead (MIT) — does similar multi-photo reconstruction
2. Contact the DUSt3R/MASt3R authors for a commercial license
3. Use COLMAP (BSD licensed) as the classical baseline for multi-photo 3D

For V0.2 multi-photo reconstruction: **Use VGGT (MIT) as primary. Keep DUSt3R for experiments only.**

---

## The License Decision Matrix

When evaluating any new dependency:

```
Is it MIT, Apache 2.0, BSD, or CC0?  →  ✅ Use it
Is it LGPL?  →  ✅ Use as dynamic link only (don't modify)
Is it GPL v3?  →  ⚠️ SaaS use is technically allowed (distribution loophole)
                   But creates ambiguity — avoid unless no alternative
Is it AGPL?  →  ❌ Cannot use in SaaS product without open-sourcing SentinelTwin
Is it CC BY-NC?  →  ❌ Non-commercial only — cannot use in product
Is it BSL?  →  ❌ Commercial use restricted for specific period — check terms
Is it proprietary?  →  ❌ No
```

---

## SentinelTwin's License File

When the repo goes public, include `LICENSE` at root:

```
Apache License
Version 2.0, January 2004

Copyright 2026 Pranay Suyash

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
...
```

And `NOTICE` file listing all dependency credits (required by Apache 2.0).

---

## The Camera Dataset — License Considerations

From Pranay's direction: build a camera dataset (home/commercial/pro vs USB) that people can test with.

**For a dataset of camera specs and test images:**

If we collect/curate camera spec data:
- Camera specs (resolution, FOV, IR range, etc.) = facts, not copyrightable. Safe to compile.
- Marketing materials from camera vendors = ⚠️ check each vendor's terms
- CC0 / Creative Commons licensed camera test images = safe
- Photos we capture ourselves = safe

For the dataset license: **CC BY 4.0** (Creative Commons Attribution) for the data,
**Apache 2.0** for any accompanying code.

This allows:
- Anyone to use the dataset for research, commercial products, training
- Attribution required (credit SentinelTwin as source)
- Maximum reach and impact

See `CAMERA_DATASET.md` for the full dataset plan.
