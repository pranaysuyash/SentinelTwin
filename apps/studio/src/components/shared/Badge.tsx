import { cn } from "@/lib/cn";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

type Variant = "green" | "red" | "amber" | "blue" | "gray" | "ghost";

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<Variant, string> = {
  green: "bg-green-950/60 text-green-400 border border-green-800/40",
  red:   "bg-red-950/60  text-red-400   border border-red-800/40",
  amber: "bg-amber-950/60 text-amber-400 border border-amber-800/40",
  blue:  "bg-blue-950/60  text-blue-400  border border-blue-800/40",
  gray:  "${UI_SURFACES.chip} text-[#668] border ${UI_SURFACES.borderPanel}",
  ghost: "${UI_SURFACES.textBody3} border ${UI_SURFACES.borderPanel}",
};

export function Badge({ children, variant = "gray", className, dot }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
      variantClasses[variant],
      className,
    )}>
      {dot && (
        <span className={cn(
          "w-1.5 h-1.5 rounded-full",
          variant === "green" && "bg-green-400",
          variant === "red"   && "bg-red-400",
          variant === "amber" && "bg-amber-400",
          variant === "blue"  && "bg-blue-400",
          (variant === "gray" || variant === "ghost") && "${UI_SURFACES.textMuted}",
        )} />
      )}
      {children}
    </span>
  );
}
