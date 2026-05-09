import { Node, Edge } from 'reactflow';

// ── Node / Edge types ───────────────────────────────────────────────────────

export type NodeType =
  | 'process' | 'decision' | 'start' | 'end'
  | 'data' | 'connector' | 'annotation'
  | 'manual_action' | 'database' | 'document'
  | 'delay' | 'subprocess';

export interface NodeData {
  label: string;
  nodeType: NodeType;
  color?: string;
  borderColor?: string;
  fontSize?: number;
  notes?: string;
  metadata?: Record<string, string>;
}

export interface EdgeData {
  edgeType?: 'straight' | 'smoothstep' | 'bezier';
  thickness?: number;
  color?: string;
  arrow?: boolean;
  dashed?: boolean;
  markerStart?: boolean;
  conditionLabel?: string;
}

// ── Versioning / history ────────────────────────────────────────────────────

export interface Snapshot {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
}

export interface Version {
  id: string;
  label: string;
  note: string;
  created_at: string;
  snapshot: { nodes: Node<NodeData>[]; edges: Edge<EdgeData>[]; whiteboard: Whiteboard };
}

// ── Whiteboard ──────────────────────────────────────────────────────────────

export interface Stroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface Sticky {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface Whiteboard {
  strokes: Stroke[];
  stickies: Sticky[];
}

// ── Process ─────────────────────────────────────────────────────────────────

export interface Process {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  archived: boolean;
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  whiteboard: Whiteboard;
  versions: Version[];
  history: { undo: Snapshot[]; redo: Snapshot[] };
}

// ── App state (legacy local store) ─────────────────────────────────────────

export interface AppState {
  processes: Process[];
  activeProcessId: string | null;
  theme: 'dark' | 'light';
  preferences: {
    snapToGrid: boolean;
    showGrid: boolean;
    autoSave: boolean;
    [key: string]: any;
  };
}

// ── V2: nodes_meta ──────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  author_email: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface NodeMeta {
  notes: string;
  comments: Comment[];
}

export type NodesMeta = Record<string, NodeMeta>;

// ── V2: Supabase flow row ───────────────────────────────────────────────────

export interface FlowRow {
  id: string;
  name: string;
  data: any;
  nodes_meta: NodesMeta;
  is_public: boolean;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
}
