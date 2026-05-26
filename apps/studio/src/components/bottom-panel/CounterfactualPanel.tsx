"use client";

import { motion } from "framer-motion";
import { ArrowUpDown, CheckCircle2, Lightbulb, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useState } from "react";

import type { CounterfactualCandidate } from "@/agents/CounterfactualAgent";
import { useAiCommand } from "@/hooks/use-ai-command";
import { cn } from "@/lib/cn";
import { createSecurityLightNode } from "@/lib/node-factory";
import { simulateStudio } from "@/simulation/simulate-studio";
import { useStudioStore } from "@/store/studio-store";

const COST_COLORS: Record<string, string> = {
  free: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

function DeltaBadge({ value, label, positive }: { value: number; label: string; positive?: "up" | "down" }) {
  const isGood = positive === "up" ? value > 0 : positive === "down" ? value < 0 : false;
  const isBad = positive === "up" ? value < 0 : positive === "down" ? value > 0 : false;

  return (
    <div className="flex items-center gap-1 text-[9px]">
      <span className="text-[#647089]">{label}</span>
      <span className={cn("font-mono font-medium", isGood ? "text-emerald-400" : isBad ? "text-red-400" : "text-[#9da8c0]")}>
        {value > 0 ? "+" : ""}{value}%
      </span>
    </div>
  );
}

interface CandidateCardProps {
  candidate: CounterfactualCandidate;
  onApply: (ops: CounterfactualCandidate["operations"]) => void;
}

function CandidateCard({ candidate, onApply }: CandidateCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border text-[9px] font-bold",
              COST_COLORS[candidate.costCategory] ?? "text-[#647089] border-[#24283a]",
            )}
          >
            {candidate.rank}
          </span>
          <p className="text-[11px] leading-snug text-[#d7deed]">{candidate.description}</p>
        </div>
        <span
          className={cn(
            "flex-shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider",
            COST_COLORS[candidate.costCategory] ?? "text-[#647089] border-[#24283a]",
          )}
        >
          {candidate.costCategory}
        </span>
      </div>

      {/* Verified deltas */}
      {candidate.verifiedDelta && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-[#1a2030] bg-[#07090f]/60 px-2 py-1.5">
          <DeltaBadge value={candidate.verifiedDelta.totalCoveragePctDelta} label="Coverage" positive="up" />
          <DeltaBadge value={candidate.verifiedDelta.blindspotPctDelta} label="Blindspot" positive="down" />
          {candidate.verifiedDelta.worstIssueResolved && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Critical issues resolved
            </span>
          )}
          {candidate.verifiedDelta.criticalZoneStatusChanges.length > 0 && (
            <span className="flex items-center gap-1 text-[9px] text-blue-400">
              {candidate.verifiedDelta.criticalZoneStatusChanges[0]}
            </span>
          )}
        </div>
      )}

      {/* Apply button */}
      <button
        onClick={() => onApply(candidate.operations)}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 py-1.5 text-[10px] font-medium text-emerald-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10"
      >
        <Sparkles className="h-3 w-3" />
        Apply This Fix
      </button>
    </motion.div>
  );
}

export function CounterfactualPanel() {
  const [constraints, setConstraints] = useState("");
  const [candidates, setCandidates] = useState<CounterfactualCandidate[]>([]);
  const [showInput, setShowInput] = useState(false);
  const { status, runCounterfactuals } = useAiCommand();
  const store = useStudioStore();

  const handlePropose = useCallback(() => {
    const constraintList = constraints
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    runCounterfactuals(constraintList, setCandidates);
  }, [constraints, runCounterfactuals]);

  const handleApply = useCallback(
    (ops: CounterfactualCandidate["operations"]) => {
      // Apply each operation to the scene
      for (const op of ops) {
        const typedOp = op as { type: string };
        const storeState = useStudioStore.getState();
        switch (typedOp.type) {
          case "move_obstruction": {
            const o = op as { obstructionId: string; newPosition: [number, number, number] };
            const obs = storeState.scene.obstructions.find((x) => x.id === o.obstructionId);
            if (obs) {
              obs.position = o.newPosition;
              storeState.markDirty();
            }
            break;
          }
          case "rotate_camera": {
            const o = op as { cameraId: string; yawDeg: number; pitchDeg?: number };
            const cam = storeState.scene.cameras.find((x) => x.id === o.cameraId);
            if (cam) {
              cam.yawDeg = o.yawDeg;
              if (o.pitchDeg !== undefined) cam.pitchDeg = o.pitchDeg;
              storeState.markDirty();
            }
            break;
          }
          case "toggle_camera": {
            const o = op as { cameraId: string; status: "on" | "off" };
            const cam = storeState.scene.cameras.find((x) => x.id === o.cameraId);
            if (cam) {
              cam.status = o.status;
              storeState.markDirty();
            }
            break;
          }
          case "add_light": {
            const o = op as { position: [number, number, number] };
            const light = createSecurityLightNode(o.position);
            storeState.scene.securityLights.push(light);
            storeState.markDirty();
            break;
          }
          default:
            break;
        }
      }
      store.setSimulationRunning(true);
      setTimeout(() => {
        const result = simulateStudio(store.scene);
        store.setSimulationResult(result, 0);
      }, 50);
    },
    [store],
  );

  const hasResult = store.simulationResult !== null;

  if (!showInput) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Lightbulb className="h-8 w-8 text-amber-400/40" />
        <p className="text-center text-[10px] text-[#5b667c] leading-relaxed max-w-[200px]">
          Find AI-suggested fixes for coverage issues in the current scene.
        </p>
        <button
          onClick={() => setShowInput(true)}
          disabled={!hasResult}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-3 py-2 text-[10px] font-medium text-emerald-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 disabled:opacity-40 disabled:hover:bg-[#111521] disabled:hover:border-[#24283a]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Find Fixes
        </button>
        {!hasResult && (
          <p className="text-[9px] text-[#4d566b]">Run simulation first to enable counterfactual analysis.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-2">
      {/* Constraints input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          placeholder="Constraints (e.g., Camera 1 cannot move, Budget is low)"
          className="min-w-0 flex-1 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 py-1.5 text-[10px] text-white placeholder-[#4d566b] outline-none transition-colors focus:border-[#3a4158]"
        />
        <button
          onClick={handlePropose}
          disabled={status.state === "parsing"}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
        >
          {status.state === "parsing" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          onClick={() => {
            setShowInput(false);
            setCandidates([]);
          }}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-[#24283a] bg-[#111521] text-[#5d6880] hover:text-white"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Candidates list */}
      <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
        {candidates.length === 0 && status.state !== "parsing" && (
          <p className="py-4 text-center text-[10px] text-[#4d566b]">Click the arrow to search for fixes.</p>
        )}
        {status.state === "parsing" && (
          <div className="flex items-center justify-center gap-2 py-6 text-[11px] text-amber-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching for fixes...
          </div>
        )}
        {candidates.map((candidate) => (
          <CandidateCard key={candidate.id} candidate={candidate} onApply={handleApply} />
        ))}
      </div>
    </div>
  );
}
