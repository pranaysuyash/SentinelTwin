import { describe, it, expect, beforeEach } from "bun:test";

import { CoordinatorAgent, ConversationMemory } from "@sentineltwin/agents";
import type { AgentTask, AgentResult } from "@sentineltwin/agents";

describe("ConversationMemory", () => {
  let memory: ConversationMemory;

  beforeEach(() => {
    memory = new ConversationMemory(5, 200);
  });

  it("stores and retrieves exchanges", () => {
    memory.add("user", "Turn on camera 1");
    memory.add("assistant", "Camera 1 is now on");

    const history = memory.getHistory();
    expect(history.length).toBe(2);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toBe("Turn on camera 1");
    expect(history[1].role).toBe("assistant");
    expect(history[1].content).toBe("Camera 1 is now on");
  });

  it("enforces max exchanges limit", () => {
    for (let i = 0; i < 10; i++) {
      memory.add("user", `Message ${i}`);
      memory.add("assistant", `Response ${i}`);
    }
    expect(memory.getHistory().length).toBe(5);
  });

  it("triggers summarization when context exceeds threshold", () => {
    // estimateTokens uses Math.ceil(text.length / 4), so 500 chars ≈ 125 tokens
    // Two messages of 500 chars each = 250 tokens > 200 threshold
    memory.add("user", "a".repeat(500));
    memory.add("assistant", "b".repeat(500));

    // Should have triggered summarization
    const summary = memory.getSummary();
    expect(summary).not.toBeNull();
    expect(summary).toContain("Recent conversation summary");
  });

  it("returns null summary when under threshold", () => {
    memory.add("user", "Short message");
    memory.add("assistant", "Short reply");

    expect(memory.getSummary()).toBeNull();
  });

  it("clears history and summary", () => {
    memory.add("user", "Message");
    memory.clear();
    expect(memory.getHistory().length).toBe(0);
    expect(memory.getSummary()).toBeNull();
  });
});

describe("CoordinatorAgent", () => {
  let coordinator: CoordinatorAgent;

  beforeEach(() => {
    coordinator = new CoordinatorAgent();
  });

  it("routes tasks to registered agents", async () => {
    const mockExecutor = {
      execute: async (task: AgentTask): Promise<AgentResult> => ({
        taskId: task.id,
        role: task.role,
        output: `Executed ${task.role}: ${task.input}`,
      }),
    };

    coordinator.registerAgent("command", mockExecutor);

    const task: AgentTask = {
      id: "task_1",
      role: "command",
      input: "Turn on camera 1",
    };

    const result = await coordinator.routeTask(task);
    expect(result.role).toBe("command");
    expect(result.output).toBe("Executed command: Turn on camera 1");
    expect(result.error).toBeUndefined();
  });

  it("returns error for unregistered agent role", async () => {
    const task: AgentTask = {
      id: "task_2",
      role: "report",
      input: "Generate report",
    };

    const result = await coordinator.routeTask(task);
    expect(result.error).toContain("No agent registered");
  });

  it("returns error when agent execute throws", async () => {
    const failingExecutor = {
      execute: async (): Promise<AgentResult> => {
        throw new Error("Something went wrong");
      },
    };

    coordinator.registerAgent("counterfactual", failingExecutor);

    const task: AgentTask = {
      id: "task_3",
      role: "counterfactual",
      input: "Test",
    };

    const result = await coordinator.routeTask(task);
    expect(result.error).toBe("Something went wrong");
  });

  it("executes chain of tasks sequentially", async () => {
    const callOrder: number[] = [];
    const executor = {
      execute: async (task: AgentTask): Promise<AgentResult> => {
        callOrder.push(parseInt(task.id.split("_")[1]));
        return { taskId: task.id, role: task.role, output: "done" };
      },
    };

    coordinator.registerAgent("command", executor);
    coordinator.registerAgent("report", executor);

    const results = await coordinator.executeChain([
      { id: "task_0", role: "command", input: "First" },
      { id: "task_1", role: "report", input: "Second" },
      { id: "task_2", role: "command", input: "Third" },
    ]);

    expect(results.length).toBe(3);
    expect(callOrder).toEqual([0, 1, 2]);
    expect(results.every((r) => !r.error)).toBe(true);
  });

  it("stops chain on error", async () => {
    const executor = {
      execute: async (task: AgentTask): Promise<AgentResult> => {
        if (task.id === "task_1") throw new Error("Failed");
        return { taskId: task.id, role: task.role, output: "done" };
      },
    };

    coordinator.registerAgent("command", executor);

    const results = await coordinator.executeChain([
      { id: "task_0", role: "command", input: "First" },
      { id: "task_1", role: "command", input: "Second" },
      { id: "task_2", role: "command", input: "Third" },
    ]);

    expect(results.length).toBe(2);
    expect(results[1].error).toBe("Failed");
  });

  it("tracks agent status", () => {
    expect(coordinator.getAgentStatus()).toEqual([]);

    const executor = {
      execute: async (task: AgentTask): Promise<AgentResult> => ({
        taskId: task.id,
        role: task.role,
        output: "done",
      }),
    };

    coordinator.registerAgent("command", executor);
    coordinator.registerAgent("report", executor);

    const status = coordinator.getAgentStatus();
    expect(status.length).toBe(2);
    expect(status.map((s) => s.role).sort()).toEqual(["command", "report"]);
    expect(status.every((s) => s.status === "idle")).toBe(true);
  });

  it("manages conversation context", () => {
    const task: AgentTask = { id: "t1", role: "command", input: "Hello" };

    const executor = {
      execute: async (t: AgentTask): Promise<AgentResult> => ({
        taskId: t.id,
        role: t.role,
        output: "Hi there",
      }),
    };

    coordinator.registerAgent("command", executor);

    // After routing a task, conversation context should have history
    coordinator.routeTask(task).then(() => {
      const ctx = coordinator.getConversationContext();
      expect(ctx.history.length).toBe(2);
      expect(ctx.history[0].content).toBe("Hello");
      expect(ctx.history[1].content).toBe("Hi there");
    });
  });

  it("resets conversation", () => {
    const task: AgentTask = { id: "t1", role: "command", input: "Test" };
    const executor = {
      execute: async (t: AgentTask): Promise<AgentResult> => ({
        taskId: t.id,
        role: t.role,
        output: "Response",
      }),
    };

    coordinator.registerAgent("command", executor);

    coordinator.routeTask(task).then(() => {
      coordinator.resetConversation();
      expect(coordinator.getConversationContext().history.length).toBe(0);
      expect(coordinator.getActiveChain().length).toBe(0);
    });
  });
});
