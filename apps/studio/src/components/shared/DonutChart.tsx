import { cn } from "@/lib/cn";

interface DonutChartProps {
  value: number;          // 0-100
  size?: number;          // px
  strokeWidth?: number;   // px
  color?: string;         // stroke colour (CSS)
  bgColor?: string;
  label?: string;
  sublabel?: string;
  className?: string;
}

export function DonutChart({
  value,
  size = 72,
  strokeWidth = 6,
  color = "#f97316",
  bgColor = "#1a1d26",
  label,
  sublabel,
  className,
}: DonutChartProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(Math.max(value, 0), 100) / 100) * circ;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* background track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* value arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={0}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      {/* centre text */}
      {label && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center"
          style={{ fontSize: size < 60 ? 9 : 11 }}
        >
          <span className="font-bold text-white leading-none" style={{ fontSize: size < 60 ? 11 : 16 }}>
            {label}
          </span>
          {sublabel && (
            <span className="text-[9px] font-semibold tracking-wide mt-0.5" style={{ color }}>
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
