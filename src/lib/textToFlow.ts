import dagre from 'dagre';
import { Node, Edge, Position } from 'reactflow';
import { NodeData, EdgeData, NodeType } from '../store/types';

const DECISION_KEYWORDS = ['if ', '?', 'decide', 'check', 'is ', 'are ', 'does ', 'do '];
const START_KEYWORDS = ['start', 'begin', 'initiate', 'trigger'];
const END_KEYWORDS = ['end', 'done', 'finish', 'complete', 'close', 'terminate'];

function detectNodeType(text: string): NodeType {
  const lower = text.toLowerCase().trim();
  if (START_KEYWORDS.some(k => lower.startsWith(k))) return 'start';
  if (END_KEYWORDS.some(k => lower.startsWith(k) || lower.endsWith(k))) return 'end';
  if (DECISION_KEYWORDS.some(k => lower.includes(k))) return 'decision';
  return 'process';
}

function getNodeColor(type: NodeType) {
  if (type === 'start') return { color: '#dcfce7', borderColor: '#16a34a' };
  if (type === 'end') return { color: '#fee2e2', borderColor: '#dc2626' };
  if (type === 'decision') return { color: '#fef9c3', borderColor: '#ca8a04' };
  return { color: '#eff6ff', borderColor: '#6366f1' };
}

function makeEdgeData(): EdgeData {
  return { edgeType: 'smoothstep', thickness: 2, color: '#6366f1', arrow: true };
}

/**
 * Estimate node dimensions from label text.
 * Returns { width, height } that dagre will use for layout, matching what the
 * React node component will actually render with auto-size CSS.
 *
 * Rules:
 *  - process/start/end/data/etc.: min 140px, max 280px, 14px per char estimate
 *  - decision (diamond): text sits in ~70% of the diamond bounding box, so we
 *    need a larger bounding box. We compute the inner text width + padding and
 *    scale up to the diamond bounding box size.
 */
function estimateNodeSize(label: string, type: NodeType): { width: number; height: number } {
  // Rough character width at 13px font
  const CHAR_W = 7.5;
  const MIN_W = 140;
  const MAX_W = 280;
  const H_PAD_RECT = 28;   // horizontal padding inside rectangular nodes (each side)
  const V_PAD_RECT = 20;   // vertical padding (each side)
  const LINE_H = 18;       // px per wrapped line

  if (type === 'decision') {
    // Diamond: the SVG polygon uses proportional points (50%,5% 95%,50% 50%,95% 5%,50%).
    // The safe text rectangle inscribed inside is ~62% of bounding width and ~62% of height.
    // Strategy: figure out how many lines the text needs inside the inner box,
    // then compute the bounding box needed to contain that text with enough margin.
    const innerMaxW = 180; // max inner text width before wrapping
    const totalTextW = label.length * CHAR_W;
    const lines = Math.ceil(totalTextW / innerMaxW) || 1;
    // Inner box height: lines * line height + vertical padding inside inner box
    const innerH = lines * LINE_H + 24;
    // Inner box width: actual text width capped at innerMaxW
    const innerW = Math.min(totalTextW, innerMaxW);
    // Bounding box: inner / 0.58 to leave enough diamond margin around text
    const bW = Math.max(180, Math.min(340, Math.round(innerW / 0.58)));
    const bH = Math.max(120, Math.min(260, Math.round(innerH / 0.50)));
    return { width: bW, height: bH };
  }

  // For oval start/end: slightly more horizontal padding
  const hPad = (type === 'start' || type === 'end') ? H_PAD_RECT + 12 : H_PAD_RECT;
  const rawW = label.length * CHAR_W + hPad * 2;
  const width = Math.max(MIN_W, Math.min(MAX_W, Math.round(rawW)));
  const lines = Math.ceil((label.length * CHAR_W) / (width - hPad * 2)) || 1;
  const height = Math.max(50, lines * LINE_H + V_PAD_RECT * 2);
  return { width, height };
}

/**
 * Parse text into nodes and edges.
 *
 * Rules:
 * - Each non-empty line is processed independently.
 * - Within a line, split on -> / => / → to get a chain of nodes.
 *   Each adjacent pair in that chain gets a directed edge.
 * - A bare line (no arrows) creates a single isolated node — no automatic
 *   chaining to the previous or next line.
 * - Duplicate labels reuse the same node ID (no duplicate nodes).
 *
 * Example: "Start -> A -> B -> End"
 *   → 4 nodes: Start, A, B, End
 *   → 3 edges: Start→A, A→B, B→End
 *
 * Example:
 *   "Start -> Process request -> End"
 *   "if error? -> Retry -> End"
 *   → 5 nodes: Start, Process request, End, if error?, Retry
 *   → 4 edges: Start→Process request, Process request→End, if error?→Retry, Retry→End
 */
export function parseTextToFlow(text: string): { nodes: Node<NodeData>[]; edges: Edge<EdgeData>[] } {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge<EdgeData>[] = [];

  let hasStart = false;
  let hasEnd = false;
  const seen = new Map<string, string>(); // label → node ID
  let counter = 0;

  function getOrCreateNode(label: string): string {
    const existing = seen.get(label);
    if (existing) return existing;

    const id = `gen-${counter++}`;
    seen.set(label, id);
    const type = detectNodeType(label);
    if (type === 'start') hasStart = true;
    if (type === 'end') hasEnd = true;
    const colors = getNodeColor(type);
    const { width, height } = estimateNodeSize(label, type);
    nodes.push({
      id,
      type,
      position: { x: 0, y: 0 },
      data: { label, nodeType: type, ...colors, fontSize: 13, notes: '', metadata: {} },
      style: { width, height },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });
    return id;
  }

  const lines = text.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Split this line on arrow separators to get the chain
    const segments = line.split(/->|=>|→/).map(s => s.trim()).filter(Boolean);
    if (segments.length === 0) continue;

    // Create/find node for each segment
    const ids = segments.map(seg => getOrCreateNode(seg));

    // Create edges between consecutive nodes in this chain
    for (let i = 1; i < ids.length; i++) {
      const sourceId = ids[i - 1];
      const targetId = ids[i];
      if (sourceId === targetId) continue; // skip self-loops
      const edgeId = `e-${sourceId}-${targetId}`;
      // Avoid duplicate edges
      if (!edges.some(e => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          source: sourceId,
          target: targetId,
          sourceHandle: 's-bottom',
          targetHandle: 's-top',
          type: 'custom',
          data: makeEdgeData(),
        });
      }
    }
  }

  // Auto-add Start node if none found.
  if (!hasStart && nodes.length > 0) {
    const startId = 'gen-auto-start';
    const firstRealNode = nodes.find(n => n.type !== 'start' && n.id !== startId);
    const { width: sw, height: sh } = estimateNodeSize('Start', 'start');
    nodes.unshift({
      id: startId,
      type: 'start',
      position: { x: 0, y: 0 },
      data: { label: 'Start', nodeType: 'start', color: '#dcfce7', borderColor: '#16a34a', fontSize: 13, notes: '', metadata: {} },
      style: { width: sw, height: sh },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });
    if (firstRealNode) {
      edges.unshift({
        id: `e-${startId}-${firstRealNode.id}`,
        source: startId,
        target: firstRealNode.id,
        sourceHandle: 's-bottom',
        targetHandle: 's-top',
        type: 'custom',
        data: makeEdgeData(),
      });
    }
  }

  // Auto-add End node if none found.
  if (!hasEnd && nodes.length > 0) {
    const endId = 'gen-auto-end';
    let lastRealNode: Node<NodeData> | undefined;
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].type !== 'end' && nodes[i].id !== endId) { lastRealNode = nodes[i]; break; }
    }
    const { width: ew, height: eh } = estimateNodeSize('End', 'end');
    nodes.push({
      id: endId,
      type: 'end',
      position: { x: 0, y: 0 },
      data: { label: 'End', nodeType: 'end', color: '#fee2e2', borderColor: '#dc2626', fontSize: 13, notes: '', metadata: {} },
      style: { width: ew, height: eh },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });
    if (lastRealNode) {
      edges.push({
        id: `e-${lastRealNode.id}-${endId}`,
        source: lastRealNode.id,
        target: endId,
        sourceHandle: 's-bottom',
        targetHandle: 's-top',
        type: 'custom',
        data: makeEdgeData(),
      });
    }
  }

  // Sanity pass: drop any edge whose source or target is not in the final node set.
  const cleanedEdges = pruneOrphanEdges(nodes, edges);

  return applyDagreLayout(nodes, cleanedEdges);
}

/**
 * Drop edges whose source or target node does not exist in the given node set.
 * Logs a console warning for every dropped edge so this never fails silently.
 */
export function pruneOrphanEdges<N extends { id: string }, E extends { id: string; source: string; target: string }>(
  nodes: N[],
  edges: E[]
): E[] {
  const nodeIds = new Set(nodes.map(n => n.id));
  const clean: E[] = [];
  for (const e of edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      clean.push(e);
    } else {
      // eslint-disable-next-line no-console
      console.warn('[zampflow] dropping orphan edge', { id: e.id, source: e.source, target: e.target });
    }
  }
  return clean;
}

export function applyDagreLayout(nodes: Node<NodeData>[], edges: Edge<EdgeData>[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach(n => g.setNode(n.id, { width: (n.style?.width as number) || 160, height: (n.style?.height as number) || 60 }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return {
    nodes: nodes.map(n => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - (((n.style?.width as number)||160)/2), y: pos.y - (((n.style?.height as number)||60)/2) } };
    }),
    edges
  };
}
