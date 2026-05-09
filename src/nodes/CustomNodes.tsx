import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FileText, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Handle, Position, NodeResizer, NodeProps } from 'reactflow';
import { NodeData } from '../store/types';
import { useZampFlowStore } from '../store/useZampFlowStore';
import { formatRelative } from '../lib/formatRelative';

// ── Handle styles ─────────────────────────────────────────────────────────────

// A single handle per position that acts as both source and target.
// ConnectionMode.Loose (set on Canvas) allows connecting from any handle type
// to any other, so one handle per side is sufficient and keeps the hit-target
// clean.  Visibility is managed via CSS: faint at rest, opaque on hover of the
// parent node (.react-flow__node:hover) or when a connection is being dragged
// (.react-flow__handle-connecting).
const handleBaseStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  background: '#6366f1',
  border: '2px solid #ffffff',
  opacity: 0,                    // hidden at rest; revealed by CSS hover rule
  transition: 'opacity 0.15s, transform 0.15s',
  zIndex: 10,
};

function DualHandle({ position, id }: { position: Position; id: string }) {
  // Use type="source" — with ConnectionMode.Loose the handle works for both
  // drag-to-connect directions.  A single node per position eliminates the
  // invisible-handle-on-top problem that was blocking pointer events.
  return (
    <Handle
      type="source"
      position={position}
      id={`s-${id}`}
      style={handleBaseStyle}
      className="zampflow-handle"
    />
  );
}

// ── Inline expand panel ───────────────────────────────────────────────────────

interface InlineExpandProps {
  nodeId: string;
  onClose: () => void;
}

function InlineExpand({ nodeId, onClose }: InlineExpandProps) {
  const { nodesMeta, setNodeNote, addComment } = useZampFlowStore();
  const meta = nodesMeta[nodeId] || { notes: '', comments: [] };
  const userEmail = useZampFlowStore(s => (s as any).user?.email || '');
  const userName = useZampFlowStore(s => (s as any).user?.name || '');

  // Try to get email from authStore via window (safe fallback)
  const [authorEmail, setAuthorEmail] = useState('');
  const [authorName, setAuthorName] = useState('');
  useEffect(() => {
    try {
      const stored = localStorage.getItem('zampflow.auth.v1');
      if (stored) {
        const u = JSON.parse(stored);
        setAuthorEmail(u.email || '');
        setAuthorName(u.name || '');
      }
    } catch {}
  }, []);

  const [notes, setNotes] = useState(meta.notes);
  const [commentText, setCommentText] = useState('');
  const notesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNotesChange = (v: string) => {
    setNotes(v);
    if (notesDebounce.current) clearTimeout(notesDebounce.current);
    notesDebounce.current = setTimeout(() => setNodeNote(nodeId, v), 600);
  };

  const submitComment = () => {
    const body = commentText.trim();
    if (!body) return;
    addComment(nodeId, {
      id: crypto.randomUUID(),
      author_email: authorEmail,
      author_name: authorName || authorEmail.split('@')[0],
      body,
      created_at: new Date().toISOString(),
    });
    setCommentText('');
  };

  return (
    <div
      className="absolute left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-xl shadow-xl z-10 overflow-hidden"
      style={{ top: '100%', marginTop: 2 }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* Notes */}
      <div className="p-2 border-b border-gray-100 dark:border-gray-800">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
        <textarea
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Add notes..."
          className="w-full text-xs resize-none bg-gray-50 dark:bg-gray-800 rounded-lg p-1.5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-1 focus:ring-indigo-400"
          rows={2}
          onKeyDown={e => e.stopPropagation()}
        />
      </div>

      {/* Comments */}
      <div className="p-2">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Comments</p>
        <div className="space-y-1.5 max-h-32 overflow-y-auto mb-2">
          {meta.comments.length === 0 && (
            <p className="text-[10px] text-gray-400 italic">No comments yet</p>
          )}
          {meta.comments.map(c => (
            <div key={c.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-1.5">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                  {c.author_name || c.author_email}
                </span>
                <span className="text-[9px] text-gray-400 ml-auto flex-shrink-0">
                  {formatRelative(c.created_at)}
                </span>
              </div>
              <p className="text-[10px] text-gray-700 dark:text-gray-300 break-words">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="Add comment... (Cmd+Enter)"
            rows={1}
            className="flex-1 text-xs resize-none bg-gray-50 dark:bg-gray-800 rounded-lg p-1.5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-1 focus:ring-indigo-400"
            onKeyDown={e => {
              e.stopPropagation();
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitComment();
            }}
          />
          <button
            onClick={submitComment}
            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] rounded-lg flex-shrink-0"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Node shell ────────────────────────────────────────────────────────────────
//
// The shell is the container rendered by React Flow for each node.
// We let it size itself from content rather than forcing a fixed w/h.
// The node's style.width/height (set by textToFlow or the resizer) constrains
// the ReactFlow node bounding box; inside that we let flexbox / text wrap do
// the rest.

interface NodeShellProps extends NodeProps<NodeData> {
  shape: React.ReactNode;
  minW?: number;
  minH?: number;
  /** Extra CSS class applied to the label span — use for diamond inset padding */
  labelClassName?: string;
  /** Override label style — use for diamond inset padding */
  labelStyle?: React.CSSProperties;
}

function NodeShell({
  id, data, selected, dragging, shape,
  minW = 80, minH = 40,
  labelClassName,
  labelStyle,
}: NodeShellProps & { dragging?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const { expandedNodeId, setExpandedNodeId, nodesMeta } = useZampFlowStore();
  const expanded = expandedNodeId === id;
  const meta = nodesMeta[id] || { notes: '', comments: [] };
  const hasNotes = Boolean(meta.notes && meta.notes.trim());
  const commentCount = meta.comments ? meta.comments.length : 0;

  // Sync label if data changes from outside
  useEffect(() => { setLabel(data.label); }, [data.label]);

  const handleDblClick = useCallback(() => setEditing(true), []);
  const handleBlur = useCallback(() => {
    setEditing(false);
    data.label = label;
  }, [label, data]);

  const handleChevronClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodeId(expanded ? null : id);
  }, [expanded, id, setExpandedNodeId]);

  // Collapse on click outside
  useEffect(() => {
    if (!expanded) return;
    const handler = () => setExpandedNodeId(null);
    const t = setTimeout(() => window.addEventListener('click', handler, { once: true }), 100);
    return () => { clearTimeout(t); window.removeEventListener('click', handler); };
  }, [expanded, setExpandedNodeId]);

  return (
    <div
      className="relative"
      style={{
        width: '100%',
        height: '100%',
        transition: dragging ? 'none' : 'transform 200ms ease-out',
      }}
    >
      <NodeResizer minWidth={minW} minHeight={minH} isVisible={selected} color="#6366f1" />
      {/* Notes + comments badges at top-right */}
      {(hasNotes || commentCount > 0) && (
        <div className="absolute top-1 right-1 z-10 flex gap-0.5 pointer-events-none">
          {hasNotes && (
            <span className="flex items-center justify-center w-4 h-4 bg-yellow-100 dark:bg-yellow-900/40 rounded-full" title="Has notes">
              <FileText size={9} className="text-yellow-600 dark:text-yellow-400" />
            </span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center justify-center min-w-[1rem] h-4 bg-indigo-100 dark:bg-indigo-900/40 rounded-full px-0.5" title={`${commentCount} comment${commentCount !== 1 ? 's' : ''}`}>
              <span className="text-[8px] font-bold text-indigo-600 dark:text-indigo-400">{commentCount}</span>
            </span>
          )}
        </div>
      )}
      <DualHandle position={Position.Top}    id="top"    />
      <DualHandle position={Position.Right}  id="right"  />
      <DualHandle position={Position.Bottom} id="bottom" />
      <DualHandle position={Position.Left}   id="left"   />

      {/* Chevron expand button — bottom-right corner, always visible */}
      <button
        onClick={handleChevronClick}
        className="absolute bottom-1 right-1 z-20 flex items-center justify-center w-5 h-5 rounded-full bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 transition-all duration-150 cursor-pointer"
        title={expanded ? 'Collapse notes & comments' : 'Click to add notes & comments'}
        style={{ pointerEvents: 'all' }}
      >
        {expanded
          ? <ChevronUp size={10} className="text-indigo-500" />
          : <ChevronDown size={10} className="text-gray-400 hover:text-indigo-500" />
        }
      </button>

      <div
        className="w-full h-full flex items-center justify-center"
        onDoubleClick={handleDblClick}
      >
        {shape}
        {editing ? (
          <input
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={e => {
              if (e.key === 'Delete' || e.key === 'Backspace') e.stopPropagation();
              if (e.key === 'Enter') handleBlur();
              if (e.key === 'Escape') { setEditing(false); setLabel(data.label); }
            }}
            className="absolute z-10 text-center bg-white dark:bg-gray-800 border border-indigo-400 rounded px-1 text-sm max-w-[90%]"
            style={{ fontSize: data.fontSize || 13 }}
          />
        ) : (
          <span
            className={`absolute inset-0 flex items-center justify-center text-center pointer-events-none select-none${labelClassName ? ' ' + labelClassName : ''}`}
            style={{
              fontSize: data.fontSize || 13,
              color: '#0f172a',
              fontWeight: 500,
              // Auto-wrap text and respect node size
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              lineHeight: 1.35,
              ...labelStyle,
            }}
          >
            {data.label}
          </span>
        )}
      </div>

      {expanded && <InlineExpand nodeId={id} onClose={() => setExpandedNodeId(null)} />}
    </div>
  );
}

// ── Gradient / visual style helpers ───────────────────────────────────────────

function makeGradientStyle(type: string, data: NodeData): React.CSSProperties {
  // Default gradients per node type (overridden if user has set custom color)
  const gradients: Record<string, string> = {
    start:   'linear-gradient(135deg, #ecfdf5, #d1fae5)',
    end:     'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
    decision:'linear-gradient(135deg, #fffbeb, #fef3c7)',
    process: 'linear-gradient(135deg, #ffffff, #f1f5f9)',
    data:    'linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%)',
    database:'linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)',
    document:'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
    manual_action: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)',
    annotation: 'linear-gradient(135deg, #fefce8 0%, #fde68a 100%)',
    connector: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
    delay:   'linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%)',
    subprocess: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
  };
  const bg = data.color ? data.color : (gradients[type] || gradients.process);
  return {
    background: bg,
    border: `1.5px solid ${data.borderColor || defaultBorder(type)}`,
    width: '100%',
    height: '100%',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
  };
}

function defaultBorder(type: string): string {
  const borders: Record<string, string> = {
    start: '#10b981', end: '#dc2626', decision: '#f59e0b',
    process: '#94a3b8',
    data: '#16a34a', database: '#2563eb', document: '#ea580c',
    manual_action: '#7c3aed', annotation: '#ca8a04',
    connector: '#6366f1', delay: '#16a34a', subprocess: '#6366f1',
  };
  return borders[type] || '#6366f1';
}

// Wrapper that adds hover lift effect
function VisualWrapper({ children, selected, dragging }: { children: React.ReactNode; selected: boolean; dragging?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`w-full h-full ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        filter: hovered && !dragging ? 'brightness(1.02)' : undefined,
        transform: hovered && !selected && !dragging ? 'translateY(-1px)' : undefined,
        transition: dragging ? 'none' : 'filter 0.15s, transform 0.15s',
      }}
    >
      {children}
    </div>
  );
}

// ── Node components ───────────────────────────────────────────────────────────

export function ProcessNode(props: NodeProps<NodeData>) {
  return (
    <NodeShell {...props} shape={
      <VisualWrapper selected={props.selected} dragging={props.dragging === true}>
        <div className="rounded-xl" style={makeGradientStyle('process', props.data)} />
      </VisualWrapper>
    }
    labelStyle={{ padding: '10px 14px' }}
    />
  );
}

export function DecisionNode(props: NodeProps<NodeData>) {
  const { data } = props;
  const border = data.borderColor || '#ca8a04';
  // Use a viewBox that matches normalized 0-100 coordinates so the diamond
  // always fills its bounding box regardless of actual pixel size.
  // Points: top-center, right-center, bottom-center, left-center — all at 3px inset.
  // Label inset: 22% vertical + 26% horizontal so text stays inside the diamond polygon.
  const diamondLabelStyle: React.CSSProperties = {
    padding: '22% 26%',
    lineHeight: 1.35,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  };
  return (
    <NodeShell {...props} minW={180} minH={120}
      labelStyle={diamondLabelStyle}
      shape={
        <VisualWrapper selected={props.selected} dragging={props.dragging === true}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0"
          >
            <defs>
              <linearGradient id="decisionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef9c3" />
                <stop offset="100%" stopColor="#fde68a" />
              </linearGradient>
            </defs>
            <polygon
              points="50,3 97,50 50,97 3,50"
              fill={data.color || 'url(#decisionGrad)'}
              stroke={border}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))' }}
            />
          </svg>
        </VisualWrapper>
      }
    />
  );
}

export function StartNode(props: NodeProps<NodeData>) {
  return (
    <NodeShell {...props} shape={
      <VisualWrapper selected={props.selected} dragging={props.dragging === true}>
        <div className="rounded-full" style={makeGradientStyle('start', props.data)} />
      </VisualWrapper>
    }
    labelStyle={{ padding: '10px 20px' }}
    />
  );
}

export function EndNode(props: NodeProps<NodeData>) {
  return (
    <NodeShell {...props} shape={
      <VisualWrapper selected={props.selected} dragging={props.dragging === true}>
        <div className="rounded-full" style={makeGradientStyle('end', { ...props.data, color: props.data.color, borderColor: props.data.borderColor || '#dc2626' })} />
      </VisualWrapper>
    }
    labelStyle={{ padding: '10px 20px' }}
    />
  );
}

export function DataNode(props: NodeProps<NodeData>) {
  const { data } = props;
  const border = data.borderColor || '#16a34a';
  return (
    <NodeShell {...props} shape={
      <VisualWrapper selected={props.selected} dragging={props.dragging === true}>
        <svg width="100%" height="100%" viewBox="0 0 160 60" preserveAspectRatio="none" className="absolute inset-0">
          <defs>
            <linearGradient id="dataGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f0fdf4" />
              <stop offset="100%" stopColor="#d1fae5" />
            </linearGradient>
          </defs>
          <polygon points="20,4 156,4 140,56 4,56" fill={data.color || 'url(#dataGrad)'} stroke={border} strokeWidth="1.5" />
        </svg>
      </VisualWrapper>
    }
    labelStyle={{ padding: '10px 24px' }}
    />
  );
}

export function ConnectorNode(props: NodeProps<NodeData>) {
  return (
    <NodeShell {...props} minW={40} minH={40} shape={
      <VisualWrapper selected={props.selected} dragging={props.dragging === true}>
        <div className="rounded-full" style={makeGradientStyle('connector', props.data)} />
      </VisualWrapper>
    }
    labelStyle={{ padding: '8px 12px' }}
    />
  );
}

export function AnnotationNode(props: NodeProps<NodeData>) {
  return (
    <NodeShell {...props} shape={
      <VisualWrapper selected={props.selected} dragging={props.dragging === true}>
        <div className="w-full h-full rounded-xl" style={{
          ...makeGradientStyle('annotation', props.data),
          border: `2px dashed ${props.data.borderColor || '#ca8a04'}`,
        }} />
      </VisualWrapper>
    }
    labelStyle={{ padding: '10px 14px' }}
    />
  );
}

export function ManualActionNode(props: NodeProps<NodeData>) {
  const { data } = props;
  const border = data.borderColor || '#7c3aed';
  return (
    <NodeShell {...props} shape={
      <VisualWrapper selected={props.selected} dragging={props.dragging === true}>
        <svg width="100%" height="100%" viewBox="0 0 160 60" preserveAspectRatio="none" className="absolute inset-0">
          <defs>
            <linearGradient id="manualGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#faf5ff" />
              <stop offset="100%" stopColor="#ede9fe" />
            </linearGradient>
          </defs>
          <polygon points="0,60 160,60 148,0 12,0" fill={data.color || 'url(#manualGrad)'} stroke={border} strokeWidth="1.5" />
        </svg>
      </VisualWrapper>
    }
    labelStyle={{ padding: '10px 14px' }}
    />
  );
}

export function DatabaseNode(props: NodeProps<NodeData>) {
  const { data } = props;
  const border = data.borderColor || '#2563eb';
  const fill = data.color || '#eff6ff';
  return (
    <NodeShell {...props} shape={
      <VisualWrapper selected={props.selected} dragging={props.dragging === true}>
        <svg width="100%" height="100%" viewBox="0 0 160 80" preserveAspectRatio="none" className="absolute inset-0">
          <defs>
            <linearGradient id="dbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#eff6ff" />
              <stop offset="100%" stopColor="#bfdbfe" />
            </linearGradient>
          </defs>
          <ellipse cx="80" cy="16" rx="76" ry="14" fill={fill} stroke={border} strokeWidth="1.5" />
          <rect x="4" y="16" width="152" height="50" fill={fill} stroke="none" />
          <line x1="4"   y1="16" x2="4"   y2="66" stroke={border} strokeWidth="1.5" />
          <line x1="156" y1="16" x2="156" y2="66" stroke={border} strokeWidth="1.5" />
          <ellipse cx="80" cy="66" rx="76" ry="14" fill={fill} stroke={border} strokeWidth="1.5" />
        </svg>
      </VisualWrapper>
    }
    labelStyle={{ padding: '22px 14px 10px' }}
    />
  );
}

export function DocumentNode(props: NodeProps<NodeData>) {
  const { data } = props;
  const border = data.borderColor || '#ea580c';
  const fill = data.color || '#fff7ed';
  return (
    <NodeShell {...props} shape={
      <VisualWrapper selected={props.selected} dragging={props.dragging === true}>
        <svg width="100%" height="100%" viewBox="0 0 160 72" preserveAspectRatio="none" className="absolute inset-0">
          <path d="M4,4 H156 V56 Q120,72 80,60 Q40,48 4,64 Z" fill={fill} stroke={border} strokeWidth="1.5" />
        </svg>
      </VisualWrapper>
    }
    labelStyle={{ padding: '8px 14px 20px' }}
    />
  );
}

export function DelayNode(props: NodeProps<NodeData>) {
  const { data } = props;
  const border = data.borderColor || '#16a34a';
  const fill = data.color || '#f0fdf4';
  return (
    <NodeShell {...props} shape={
      <VisualWrapper selected={props.selected} dragging={props.dragging === true}>
        <svg width="100%" height="100%" viewBox="0 0 160 60" preserveAspectRatio="none" className="absolute inset-0">
          <path d="M4,4 H120 Q156,4 156,30 Q156,56 120,56 H4 Z" fill={fill} stroke={border} strokeWidth="1.5" />
        </svg>
      </VisualWrapper>
    }
    labelStyle={{ padding: '10px 24px 10px 14px' }}
    />
  );
}

export function SubprocessNode(props: NodeProps<NodeData>) {
  const { data } = props;
  const border = data.borderColor || '#6366f1';
  return (
    <NodeShell {...props} shape={
      <VisualWrapper selected={props.selected} dragging={props.dragging === true}>
        <div className="relative rounded-xl w-full h-full" style={makeGradientStyle('subprocess', data)}>
          <div className="absolute left-5 inset-y-0 border-l-2" style={{ borderColor: border }} />
          <div className="absolute right-5 inset-y-0 border-r-2" style={{ borderColor: border }} />
        </div>
      </VisualWrapper>
    }
    labelStyle={{ padding: '10px 28px' }}
    />
  );
}

export const nodeTypes = {
  process:       ProcessNode,
  decision:      DecisionNode,
  start:         StartNode,
  end:           EndNode,
  data:          DataNode,
  connector:     ConnectorNode,
  annotation:    AnnotationNode,
  manual_action: ManualActionNode,
  database:      DatabaseNode,
  document:      DocumentNode,
  delay:         DelayNode,
  subprocess:    SubprocessNode,
};
