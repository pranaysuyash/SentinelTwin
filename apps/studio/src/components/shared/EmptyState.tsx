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
      <p className="text-center text-[10px] text-[#4d566b] max-w-[200px] leading-relaxed">
        {message}
      </p>
      {subtext && (
        <p className="text-[9px] text-[#3a4158]">{subtext}</p>
      )}
      {action}
    </div>
  );
}
