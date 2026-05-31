import React, { useState } from "react";
import { useStudioStore } from "@/store/studio-store";
import { GitBranch, GitMerge, Check, Plus, AlertCircle } from "lucide-react";

export function BranchSwitcher() {
  const { activeBranch, branchScenes, createDraftBranch, switchBranch } = useStudioStore();
  const [isOpen, setIsOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  const branches = Object.keys(branchScenes);

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    
    // Simple slugification
    const slug = newBranchName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    createDraftBranch(slug);
    setNewBranchName("");
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-sm hover:bg-neutral-800 transition-colors"
      >
        <GitBranch className="w-4 h-4 text-emerald-500" />
        <span className="font-mono">{activeBranch}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-neutral-800 bg-neutral-900/50">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Branches</h3>
            <div className="space-y-1">
              {branches.map((branch) => (
                <button type="button"
                  key={branch}
                  onClick={() => {
                    switchBranch(branch);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between ${
                    branch === activeBranch 
                      ? "bg-emerald-500/10 text-emerald-400" 
                      : "text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  <span className="font-mono flex items-center gap-2">
                    {branch === "main" ? <GitMerge className="w-3.5 h-3.5" /> : <GitBranch className="w-3.5 h-3.5" />}
                    {branch}
                  </span>
                  {branch === activeBranch && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
          
          <form onSubmit={handleCreateBranch} className="p-3 bg-neutral-950">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">New Draft Branch</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="branch-name..."
                aria-label="New branch name"
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!newBranchName.trim() || branches.includes(newBranchName.trim())}
                className="p-1.5 bg-emerald-600 rounded text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {branches.includes(newBranchName.trim()) && (
              <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Branch already exists
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
