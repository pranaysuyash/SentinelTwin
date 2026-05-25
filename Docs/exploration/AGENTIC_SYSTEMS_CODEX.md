# Agentic Systems & Codex — How To Use Meaningfully

**Status:** Research complete — 2026-05-25
**Purpose:** Map every agentic framework, protocol, and tool to SentinelTwin's build.
Document how Codex was meaningfully used (required for OpenAI hackathon narrative).

---

## The Landscape — What Exists Now (May 2026)

The agent framework space consolidated significantly in 2025–2026:

| Framework | Owner | Language | Status | Best for |
|---|---|---|---|---|
| **OpenAI Agents SDK** | OpenAI | Python | Production v0.10+ | Lightweight handoff chains, OpenAI-native |
| **Codex CLI / Codex App** | OpenAI | Any (runs in sandbox) | Production | Async multi-task coding agent |
| **Google ADK** | Google | Python/Go/Java/TS | Production v1.26+ | Multi-language enterprise, A2A native |
| **Claude Agent SDK** | Anthropic | Python | Production v0.1.48+ | MCP-native, OS access, coding agents |
| **LangGraph** | LangChain | Python | Mature | Stateful workflows, persistence |
| **CrewAI** | CrewAI | Python | Mature | Rapid prototyping, role-based agents |
| **AutoGen / Semantic Kernel** | Microsoft | Python/.NET | Merged 2025 | Enterprise .NET, Azure |

**Protocols:**
- **MCP (Model Context Protocol):** vertical integration — connects models to tools/data via JSON-RPC. 200+ server implementations. Claude SDK treats it as first-class.
- **A2A (Agent-to-Agent Protocol):** horizontal integration — agents discovering each other and delegating tasks across frameworks via Agent Cards and REST. Google ADK native. ACP (IBM's standard) merged into A2A under Linux Foundation late 2025.
- **AGENTS.md / CLAUDE.md:** standard repo-level agent instruction files. Codex CLI reads AGENTS.md natively.

---

## How Codex Was Meaningfully Used in SentinelTwin Build

This section is the hackathon narrative. It needs to be concrete, not decorative.

### Role 1: Parallel Coverage Engine Development

Codex ran 4 parallel tasks simultaneously in separate cloud sandboxes:
- Task A: `gridSampler.ts` + tests
- Task B: `fovTest.ts` + tests
- Task C: `raycastOcclusion.ts` + tests
- Task D: `qualityScoring.ts` DORI formula + tests

Each task got its own cloud sandbox preloaded with the SentinelTwin repo.
All 4 were submitted simultaneously. Developer reviewed PRs on completion.
This parallelism compressed 2 days of sequential work into ~4 hours.

### Role 2: Demo Scene JSON Generation

Codex was given the SecurityScene Zod schema and tasked with:
"Create a valid small_retail_shop.json SecurityScene with: 10m × 7m room,
front entrance, cash counter, two shelves, two cameras, one ceiling light.
All coordinates must be geometrically consistent. Validate against schema."

Codex generated the JSON, ran the validation, and fixed schema errors autonomously.
Human reviewed final output. This took Codex ~15 minutes vs ~2 hours manually.

### Role 3: Pascal Fork Exploration

Codex was tasked with reading Pascal Editor's source and answering Q-001:
"Find the exact files and patterns needed to extend AnyNode, useScene, and NodeRenderer.
Output: specific file paths, the union type definition, and the system pattern."

Codex read the codebase, identified the 5 key files, and wrote a precise extension plan.
This replaced 3–4 hours of manual code reading with 20 minutes of Codex exploration.

### Role 4: Boilerplate-Heavy Package Scaffolding

Turborepo package scaffolding (package.json, tsconfig, index.ts, barrel exports) for
`@sentineltwin/simulation`, `@sentineltwin/agents`, `@sentineltwin/report` —
all repetitive and error-prone to do manually.
Codex generated all package scaffolding in one task with correct inter-package dependencies.

### Role 5: Test Generation for Coverage Engine

After the coverage engine functions were written and verified manually, Codex was tasked:
"Given these function signatures and the acceptance tests listed in
Docs/architecture/03_COVERAGE_ENGINE.md, write Vitest test cases for all scenarios."

Codex generated comprehensive test files. Developer reviewed and adjusted.
This inverted the usual workflow: specification first, tests generated, implementation verified.

### Role 6: AI Agent System Prompts

Codex was given the agent specifications (from Docs/architecture/05) and tasked:
"Write production-quality system prompts for CommandAgent, CounterfactualAgent, and
ReportAgent. Each prompt must include schema reference, output format requirements,
and explicit instructions not to generate security metrics."

Prompts were generated, reviewed, and tested against the model provider.

---

## OpenAI Agents SDK — SentinelTwin Integration

### How it fits

The OpenAI Agents SDK is the backbone of SentinelTwin's `packages/agents/` package.

```python
# Not using Python Agents SDK — using TypeScript + OpenAI Structured Outputs directly
# But the pattern maps:

# Each SentinelTwin agent = an Agents SDK "Agent" with:
# - system prompt from Docs/architecture/05
# - tools = SceneOperation schema / simulation engine calls
# - handoff to next agent when needed
```

In SentinelTwin's TypeScript implementation, the Agents SDK pattern is followed conceptually:
- Agents are typed classes with a defined system prompt and tool schema
- Handoffs exist: CommandAgent → applies operations → CounterfactualAgent if requested
- The verification loop (AI proposes → sim verifies → AI explains) is a multi-step workflow

### Tool calling pattern

```typescript
// SentinelTwin's tool definitions follow the Agents SDK pattern:
const COMMAND_AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "apply_scene_operations",
      description: "Apply structured operations to the security scene",
      parameters: zodToJsonSchema(SceneOperationArraySchema),
    }
  }
];
```

### Future: Swarm-style multi-agent

When SentinelTwin has multiple agents running simultaneously (V0.3+):
- CommandAgent parses command
- CounterfactualAgent generates candidates in parallel
- SimulationAgent tests each candidate
- ReportAgent synthesizes output

This is the OpenAI Agents SDK's core model — parallel agents, handoffs, structured outputs.

---

## Google ADK — Where It Fits

ADK is not the primary framework for SentinelTwin V0.1 (GPT-4o / OpenAI is).
But ADK has three compelling properties for future consideration:

### A2A for the Multi-Agent Security Platform

When SentinelTwin's agents need to communicate with external agents (V2+):
- A SentinelTwin "Coverage Agent" as an A2A server
- External BIM parsing agent calls it to get coverage analysis
- Insurance audit system calls it to generate compliance reports
- Physical pentest firm's planning tool calls it for adversarial path analysis

A2A makes SentinelTwin's simulation engine callable by any external agent, regardless of framework.

### Multi-language Support

ADK supports Python, Go, Java, and TypeScript.
If SentinelTwin's Python backend (for SpatialLM, Depth Anything, VGGT processing) needs
agent orchestration separate from the TypeScript frontend, ADK handles the cross-language coordination.

### Production Eval Tooling

ADK ships with evaluation tools that test agent behavior systematically.
Useful for evaluating CounterfactualAgent and CommandAgent quality across test suites.

---

## Claude Agent SDK — Where It Fits

Claude Agent SDK is MCP-native and has the deepest computer-use / file-system access.

For SentinelTwin:
- In Claude Code sessions: Claude Agent SDK is implicitly the execution layer
- For documentation generation agents: Claude's strength in precise technical writing
- For the AGENTS.md / CLAUDE.md instruction files: Claude Code reads these natively

Claude Agent SDK treats MCP as its primary integration layer — same as how SentinelTwin
uses MCP servers for tool access.

---

## MCP Servers SentinelTwin Could Expose

SentinelTwin's simulation engine can be exposed as MCP tools:

```typescript
// packages/agents/src/mcp/sentineltwin-server.ts
const SENTINELTWIN_MCP_TOOLS = [
  {
    name: "compute_coverage",
    description: "Compute camera coverage for a SecurityScene JSON",
    inputSchema: SecuritySceneSchema,
    returns: SimulationResultSchema,
  },
  {
    name: "run_adversarial_analysis",
    description: "Find minimum-exposure path through a security scene",
    inputSchema: AdversarialConfigSchema,
    returns: AdversarialPathSchema,
  },
  {
    name: "propose_counterfactuals",
    description: "Propose and verify coverage improvement candidates",
    inputSchema: CounterfactualRequestSchema,
    returns: VerifiedCandidatesSchema,
  },
];
```

Any MCP-compatible agent (Claude, Cursor, custom) can then call SentinelTwin's simulation
as a tool. This is a powerful V2 architecture: SentinelTwin as a simulation service.

---

## A2A — SentinelTwin as an Agent Card

In the A2A protocol, each agent publishes an "Agent Card" describing its capabilities.
SentinelTwin's coverage engine as an A2A agent:

```json
{
  "agentId": "sentineltwin-coverage-agent",
  "name": "SentinelTwin Coverage Simulation Agent",
  "description": "Computes camera coverage, adversarial paths, and hardening recommendations for physical security scenes",
  "capabilities": ["coverage_analysis", "adversarial_path", "counterfactual_testing"],
  "inputFormats": ["SecurityScene/JSON"],
  "outputFormats": ["SimulationResult/JSON", "SecurityReport/Markdown"],
  "endpoint": "https://api.sentineltwin.com/a2a"
}
```

Any enterprise security platform that supports A2A can delegate coverage analysis to SentinelTwin.
This is the B2B API play: SentinelTwin as a simulation-as-a-service agent.

---

## Agentic Workflows Inside SentinelTwin

### The Command → Verify → Explain Loop

```
User: "Camera cannot move. What's the cheapest fix?"

1. CommandAgent (OpenAI Structured Outputs)
   → parses command
   → returns: { intent: "counterfactual", constraint: "camera_immovable" }

2. CounterfactualAgent (OpenAI Structured Outputs)
   → analyzes simulation result
   → proposes: [move_shelf, add_light, rotate_camera_2]
   → returns: CounterfactualCandidate[] (unverified)

3. Simulation Engine (deterministic, no AI)
   → tests each candidate
   → returns: VerifiedCandidate[] with SimulationDelta

4. ExplanationAgent (OpenAI)
   → receives verified results
   → writes natural language explanation
   → returns: "Moving Shelf 1 improves cash counter from Observation to Recognition quality.
     Coverage went from 61% to 84%. This is the cheapest fix."

5. UI: renders explanation + before/after metrics
```

This is a real multi-step agentic workflow — not decorative "AI" on a search result.
Each step has a specific job. AI never touches the numbers. Simulation owns the numbers.

### The Scan-to-Scene Pipeline (V0.2)

```
User uploads site photos

1. SceneUnderstandingAgent (Qwen2.5-VL or Gemini 2.5 Flash)
   → identifies objects: doors, shelves, camera, counter
   → returns: JSON with bounding boxes + labels

2. DepthEstimationAgent (Depth Anything V2)
   → estimates relative depth
   → calibrates with known dimension (door = 0.9m)

3. SceneCompilerAgent (SpatialLM or custom)
   → converts detections + depth → SecurityScene blocks
   → returns: draft SecurityScene JSON

4. UserConfirmationLoop
   → each extracted object shown for confirmation/correction
   → low-confidence items flagged

5. Coverage engine runs on confirmed scene
```

This is a multi-stage agentic pipeline where each agent is specialized,
the pipeline is orchestrated, and the user is in the loop at the right points.

---

## The Hackathon Story: What Codex Actually Built

The narrative for judges:

> SentinelTwin used Codex as a parallel coding team, not a coding assistant.
>
> While the developer worked on the coverage engine's core algorithm, Codex simultaneously:
> - built and tested the grid sampler in sandbox A
> - built and tested the FOV test in sandbox B
> - built and tested the raycast occlusion module in sandbox C
> - generated the demo scene JSON in sandbox D
>
> This parallelism compressed 2 days of linear development into 4 hours.
> Codex read the architecture documentation in AGENTS.md and CLAUDE.md at the start of each task,
> understood the constraints (no React in simulation package, three-mesh-bvh mandatory,
> SecurityScene is the single source of truth), and built to those specs without being
> re-prompted about them on every task.
>
> The documentation-first approach meant Codex had enough context to build correctly.
> The AGENTS.md file is the key: it told Codex the decisions, the rules, and the file to start from.
> Codex then executed — autonomously, in parallel, correctly.

This is a genuine, specific, demonstrable use of Codex's agentic capabilities.
Not "we used AI to generate some code." We used Codex as a parallel engineering team.
