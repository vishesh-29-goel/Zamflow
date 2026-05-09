import { AppState } from '../store/types';
import { TEMPLATES } from '../templates';

// ── Storage key ───────────────────────────────────────────────────────────────
// The legacy global key (unscoped). Still read for migration detection.
export const LEGACY_KEY = 'zampflow.state.v1';

// Per-user key. Namespace by Supabase UID so users on the same device never
// share localStorage state. Falls back to LEGACY_KEY when userId is unknown
// (unauthenticated/offline mode).
export function storageKey(userId?: string): string {
  if (userId) return `zampflow.state.v2:${userId}`;
  return LEGACY_KEY;
}

function makeDemoProcess() {
  const t = TEMPLATES.sop_workflow;
  return {
    id: crypto.randomUUID(),
    name: 'My First Process (SOP)',
    description: 'A demo SOP workflow. Edit or replace this.',
    category: 'Operations',
    tags: ['demo', 'sop'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived: false,
    nodes: t.nodes,
    edges: t.edges,
    whiteboard: { strokes: [], stickies: [] },
    versions: [],
    history: { undo: [], redo: [] }
  };
}

export function loadState(userId?: string): AppState {
  try {
    const key = storageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.processes)) return parsed;
    }
  } catch { /* corrupt */ }
  const demo = makeDemoProcess();
  return {
    processes: [demo],
    activeProcessId: demo.id,
    theme: 'light',
    preferences: { snapToGrid: false, showGrid: true, autoSave: true }
  };
}

export function saveState(state: AppState, userId?: string) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch { /* quota exceeded */ }
}
