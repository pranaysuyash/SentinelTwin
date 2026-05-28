"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CirclePlus,
  ImageUp,
  Loader2,
  ScanSearch,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState, type MouseEvent } from "react";

import { SurfaceButton } from "@/components/shared/SurfaceButton";
import { compileScanSessionToScene, createScanCandidate, createScanSession, SCAN_CANDIDATE_TYPES, summarizeScanProvenance, type ScanCandidate, type ScanCandidateKind, type ScanSession } from "@/lib/scan-to-scene";
import { useStudioStore } from "@/store/studio-store";

interface ScanSiteWizardProps {
  onClose?: () => void;
}

type ScanStep = 0 | 1 | 2 | 3;

const SAMPLE_SITE_IMAGE = (() => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-label="Sample retail site">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#142033" />
          <stop offset="100%" stop-color="#0b111d" />
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1d2a40" />
          <stop offset="100%" stop-color="#0f1726" />
        </linearGradient>
      </defs>
      <rect width="1200" height="900" fill="url(#bg)" />
      <rect x="70" y="80" width="1060" height="740" rx="28" fill="#0e1523" stroke="#2b3a56" stroke-width="10" />
      <rect x="110" y="130" width="980" height="650" rx="16" fill="url(#floor)" stroke="#344762" stroke-width="6" />
      <rect x="120" y="130" width="220" height="110" fill="#18253a" />
      <rect x="860" y="130" width="220" height="110" fill="#18253a" />
      <rect x="530" y="130" width="140" height="42" fill="#314464" />
      <rect x="530" y="130" width="140" height="18" fill="#445a7f" />
      <rect x="250" y="350" width="180" height="140" rx="12" fill="#33465f" />
      <rect x="220" y="560" width="260" height="100" rx="14" fill="#b7791f" />
      <rect x="720" y="500" width="280" height="120" rx="14" fill="#355f5a" />
      <rect x="760" y="260" width="120" height="120" rx="60" fill="#4fb3d9" opacity="0.2" />
      <circle cx="780" cy="280" r="24" fill="#8be9fd" />
      <circle cx="360" cy="290" r="20" fill="#94a3b8" />
      <text x="130" y="770" fill="#91a4c5" font-family="Inter, Arial, sans-serif" font-size="28" letter-spacing="0.2em">SAMPLE SITE PHOTO</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
})();

function kindMeta(kind: ScanCandidateKind) {
  const meta: Record<ScanCandidateKind, { label: string; accent: string; border: string; bg: string }> = {
    wall: { label: "Wall", accent: "text-sky-300", border: "border-sky-500/30", bg: "bg-sky-500/12" },
    door: { label: "Door", accent: "text-amber-300", border: "border-amber-500/30", bg: "bg-amber-500/12" },
    window: { label: "Window", accent: "text-cyan-300", border: "border-cyan-500/30", bg: "bg-cyan-500/12" },
    camera: { label: "Camera", accent: "text-emerald-300", border: "border-emerald-500/30", bg: "bg-emerald-500/12" },
    light: { label: "Light", accent: "text-yellow-300", border: "border-yellow-500/30", bg: "bg-yellow-500/12" },
    cupboard: { label: "Cupboard", accent: "text-violet-300", border: "border-violet-500/30", bg: "bg-violet-500/12" },
    counter: { label: "Cash Counter", accent: "text-rose-300", border: "border-rose-500/30", bg: "bg-rose-500/12" },
    shelf: { label: "Shelf", accent: "text-teal-300", border: "border-teal-500/30", bg: "bg-teal-500/12" },
    obstruction: { label: "Obstruction", accent: "text-slate-300", border: "border-slate-500/30", bg: "bg-slate-500/12" },
    entry_point: { label: "Entry Point", accent: "text-orange-300", border: "border-orange-500/30", bg: "bg-orange-500/12" },
    critical_zone: { label: "Critical Zone", accent: "text-fuchsia-300", border: "border-fuchsia-500/30", bg: "bg-fuchsia-500/12" },
  };

  return meta[kind];
}

function ScanTypeChips({
  activeKind,
  onChange,
}: {
  activeKind: ScanCandidateKind;
  onChange: (kind: ScanCandidateKind) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SCAN_CANDIDATE_TYPES.map((type) => {
        const meta = kindMeta(type.kind);
        const active = type.kind === activeKind;
        return (
          <button
            key={type.kind}
            type="button"
            onClick={() => onChange(type.kind)}
            className={[
              "rounded-full border px-3 py-1.5 text-[11px] transition-colors",
              active ? `${meta.border} ${meta.bg} ${meta.accent}` : "border-[#263043] bg-[#0d1320] text-[#8b96ae] hover:border-[#39455d] hover:text-white",
            ].join(" ")}
            title={type.description}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function StepBadge({ step, current, label }: { step: number; current: number; label: string }) {
  const active = step === current;
  const complete = step < current;

  return (
    <div className="flex items-center gap-2">
      <div
        className={[
          "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold",
          complete ? "bg-emerald-500 text-white" : active ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40" : "bg-[#182032] text-[#61708f]",
        ].join(" ")}
      >
        {complete ? <Check className="h-3 w-3" /> : current + 1}
      </div>
      <span className={active ? "text-[#dce5f4]" : "text-[#60708d]"}>{label}</span>
    </div>
  );
}

export function ScanSiteWizard({ onClose }: ScanSiteWizardProps) {
  const setScene = useStudioStore((s) => s.setScene);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState<ScanStep>(0);
  const [activeKind, setActiveKind] = useState<ScanCandidateKind>("counter");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingCandidateId, setDraggingCandidateId] = useState<string | null>(null);
  const [compileLowConfidenceOverride, setCompileLowConfidenceOverride] = useState(false);
  const [session, setSession] = useState<ScanSession>(() => createScanSession("Manual Assisted Scan", 10, 8, 3));

  const candidateStats = useMemo(() => {
    const accepted = session.candidates.filter((candidate) => candidate.status !== "rejected");
    const rejected = session.candidates.filter((candidate) => candidate.status === "rejected");
    const pending = session.candidates.filter((candidate) => candidate.status === "pending");
    return {
      accepted: accepted.length,
      rejected: rejected.length,
      pending: pending.length,
      cameraCount: accepted.filter((candidate) => candidate.kind === "camera").length,
      obstructionCount: accepted.filter((candidate) => candidate.kind === "counter" || candidate.kind === "cupboard" || candidate.kind === "shelf" || candidate.kind === "obstruction").length,
    };
  }, [session.candidates]);

  const canProceed = useMemo(() => {
    if (step === 0) return session.roomName.trim().length > 0;
    if (step === 1) return Boolean(session.imageDataUrl);
    if (step === 2) return Boolean(session.imageDataUrl);
    return true;
  }, [session.imageDataUrl, session.roomName, step]);

  const acceptedCandidates = useMemo(
    () => session.candidates.filter((candidate) => candidate.status !== "rejected"),
    [session.candidates],
  );
  const duplicateCandidateGroups = useMemo(() => {
    const groups: Array<{ kind: ScanCandidateKind; ids: string[] }> = [];
    const byKind = new Map<ScanCandidateKind, ScanCandidate[]>();
    for (const candidate of acceptedCandidates) {
      const list = byKind.get(candidate.kind) ?? [];
      list.push(candidate);
      byKind.set(candidate.kind, list);
    }

    const nearThreshold = 0.035;
    for (const [kind, candidates] of byKind.entries()) {
      const visited = new Set<string>();
      for (let i = 0; i < candidates.length; i += 1) {
        const base = candidates[i];
        if (visited.has(base.id)) continue;
        const cluster: string[] = [base.id];
        visited.add(base.id);
        for (let j = i + 1; j < candidates.length; j += 1) {
          const other = candidates[j];
          if (visited.has(other.id)) continue;
          const dx = base.point[0] - other.point[0];
          const dy = base.point[1] - other.point[1];
          const dist = Math.hypot(dx, dy);
          if (dist <= nearThreshold) {
            cluster.push(other.id);
            visited.add(other.id);
          }
        }
        if (cluster.length > 1) {
          groups.push({ kind, ids: cluster });
        }
      }
    }
    return groups;
  }, [acceptedCandidates]);
  const openingWithoutWallNearbyCount = useMemo(() => {
    const walls = acceptedCandidates.filter((candidate) => candidate.kind === "wall");
    if (walls.length === 0) {
      return acceptedCandidates.filter((candidate) => candidate.kind === "door" || candidate.kind === "window").length;
    }
    const maxNearbyDistance = 0.08;
    return acceptedCandidates.filter((candidate) => {
      if (candidate.kind !== "door" && candidate.kind !== "window") return false;
      const nearest = walls.reduce((best, wall) => {
        const dx = candidate.point[0] - wall.point[0];
        const dy = candidate.point[1] - wall.point[1];
        const dist = Math.hypot(dx, dy);
        return Math.min(best, dist);
      }, Number.POSITIVE_INFINITY);
      return nearest > maxNearbyDistance;
    }).length;
  }, [acceptedCandidates]);
  const lowConfidenceAccepted = useMemo(
    () => acceptedCandidates.filter((candidate) => candidate.confidence < 0.45),
    [acceptedCandidates],
  );
  const scanSanityIssues = useMemo(() => {
    const acceptedWalls = acceptedCandidates.filter((candidate) => candidate.kind === "wall").length;
    const acceptedDoors = acceptedCandidates.filter((candidate) => candidate.kind === "door").length;
    const acceptedCameras = acceptedCandidates.filter((candidate) => candidate.kind === "camera").length;
    const issues: string[] = [];
    if (acceptedWalls < 2) issues.push("Low wall evidence: fewer than 2 accepted wall candidates.");
    if (acceptedDoors === 0) issues.push("No accepted door candidate; entry/exit flow may be inaccurate.");
    if (acceptedCameras === 0) issues.push("No accepted camera candidate yet; coverage replay will be limited.");
    if (lowConfidenceAccepted.length > 0) issues.push(`${lowConfidenceAccepted.length} accepted candidate(s) are below 45% confidence.`);
    return issues;
  }, [acceptedCandidates, lowConfidenceAccepted.length]);
  const provenance = useMemo(() => summarizeScanProvenance(session), [session]);

  const updateSession = useCallback((patch: Partial<ScanSession>) => {
    setSession((current) => ({ ...current, ...patch, updatedAt: Date.now() }));
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setIsReading(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Failed to read image file."));
        reader.readAsDataURL(file);
      });

      setSession((current) => ({
        ...current,
        imageDataUrl: dataUrl,
        imageName: file.name,
        updatedAt: Date.now(),
      }));
      setStep(2);
      setSelectedCandidateId(null);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Failed to read image file.");
    } finally {
      setIsReading(false);
    }
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSampleSite = useCallback(() => {
    updateSession({
      imageDataUrl: SAMPLE_SITE_IMAGE,
      imageName: "sample-retail-site.svg",
    });
    setStep(2);
    setSelectedCandidateId(null);
  }, [updateSession]);

  const addCandidate = useCallback((point: [number, number]) => {
    let nextCandidateId = "";
    setSession((current) => {
      const candidate = createScanCandidate(activeKind, point, current.candidates.length);
      nextCandidateId = candidate.id;
      return {
        ...current,
        candidates: [...current.candidates, candidate],
        updatedAt: Date.now(),
      };
    });
    setSelectedCandidateId(nextCandidateId);
  }, [activeKind]);

  const updateCandidate = useCallback((candidateId: string, patch: Partial<ScanCandidate>) => {
    setSession((current) => ({
      ...current,
      candidates: current.candidates.map((candidate) => (
        candidate.id === candidateId ? { ...candidate, ...patch, source: patch.source ?? candidate.source } : candidate
      )),
      updatedAt: Date.now(),
    }));
  }, []);

  const removeCandidate = useCallback((candidateId: string) => {
    setSession((current) => ({
      ...current,
      candidates: current.candidates.filter((candidate) => candidate.id !== candidateId),
      updatedAt: Date.now(),
    }));
    setSelectedCandidateId((current) => (current === candidateId ? null : current));
  }, []);

  const handleImageClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!session.imageDataUrl) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const point: [number, number] = [
      Math.min(0.98, Math.max(0.02, (event.clientX - rect.left) / rect.width)),
      Math.min(0.98, Math.max(0.02, (event.clientY - rect.top) / rect.height)),
    ];
    addCandidate(point);
  }, [addCandidate, session.imageDataUrl]);

  const updateCandidatePointFromClient = useCallback((candidateId: string, clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const point: [number, number] = [
      Math.min(0.98, Math.max(0.02, (clientX - rect.left) / rect.width)),
      Math.min(0.98, Math.max(0.02, (clientY - rect.top) / rect.height)),
    ];
    updateCandidate(candidateId, { point, status: "edited" });
  }, [updateCandidate]);

  const nudgeSelectedCandidate = useCallback((dx: number, dy: number) => {
    if (!selectedCandidateId) return;
    const selected = session.candidates.find((candidate) => candidate.id === selectedCandidateId);
    if (!selected) return;
    const point: [number, number] = [
      Math.min(0.98, Math.max(0.02, selected.point[0] + dx)),
      Math.min(0.98, Math.max(0.02, selected.point[1] + dy)),
    ];
    updateCandidate(selectedCandidateId, { point, status: "edited" });
  }, [selectedCandidateId, session.candidates, updateCandidate]);

  const handleCompile = useCallback(async () => {
    if (!session.imageDataUrl) {
      setError("Upload a site image or choose the sample site before compiling.");
      return;
    }
    if (lowConfidenceAccepted.length > 0 && !compileLowConfidenceOverride) {
      setError("Low-confidence accepted candidates detected. Confirm override to compile anyway.");
      return;
    }

    setIsCompiling(true);
    setError(null);
    try {
      const compiled = compileScanSessionToScene(session);
      setScene(compiled.scene);
      onClose?.();
    } catch (compileError) {
      setError(compileError instanceof Error ? compileError.message : "Failed to compile scan session.");
    } finally {
      setIsCompiling(false);
    }
  }, [compileLowConfidenceOverride, lowConfidenceAccepted.length, onClose, session, setScene]);

  const handleMergeNearDuplicates = useCallback(() => {
    setSession((current) => {
      const activeCandidates = current.candidates.filter((candidate) => candidate.status !== "rejected");
      const nearThreshold = 0.035;
      const groupedIds: string[][] = [];
      const byKind = new Map<ScanCandidateKind, ScanCandidate[]>();
      for (const candidate of activeCandidates) {
        const list = byKind.get(candidate.kind) ?? [];
        list.push(candidate);
        byKind.set(candidate.kind, list);
      }
      for (const candidates of byKind.values()) {
        const visited = new Set<string>();
        for (let i = 0; i < candidates.length; i += 1) {
          const base = candidates[i];
          if (visited.has(base.id)) continue;
          const cluster: string[] = [base.id];
          visited.add(base.id);
          for (let j = i + 1; j < candidates.length; j += 1) {
            const other = candidates[j];
            if (visited.has(other.id)) continue;
            const dx = base.point[0] - other.point[0];
            const dy = base.point[1] - other.point[1];
            if (Math.hypot(dx, dy) <= nearThreshold) {
              cluster.push(other.id);
              visited.add(other.id);
            }
          }
          if (cluster.length > 1) groupedIds.push(cluster);
        }
      }
      if (groupedIds.length === 0) return current;

      const groupMap = new Map<string, string[]>();
      for (const group of groupedIds) {
        for (const id of group) groupMap.set(id, group);
      }
      const nextCandidates: ScanCandidate[] = current.candidates.map((candidate) => {
        const group = groupMap.get(candidate.id);
        if (!group) return candidate;
        const [keeperId] = group;
        if (candidate.id !== keeperId) {
          return {
            ...candidate,
            status: "rejected" as ScanCandidate["status"],
            note: "Auto-fix: merged into nearest same-type duplicate group.",
          };
        }
        const groupedCandidates = current.candidates.filter((entry) => group.includes(entry.id));
        const avgX = groupedCandidates.reduce((sum, entry) => sum + entry.point[0], 0) / groupedCandidates.length;
        const avgY = groupedCandidates.reduce((sum, entry) => sum + entry.point[1], 0) / groupedCandidates.length;
        const avgConfidence = groupedCandidates.reduce((sum, entry) => sum + entry.confidence, 0) / groupedCandidates.length;
        return {
          ...candidate,
          point: [avgX, avgY] as [number, number],
          confidence: avgConfidence,
          status: "edited" as ScanCandidate["status"],
          note: `Auto-fix: merged ${groupedCandidates.length} near-duplicate candidates.`,
        };
      });
      return {
        ...current,
        candidates: nextCandidates,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const handleSnapOpeningsToWalls = useCallback(() => {
    setSession((current) => {
      const walls = current.candidates.filter((candidate) => candidate.status !== "rejected" && candidate.kind === "wall");
      if (walls.length === 0) return current;
      let changed = false;
      const nextCandidates: ScanCandidate[] = current.candidates.map((candidate) => {
        if (candidate.status === "rejected" || (candidate.kind !== "door" && candidate.kind !== "window")) {
          return candidate;
        }
        const nearestWall = walls.reduce((best, wall) => {
          const dx = candidate.point[0] - wall.point[0];
          const dy = candidate.point[1] - wall.point[1];
          const dist = Math.hypot(dx, dy);
          if (!best || dist < best.dist) return { wall, dist };
          return best;
        }, null as { wall: ScanCandidate; dist: number } | null);
        if (!nearestWall) return candidate;
        const snappedPoint: [number, number] = [
          candidate.point[0] * 0.65 + nearestWall.wall.point[0] * 0.35,
          candidate.point[1] * 0.65 + nearestWall.wall.point[1] * 0.35,
        ];
        changed = true;
        return {
          ...candidate,
          point: snappedPoint,
          status: "edited" as ScanCandidate["status"],
          note: `Auto-fix: snapped toward nearest wall (${(nearestWall.dist * 100).toFixed(1)}% normalized distance).`,
        };
      });
      if (!changed) return current;
      return {
        ...current,
        candidates: nextCandidates,
        updatedAt: Date.now(),
      };
    });
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0b0f17]">
      <div className="flex items-center justify-between border-b border-[#1e2130] px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-white">
            <ScanSearch className="h-4 w-4 text-cyan-300" />
            <h2 className="text-sm font-semibold">Scan a Site</h2>
            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-cyan-200">
              Manual-assisted
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#7e8da9]">
            Upload a site photo, tap objects on the image, classify them, and compile the result into the live Studio scene.
          </p>
        </div>
        <SurfaceButton onClick={onClose}>Close</SurfaceButton>
      </div>

      <div className="border-b border-[#1e2130] px-4 py-3">
        <div className="grid gap-3 md:grid-cols-4">
          <StepBadge step={0} current={step} label="Scene setup" />
          <StepBadge step={1} current={step} label="Image source" />
          <StepBadge step={2} current={step} label="Annotate objects" />
          <StepBadge step={3} current={step} label="Review & compile" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 py-4">
        {step === 0 ? (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-[#1f2536] bg-[#0c111b] p-4">
              <h3 className="text-sm font-semibold text-white">Room details</h3>
              <p className="mt-1 text-xs text-[#8292af]">
                These values seed the output scene. You can fine-tune them later in Camera Studio.
              </p>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-[11px] text-[#9db0d0]">Scene name</span>
                  <input
                    value={session.roomName}
                    onChange={(event) => updateSession({ roomName: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#243049] bg-[#0a0f17] px-3 py-2 text-sm text-[#e3ebf8] outline-none focus:border-cyan-500/50"
                    placeholder="Manual Assisted Scan"
                  />
                </label>

                <div className="grid grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-[11px] text-[#9db0d0]">Width (m)</span>
                    <input
                      type="number"
                      min={1}
                      step={0.1}
                      value={session.widthM}
                      onChange={(event) => updateSession({ widthM: Math.max(1, Number(event.target.value) || 1) })}
                      className="mt-1 w-full rounded-xl border border-[#243049] bg-[#0a0f17] px-3 py-2 text-sm text-[#e3ebf8] outline-none focus:border-cyan-500/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-[#9db0d0]">Depth (m)</span>
                    <input
                      type="number"
                      min={1}
                      step={0.1}
                      value={session.depthM}
                      onChange={(event) => updateSession({ depthM: Math.max(1, Number(event.target.value) || 1) })}
                      className="mt-1 w-full rounded-xl border border-[#243049] bg-[#0a0f17] px-3 py-2 text-sm text-[#e3ebf8] outline-none focus:border-cyan-500/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-[#9db0d0]">Height (m)</span>
                    <input
                      type="number"
                      min={2}
                      step={0.1}
                      value={session.heightM}
                      onChange={(event) => updateSession({ heightM: Math.max(2, Number(event.target.value) || 2) })}
                      className="mt-1 w-full rounded-xl border border-[#243049] bg-[#0a0f17] px-3 py-2 text-sm text-[#e3ebf8] outline-none focus:border-cyan-500/50"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-[11px] text-[#9db0d0]">Known reference length (m)</span>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={session.scaleReferenceM}
                    onChange={(event) => updateSession({ scaleReferenceM: Math.max(0.1, Number(event.target.value) || 0.1) })}
                    className="mt-1 w-44 rounded-xl border border-[#243049] bg-[#0a0f17] px-3 py-2 text-sm text-[#e3ebf8] outline-none focus:border-cyan-500/50"
                  />
                </label>

                <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/8 p-3 text-xs text-cyan-100/90">
                  This flow is intentionally manual-assisted. Tap the image to place candidates, then classify each object before compiling.
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#1f2536] bg-[#0c111b] p-4">
              <h3 className="text-sm font-semibold text-white">Session snapshot</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#243049] bg-[#0a0f17] p-3">
                  <div className="text-[11px] text-[#8192b1]">Candidates</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{session.candidates.length}</div>
                </div>
                <div className="rounded-xl border border-[#243049] bg-[#0a0f17] p-3">
                  <div className="text-[11px] text-[#8192b1]">Cameras</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{candidateStats.cameraCount}</div>
                </div>
                <div className="rounded-xl border border-[#243049] bg-[#0a0f17] p-3">
                  <div className="text-[11px] text-[#8192b1]">Obstructions</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{candidateStats.obstructionCount}</div>
                </div>
                <div className="rounded-xl border border-[#243049] bg-[#0a0f17] p-3">
                  <div className="text-[11px] text-[#8192b1]">Source</div>
                  <div className="mt-1 text-sm font-medium text-cyan-200">Manual scan</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-2xl border border-[#1f2536] bg-[#0c111b] p-4">
              <h3 className="text-sm font-semibold text-white">Choose a site image</h3>
              <p className="mt-1 text-xs text-[#8292af]">
                Upload a photo or use the bundled sample. This keeps the scan flow testable without waiting on AI perception.
              </p>

              <div
                className="mt-4 flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#263043] bg-[#09111b] px-4 py-10 text-center transition-colors hover:border-cyan-500/40"
                onClick={handleUploadClick}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files[0];
                  if (file && file.type.startsWith("image/")) {
                    void handleFile(file);
                  }
                }}
              >
                {isReading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
                    <p className="text-sm text-[#a9bad7]">Reading image...</p>
                  </div>
                ) : (
                  <>
                    <ImageUp className="h-10 w-10 text-[#5d6b84]" />
                    <p className="mt-4 text-sm font-medium text-[#d6dfef]">Drop an image here or click to upload</p>
                    <p className="mt-1 text-xs text-[#73839f]">PNG, JPG, or SVG. You can also use the built-in sample site.</p>
                    <div className="mt-5 flex gap-2">
                      <SurfaceButton type="button" onClick={(event) => {
                        event.stopPropagation();
                        handleUploadClick();
                      }}>
                        Upload photo
                      </SurfaceButton>
                      <SurfaceButton type="button" onClick={(event) => {
                        event.stopPropagation();
                        handleSampleSite();
                      }}>
                        Use sample site
                      </SurfaceButton>
                    </div>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleFile(file);
                  }
                  event.target.value = "";
                }}
              />
            </div>

            <div className="rounded-2xl border border-[#1f2536] bg-[#0c111b] p-4">
              <h3 className="text-sm font-semibold text-white">What happens next</h3>
              <div className="mt-4 space-y-3 text-xs text-[#8292af]">
                <p>1. You upload a photo of the site or use the sample retail layout.</p>
                <p>2. You tap locations on the image and classify them as wall, door, camera, cupboard, counter, or another object type.</p>
                <p>3. The scan candidates remain separate from the final scene until you compile them.</p>
                <p>4. The result becomes a real SecurityScene, ready for the existing coverage and replay flow.</p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid h-full gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="flex min-h-0 flex-col rounded-2xl border border-[#1f2536] bg-[#0c111b] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Annotate the photo</h3>
                  <p className="mt-1 text-xs text-[#8292af]">
                    Click a point on the image to add a candidate. Classification is manual for now, so the flow is honest about what is real today.
                  </p>
                </div>
                <SurfaceButton type="button" onClick={handleUploadClick}>
                  <ImageUp className="h-3.5 w-3.5" />
                  Replace image
                </SurfaceButton>
              </div>

              <div className="mt-4">
                <ScanTypeChips activeKind={activeKind} onChange={setActiveKind} />
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#243049] bg-[#09111b]">
                <div className="relative h-full min-h-[360px] w-full">
                  {session.imageDataUrl ? (
                    <div
                      ref={canvasRef}
                      className="relative h-full w-full cursor-crosshair overflow-hidden"
                      onClick={handleImageClick}
                      onPointerMove={(event) => {
                        if (!draggingCandidateId) return;
                        updateCandidatePointFromClient(draggingCandidateId, event.clientX, event.clientY);
                      }}
                      onPointerUp={() => setDraggingCandidateId(null)}
                      onPointerLeave={() => setDraggingCandidateId(null)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowLeft") {
                          event.preventDefault();
                          nudgeSelectedCandidate(-0.005, 0);
                        } else if (event.key === "ArrowRight") {
                          event.preventDefault();
                          nudgeSelectedCandidate(0.005, 0);
                        } else if (event.key === "ArrowUp") {
                          event.preventDefault();
                          nudgeSelectedCandidate(0, -0.005);
                        } else if (event.key === "ArrowDown") {
                          event.preventDefault();
                          nudgeSelectedCandidate(0, 0.005);
                        }
                      }}
                      tabIndex={0}
                    >
                      <img
                        src={session.imageDataUrl}
                        alt={session.imageName ?? "Uploaded site"}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(16,24,40,0.04),rgba(16,24,40,0.04)),radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.06),transparent_70%)]" />
                      {session.candidates.map((candidate, index) => {
                        const meta = kindMeta(candidate.kind);
                        const isSelected = candidate.id === selectedCandidateId;
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            className={[
                              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-[10px] font-medium shadow-lg",
                              meta.border,
                              meta.bg,
                              meta.accent,
                              candidate.status === "rejected" ? "opacity-40" : "opacity-100",
                              isSelected ? "ring-2 ring-white/70" : "",
                            ].join(" ")}
                            style={{ left: `${candidate.point[0] * 100}%`, top: `${candidate.point[1] * 100}%` }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedCandidateId(candidate.id);
                            }}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              setSelectedCandidateId(candidate.id);
                              setDraggingCandidateId(candidate.id);
                            }}
                            title={`${candidate.label} (${candidate.status})`}
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[360px] items-center justify-center px-6 text-center">
                      <div>
                        <ScanSearch className="mx-auto h-10 w-10 text-[#5b6881]" />
                        <p className="mt-3 text-sm font-medium text-[#d7e0f0]">Upload a site image to begin</p>
                        <p className="mt-1 text-xs text-[#73839f]">The image area will become the annotation canvas once a photo is loaded.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col rounded-2xl border border-[#1f2536] bg-[#0c111b] p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">Candidate review</h3>
                  <p className="mt-1 text-xs text-[#8292af]">
                    Confirm, relabel, or reject each annotation before compile.
                  </p>
                </div>
                <span className="rounded-full border border-[#243049] bg-[#09111b] px-2 py-1 text-[10px] text-[#8da0bf]">
                  {session.candidates.length} total
                </span>
              </div>

              <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                <div className="rounded-xl border border-[#243049] bg-[#09111b] px-3 py-2 text-[10px] text-[#89a0c2]">
                  Drag markers to reposition. Use keyboard arrow keys for fine nudges when the canvas is focused.
                </div>
                {session.candidates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#243049] bg-[#09111b] px-4 py-8 text-center text-xs text-[#73839f]">
                    Tap the image to add the first candidate. Use the kind chips above to switch what you are placing.
                  </div>
                ) : (
                  session.candidates.map((candidate, index) => {
                    const meta = kindMeta(candidate.kind);
                    const isSelected = candidate.id === selectedCandidateId;
                    return (
                      <div
                        key={candidate.id}
                        className={[
                          "rounded-2xl border p-3 transition-colors",
                          isSelected ? "border-cyan-500/40 bg-cyan-500/10" : "border-[#243049] bg-[#09111b]",
                        ].join(" ")}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedCandidateId(candidate.id)}
                            className={[
                              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                              meta.border,
                              meta.bg,
                              meta.accent,
                            ].join(" ")}
                          >
                            {index + 1}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-white">{candidate.label}</span>
                              <span className="rounded-full border border-[#243049] bg-[#0c111b] px-2 py-0.5 text-[10px] text-[#89a0c2]">
                                {candidate.status}
                              </span>
                            </div>
                            <div className="mt-1 grid gap-2 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-[10px] text-[#73839f]">Type</span>
                                <select
                                  value={candidate.kind}
                                  onChange={(event) => updateCandidate(candidate.id, { kind: event.target.value as ScanCandidateKind })}
                                  className="mt-1 w-full rounded-xl border border-[#243049] bg-[#0a0f17] px-3 py-2 text-xs text-[#e3ebf8] outline-none focus:border-cyan-500/50"
                                >
                                  {SCAN_CANDIDATE_TYPES.map((type) => (
                                    <option key={type.kind} value={type.kind}>
                                      {type.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block">
                                <span className="text-[10px] text-[#73839f]">Status</span>
                                <select
                                  value={candidate.status}
                                  onChange={(event) => updateCandidate(candidate.id, { status: event.target.value as ScanSession["candidates"][number]["status"] })}
                                  className="mt-1 w-full rounded-xl border border-[#243049] bg-[#0a0f17] px-3 py-2 text-xs text-[#e3ebf8] outline-none focus:border-cyan-500/50"
                                >
                                  <option value="accepted">accepted</option>
                                  <option value="edited">edited</option>
                                  <option value="pending">pending</option>
                                  <option value="rejected">rejected</option>
                                </select>
                              </label>
                            </div>
                            <label className="mt-2 block">
                              <span className="text-[10px] text-[#73839f]">Label</span>
                              <input
                                value={candidate.label}
                                onChange={(event) => updateCandidate(candidate.id, { label: event.target.value })}
                                className="mt-1 w-full rounded-xl border border-[#243049] bg-[#0a0f17] px-3 py-2 text-xs text-[#e3ebf8] outline-none focus:border-cyan-500/50"
                              />
                            </label>
                            <label className="mt-2 block">
                              <span className="flex items-center justify-between text-[10px] text-[#73839f]">
                                <span>Confidence</span>
                                <span>{Math.round(candidate.confidence * 100)}%</span>
                              </span>
                              <input
                                type="range"
                                min={0.1}
                                max={1}
                                step={0.01}
                                value={candidate.confidence}
                                onChange={(event) => updateCandidate(candidate.id, { confidence: Number(event.target.value) })}
                                className="mt-2 w-full accent-cyan-400"
                              />
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCandidate(candidate.id)}
                            className="rounded-xl border border-[#243049] bg-[#0a0f17] p-2 text-[#7890b2] transition-colors hover:border-rose-500/40 hover:text-rose-300"
                            title="Remove candidate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {candidate.note ? (
                          <p className="mt-2 text-[11px] text-[#7b8aa8]">{candidate.note}</p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-[#1f2536] bg-[#0c111b] p-4">
              <h3 className="text-sm font-semibold text-white">Review summary</h3>
              <p className="mt-1 text-xs text-[#8292af]">
                The output is a real SecurityScene. Wall annotations tune the shell, while objects become scene nodes.
              </p>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-[#243049] bg-[#09111b] px-3 py-2">
                  <span className="text-xs text-[#8292af]">Scene name</span>
                  <span className="text-xs font-medium text-white">{session.roomName}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#243049] bg-[#09111b] px-3 py-2">
                  <span className="text-xs text-[#8292af]">Dimensions</span>
                  <span className="text-xs font-medium text-white">{session.widthM}m × {session.depthM}m × {session.heightM}m</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#243049] bg-[#09111b] px-3 py-2">
                  <span className="text-xs text-[#8292af]">Accepted candidates</span>
                  <span className="text-xs font-medium text-white">{candidateStats.accepted}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#243049] bg-[#09111b] px-3 py-2">
                  <span className="text-xs text-[#8292af]">Rejected candidates</span>
                  <span className="text-xs font-medium text-white">{candidateStats.rejected}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#243049] bg-[#09111b] px-3 py-2">
                  <span className="text-xs text-[#8292af]">Source</span>
                  <span className="text-xs font-medium text-cyan-200">scan_import</span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/8 p-3 text-xs text-cyan-100/90">
                No AI perception is claimed here. The image is a manual-assisted intake that compiles directly into the existing simulation pipeline.
              </div>
              <div className="mt-3 rounded-2xl border border-[#243049] bg-[#09111b] p-3">
                <h4 className="text-xs font-semibold text-white">Structural auto-fix assist (explicit)</h4>
                <p className="mt-1 text-[11px] text-[#8aa1c4]">
                  These actions are manual and visible. They do not run automatically and only update candidate annotations.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <SurfaceButton type="button" onClick={handleMergeNearDuplicates}>
                    Merge near-duplicate candidates (same type, close points)
                  </SurfaceButton>
                  <SurfaceButton type="button" onClick={handleSnapOpeningsToWalls}>
                    Snap door/window candidates closer to nearest wall
                  </SurfaceButton>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-[#243049] bg-[#09111b] p-3">
                <h4 className="text-xs font-semibold text-white">Geometry sanity checks</h4>
                <div className="mt-2 space-y-1 text-[11px] text-[#8aa1c4]">
                  <p>• Duplicate groups (same type + close points): {duplicateCandidateGroups.length}</p>
                  <p>• Door/window without nearby wall: {openingWithoutWallNearbyCount}</p>
                  <p>• Pending candidate count: {candidateStats.pending}</p>
                  {scanSanityIssues.length === 0 ? (
                    <p className="text-emerald-300">No obvious structural issues detected.</p>
                  ) : (
                    scanSanityIssues.map((issue) => (
                      <p key={issue}>• {issue}</p>
                    ))
                  )}
                </div>
                <div className="mt-3 rounded-xl border border-[#243049] bg-[#09111b] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-[#8292af]">Provenance</span>
                    <span className={[
                      "rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]",
                      provenance.confidenceLevel === "high"
                        ? "bg-emerald-500/12 text-emerald-200"
                        : provenance.confidenceLevel === "medium"
                          ? "bg-amber-500/12 text-amber-200"
                          : "bg-rose-500/12 text-rose-200",
                    ].join(" ")}>
                      {provenance.confidenceLevel} confidence
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-[#8aa1c4]">{provenance.summary}</p>
                  <p className="mt-1 text-[10px] text-[#73839f]">
                    {provenance.acceptedCandidates}/{provenance.totalCandidates} accepted · {(provenance.averageConfidence * 100).toFixed(0)}% avg confidence
                  </p>
                </div>
                {lowConfidenceAccepted.length > 0 ? (
                  <label className="mt-3 flex items-start gap-2 text-[11px] text-[#c6d3ea]">
                    <input
                      type="checkbox"
                      checked={compileLowConfidenceOverride}
                      onChange={(event) => setCompileLowConfidenceOverride(event.target.checked)}
                    />
                    <span>Compile anyway with low-confidence accepted candidates (explicit manual override).</span>
                  </label>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-[#1f2536] bg-[#0c111b] p-4">
              <h3 className="text-sm font-semibold text-white">Compiled node preview</h3>
              <p className="mt-1 text-xs text-[#8292af]">
                Accepted scan candidates will appear in the live Studio scene after compile.
              </p>
              <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {session.candidates.filter((candidate) => candidate.status !== "rejected").map((candidate, index) => {
                  const meta = kindMeta(candidate.kind);
                  return (
                    <div key={candidate.id} className="flex items-center justify-between rounded-xl border border-[#243049] bg-[#09111b] px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className={[
                          "flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold",
                          meta.border,
                          meta.bg,
                          meta.accent,
                        ].join(" ")}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-white">{candidate.label}</div>
                          <div className="text-[10px] text-[#73839f]">{meta.label} • {candidate.status}</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-[#8093b4]">{Math.round(candidate.confidence * 100)}%</div>
                    </div>
                  );
                })}
                {session.candidates.filter((candidate) => candidate.status !== "rejected").length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#243049] bg-[#09111b] px-3 py-6 text-center text-xs text-[#73839f]">
                    There are no accepted candidates yet. Go back and add at least one object.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
      </div>

      <div className="flex items-center justify-between border-t border-[#1e2130] px-4 py-3">
        <SurfaceButton
          type="button"
          onClick={() => {
            if (step > 0) {
              setStep((current) => (current - 1) as ScanStep);
            } else {
              onClose?.();
            }
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {step > 0 ? "Back" : "Cancel"}
        </SurfaceButton>

        {step < 3 ? (
          <SurfaceButton
            type="button"
            onClick={() => setStep((current) => (Math.min(3, current + 1) as ScanStep))}
            disabled={!canProceed}
          >
            Next
            <ArrowRight className="h-3.5 w-3.5" />
          </SurfaceButton>
        ) : (
          <SurfaceButton type="button" onClick={() => void handleCompile()} disabled={isCompiling}>
            {isCompiling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CirclePlus className="h-3.5 w-3.5" />}
            Compile to Camera Studio
          </SurfaceButton>
        )}
      </div>
    </div>
  );
}
