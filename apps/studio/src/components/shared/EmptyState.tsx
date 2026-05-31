"use client";

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  subtext?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, message, subtext, action }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      {icon && (
        <div className="flex items-center justify-center">
          {icon}
        </div>
      )}
      <p className="text-center text-[10px] max-w-[200px] leading-relaxed" style={{ color: "var(--st-text-dim, #4d566b)" }}>
        {message}
      </p>
      {subtext && (
        <p className="text-[9px]" style={{ color: "color-mix(in srgb, var(--st-text-dim, #3a4158) 80%, transparent)" }}>{subtext}</p>
      )}
      {action}
    </div>
  );
}
