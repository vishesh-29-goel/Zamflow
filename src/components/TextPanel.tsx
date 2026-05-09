import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { X, AlertCircle } from 'lucide-react';
import { useZampFlowStore } from '../store/useZampFlowStore';
import { parseTextToFlow, pruneOrphanEdges } from '../lib/textToFlow';
import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData } from '../store/types';

// Convert current nodes/edges back to text.
// Always emits ONE edge per line: "Source Label -> Target Label"
// Never chains (A -> B -> C) because chaining loses branch nodes on round-trip.
function flowToText(nodes: Node<NodeData>[], edges: Edge<EdgeData>[]): string {
  if (nodes.length === 0) return '';

  const nodeById = new Map<string, Node<NodeData>>();
  nodes.forEach(n => nodeById.set(n.id, n));

  const lines: string[] = [];
  const referencedIds = new Set<string>();

  // One line per edge: "Source -> Target"
  edges.forEach(e => {
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    if (!src || !tgt) return;
    lines.push(`${src.data.label} -> ${tgt.data.label}`);
    referencedIds.add(e.source);
    referencedIds.add(e.target);
  });

  // Isolated nodes (no edges) — emit as bare labels so they're not lost
  nodes.forEach(n => {
    if (!referencedIds.has(n.id)) {
      lines.push(n.data.label);
    }
  });

  return lines.join('\n');
}

// Simple validation
interface ParseError {
  line: number;
  message: string;
}

function validateText(text: string): ParseError[] {
  const errors: ParseError[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const segs = line.trim().split(/->|=>|→/).map(s => s.trim()).filter(Boolean);
    segs.forEach((seg, si) => {
      if (segs.indexOf(seg) !== si) {
        errors.push({ line: i + 1, message: `"${seg}" appears twice on same line` });
      }
    });
  });
  return errors;
}

export function TextPanel() {
  const { setNodes, setEdges, activeProcess, nodesMeta } = useZampFlowStore();
  const { fitView } = useReactFlow();
  const proc = activeProcess();
  const { showTextPanel, setShowTextPanel } = useZampFlowStore();

  const [text, setText] = useState('');
  const [errors, setErrors] = useState<ParseError[]>([]);
  const lastEditSource = useRef<'text' | 'canvas'>('canvas');
  const isTyping = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRef = useRef(false);

  // Initialize text from canvas on first open
  useEffect(() => {
    if (!showTextPanel || !proc) return;
    if (!initRef.current) {
      initRef.current = true;
      setText(flowToText(proc.nodes as Node<NodeData>[], proc.edges as Edge<EdgeData>[]));
    }
  }, [showTextPanel, proc]);

  // Canvas → text: when nodes/edges change and user isn't typing
  useEffect(() => {
    if (!showTextPanel || !proc || isTyping.current) return;
    if (lastEditSource.current === 'text') return;
    const newText = flowToText(proc.nodes as Node<NodeData>[], proc.edges as Edge<EdgeData>[]);
    setText(newText);
  }, [proc?.nodes, proc?.edges, showTextPanel]);

  const handleTextChange = useCallback((val: string) => {
    isTyping.current = true;
    lastEditSource.current = 'text';
    setText(val);

    const errs = validateText(val);
    setErrors(errs);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      isTyping.current = false;
      if (errs.length > 0) return;
      const { nodes: newNodes, edges: newEdges } = parseTextToFlow(val);
      
      // Preserve nodes_meta for nodes whose label still matches
      const currentMeta = useZampFlowStore.getState().nodesMeta;
      const currentProc = useZampFlowStore.getState().activeProcess();
      if (!currentProc) return;
      
      // Map old label → meta
      const labelToMeta = new Map<string, any>();
      currentProc.nodes.forEach(n => {
        const m = currentMeta[n.id];
        if (m && (m.notes || m.comments?.length)) labelToMeta.set(n.data.label, m);
      });
      
      // Apply preserved meta to new nodes by matching labels
      const nextMeta: Record<string, any> = {};
      newNodes.forEach(n => {
        const m = labelToMeta.get(n.data.label);
        if (m) nextMeta[n.id] = m;
      });

      useZampFlowStore.getState().setNodesMeta(nextMeta);
      setNodes(newNodes as any);
      setEdges(pruneOrphanEdges(newNodes, newEdges) as any);
      lastEditSource.current = 'canvas'; // reset so next canvas change can update text
      setTimeout(() => fitView({ padding: 0.15 }), 50);
    }, 400);
  }, [setNodes, setEdges, fitView]);

  if (!showTextPanel) return null;

  return (
    <div className="w-72 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Text Editor</span>
        <button onClick={() => setShowTextPanel(false)} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
          <X size={13} />
        </button>
      </div>

      {/* Help */}
      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
        <p className="text-[10px] text-gray-500 dark:text-gray-400">
          Each line = node chain. Use <code className="bg-gray-200 dark:bg-gray-700 rounded px-0.5">-&gt;</code> for arrows.
          <br />Canvas changes update this panel. Your edits update the canvas.
        </p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          {errors.map((e, i) => (
            <div key={i} className="flex items-start gap-1 text-[10px] text-amber-700 dark:text-amber-400">
              <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />
              <span>Line {e.line}: {e.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        value={text}
        onChange={e => handleTextChange(e.target.value)}
        className="flex-1 p-3 text-xs font-mono bg-transparent outline-none resize-none text-gray-800 dark:text-gray-200 leading-relaxed"
        placeholder={`Start -> Process request -> End\nif valid? -> Approve\nif invalid? -> Reject`}
        spellCheck={false}
      />
    </div>
  );
}
