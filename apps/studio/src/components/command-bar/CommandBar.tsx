"use client";

import { motion } from "framer-motion";
import { ArrowUp, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAiCommand } from "@/hooks/use-ai-command";

export function CommandBar() {
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { status, executeCommand, dismissError } = useAiCommand();

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    executeCommand(trimmed);
    setInput("");
  }, [input, executeCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Keyboard shortcut: Cmd+K or Ctrl+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsExpanded((prev) => !prev);
        if (!isExpanded) {
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isExpanded]);

  // Auto-focus when expanded
  useEffect(() => {
    if (isExpanded) {
      inputRef.current?.focus();
    }
  }, [isExpanded]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="group absolute bottom-3 right-3 z-30 flex h-9 items-center gap-2 rounded-xl border border-[#1f2536] bg-[#0b0f17]/80 px-3 text-[10px] font-medium text-[#5b667c] shadow-[0_4px_16px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-all hover:border-[#32384d] hover:text-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
      >
        <Sparkles className="h-3.5 w-3.5 text-emerald-400/70 group-hover:text-emerald-400" />
        AI Command
        <kbd className="ml-1 rounded border border-[#24283a] bg-[#111521] px-1 py-0.5 text-[8px] text-[#4d566b]">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="absolute bottom-3 left-3 right-3 z-30"
    >
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#1f2536] bg-[#0b0f17]/95 p-2 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        {/* Status indicators */}
        {status.state !== "idle" && (
          <div className="mb-2 rounded-xl border border-[#1a2030] bg-[#07090f]/60 px-3 py-2">
            {status.state === "parsing" && (
              <div className="flex items-center gap-2 text-[11px] text-amber-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking...
              </div>
            )}
            {status.state === "applying" && (
              <div className="flex items-center gap-2 text-[11px] text-blue-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Applying {status.descriptions.length} operation{status.descriptions.length > 1 ? "s" : ""}...
              </div>
            )}
            {status.state === "success" && (
              <div className="flex items-center gap-2 text-[11px] text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                {status.message}
              </div>
            )}
            {status.state === "error" && (
              <div className="flex items-start gap-2 text-[11px] text-red-300">
                <span className="mt-0.5">⚠</span>
                <span className="flex-1">{status.message}</span>
                <button onClick={dismissError} className="text-red-400/60 hover:text-red-300">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 flex-shrink-0 text-emerald-400/60" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to modify the scene..."
            disabled={status.state === "parsing" || status.state === "applying"}
            className="min-w-0 flex-1 bg-transparent text-[12px] text-white placeholder-[#4d566b] outline-none disabled:opacity-50"
          />
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-[#3a4158]">Esc</span>
            <button
              onClick={() => {
                setIsExpanded(false);
                dismissError();
              }}
              className="rounded-lg border border-[#24283a] bg-[#111521] p-1 text-[#5d6880] hover:border-[#32384d] hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || status.state === "parsing" || status.state === "applying"}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600"
          >
            {status.state === "parsing" || status.state === "applying" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Quick hints */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["Move Camera 1 toward the entry", "Switch to night mode", "Turn off Camera 2", "Add a light near the counter"].map((hint) => (
            <button
              key={hint}
              onClick={() => {
                setInput(hint);
                inputRef.current?.focus();
              }}
              className="rounded-md border border-[#1e2536] bg-[#0d111a] px-2 py-1 text-[9px] text-[#5b667c] transition-colors hover:border-[#2a3146] hover:text-[#9da8c0]"
            >
              {hint}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
