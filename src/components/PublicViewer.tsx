import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Background, BackgroundVariant, Controls, MiniMap,
  ReactFlowProvider, NodeProps, Handle, Position, NodeResizer,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { edgeTypes } from '../edges/CustomEdge';
import { loadPublicFlow, supabase } from '../lib/supabase';
import { normalizeEdges } from '../lib/normalizeEdges';
import { FlowRow } from '../lib/supabase';
import { NodesMeta } from '../store/types';
import { Layers, Loader2, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { NodeData } from '../store/types';
import { formatRelative } from '../lib/formatRelative';

interface PublicViewerProps {
  slug: string;
}

// ── Anon comment shape ───────────────────────────────────────────────────────
interface AnonComment {
  id: string;
  author_name: string;
  author_email: null;
  body: string;
  created_at: string;
  is_anonymous: boolean;
}

// ── Shared nodesMeta context for the public viewer ───────────────────────────
// We use a simple module-level ref so public node components can read/update
// without a full React context setup.
type PublicMetaStore = {
  meta: NodesMeta;
  slug: string;
  expandedId: string | null;
  setExpanded: (id: string | null) => void;
  appendComment: (nodeId: string, comment: AnonComment) => void;
};
let _publicStore: PublicMetaStore = {
  meta: {},
  slug: '',
  expandedId: null,
  setExpanded: () => {},
  appendComment: () => {},
};

// ── Anon expand panel ────────────────────────────────────────────────────────
function AnonInlineExpand({ nodeId, slug }: { nodeId: string; slug: string }) {
  const nodeMeta = _publicStore.meta[nodeId] || { notes: '', comments: [] };
  const [comments, setComments] = useState<AnonComment[]>(
    (nodeMeta.comments || []) as AnonComment[]
  );
  const [anonName, setAnonName] = useState(() => {
    try { return localStorage.getItem('zampflow.anon_name') || ''; } catch { return ''; }
  });
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const canPost = anonName.trim().length > 0 && body.trim().length > 0 && !posting;

  const handleNameChange = (v: string) => {
    setAnonName(v);
    try { localStorage.setItem('zampflow.anon_name', v); } catch {}
  };

  const handlePost = async () => {
    if (!canPost) return;
    setPosting(true);
    setPostError(null);
    const comment: AnonComment = {
      id: crypto.randomUUID(),
      author_name: anonName.trim(),
      author_email: null,
      body: body.trim(),
      created_at: new Date().toISOString(),
      is_anonymous: true,
    };
    const { error } = await supabase.rpc('append_public_comment', {
      p_slug: slug,
      p_node_id: nodeId,
      p_comment: comment as any,
    });
    if (error) {
      setPostError('Failed to post comment. Please try again.');
    } else {
      const next = [...comments, comment];
      setComments(next);
      _publicStore.appendComment(nodeId, comment);
      setBody('');
    }
    setPosting(false);
  };

  return (
    <div
      className="absolute left-0 right-0 bg-white border border-gray-200 rounded-b-xl shadow-xl z-10 overflow-hidden"
      style={{ top: '100%', marginTop: 2 }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* Notes (read-only) */}
      {nodeMeta.notes && (
        <div className="p-2 border-b border-gray-100">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{nodeMeta.notes}</p>
        </div>
      )}

      {/* Comments */}
      <div className="p-2">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Comments</p>
        <div className="space-y-1.5 max-h-32 overflow-y-auto mb-2">
          {comments.length === 0 && (
            <p className="text-[10px] text-gray-400 italic">No comments yet — be the first!</p>
          )}
          {comments.map(c => (
            <div key={c.id} className="bg-gray-50 rounded-lg p-1.5">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[9px] font-semibold text-indigo-600 truncate">
                  {c.author_name}
                </span>
                {c.is_anonymous && (
                  <span className="text-[8px] text-gray-400 italic ml-0.5">Guest</span>
                )}
                <span className="text-[9px] text-gray-400 ml-auto flex-shrink-0">
                  {formatRelative(c.created_at)}
                </span>
              </div>
              <p className="text-[10px] text-gray-700 break-words">{c.body}</p>
            </div>
          ))}
        </div>

        {/* Anonymous comment input */}
        <div className="space-y-1.5 border-t border-gray-100 pt-2">
          <input
            type="text"
            value={anonName}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Your name *"
            className="w-full text-xs bg-gray-50 rounded-lg p-1.5 border border-gray-200 outline-none focus:ring-1 focus:ring-indigo-400"
            onKeyDown={e => e.stopPropagation()}
          />
          <div className="flex gap-1">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="flex-1 text-xs resize-none bg-gray-50 rounded-lg p-1.5 border border-gray-200 outline-none focus:ring-1 focus:ring-indigo-400"
              onKeyDown={e => {
                e.stopPropagation();
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handlePost();
              }}
            />
            <button
              onClick={handlePost}
              disabled={!canPost}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] rounded-lg flex-shrink-0 self-end"
            >
              {posting ? '...' : 'Post'}
            </button>
          </div>
          {postError && (
            <p className="text-[10px] text-red-500">{postError}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Public node shell (read-only, with expand) ────────────────────────────────
function PublicNodeShell(props: NodeProps<NodeData> & { slug: string }) {
  const { id, data, slug } = props;
  // Use a local state that syncs with the module-level store
  const [expanded, setExpandedLocal] = useState(false);
  const nodeMeta = _publicStore.meta[id] || { notes: '', comments: [] };
  const hasNotes = Boolean(nodeMeta.notes && nodeMeta.notes.trim());
  const commentCount = (nodeMeta.comments || []).length;

  // Sync collapsed state when another node expands
  useEffect(() => {
    // poll is cheap since public viewer has no other state churn
    const interval = setInterval(() => {
      const isMe = _publicStore.expandedId === id;
      setExpandedLocal(prev => (prev !== isMe ? isMe : prev));
    }, 100);
    return () => clearInterval(interval);
  }, [id]);

  const handleChevron = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const next = _publicStore.expandedId === id ? null : id;
    _publicStore.setExpanded(next);
    setExpandedLocal(next === id);
  }, [id]);

  const borderColor = data.borderColor || '#6366f1';
  const bg = data.color || '#f8faff';

  return (
    <div className="relative w-full h-full">
      <NodeResizer minWidth={80} minHeight={40} isVisible={false} color="#6366f1" />

      {/* Handles — must match editor handle ids so saved edges resolve */}
      <Handle type="target" id="t-top"    position={Position.Top}    style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" id="s-top"    position={Position.Top}    style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" id="t-bottom" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" id="s-bottom" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" id="t-left"   position={Position.Left}   style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" id="s-left"   position={Position.Left}   style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" id="t-right"  position={Position.Right}  style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" id="s-right"  position={Position.Right}  style={{ opacity: 0, pointerEvents: 'none' }} />

      {/* Node body */}
      <div
        className="w-full h-full rounded-xl flex items-center justify-center"
        style={{ background: bg, border: `1.5px solid ${borderColor}`, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
      >
        <span
          className="px-2 text-center pointer-events-none select-none"
          style={{ fontSize: data.fontSize || 13, color: '#0f172a', fontWeight: 500 }}
        >
          {data.label}
        </span>
      </div>

      {/* Badges */}
      {(hasNotes || commentCount > 0) && (
        <div className="absolute top-1 right-1 z-10 flex gap-0.5 pointer-events-none">
          {hasNotes && (
            <span className="flex items-center justify-center w-4 h-4 bg-yellow-100 rounded-full" title="Has notes">
              <FileText size={9} className="text-yellow-600" />
            </span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center justify-center min-w-[1rem] h-4 bg-indigo-100 rounded-full px-0.5" title={`${commentCount} comment${commentCount !== 1 ? 's' : ''}`}>
              <span className="text-[8px] font-bold text-indigo-600">{commentCount}</span>
            </span>
          )}
        </div>
      )}

      {/* Chevron expand button */}
      <button
        onClick={handleChevron}
        className="absolute bottom-1 right-1 z-20 flex items-center justify-center w-5 h-5 rounded-full bg-white/80 hover:bg-white shadow-sm border border-gray-200 transition-all duration-150 cursor-pointer"
        title={expanded ? 'Collapse' : 'View notes & comments'}
        style={{ pointerEvents: 'all' }}
      >
        {expanded
          ? <ChevronUp size={10} className="text-indigo-500" />
          : <ChevronDown size={10} className="text-gray-400 hover:text-indigo-500" />
        }
      </button>

      {expanded && <AnonInlineExpand nodeId={id} slug={slug} />}
    </div>
  );
}

// ── Build public node types bound to the slug ────────────────────────────────
function makePublicNodeTypes(slug: string) {
  const Shell = (props: NodeProps<NodeData>) => <PublicNodeShell {...props} slug={slug} />;
  const types: Record<string, React.ComponentType<NodeProps>> = {};
  const nodeTypeNames = [
    'process','decision','start','end','data','connector',
    'annotation','manual_action','database','document','delay','subprocess',
  ];
  nodeTypeNames.forEach(t => { types[t] = Shell; });
  return types;
}

// ── ViewerInner ───────────────────────────────────────────────────────────────
function ViewerInner({ slug }: PublicViewerProps) {
  const [flow, setFlow] = useState<FlowRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [meta, setMeta] = useState<NodesMeta>({});
  const [publicNodeTypes] = useState(() => makePublicNodeTypes(slug));

  // Wire up the module-level store so public node components can read/update it
  useEffect(() => {
    _publicStore.meta = meta;
    _publicStore.slug = slug;
    _publicStore.expandedId = expandedId;
    _publicStore.setExpanded = (id) => setExpandedId(id);
    _publicStore.appendComment = (nodeId, comment) => {
      setMeta(prev => {
        const existing = prev[nodeId] || { notes: '', comments: [] };
        return {
          ...prev,
          [nodeId]: {
            ...existing,
            comments: [...(existing.comments || []), comment],
          },
        };
      });
    };
  }, [meta, slug, expandedId]);

  useEffect(() => {
    loadPublicFlow(slug).then(f => {
      if (!f) setError('This flow is not found or has been made private.');
      else {
        setFlow(f);
        setMeta((f.nodes_meta as NodesMeta) || {});
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={24} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !flow) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mb-4">
          <Layers size={22} className="text-white" />
        </div>
        <h1 className="text-lg font-semibold text-gray-800 mb-1">Flow not found</h1>
        <p className="text-sm text-gray-500 mb-4">{error || 'This flow is private or does not exist.'}</p>
        <a href="/" className="text-sm text-indigo-600 hover:underline">← Go to ZampFlow</a>
      </div>
    );
  }

  const nodes = flow.data?.nodes || [];
  const edges = normalizeEdges(flow.data?.edges || []);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Minimal header */}
      <div className="h-11 flex items-center gap-2 px-4 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Layers size={13} className="text-white" />
        </div>
        <span className="font-semibold text-sm text-gray-800">{flow.name}</span>
        <span className="ml-2 px-2 py-0.5 text-[9px] bg-gray-100 text-gray-500 rounded-full uppercase tracking-wide">Read-only</span>
        <div className="flex-1" />
        <a href="/" className="text-xs text-indigo-600 hover:underline">Open ZampFlow →</a>
      </div>

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={publicNodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
          <Controls showInteractive={false} />
          <MiniMap nodeColor={n => n.data?.color || '#e5e7eb'} maskColor="rgba(0,0,0,0.07)" />
        </ReactFlow>
      </div>

      {/* Footer */}
      <div className="h-8 flex items-center justify-center bg-white border-t border-gray-200">
        <a href="/" className="text-[10px] text-gray-400 hover:text-indigo-600 transition-colors">
          Made with <strong>ZampFlow</strong> ↗
        </a>
      </div>
    </div>
  );
}

export function PublicViewer({ slug }: PublicViewerProps) {
  return (
    <ReactFlowProvider>
      <ViewerInner slug={slug} />
    </ReactFlowProvider>
  );
}
