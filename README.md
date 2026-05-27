# SentinelTwin

AI-native physical security digital twin for reviewing coverage in a live scene.

SentinelTwin is being built as a studio-first experience for understanding what a camera setup actually achieves in context, not just where cameras point.

## Hackathon Update

The current submission shows an in-progress but coherent studio workflow:

- map-first scene editing
- camera, replay, and comparison review modes
- coverage and blind-spot feedback
- visual exploration of security risk in the scene

This is a progress update, not a full product reveal. The repo is already moving in the right direction, and the visuals below show the current shape of the experience.

## Selected Screens

### Core studio views

<table>
  <tr>
    <td><img src="./shot-map.png" alt="Studio map view" width="420" /></td>
    <td><img src="./shot-camera-view.png" alt="Camera view" width="420" /></td>
  </tr>
  <tr>
    <td><img src="./shot-path-replay.png" alt="Path replay view" width="420" /></td>
    <td><img src="./shot-camera-wall.png" alt="Camera wall view" width="420" /></td>
  </tr>
  <tr>
    <td><img src="./shot-compare.png" alt="Compare view" width="420" /></td>
    <td><img src="./sentineltwin-final-check.png" alt="Final studio check" width="420" /></td>
  </tr>
</table>

### Design direction

<table>
  <tr>
    <td><img src="./sentineltwin-studio-map.png" alt="Studio map design" width="420" /></td>
    <td><img src="./sentineltwin-expanded-final.png" alt="Expanded studio design" width="420" /></td>
  </tr>
</table>

## What is next

The next phase is about tightening the studio experience, finishing the remaining review flows, and making the security feedback easier to read at a glance.

## Repo structure

- `apps/studio` - main studio app
- `Docs/` - architecture, decisions, exploration, and progress notes

## Notes

This README is intentionally high-level for the hackathon submission update. The detailed architecture and working notes live in `Docs/`.
