import { ShieldCheck, BrainCircuit, Activity, HelpCircle, Database, Radio } from "lucide-react";
import { cn } from "@/lib/cn";

export type TruthLabel = "computed" | "inferred" | "imported" | "simulated" | "placeholder" | "live" | "configured";

interface TruthBadgeProps {
  label: TruthLabel;
  className?: string;
  showText?: boolean;
}

export function TruthBadge({ label, className, showText = true }: TruthBadgeProps) {
  const config = {
    computed: {
      color: "text-cyan-400 bg-cyan-950/30 border-cyan-900/50",
      icon: Database,
      text: "Computed",
    },
    simulated: {
      color: "text-blue-400 bg-blue-950/30 border-blue-900/50",
      icon: Activity,
      text: "Simulated",
    },
    inferred: {
      color: "text-purple-400 bg-purple-950/30 border-purple-900/50",
      icon: BrainCircuit,
      text: "Inferred",
    },
    imported: {
      color: "text-indigo-400 bg-indigo-950/30 border-indigo-900/50",
      icon: Database,
      text: "Imported",
    },
    live: {
      color: "text-emerald-400 bg-emerald-950/30 border-emerald-900/50",
      icon: Radio,
      text: "Live",
    },
    real: {
      color: "text-emerald-400 bg-emerald-950/30 border-emerald-900/50",
      icon: ShieldCheck,
      text: "Real Evidence",
    },
    configured: {
      color: "text-sky-400 bg-sky-950/30 border-sky-900/50",
      icon: ShieldCheck,
      text: "Configured",
    },
    placeholder: {
      color: "text-amber-500 bg-amber-950/30 border-amber-900/50",
      icon: HelpCircle,
      text: "Placeholder",
    },
  };

  const { color, icon: Icon, text } = config[label];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.1em]",
        color,
        className,
      )}
      title={`Truth Label: ${text}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {showText && <span>{text}</span>}
    </div>
  );
}
