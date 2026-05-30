import { ShieldCheck, BrainCircuit, Activity, HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export type TruthLabel = "simulated" | "inferred" | "real" | "placeholder";

interface TruthBadgeProps {
  label: TruthLabel;
  className?: string;
  showText?: boolean;
}

export function TruthBadge({ label, className, showText = true }: TruthBadgeProps) {
  const config = {
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
    real: {
      color: "text-emerald-400 bg-emerald-950/30 border-emerald-900/50",
      icon: ShieldCheck,
      text: "Real Evidence",
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
