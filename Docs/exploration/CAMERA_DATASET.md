# Camera Dataset

**Status:** Concept — 2026-05-25
**From Pranay:** Build a camera dataset both home and commercial, pro vs USB etc,
which people can test out with the details those cameras provide.

---

## Why This Matters

SentinelTwin's camera quality model is only as good as its camera preset data.
Currently the plan is 7 generic presets (2MP dome, 4MP wide, 8MP bullet, etc.).
A real dataset of actual cameras with verified specs would:

1. Make SentinelTwin's simulation more accurate for real deployments
2. Let users select their actual camera model and get realistic simulation
3. Give the community something to contribute to and use beyond SentinelTwin itself
4. Create a credibility signal: "uses verified camera specifications"
5. Enable training/fine-tuning AI models that extract camera specs from spec sheets
6. Support benchmarking of camera quality claims vs real-world performance

---

## Dataset Scope

### Category 1: Home / Consumer

| Sub-category | Examples | Key specs to capture |
|---|---|---|
| USB cameras (webcam) | Logitech C920, C922, Brio | Resolution, FOV, low-light |
| Smart home cameras | Ring, Nest, Arlo, Wyze | Resolution, FOV, night mode, IR |
| Baby monitors | Nanit, Owlet, Infant Optics | Resolution, FOV, night |
| Doorbell cameras | Ring Video Doorbell, Nest Hello | Resolution, FOV, IR |
| Indoor standalone | Eufy 2K, TP-Link Tapo | Resolution, FOV, IR |

### Category 2: Commercial / Business-Grade

| Sub-category | Examples | Key specs |
|---|---|---|
| 2MP dome (entry) | Hikvision DS-2CD2121, Dahua IPC-HDW | Resolution, FOV, IR range |
| 4MP dome (mid) | Axis P3245, Hanwha QNV-8080R | Resolution, FOV, night mode |
| 8MP bullet (outdoor) | Axis P1448, Pelco IME219 | Resolution, FOV, IR, weatherproof |
| Varifocal lens cameras | Bosch FLEXIDOME, Hanwha 5MP | Lens range, adjustable FOV |
| PTZ cameras | Axis P5655-E, Sony SNC-ZP550 | PTZ range, presets, auto-track |
| Fisheye / 360° | Axis M3106-L, Hikvision DS-2CD2955 | Fisheye correction, virtual PTZ |
| Multi-sensor | Axis P3807-PVE | Combined FOV, sensor count |

### Category 3: Professional / Specialized

| Sub-category | Examples | Key specs |
|---|---|---|
| Thermal cameras | FLIR A400, Axis Q2901-E | Temp range, resolution, detection range |
| Low-light / starlight | Axis P1448-LE Lightfinder | Lux sensitivity, color night performance |
| License plate recognition | Axis P1448, Genetec LPR | Shutter speed, IR specs, capture range |
| Body-worn | Axon Body 3, Motorola Si700 | Resolution, battery, FOV |
| Mini / covert | Axis F series, Hanwha PNF-9300R | Covert specs, fisheye |
| Industrial | Axis Q6135-LE, Sony SSC | Environment rating, resolution |

### Category 4: Budget / Entry-Level

| Sub-category | Examples | Key specs |
|---|---|---|
| Generic/white-label | Amazon Basics, cheap IP cams | Resolution, actual vs claimed FOV |
| Mid-market | Reolink, Amcrest, Zmodo | Resolution, IR, app connectivity |

---

## What Data to Capture Per Camera

```typescript
type CameraDatasetEntry = {
  // Identification
  id: string;                  // "axis-p3245-v"
  manufacturer: string;        // "Axis Communications"
  model: string;               // "P3245-V"
  category: CameraCategory;    // "commercial_dome_4mp"
  msrp_usd?: number;          // approx price

  // Optics
  sensorType: "CMOS" | "CCD";
  sensorSize?: string;         // "1/2.8 inch"
  resolutionMP: number;        // 4
  resolutionWidth: number;     // 2592
  resolutionHeight: number;    // 1944
  fovHorizontalDeg: number;    // actual, measured
  fovHorizontalDeg_claimed: number;  // manufacturer spec
  fovVerticalDeg: number;
  lensType: "fixed" | "varifocal" | "fisheye";
  focalLengthMm?: number | [number, number];  // fixed or range

  // Night
  minimumIlluminationLux: number;      // 0.01 lux typical
  nightMode: "ir" | "low_light" | "thermal" | "none";
  irRangeM: number;                    // manufacturer claimed
  irRangeM_effective?: number;         // real-world tested
  colorNightVision: boolean;

  // Signal
  compressionFormats: string[];        // ["H.265", "H.264", "MJPEG"]
  maxFrameRate: number;                // 30
  bitRateRange?: [number, number];     // kbps

  // Physical
  mountType: string[];                 // ["ceiling", "wall"]
  weatherRating?: string;             // "IP67", "IK10"
  indoorOutdoor: "indoor" | "outdoor" | "both";

  // Compliance
  ndaaCompliant: boolean;             // false for Hikvision/Dahua
  manufacturer_country: string;
  certifications: string[];           // ["CE", "FCC", "UL"]

  // Simulation parameters
  simulationPreset: CameraPreset;     // derived simulation settings
  clarityRating: "poor" | "average" | "good" | "excellent";  // based on sensor specs
  compressionPenalty: number;         // PPM reduction due to compression at typical settings

  // Data provenance
  dataSource: "manufacturer_spec" | "measured" | "community";
  specSheetUrl?: string;
  lastVerified: string;              // date
  notes?: string;
};
```

---

## Data Collection Strategy

### Phase 1: Manufacturer Specs (Automated)

Build a scraper/parser pipeline:
1. Input: camera model number or spec sheet URL
2. Use GPT-4o to extract: resolution, FOV, IR range, night mode, compression
3. Validate: cross-check across 2+ sources (spec sheet + datasheet + distributor)
4. Output: `CameraDatasetEntry` JSON

This is where the camera spec extraction agent in `packages/agents/` has immediate value.
The dataset IS the test for that agent.

### Phase 2: Real-World Testing (Community)

Provide a test protocol:
1. Mount camera at known height (2.5m) facing a test card at known distances (5m, 10m, 15m, 20m)
2. Photograph the test card in: day, night with IR, night without IR
3. Measure actual PPM at each distance from the test image
4. Compare to manufacturer claimed DORI/OODPCVS at that distance

Open-source the test protocol. Community can contribute verified measurements.

### Phase 3: AI Quality Estimation (Advanced)

Given a real camera image:
- Run the image through quality estimation model
- Estimate: actual PPM, noise level, compression artifacts, blur
- Compare to expected PPM at stated distance

This closes the loop between simulation (what camera should see) and reality (what it actually sees).

---

## What the Dataset Enables

**For SentinelTwin users:**
- Select actual camera model from dropdown
- Get simulation using real verified specs, not generic presets
- See honest comparison: "Manufacturer claims 25m IR range. Community tests show 18m effective"

**For the community:**
- Open camera spec database that anyone can use for research, products, comparisons
- First database that includes both manufacturer claims AND community-measured real-world performance

**For SentinelTwin credibility:**
- "Simulated using verified camera specifications from the SentinelTwin Camera Dataset"
- Professional credibility over tools using generic estimates

**For AI training:**
- The dataset + spec sheets = training data for camera spec extraction models
- Test suite for evaluating how well VLMs read camera spec sheets

---

## Dataset Repository Plan

Separate repo or monorepo package:

```
packages/camera-dataset/
├── data/
│   ├── consumer/
│   │   ├── logitech-c920.json
│   │   └── ...
│   ├── commercial/
│   │   ├── axis-p3245-v.json
│   │   └── ...
│   ├── professional/
│   │   └── ...
│   └── budget/
│       └── ...
├── schema/
│   └── CameraDatasetEntry.ts
├── test-protocol/
│   └── MEASUREMENT_PROTOCOL.md
├── tools/
│   ├── extract-from-spec-sheet.ts
│   └── validate-entry.ts
├── README.md
└── CONTRIBUTING.md
```

**License: CC BY 4.0** — anyone can use, must attribute SentinelTwin.

---

## Initial Dataset Size Target

For V0.1 launch:
- 10 consumer cameras (covering most common smart home brands)
- 20 commercial cameras (most common professional CCTV)
- 5 specialized (thermal, LPR, PTZ)
- 5 budget cameras (honest "what you actually get" specs)

= 40 cameras to start. Enough to be useful, not so many that quality suffers.

**Contribution welcome from hackathon day 1** — open the dataset repo publicly,
ask the community to contribute their camera specs.

---

## Connection to SentinelTwin Product

The dataset feeds directly into `packages/core/src/presets/cameraPresets.ts`:

```typescript
// Generated from camera-dataset package
import { axis_p3245_v } from '@sentineltwin/camera-dataset/commercial';

const VERIFIED_CAMERA_PRESETS = [
  {
    id: "axis-p3245-v",
    name: "Axis P3245-V (Verified)",
    ...axis_p3245_v.simulationPreset,
    verified: true,
    dataSource: "manufacturer_spec + community",
  },
  // ... more presets
];
```

Users who don't know their camera model use generic presets.
Users who know their model get verified simulation.
The gap between these two is the dataset's value.
