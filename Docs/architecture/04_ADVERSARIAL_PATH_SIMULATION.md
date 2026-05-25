# Adversarial Path Simulation

**Status:** Design — 2026-05-25
**Novelty:** This feature does not exist in any current security planning tool.
**Classification:** Authorized defensive security analysis only.

---

## The Core Idea

Every coverage tool shows where cameras see. SentinelTwin also shows what a motivated actor
**would actually do** given that camera layout.

Model the floor as a weighted graph where each node's weight represents detection probability
from all cameras combined. Run pathfinding from entry to target minimizing cumulative exposure.
The output is the path a rational actor would take through the space.

Show this path to the security planner. They see the gap concretely — not inferred from a
heatmap, but as a specific exploitable route with a risk score.

The planner fixes coverage. The adversarial path recomputes and must find a new route, or
it can no longer reach the target without exceeding a minimum detection threshold.

This creates a **red team vs blue team** dynamic as an interactive simulation.

---

## Why This Is Genuinely Novel

Existing tools:
- Show camera FOV cones
- Show coverage heatmaps
- Calculate % floor covered

SentinelTwin's adversarial sim shows:
- The actual path an actor would take
- Exactly which camera blindspots they would exploit
- How long they would remain undetected at each quality level
- How coverage changes close the route

The planner's mental model shifts from "is my floor covered?" to "where does my setup fail
against a motivated actor?" These are different questions with different answers.

---

## Framing and Safety

This feature must be framed exclusively as authorized defensive security analysis.

Language to use:
- "Authorized threat path analysis"
- "Coverage gap exposure route"
- "Red team simulation for security hardening"
- "Worst-case coverage failure analysis"

Language to never use:
- "Optimal evasion path"
- "How to avoid cameras"
- "Robbery route"
- "Bypass coverage"

The product context makes this clear: only security professionals use this tool to harden
their own sites. There is no "enter someone else's building" mode.

---

## Algorithm Design

### Step 1: Build the Visibility Graph

Convert the floor plan into a navigation grid. This is separate from the coverage grid —
it models movement, not camera visibility.

```typescript
type NavNode = {
  id: string;
  position: [number, number];       // [x, z] floor coordinates
  accessible: boolean;               // not inside walls/solid objects
  
  // Derived from coverage engine
  detectionProbability: number;      // 0–1 by all cameras combined
  maxQualityAtNode: DORIQuality;
  visibleFromCameras: string[];
};

type NavGraph = {
  nodes: NavNode[];
  edges: NavEdge[];                  // connectivity between adjacent nodes
};

type NavEdge = {
  from: string;
  to: string;
  movementCost: number;              // time to traverse (based on distance, obstacles)
  exposureCost: number;              // detection exposure during traversal
};
```

### Step 2: Compute Node Detection Probability

For each nav grid node, combine coverage from all cameras:

```typescript
function computeNodeDetectionProbability(
  node: NavNode,
  cameraResults: Map<string, CellCoverage>,
): number {
  // Using quality as proxy for detection probability
  const qualityToProbability: Record<DORIQuality, number> = {
    none:           0.00,
    detection:      0.25,    // can detect presence
    observation:    0.50,    // can observe activity
    recognition:    0.85,    // can recognize known person
    identification: 0.99,    // can identify on footage
  };

  // Max detection probability across all cameras (any camera that can see you)
  const maxQuality = getMaxQualityAtNode(node, cameraResults);
  return qualityToProbability[maxQuality];
}
```

### Step 3: Pathfinding — Minimum Exposure Route

Use Dijkstra's algorithm with exposure cost as edge weight:

```typescript
function findMinExposurePath(
  graph: NavGraph,
  entryNodeId: string,
  targetNodeId: string,
  config: AdversarialConfig,
): AdversarialPath | null {
  // Standard Dijkstra but cost = cumulative exposure, not distance
  const dist: Map<string, number> = new Map();
  const prev: Map<string, string> = new Map();
  const queue: PriorityQueue<{ nodeId: string; cost: number }> = new PriorityQueue();

  dist.set(entryNodeId, 0);
  queue.push({ nodeId: entryNodeId, cost: 0 });

  while (!queue.isEmpty()) {
    const { nodeId, cost } = queue.pop();

    if (nodeId === targetNodeId) break;
    if (cost > dist.get(nodeId)!) continue;

    for (const edge of graph.getEdges(nodeId)) {
      const neighbor = edge.to;
      const edgeCost = computeEdgeExposureCost(edge, graph.nodes.get(neighbor)!, config);
      const newCost = cost + edgeCost;

      if (newCost < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, newCost);
        prev.set(neighbor, nodeId);
        queue.push({ nodeId: neighbor, cost: newCost });
      }
    }
  }

  if (!dist.has(targetNodeId)) return null;
  return reconstructPath(prev, entryNodeId, targetNodeId, graph, dist.get(targetNodeId)!);
}

function computeEdgeExposureCost(
  edge: NavEdge,
  targetNode: NavNode,
  config: AdversarialConfig,
): number {
  const distanceCost = edge.movementCost;                            // time to cross
  const exposureCost = targetNode.detectionProbability * distanceCost; // exposure = prob × time

  // Blend: pure exposure minimization vs balanced
  return config.strategy === "stealth"
    ? exposureCost * 10 + distanceCost          // heavily weight exposure
    : exposureCost * 3 + distanceCost;           // balanced
}
```

### Step 4: Build AdversarialPath Result

```typescript
type AdversarialPath = {
  // The route
  waypoints: AdversarialWaypoint[];

  // Aggregate metrics
  totalExposureScore: number;          // lower = better evasion
  totalDurationS: number;
  detectionQualityExposure: {
    detection: number;                 // seconds at detection quality
    observation: number;
    recognition: number;
    identification: number;
  };
  maxDetectionProbability: number;     // worst single point on route

  // Exploited gaps
  blindspotsExploited: string[];       // obstruction IDs used for cover
  camerasEvaded: string[];             // camera IDs successfully avoided
  criticalZonesReached: string[];      // which protected zones were breached

  // Reachability
  targetReached: boolean;
  failureReason?: string;              // "Target unreachable with exposure < threshold"
};

type AdversarialWaypoint = {
  position: [number, number];
  timeS: number;
  detectionQuality: DORIQuality;
  detectionProbability: number;
  usingCoverOf?: string;               // obstruction ID providing cover
  exposedToCamera?: string;            // camera that can partially see this point
};
```

---

## AdversarialConfig

```typescript
type AdversarialConfig = {
  // Entry and target
  entryPoints: string[];               // entry point node IDs (can try multiple)
  targetZoneId: string;                // critical zone to reach

  // Actor model
  actorType: "cautious" | "opportunistic" | "random";
  actorSpeedMps: number;               // default 1.2 m/s (normal walk)
  actorHeightM: number;                // default 1.7m

  // Strategy
  strategy: "stealth" | "speed" | "balanced";

  // Thresholds
  maxAcceptableExposure?: number;       // if route requires > this, return null
  minDetectionQualityToAvoid: DORIQuality; // avoid any path with quality >= this

  // Constraints
  timeOfDay: "day" | "night";
  requiresPhysicalAccess: boolean;     // can actor open doors?
};
```

---

## UI Presentation

### Adversarial Path Visualization

The path is rendered as a glowing orange/red line over the floor:
- Bright red segments: high exposure (recognition/identification quality)
- Orange segments: medium exposure (observation quality)
- Yellow segments: low exposure (detection quality only)
- Green segments: effectively undetected

Waypoints show:
- Estimated time at each point
- Detection quality
- Which camera (if any) can see this point
- Which obstruction provides cover

### The "Fix Coverage" Loop

When the planner makes a change (moves camera, moves obstruction, adds light):
1. Coverage recomputes
2. Adversarial path recomputes (on-demand, triggered by change)
3. Path updates in real time
4. If path now requires crossing a recognition-quality zone, the route changes
5. If no route exists below threshold, show: "No viable low-exposure route from Front Entry to Cash Counter under current configuration"

That final state is the security goal.

### Side Panel

```
Adversarial Analysis
━━━━━━━━━━━━━━━━━━━━
Entry: Front Door
Target: Cash Counter Zone

Route found in 0.3s
Total exposure score: 3.2 (high risk)

Timeline:
00:00  Enter from front door — Detection only
00:04  Move behind Shelf 1 — Undetected
00:09  Cross to counter area — Observation (Camera 2)
00:14  Reach Cash Counter Zone

Worst point: 9.2m mark — Observation by Camera 2
Cameras evaded: Camera 1 (blocked by Shelf 1)
Cover used: Shelf 1, Cupboard near counter

Recommended fix:
→ Rotate Camera 1 left 20° to cover Shelf 1 blind zone
→ Estimated new exposure score: 8.7 (low risk)
```

---

## Performance Considerations

The adversarial path sim is more expensive than the coverage engine:
- Nav graph for 20m × 20m room at 4 cells/m: 80×80 = 6,400 nodes
- Dijkstra on 6,400 nodes with ~8 edges each: ~50,000 operations
- Benchmarks suggest < 10ms in pure JS

Strategy:
- V0.1: compute synchronously on explicit "Run Threat Analysis" button press
- V0.2: compute in Web Worker, trigger on scene change with 500ms debounce
- V0.3+: consider GPU compute for very large scenes (warehouse, campus)

Do NOT auto-recompute adversarial path on every drag. It's too expensive and disorienting.
User must explicitly trigger threat analysis.

---

## Multiple Entry Points

Run pathfinding from all entry points in parallel (Promise.all):

```typescript
const results = await Promise.all(
  config.entryPoints.map(entryId =>
    findMinExposurePath(graph, entryId, config.targetZoneId, config)
  )
);

const worstCase = results
  .filter(r => r !== null && r.targetReached)
  .sort((a, b) => a.totalExposureScore - b.totalExposureScore)[0];
```

Show the worst-case route (lowest exposure = most dangerous). This is the security hole to fix.

---

## Future Extensions

**Multi-actor simulation:** Multiple actors at different entry points, do they overwhelm the system?

**Guard patrol intersection:** Factor guard patrol routes into detection probability. If a guard passes a zone every 15 minutes, the detection window changes.

**Temporal adversarial:** What time of day is the adversarial route most viable? Combine with temporal simulation.

**Probabilistic actor model:** Instead of a rational minimizer, model a distribution of actors with varying awareness levels. Show expected detection rate across the distribution.

**AI-assisted hardening:** After adversarial path analysis, ask the AI agent to propose the minimum-cost change set that closes the route. AI generates candidates, simulation verifies each.
