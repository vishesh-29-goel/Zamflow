import { create } from 'zustand';
import { Node, Edge, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, Connection } from 'reactflow';
import { AppState, Process, NodeData, EdgeData, Version, Snapshot, Whiteboard, NodesMeta, Comment } from './types';
import { loadState, saveState } from '../lib/persistence';
import { normalizeEdges } from '../lib/normalizeEdges';
import { TEMPLATES } from '../templates';
// Import the active connection style getter at module level.
// This avoids the broken require() call that was crashing onConnect at runtime.
import { getActiveConnectionStyle } from '../components/RightSidebar';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

// ── V2 extended state ────────────────────────────────────────────────────────
interface V2State {
  // nodes_meta: keyed by nodeId, per active flow
  nodesMeta: NodesMeta;
  setNodesMeta: (meta: NodesMeta) => void;
  setNodeNote: (nodeId: string, notes: string) => void;
  addComment: (nodeId: string, comment: Comment) => void;
  // expanded node inline
  expandedNodeId: string | null;
  setExpandedNodeId: (id: string | null) => void;
  // text panel
  showTextPanel: boolean;
  setShowTextPanel: (v: boolean) => void;
}

interface ZampFlowStore extends AppState, V2State {
  lastSaved: Date | null;
  activeProcess: () => Process | null;
  setActiveProcess: (id: string) => void;
  createProcess: (name: string, templateKey?: string) => void;
  updateProcess: (id: string, updates: Partial<Process>) => void;
  deleteProcess: (id: string) => void;
  duplicateProcess: (id: string) => void;
  archiveProcess: (id: string) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge<EdgeData>[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  updateEdgeData: (edgeId: string, data: Partial<EdgeData>) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  saveVersion: (note?: string) => void;
  restoreVersion: (versionId: string) => void;
  deleteVersion: (versionId: string) => void;
  setWhiteboard: (wb: Whiteboard) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setPreference: (key: string, value: any) => void;
  triggerSave: () => void;
}

const initialState = loadState();

export const useZampFlowStore = create<ZampFlowStore>((set, get) => ({
  ...initialState,
  lastSaved: null,

  // ── V2 initial state ────────────────────────────────────────────────────
  nodesMeta: {},
  setNodesMeta: (meta) => set({ nodesMeta: meta }),
  setNodeNote: (nodeId, notes) => set((s) => {
    const existing = s.nodesMeta[nodeId] || { notes: '', comments: [] };
    return { nodesMeta: { ...s.nodesMeta, [nodeId]: { ...existing, notes } } };
  }),
  addComment: (nodeId, comment) => set((s) => {
    const existing = s.nodesMeta[nodeId] || { notes: '', comments: [] };
    return {
      nodesMeta: {
        ...s.nodesMeta,
        [nodeId]: { ...existing, comments: [...existing.comments, comment] },
      },
    };
  }),
  expandedNodeId: null,
  setExpandedNodeId: (id) => set({ expandedNodeId: id }),
  showTextPanel: false,
  setShowTextPanel: (v) => set({ showTextPanel: v }),

  // ── Existing store ────────────────────────────────────────────────────────
  activeProcess: () => {
    const { processes, activeProcessId } = get();
    return processes.find(p => p.id === activeProcessId) || null;
  },

  setActiveProcess: (id) => {
    set({ activeProcessId: id });
    get().triggerSave();
  },

  createProcess: (name, templateKey) => {
    const t = templateKey ? TEMPLATES[templateKey] : null;
    const p: Process = {
      id: crypto.randomUUID(),
      name, description: '', category: 'General', tags: [],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      archived: false,
      nodes: t ? t.nodes.map(n => ({...n, id: crypto.randomUUID() + '-' + n.id})) : [],
      edges: t ? [] : [],
      whiteboard: { strokes: [], stickies: [] },
      versions: [], history: { undo: [], redo: [] }
    };
    if (t) {
      const idMap: Record<string, string> = {};
      t.nodes.forEach((n, i) => { idMap[n.id] = p.nodes[i].id; });
      p.edges = t.edges.map(e => ({ ...e, id: crypto.randomUUID(), source: idMap[e.source] || e.source, target: idMap[e.target] || e.target }));
    }
    set(s => ({ processes: [...s.processes, p], activeProcessId: p.id }));
    get().triggerSave();
  },

  updateProcess: (id, updates) => {
    set(s => ({
      processes: s.processes.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p)
    }));
    get().triggerSave();
  },

  deleteProcess: (id) => {
    set(s => {
      const filtered = s.processes.filter(p => p.id !== id);
      return { processes: filtered, activeProcessId: filtered[0]?.id || null };
    });
    get().triggerSave();
  },

  duplicateProcess: (id) => {
    const proc = get().processes.find(p => p.id === id);
    if (!proc) return;
    const copy: Process = { ...JSON.parse(JSON.stringify(proc)), id: crypto.randomUUID(), name: proc.name + ' (Copy)', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    set(s => ({ processes: [...s.processes, copy], activeProcessId: copy.id }));
    get().triggerSave();
  },

  archiveProcess: (id) => {
    set(s => ({ processes: s.processes.map(p => p.id === id ? { ...p, archived: !p.archived } : p) }));
    get().triggerSave();
  },

  setNodes: (nodes) => {
    const { activeProcessId } = get();
    if (!activeProcessId) return;
    set(s => ({ processes: s.processes.map(p => p.id === activeProcessId ? { ...p, nodes, updated_at: new Date().toISOString() } : p) }));
    get().triggerSave();
  },

  setEdges: (edges) => {
    const { activeProcessId } = get();
    if (!activeProcessId) return;
    const normalized = normalizeEdges(edges);
    set(s => ({ processes: s.processes.map(p => p.id === activeProcessId ? { ...p, edges: normalized, updated_at: new Date().toISOString() } : p) }));
    get().triggerSave();
  },

  onNodesChange: (changes) => {
    const proc = get().activeProcess();
    if (!proc) return;
    const nodes = applyNodeChanges(changes, proc.nodes) as Node<NodeData>[];
    get().setNodes(nodes);
  },

  onEdgesChange: (changes) => {
    const proc = get().activeProcess();
    if (!proc) return;
    const edges = applyEdgeChanges(changes, proc.edges) as Edge<EdgeData>[];
    get().setEdges(edges);
  },

  onConnect: (connection) => {
    console.log('[zampflow] onConnect called with:', JSON.stringify(connection));
    try {
      const proc = get().activeProcess();
      if (!proc) return;
      // Defensive fallback in case getActiveConnectionStyle throws (e.g. circular import race)
      let style: { dashed: boolean; arrow: string } = { dashed: false, arrow: 'target' };
      try {
        style = getActiveConnectionStyle();
      } catch (styleErr) {
        console.error('[zampflow] getActiveConnectionStyle error:', styleErr);
      }
      const edges = addEdge({
        ...connection,
        id: `e-${connection.source}-${connection.sourceHandle ?? ''}-${connection.target}-${connection.targetHandle ?? ''}-${Date.now()}`,
        type: 'custom',
        data: {
          edgeType: 'smoothstep',
          thickness: 2,
          color: '#6366f1',
          dashed: style.dashed,
          arrow: style.arrow !== 'none',
          markerStart: style.arrow === 'both',
        },
      }, proc.edges) as Edge<EdgeData>[];
      get().setEdges(edges);
    } catch (e) {
      console.error('[zampflow] onConnect error:', e);
    }
  },

  updateNodeData: (nodeId, data) => {
    const proc = get().activeProcess();
    if (!proc) return;
    const nodes = proc.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n);
    get().setNodes(nodes);
  },

  updateEdgeData: (edgeId, data) => {
    const proc = get().activeProcess();
    if (!proc) return;
    const edges = proc.edges.map(e => e.id === edgeId ? { ...e, data: { ...e.data, ...data } } : e);
    get().setEdges(edges);
  },

  pushHistory: () => {
    const proc = get().activeProcess();
    if (!proc) return;
    const snap: Snapshot = { nodes: JSON.parse(JSON.stringify(proc.nodes)), edges: JSON.parse(JSON.stringify(proc.edges)) };
    const undo = [...(proc.history.undo || []).slice(-49), snap];
    set(s => ({ processes: s.processes.map(p => p.id === proc.id ? { ...p, history: { undo, redo: [] } } : p) }));
  },

  undo: () => {
    const proc = get().activeProcess();
    if (!proc || !proc.history.undo.length) return;
    const undo = [...proc.history.undo];
    const snap = undo.pop()!;
    const redoSnap: Snapshot = { nodes: JSON.parse(JSON.stringify(proc.nodes)), edges: JSON.parse(JSON.stringify(proc.edges)) };
    const redo = [...(proc.history.redo || []), redoSnap];
    set(s => ({ processes: s.processes.map(p => p.id === proc.id ? { ...p, nodes: snap.nodes, edges: snap.edges, history: { undo, redo } } : p) }));
    get().triggerSave();
  },

  redo: () => {
    const proc = get().activeProcess();
    if (!proc || !proc.history.redo.length) return;
    const redo = [...proc.history.redo];
    const snap = redo.pop()!;
    const undoSnap: Snapshot = { nodes: JSON.parse(JSON.stringify(proc.nodes)), edges: JSON.parse(JSON.stringify(proc.edges)) };
    const undo = [...(proc.history.undo || []), undoSnap];
    set(s => ({ processes: s.processes.map(p => p.id === proc.id ? { ...p, nodes: snap.nodes, edges: snap.edges, history: { undo, redo } } : p) }));
    get().triggerSave();
  },

  saveVersion: (note = '') => {
    const proc = get().activeProcess();
    if (!proc) return;
    const count = proc.versions.length + 1;
    const v: Version = {
      id: crypto.randomUUID(),
      label: `v1.${count - 1}`,
      created_at: new Date().toISOString(),
      note,
      snapshot: { nodes: JSON.parse(JSON.stringify(proc.nodes)), edges: JSON.parse(JSON.stringify(proc.edges)), whiteboard: JSON.parse(JSON.stringify(proc.whiteboard)) }
    };
    set(s => ({ processes: s.processes.map(p => p.id === proc.id ? { ...p, versions: [...p.versions, v] } : p) }));
    get().triggerSave();
  },

  restoreVersion: (versionId) => {
    const proc = get().activeProcess();
    if (!proc) return;
    const v = proc.versions.find(v => v.id === versionId);
    if (!v) return;
    set(s => ({ processes: s.processes.map(p => p.id === proc.id ? { ...p, nodes: v.snapshot.nodes, edges: v.snapshot.edges, whiteboard: v.snapshot.whiteboard } : p) }));
    get().triggerSave();
  },

  deleteVersion: (versionId) => {
    const proc = get().activeProcess();
    if (!proc) return;
    set(s => ({ processes: s.processes.map(p => p.id === proc.id ? { ...p, versions: p.versions.filter(v => v.id !== versionId) } : p) }));
    get().triggerSave();
  },

  setWhiteboard: (wb) => {
    const { activeProcessId } = get();
    if (!activeProcessId) return;
    set(s => ({ processes: s.processes.map(p => p.id === activeProcessId ? { ...p, whiteboard: wb } : p) }));
    get().triggerSave();
  },

  setTheme: (theme) => {
    set({ theme });
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    get().triggerSave();
  },

  setPreference: (key, value) => {
    set(s => ({ preferences: { ...s.preferences, [key]: value } }));
    get().triggerSave();
  },

  triggerSave: () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const state = get();
      saveState({ processes: state.processes, activeProcessId: state.activeProcessId, theme: state.theme, preferences: state.preferences });
      set({ lastSaved: new Date() });
    }, 1000);
  }
}));
