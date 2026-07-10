"use client";

import { Cpu, Loader2, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { globalCoordinator } from "@/agents/CoordinatorAgent";
import { globalTokenTracker } from "@/agents/providers/AgentConfig";
import { cn } from "@/lib/cn";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function AgentCoordinatorPanel() {
  const [agentStatus, setAgentStatus] = useState(globalCoordinator.getAgentStatus());
  const [usage, setUsage] = useState(globalTokenTracker.getUsage());
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setAgentStatus(globalCoordinator.getAgentStatus());
      setUsage(globalTokenTracker.getUsage());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full flex-col p-2">
      {/* Header */}
      <div className="`{flex items-center justify-between border-b ${UI_SURFACES.borderPanel} pb-1.5}`">
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-emerald-400/70" />
          <span className="text-[11px] font-medium text-[#e8edf5]">Agent Pipeline</span>
        </div>
        <button type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="`{rounded border ${UI_SURFACES.borderPanel} px-2 py-0.5 text-[8px] text-[#59637a] hover:text-white}`"
        >
          {showDetails ? "Hide Details" : "Show Details"}
        </button>
      </div>

      {/* Agent Status Cards */}
      <div className="mt-2 space-y-1.5">
        {agentStatus.map((agent) => (
          <div
            key={agent.role}
            className={cn(
              "flex items-center justify-between rounded-lg border px-2.5 py-1.5",
              agent.status === "busy"
                ? "border-amber-500/20 bg-amber-500/5"
                : agent.status === "error"
                  ? "border-red-500/20 bg-red-500/5"
                  : "${UI_SURFACES.borderPanel} bg-[#0b0f17]",
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  agent.status === "idle" ? "bg-emerald-500" : agent.status === "busy" ? "bg-amber-400" : "bg-red-400",
                )}
              />
              <span className="text-[10px] font-medium capitalize text-[#c5ccdb]">{agent.role}</span>
            </div>
            <span className="text-[9px] capitalize text-[#59637a]">
              {agent.status === "busy" ? (
                <span className="flex items-center gap-1 text-amber-300">
                  <Loader2 className="h-3 w-3 animate-spin" /> Active
                </span>
              ) : agent.status === "error" ? (
                <span className="text-red-300">Error</span>
              ) : agent.status === "busy" ? (
                "Busy"
              ) : (
                "Idle"
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Token Usage */}
      {showDetails && (
        <div className="`{mt-2 space-y-1 rounded-lg border ${UI_SURFACES.borderPanel} bg-[#0b0f17] p-2}`">
          <div className="`{flex items-center gap-1.5 border-b ${UI_SURFACES.borderPanel} pb-1}`">
            <Zap className="h-3 w-3 text-amber-400/70" />
            <span className="text-[9px] font-medium text-[#8090a8]">Token Usage</span>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px]">
              <span className="text-[#59637a]">Total Tokens</span>
              <span className="font-mono text-[#c5ccdb]">{usage.totalTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-[#59637a]">Prompt</span>
              <span className="font-mono text-[#c5ccdb]">{usage.totalPromptTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-[#59637a]">Completion</span>
              <span className="font-mono text-[#c5ccdb]">{usage.totalCompletionTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-[#59637a]">API Calls</span>
              <span className="font-mono text-[#c5ccdb]">{usage.callCount}</span>
            </div>
          </div>
          {Object.entries(usage.byModel).length > 0 && (
            <div className="`{border-t ${UI_SURFACES.borderPanel} pt-1}`">
              <span className="text-[8px] text-[#59637a]">By Model:</span>
              {Object.entries(usage.byModel).map(([model, tokens]) => (
                <div key={model} className="flex justify-between text-[8px]">
                  <span className="text-[#59637a]">{model}</span>
                  <span className="font-mono text-[#8090a8]">{tokens.totalTokens.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Chain */}
      {globalCoordinator.getActiveChain().length > 0 && showDetails && (
        <div className="`{mt-2 space-y-1 rounded-lg border ${UI_SURFACES.borderPanel} bg-[#0b0f17] p-2}`">
          <span className="text-[8px] font-medium uppercase tracking-wider text-[#59637a]">Active Chain</span>
          {globalCoordinator.getActiveChain().map((task) => (
            <div key={task.id} className="flex items-center gap-1.5 text-[8px] text-[#68738a]">
              <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[7px] text-emerald-300">{task.role}</span>
              <span className="truncate">{task.input.slice(0, 40)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
