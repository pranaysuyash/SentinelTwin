import { NextRequest } from "next/server";
import { corsJson, corsNoContent } from "@/lib/api-cors";
import { API_METHODS } from "@/lib/api-response";

const WORKSPACE_STORAGE_KEY = "sentineltwin.workspaces.v1";

function loadWorkspaces(): Record<string, unknown>[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWorkspaces(workspaces: Record<string, unknown>[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspaces));
  } catch {}
}

export async function GET(request: NextRequest) {
  const workspaces = loadWorkspaces();
  return corsJson({ ok: true, workspaces, count: workspaces.length }, request, undefined, { methods: API_METHODS });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workspaces = loadWorkspaces();
    const existing = workspaces.findIndex((w) => (w as { id: string }).id === body.id);
    if (existing >= 0) {
      workspaces[existing] = { ...workspaces[existing], ...body, updatedAt: Date.now() };
    } else {
      workspaces.push({ ...body, createdAt: Date.now(), updatedAt: Date.now() });
    }
    saveWorkspaces(workspaces);
    return corsJson({ ok: true, count: workspaces.length }, request, undefined, { methods: API_METHODS });
  } catch (err) {
    return corsJson({ ok: false, error: String(err) }, request, { status: 500 }, { methods: API_METHODS });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return corsJson({ ok: false, error: "Missing id parameter" }, request, { status: 400 }, { methods: API_METHODS });
    }
    const workspaces = loadWorkspaces().filter((w) => (w as { id: string }).id !== id);
    saveWorkspaces(workspaces);
    return corsJson({ ok: true, count: workspaces.length }, request, undefined, { methods: API_METHODS });
  } catch (err) {
    return corsJson({ ok: false, error: String(err) }, request, { status: 500 }, { methods: API_METHODS });
  }
}

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["GET", "POST", "DELETE", "OPTIONS"] });
}
