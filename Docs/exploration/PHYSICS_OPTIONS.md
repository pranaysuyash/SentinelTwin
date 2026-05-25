# Physics Options

**Thread:** Exploration Map Thread 5
**Status:** Decision made — Rapier optional, not in V0.1
**Last updated:** 2026-05-25

---

## Decision Summary

Physics is NOT core to the security simulation.
Camera visibility = raycasting/geometry (three-mesh-bvh).
Physics = movement, drag, doors, collisions (optional layer on top).

V0.1: Simple AABB overlap detection for drag-and-drop. No Rapier.
V0.2: Add Rapier for door hinges, realistic drag, person path collisions.

---

## Library Comparison

### Rapier + @react-three/rapier (recommended when we add physics)

**Why:**
- WASM-based, very performant
- `@react-three/rapier` wraps it cleanly for R3F
- Character controller: person capsule that collides with walls
- Rigid bodies, sensors, constraints
- Active development, modern API
- Pascal's stack already supports WASM

**Use for:**
- Draggable obstructions that collide with walls (can't push shelf through wall)
- Door/gate open-close states with hinge constraint
- Person path actor: capsule that follows path but stops at walls
- Camera sensor zones (trigger event when person enters zone)

**Do NOT use for:**
- Camera ray visibility — use Three.js raycasting + three-mesh-bvh
- Coverage calculation — deterministic geometry
- Anything where physics accuracy matters for security outcomes

### cannon-es (lighter alternative)

- Maintained fork of cannon.js
- Simpler API than Rapier
- No WASM (pure JS)
- Slower than Rapier for complex scenes
- Good if we want to avoid WASM bundle size
- Not recommended over Rapier for performance-sensitive use

### Ammo.js

- Direct WASM port of Bullet physics
- Very powerful but heavier API
- "C++ API ported to JS" feel
- Not recommended for web-first product

### JoltPhysics.js

- Newer, very fast
- WASM port
- Three.js addon exists
- Worth watching but less mature ecosystem
- Could be revisited if Rapier has issues

### Matter.js

- 2D only
- Potentially useful for 2D floor plan view physics
- Not for 3D simulation

---

## The Physics vs Vision Collider Distinction

This is important regardless of which physics library we choose.

Every physical object in SentinelTwin has THREE layers:

```
visual mesh     — what the user sees (detailed, pretty)
physics collider — what blocks movement (simple shape: box, capsule)
vision collider  — what blocks camera rays (may differ from physics)
```

These are NOT the same:

| Object | Physics | Vision |
|---|---|---|
| Solid wall | Full block | Full block (transmission: 0) |
| Glass wall | Full block | Pass-through + glare (transmission: 0.9) |
| Grill/fence | Block | Partial (transmission: 0.5) |
| Cupboard | Block | Full block (transmission: 0) |
| Curtain | Soft/none | Partial (transmission: 0.2, night: 0.1) |
| Mesh fence | Soft | Partial (transmission: 0.6) |
| Tree/foliage | Soft | Variable (transmission: 0.3–0.7) |

**This distinction must be in the data model from V0.1** even before Rapier is added.
`ObstructionNode.visionTransmission` is a data field, not a physics property.

---

## V0.1 Drag Without Rapier

For V0.1, when a user drags a shelf/cupboard:

```typescript
// Simple AABB overlap check (no physics engine)
function isPositionValid(
  movingNode: ObstructionNode,
  newPosition: [number, number, number],
  allNodes: AnySecurityNode[],
): boolean {
  const movingBox = getBoundingBox(movingNode, newPosition);

  for (const node of allNodes) {
    if (node.id === movingNode.id) continue;
    if (node.nodeType === "wall" || node.nodeType === "obstruction") {
      const otherBox = getBoundingBox(node);
      if (movingBox.intersectsBox(otherBox)) {
        return false;
      }
    }
  }
  return true;
}
```

Simple, no WASM, works for V0.1.
The shelf snaps to "last valid position" if user tries to place it inside a wall.

---

## When to Add Rapier

Add Rapier in V0.2 when:
- User feedback shows drag-and-drop physics feels imprecise
- We need door/gate hinge animations
- We want person capsule to realistically navigate around obstacles
- Guard patrol path validation (guard can't walk through walls)

Not before. WASM adds bundle size and build complexity.
