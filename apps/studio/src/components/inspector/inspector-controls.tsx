"use client";

import { cn } from "@/lib/cn";

export function Field({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#181c27] py-2 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-[10px] text-[#6a748b]">{label}</span>
      <span className="flex items-center gap-1 text-right text-[11px] font-medium text-[#d2d9e8]">
        {value}
        {unit ? <span className="text-[9px] text-[#556076]">{unit}</span> : null}
      </span>
    </div>
  );
}

export function NumberInput({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-lg border border-[#1f2536] bg-[#111521] px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">{label}</span>
        {unit ? <span className="text-[8px] text-[#556076]">{unit}</span> : null}
      </div>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isNaN(next)) return;
          onChange(next);
        }}
        className="w-full bg-transparent text-right font-mono text-[11px] text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
      />
    </label>
  );
}

export function SliderInput({
  label,
  value,
  min = 0,
  max = 180,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="border-b border-[#181c27] py-2 last:border-b-0 last:pb-0 first:pt-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[10px] text-[#6a748b]">{label}</span>
        <span className="text-[11px] font-mono text-[#d2d9e8]">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-blue-400"
      />
    </div>
  );
}

export function ToggleField({
  label,
  value,
  trueLabel,
  falseLabel,
  onChange,
}: {
  label: string;
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#181c27] py-2 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-[10px] text-[#6a748b]">{label}</span>
      <div className="inline-flex overflow-hidden rounded-md border border-[#24283a] bg-[#111521]">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "px-2 py-1 text-[10px] font-medium transition-colors",
            value ? "bg-emerald-500/18 text-emerald-200" : "text-[#7f8aa3] hover:text-white",
          )}
        >
          {trueLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "border-l border-[#24283a] px-2 py-1 text-[10px] font-medium transition-colors",
            !value ? "bg-red-500/15 text-red-200" : "text-[#7f8aa3] hover:text-white",
          )}
        >
          {falseLabel}
        </button>
      </div>
    </div>
  );
}

export function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 border-b border-[#181c27] py-2 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-[10px] text-[#6a748b]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors hover:border-[#32384d]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SummaryStat({ label, value, accent = "text-[#d2d9e8]" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-[#1f2536] bg-[#111521] px-2 py-1.5">
      <div className={cn("text-[12px] font-semibold", accent)}>{value}</div>
      <div className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-[#556076]">{label}</div>
    </div>
  );
}

export function TextInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block rounded-lg border border-[#1f2536] bg-[#111521] px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">{label}</span>
      </div>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-right font-mono text-[11px] text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
      />
    </label>
  );
}

export function ColorInput({
  label,
  value,
  placeholder = "#ffffff",
  onChange,
  onClear,
}: {
  label: string;
  /** Hex color, or undefined when the surface uses its built-in color. */
  value: string | undefined;
  placeholder?: string;
  onChange: (v: string) => void;
  /** When provided, shows a reset affordance that clears the override. */
  onClear?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#181c27] py-2 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-[10px] text-[#6a748b]">{label}</span>
      <div className="flex items-center gap-1.5">
        {value !== undefined && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded px-1 py-0.5 text-[9px] text-[#556076] transition-colors hover:text-[#a8b4cc]"
            title="Reset to default color"
          >
            Reset
          </button>
        ) : null}
        <span className="font-mono text-[9px] text-[#7f8aa3]">{value ?? "default"}</span>
        <input
          type="color"
          value={value ?? placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-[#24283a] bg-[#111521] p-0.5"
        />
      </div>
    </div>
  );
}

export function PropSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#181c27] py-1.5 last:border-b-0">
      <span className="text-[10px] text-[#6a748b]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors hover:border-[#32384d]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
