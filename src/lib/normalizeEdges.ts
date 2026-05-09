import { Edge, MarkerType } from 'reactflow';
import { EdgeData } from '../store/types';

// Build a marker spec from the edge's color. ReactFlow registers these
// automatically as <defs><marker>...</marker></defs> on the root SVG and
// gives BaseEdge the resolved url(#id) string.
function endMarker(color: string) {
  return { type: MarkerType.Arrow, color, width: 18, height: 18, strokeWidth: 1.5 } as const;
}
function startMarker(color: string) {
  return { type: MarkerType.Arrow, color, width: 18, height: 18, strokeWidth: 1.5, orient: 'auto-start-reverse' } as any;
}

// Normalize an edge to have ReactFlow-compatible markerEnd/markerStart props
// based on its data.arrow / data.markerStart booleans. Idempotent.
export function normalizeEdge<T extends EdgeData = EdgeData>(e: Edge<T>): Edge<T> {
  const data = (e.data || {}) as EdgeData;
  const color = data.color || '#6366f1';
  const showArrow = data.arrow !== false; // default true
  const showStart = !!(data as any).markerStart;
  return {
    ...e,
    markerEnd: showArrow ? (endMarker(color) as any) : undefined,
    markerStart: showStart ? (startMarker(color) as any) : undefined,
  };
}

export function normalizeEdges<T extends EdgeData = EdgeData>(edges: Edge<T>[]): Edge<T>[] {
  return edges.map(normalizeEdge);
}
