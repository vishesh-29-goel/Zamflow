import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData, NodeType, Process, Whiteboard } from '../store/types';
import { parseTextToFlow, applyDagreLayout } from './textToFlow';
import { TEMPLATES } from '../templates';

// ─── Public schema ───────────────────────────────────────────────────────────

export interface ZampFlowImportPayload {
  version: '1.0';
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  nodes: Array<{
    id: string;
    type: NodeType;
    label: string;
    x?: number;
    y?: number;
    color?: string;
    borderColor?: string;
    fontSize?: number;
    notes?: string;
    metadata?: Record<string, string>;
  }>;
  edges: Array<{
    id?: string;
    source: string;
    target: string;
    label?: string;
    type?: 'straight' | 'smoothstep' | 'bezier';
    color?: string;
    thickness?: number;
    dashed?: boolean;
  }>;
  whiteboard?: { strokes?: any[]; stickies?: any[] };
}

export interface ImportResult {
  process: Process;
  toastMessage: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_NODE_TYPES: NodeType[] = [
  'process', 'decision', 'start', 'end', 'data',
  'connector', 'annotation', 'manual_action', 'database',
  'document', 'delay', 'subprocess',
];

function validatePayload(raw: unknown): raw is ZampFlowImportPayload {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Record<string, unknown>;
  if (p.version !== '1.0') return false;
  if (typeof p.name !== 'string' || !p.name.trim()) return false;
  if (!Array.isArray(p.nodes) || p.nodes.length === 0) return false;
  if (!Array.isArray(p.edges)) return false;
  for (const n of p.nodes as any[]) {
    if (typeof n.id !== 'string' || !n.id) return false;
    if (!VALID_NODE_TYPES.includes(n.type)) return false;
    if (typeof n.label !== 'string') return false;
  }
  for (const e of p.edges as any[]) {
    if (typeof e.source !== 'string' || !e.source) return false;
    if (typeof e.target !== 'string' || !e.target) return false;
  }
  return true;
}

// ─── Payload → Process conversion ────────────────────────────────────────────

function payloadToProcess(payload: ZampFlowImportPayload): Process {
  const nodeHeightFor = (type: NodeType) => type === 'decision' ? 80 : 60;
  const nodeWidthFor = (type: NodeType) => type === 'start' || type === 'end' ? 120 : 160;

  const defaultColor = (type: NodeType) => {
    if (type === 'start') return { color: '#dcfce7', borderColor: '#16a34a' };
    if (type === 'end') return { color: '#fee2e2', borderColor: '#dc2626' };
    if (type === 'decision') return { color: '#fef9c3', borderColor: '#ca8a04' };
    return { color: '#eff6ff', borderColor: '#6366f1' };
  };

  // Build raw nodes with positions
  let rawNodes: Node<NodeData>[] = payload.nodes.map(n => ({
    id: n.id,
    type: n.type,
    position: { x: n.x ?? 0, y: n.y ?? 0 },
    data: {
      label: n.label,
      nodeType: n.type,
      color: n.color ?? defaultColor(n.type).color,
      borderColor: n.borderColor ?? defaultColor(n.type).borderColor,
      fontSize: n.fontSize ?? 13,
      notes: n.notes ?? '',
      metadata: n.metadata ?? {},
    },
    style: { width: nodeWidthFor(n.type), height: nodeHeightFor(n.type) },
  }));

  const rawEdges: Edge<EdgeData>[] = payload.edges.map(e => ({
    id: e.id ?? `e-${e.source}-${e.target}-${crypto.randomUUID().slice(0, 6)}`,
    source: e.source,
    target: e.target,
    label: e.label ?? '',
    type: 'custom',
    data: {
      edgeType: e.type ?? 'smoothstep',
      thickness: e.thickness ?? 2,
      color: e.color ?? '#6366f1',
      arrow: true,
      dashed: e.dashed ?? false,
    },
  }));

  // Auto-layout if any node is missing explicit coordinates
  const needsLayout = payload.nodes.some(n => n.x == null || n.y == null);
  const { nodes: layoutNodes, edges: layoutEdges } = needsLayout
    ? applyDagreLayout(rawNodes, rawEdges)
    : { nodes: rawNodes, edges: rawEdges };

  const whiteboard: Whiteboard = {
    strokes: payload.whiteboard?.strokes ?? [],
    stickies: (payload.whiteboard?.stickies ?? []) as any,
  };

  return {
    id: crypto.randomUUID(),
    name: payload.name.trim(),
    description: payload.description ?? '',
    category: payload.category ?? 'Imported',
    tags: payload.tags ?? [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived: false,
    nodes: layoutNodes,
    edges: layoutEdges,
    whiteboard,
    versions: [],
    history: { undo: [], redo: [] },
  };
}

// ─── Template import ──────────────────────────────────────────────────────────

// Map URL-friendly names to TEMPLATES keys
const TEMPLATE_NAME_MAP: Record<string, string> = {
  'decision-tree': 'decision_tree',
  'decision_tree': 'decision_tree',
  'approval-workflow': 'approval_workflow',
  'approval_workflow': 'approval_workflow',
  'escalation': 'escalation_process',
  'escalation-process': 'escalation_process',
  'escalation_process': 'escalation_process',
  'incident-response': 'incident_response',
  'incident_response': 'incident_response',
  'sop-workflow': 'sop_workflow',
  'sop_workflow': 'sop_workflow',
};

function templateToProcess(templateName: string): Process | null {
  const key = TEMPLATE_NAME_MAP[templateName.toLowerCase()] ?? templateName.toLowerCase();
  const tpl = TEMPLATES[key];
  if (!tpl) return null;

  // Re-map node IDs to fresh UUIDs to avoid collisions with existing processes
  const idMap: Record<string, string> = {};
  const nodes: Node<NodeData>[] = tpl.nodes.map(n => {
    const newId = crypto.randomUUID();
    idMap[n.id] = newId;
    return { ...n, id: newId };
  });
  const edges: Edge<EdgeData>[] = tpl.edges.map(e => ({
    ...e,
    id: crypto.randomUUID(),
    source: idMap[e.source] ?? e.source,
    target: idMap[e.target] ?? e.target,
  }));

  return {
    id: crypto.randomUUID(),
    name: tpl.name,
    description: tpl.description,
    category: 'Template',
    tags: ['template'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived: false,
    nodes,
    edges,
    whiteboard: { strokes: [], stickies: [] },
    versions: [],
    history: { undo: [], redo: [] },
  };
}

// ─── Text import ──────────────────────────────────────────────────────────────

function textToProcess(text: string): Process {
  const { nodes, edges } = parseTextToFlow(text);
  const firstLine = text.split('\n').map(l => l.trim()).find(l => l.length > 0) ?? 'Imported Flow';
  const name = firstLine.slice(0, 60);

  return {
    id: crypto.randomUUID(),
    name,
    description: '',
    category: 'Imported',
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived: false,
    nodes,
    edges,
    whiteboard: { strokes: [], stickies: [] },
    versions: [],
    history: { undo: [], redo: [] },
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export type URLImportError = 'invalid_payload' | 'fetch_failed' | 'unknown_template';

export interface ImportResult2 {
  process: Process;
  toastMessage: string;
  error?: URLImportError;
}

/**
 * Reads URL query params ONCE on app load.
 * Returns an ImportResult if an import param is detected, or null if none present.
 * Also strips the params from the URL via history.replaceState.
 */
export async function getImportFromURL(): Promise<ImportResult2 | null> {
  const params = new URLSearchParams(window.location.search);

  // Strip params regardless of outcome
  const stripParams = () => {
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.toString());
  };

  // ── 1. ?import=<base64-json> ─────────────────────────────────────────────
  const importParam = params.get('import');
  if (importParam) {
    stripParams();
    try {
      const json = JSON.parse(atob(importParam));
      if (!validatePayload(json)) {
        return { process: null as any, toastMessage: 'Invalid flowchart payload', error: 'invalid_payload' };
      }
      return { process: payloadToProcess(json), toastMessage: 'Imported from URL' };
    } catch {
      return { process: null as any, toastMessage: 'Invalid flowchart payload', error: 'invalid_payload' };
    }
  }

  // ── 2. ?importUrl=<encoded-url> ──────────────────────────────────────────
  const importUrl = params.get('importUrl');
  if (importUrl) {
    stripParams();
    try {
      const resp = await fetch(decodeURIComponent(importUrl));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (!validatePayload(json)) {
        return { process: null as any, toastMessage: 'Invalid flowchart payload', error: 'invalid_payload' };
      }
      return { process: payloadToProcess(json), toastMessage: 'Imported from URL' };
    } catch {
      return { process: null as any, toastMessage: 'Could not fetch flowchart from URL', error: 'fetch_failed' };
    }
  }

  // ── 3. ?text=<urlencoded-sop> ────────────────────────────────────────────
  const textParam = params.get('text');
  if (textParam) {
    stripParams();
    const decoded = decodeURIComponent(textParam);
    return { process: textToProcess(decoded), toastMessage: 'Imported from URL' };
  }

  // ── 4. ?template=<name> ──────────────────────────────────────────────────
  const templateParam = params.get('template');
  if (templateParam) {
    stripParams();
    const proc = templateToProcess(templateParam);
    if (!proc) {
      return { process: null as any, toastMessage: `Unknown template: ${templateParam}`, error: 'unknown_template' };
    }
    return { process: proc, toastMessage: 'Imported from URL' };
  }

  return null;
}
