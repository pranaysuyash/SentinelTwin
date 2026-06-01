import type { AgentResult, AgentRole, AgentTask } from "./types";

export class ConversationMemory {
  private maxExchanges: number;
  private maxContextTokens: number;
  private exchanges: { role: "user" | "assistant"; content: string }[] = [];
  private summary: string | null = null;

  constructor(maxExchanges = 20, maxContextTokens = 8000) {
    this.maxExchanges = maxExchanges;
    this.maxContextTokens = maxContextTokens;
  }

  add(role: "user" | "assistant", content: string): void {
    this.exchanges.push({ role, content });
    if (this.exchanges.length > this.maxExchanges) {
      this.exchanges = this.exchanges.slice(-this.maxExchanges);
    }
    this.checkSummarization();
  }

  getHistory(): { role: "user" | "assistant"; content: string }[] {
    return this.exchanges;
  }

  getSummary(): string | null {
    return this.summary;
  }

  clear(): void {
    this.exchanges = [];
    this.summary = null;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private checkSummarization(): void {
    const totalChars = this.exchanges.reduce((sum, e) => sum + e.content.length, 0);
    if (Math.ceil(totalChars / 4) > this.maxContextTokens) {
      const recent = this.exchanges.slice(-6);
      const bullets = recent.map((entry) => `${entry.role}: ${entry.content.slice(0, 120)}`).join(" | ");
      this.summary = `Recent conversation summary (${this.exchanges.length} exchanges): ${bullets}`;
    }
  }
}

export class CoordinatorAgent {
  private memory: ConversationMemory;
  private agentRegistry: Map<AgentRole, { execute: (task: AgentTask) => Promise<AgentResult>; status: string }>;
  private activeChain: AgentTask[] = [];

  constructor() {
    this.memory = new ConversationMemory();
    this.agentRegistry = new Map();
  }

  registerAgent(role: AgentRole, executor: { execute: (task: AgentTask) => Promise<AgentResult> }): void {
    this.agentRegistry.set(role, { ...executor, status: "idle" });
  }

  getAgentStatus(): { role: AgentRole; status: string }[] {
    return Array.from(this.agentRegistry.entries()).map(([role, info]) => ({
      role,
      status: info.status,
    }));
  }

  async routeTask(task: AgentTask): Promise<AgentResult> {
    const agent = this.agentRegistry.get(task.role);
    if (!agent) {
      return {
        taskId: task.id,
        role: task.role,
        output: "",
        error: `No agent registered for role: ${task.role}`,
      };
    }

    this.activeChain.push(task);
    agent.status = "busy";

    try {
      this.memory.add("user", task.input);

      const result = await agent.execute(task);

      if (!result.error) {
        this.memory.add("assistant", result.output);
      }

      return result;
    } catch (err) {
      return {
        taskId: task.id,
        role: task.role,
        output: "",
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      this.activeChain = this.activeChain.filter((entry) => entry.id !== task.id);
      agent.status = "idle";
    }
  }

  async executeChain(tasks: AgentTask[]): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    for (const task of tasks) {
      const result = await this.routeTask(task);
      results.push(result);
      if (result.error) break;
    }
    return results;
  }

  getConversationContext(): { history: { role: "user" | "assistant"; content: string }[]; summary: string | null } {
    return {
      history: this.memory.getHistory(),
      summary: this.memory.getSummary(),
    };
  }

  resetConversation(): void {
    this.memory.clear();
    this.activeChain = [];
  }

  getActiveChain(): AgentTask[] {
    return this.activeChain;
  }
}

export const globalCoordinator = new CoordinatorAgent();
