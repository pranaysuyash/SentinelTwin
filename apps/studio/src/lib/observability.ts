export type TraceSpan = {
  id: string;
  parentId: string | null;
  operation: string;
  category: "simulation" | "camera" | "sensor" | "evidence" | "ai" | "network" | "storage" | "render";
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
  status: "ok" | "error";
  error: string | null;
  metadata: Record<string, unknown>;
};

export type Trace = {
  id: string;
  rootOperation: string;
  spans: TraceSpan[];
  startedAt: number;
  endedAt: number | null;
  totalDurationMs: number | null;
  status: "ok" | "error";
};

const activeTraces = new Map<string, Trace>();
const completedTraces: Trace[] = [];
const MAX_COMPLETED_TRACES = 100;

export function startTrace(rootOperation: string): string {
  const id = `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  activeTraces.set(id, { id, rootOperation, spans: [], startedAt: Date.now(), endedAt: null, totalDurationMs: null, status: "ok" });
  return id;
}

export function endTrace(traceId: string): void {
  const trace = activeTraces.get(traceId);
  if (!trace) return;
  trace.endedAt = Date.now();
  trace.totalDurationMs = trace.endedAt - trace.startedAt;
  trace.status = trace.spans.some((s) => s.status === "error") ? "error" : "ok";
  activeTraces.delete(traceId);
  completedTraces.unshift(trace);
  if (completedTraces.length > MAX_COMPLETED_TRACES) completedTraces.length = MAX_COMPLETED_TRACES;
}

export function startSpan(traceId: string, operation: string, category: TraceSpan["category"], metadata: Record<string, unknown> = {}): string {
  const trace = activeTraces.get(traceId);
  if (!trace) return "";
  const id = `span_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  trace.spans.push({ id, parentId: null, operation, category, startedAt: Date.now(), endedAt: null, durationMs: null, status: "ok", error: null, metadata });
  return id;
}

export function endSpan(traceId: string, spanId: string, error?: string): void {
  const trace = activeTraces.get(traceId);
  if (!trace) return;
  const span = trace.spans.find((s) => s.id === spanId);
  if (!span) return;
  span.endedAt = Date.now();
  span.durationMs = span.endedAt - span.startedAt;
  if (error) {
    span.status = "error";
    span.error = error;
  }
}

export function getRecentTraces(count = 20): Trace[] {
  return completedTraces.slice(0, count);
}

export function getActiveTraces(): Trace[] {
  return [...activeTraces.values()];
}

export function clearTraces(): void {
  activeTraces.clear();
  completedTraces.length = 0;
}
