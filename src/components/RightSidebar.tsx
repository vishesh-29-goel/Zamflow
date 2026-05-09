import React, { useState, useRef } from 'react';
import { useStore, useReactFlow } from 'reactflow';
import { Settings, Wand2, GitBranch, X, RotateCcw, Trash2, Plus, ChevronLeft, ChevronRight, ChevronDown, Layers } from 'lucide-react';
import { useZampFlowStore } from '../store/useZampFlowStore';
import { parseTextToFlow, pruneOrphanEdges } from '../lib/textToFlow';
import { NodeType } from '../store/types';

type Tab = 'palette' | 'properties' | 'versions';

// ─── Node Palette data ────────────────────────────────────────────────────────
const NODE_PALETTE: { category: string; items: { type: NodeType; label: string; color: string; borderColor: string }[] }[] = [
  { category: 'Flow', items: [
    { type: 'start',         label: 'Start',         color: '#dcfce7', borderColor: '#16a34a' },
    { type: 'end',           label: 'End',           color: '#fee2e2', borderColor: '#dc2626' },
    { type: 'process',       label: 'Process',       color: '#eff6ff', borderColor: '#6366f1' },
    { type: 'decision',      label: 'Decision',      color: '#fef9c3', borderColor: '#ca8a04' },
    { type: 'subprocess',    label: 'Subprocess',    color: '#eff6ff', borderColor: '#6366f1' },
    { type: 'manual_action', label: 'Manual Action', color: '#faf5ff', borderColor: '#7c3aed' },
    { type: 'connector',     label: 'Connector',     color: '#f3f4f6', borderColor: '#6366f1' },
  ]},
  { category: 'Data', items: [
    { type: 'data',     label: 'Data',     color: '#f0fdf4', borderColor: '#16a34a' },
    { type: 'database', label: 'Database', color: '#eff6ff', borderColor: '#2563eb' },
    { type: 'document', label: 'Document', color: '#fff7ed', borderColor: '#ea580c' },
  ]},
  { category: 'Annotations', items: [
    { type: 'annotation', label: 'Annotation', color: '#fefce8', borderColor: '#ca8a04' },
    { type: 'delay',      label: 'Delay',      color: '#f0fdf4', borderColor: '#16a34a' },
  ]},
];


// ─── Connection Style types ────────────────────────────────────────────────────
export interface ConnectionStyle {
  id: string;
  label: string;
  dashed: boolean;
  arrow: 'target' | 'both' | 'none';
  preview: React.ReactNode;
}

const CONNECTION_STYLES: ConnectionStyle[] = [
  {
    id: 'solid-one-way',
    label: 'Solid arrow (one-way)',
    dashed: false,
    arrow: 'target',
    preview: (
      <svg width="60" height="20" viewBox="0 0 60 20">
        <line x1="4" y1="10" x2="48" y2="10" stroke="#6366f1" strokeWidth="2"/>
        <polygon points="50,10 44,7 44,13" fill="#6366f1"/>
      </svg>
    ),
  },
  {
    id: 'dotted-one-way',
    label: 'Dotted arrow (one-way)',
    dashed: true,
    arrow: 'target',
    preview: (
      <svg width="60" height="20" viewBox="0 0 60 20">
        <line x1="4" y1="10" x2="48" y2="10" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 3"/>
        <polygon points="50,10 44,7 44,13" fill="#6366f1"/>
      </svg>
    ),
  },
  {
    id: 'solid-two-way',
    label: 'Solid line (two-way)',
    dashed: false,
    arrow: 'both',
    preview: (
      <svg width="60" height="20" viewBox="0 0 60 20">
        <polygon points="6,10 12,7 12,13" fill="#6366f1"/>
        <line x1="6" y1="10" x2="54" y2="10" stroke="#6366f1" strokeWidth="2"/>
        <polygon points="54,10 48,7 48,13" fill="#6366f1"/>
      </svg>
    ),
  },
  {
    id: 'dotted-two-way',
    label: 'Dotted line (two-way)',
    dashed: true,
    arrow: 'both',
    preview: (
      <svg width="60" height="20" viewBox="0 0 60 20">
        <polygon points="6,10 12,7 12,13" fill="#6366f1"/>
        <line x1="6" y1="10" x2="54" y2="10" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 3"/>
        <polygon points="54,10 48,7 48,13" fill="#6366f1"/>
      </svg>
    ),
  },
  {
    id: 'plain-line',
    label: 'Plain line',
    dashed: false,
    arrow: 'none',
    preview: (
      <svg width="60" height="20" viewBox="0 0 60 20">
        <line x1="4" y1="10" x2="56" y2="10" stroke="#6366f1" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    id: 'dotted-no-arrow',
    label: 'Dotted line (no arrow)',
    dashed: true,
    arrow: 'none',
    preview: (
      <svg width="60" height="20" viewBox="0 0 60 20">
        <line x1="4" y1="10" x2="56" y2="10" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 3"/>
      </svg>
    ),
  },
];

// Global mutable ref for the active connection style (accessed by store onConnect)
let _activeConnectionStyleId: string = 'solid-one-way';
export function getActiveConnectionStyleId() { return _activeConnectionStyleId; }
export function setActiveConnectionStyleId(id: string) { _activeConnectionStyleId = id; }
export function getActiveConnectionStyle(): ConnectionStyle {
  return CONNECTION_STYLES.find(s => s.id === _activeConnectionStyleId) ?? CONNECTION_STYLES[0];
}

function ConnectionsPaletteSection({
  selectedEdges,
  updateEdgeData,
}: {
  selectedEdges: any[];
  updateEdgeData: (id: string, data: any) => void;
}) {
  const [activeId, setActiveId] = useState(_activeConnectionStyleId);
  const [open, setOpen] = useState(true);

  const applyStyle = (style: ConnectionStyle) => {
    setActiveId(style.id);
    setActiveConnectionStyleId(style.id);
    // Option B: if an edge is selected, rewrite its style immediately
    if (selectedEdges.length > 0) {
      selectedEdges.forEach(edge => {
        updateEdgeData(edge.id, {
          dashed: style.dashed,
          arrow: style.arrow !== 'none',
          markerStart: style.arrow === 'both',
        });
      });
    }
  };

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 w-full px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-gray-200"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        Connections
      </button>
      {open && (
        <div className="ml-1 space-y-0.5">
          <p className="text-[9px] text-gray-400 px-2 pb-0.5">Click to set default for next edge{selectedEdges.length > 0 ? ' • also applies to selected edge' : ''}</p>
          {CONNECTION_STYLES.map(style => (
            <button
              key={style.id}
              onClick={() => applyStyle(style)}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left transition-colors ${
                activeId === style.id
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex-shrink-0">{style.preview}</div>
              <span className="text-xs text-gray-700 dark:text-gray-300 leading-tight">{style.label}</span>
              {activeId === style.id && (
                <span className="ml-auto text-indigo-500 text-[10px] font-bold">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PaletteItem({ type, label, color, borderColor }: { type: NodeType; label: string; color: string; borderColor: string }) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/reactflow', type);
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing select-none"
    >
      <div
        className="w-5 h-5 flex-shrink-0 rounded"
        style={{ background: color, border: `1.5px solid ${borderColor}` }}
      />
      <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
    </div>
  );
}

function PaletteCategory({ category, items }: typeof NODE_PALETTE[0]) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 w-full px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-gray-200"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {category}
      </button>
      {open && (
        <div className="ml-1">
          {items.map(i => <PaletteItem key={i.type} {...i} />)}
        </div>
      )}
    </div>
  );
}

function NodePaletteTab({ selectedEdges, updateEdgeData }: { selectedEdges: any[]; updateEdgeData: (id: string, data: any) => void }) {
  return (
    <div className="p-2 space-y-1">
      <p className="text-[10px] text-gray-400 px-2 pb-1">Drag nodes onto the canvas</p>
      {NODE_PALETTE.map(g => <PaletteCategory key={g.category} {...g} />)}
      <ConnectionsPaletteSection selectedEdges={selectedEdges} updateEdgeData={updateEdgeData} />
    </div>
  );
}

// ─── Properties Tab ───────────────────────────────────────────────────────────
function PropertiesTab() {
  const { activeProcess, updateNodeData, updateEdgeData, setNodes, setEdges, pushHistory } = useZampFlowStore();
  const selectedNodes = useStore(s => s.getNodes().filter(n => n.selected));
  const selectedEdges = useStore(s => s.edges.filter(e => e.selected));
  const proc = activeProcess();

  if (!proc) return <div className="p-4 text-xs text-gray-400">No process selected</div>;
  if (selectedNodes.length === 0 && selectedEdges.length === 0) {
    return (
      <div className="p-4 text-xs text-gray-400 text-center">
        Select a node or edge to edit properties
      </div>
    );
  }

  // ── Node properties ─────────────────────────────────────────────────────────
  if (selectedNodes.length > 0) {
    const node = selectedNodes[0];
    const data = node.data;

    const handleDeleteNode = () => {
      pushHistory();
      const currentProc = useZampFlowStore.getState().activeProcess();
      if (!currentProc) return;
      setNodes(currentProc.nodes.filter(n => n.id !== node.id));
      setEdges(currentProc.edges.filter(e => e.source !== node.id && e.target !== node.id));
    };

    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Node Properties
          </div>
          <button
            onClick={handleDeleteNode}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800"
            title="Delete node (or press Delete/Backspace)"
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Label</label>
          <input
            value={data.label}
            onChange={e => updateNodeData(node.id, { label: e.target.value })}
            className="input-field mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Fill Color</label>
            <input
              type="color"
              value={data.color || '#ffffff'}
              onChange={e => updateNodeData(node.id, { color: e.target.value })}
              className="mt-1 w-full h-8 rounded border border-gray-200 dark:border-gray-600 cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Border Color</label>
            <input
              type="color"
              value={data.borderColor || '#6366f1'}
              onChange={e => updateNodeData(node.id, { borderColor: e.target.value })}
              className="mt-1 w-full h-8 rounded border border-gray-200 dark:border-gray-600 cursor-pointer"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Font Size</label>
          <input
            type="number" min={9} max={24}
            value={data.fontSize || 13}
            onChange={e => updateNodeData(node.id, { fontSize: Number(e.target.value) })}
            className="input-field mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Notes</label>
          <textarea
            value={data.notes || ''}
            onChange={e => updateNodeData(node.id, { notes: e.target.value })}
            className="input-field mt-1 h-16 resize-none"
            placeholder="Add notes..."
          />
        </div>
        <MetadataEditor nodeId={node.id} metadata={data.metadata || {}} />
      </div>
    );
  }

  // ── Edge properties ─────────────────────────────────────────────────────────
  if (selectedEdges.length > 0) {
    const edge = selectedEdges[0];
    const edata = edge.data || {};

    const handleDeleteEdge = () => {
      pushHistory();
      const currentProc = useZampFlowStore.getState().activeProcess();
      if (!currentProc) return;
      setEdges(currentProc.edges.filter(e => e.id !== edge.id));
    };

    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Edge Properties
          </div>
          <button
            onClick={handleDeleteEdge}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800"
            title="Delete edge (or press Delete/Backspace)"
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Style</label>
          <select
            value={edata.edgeType || 'smoothstep'}
            onChange={e => updateEdgeData(edge.id, { edgeType: e.target.value as any })}
            className="input-field mt-1"
          >
            <option value="straight">Straight</option>
            <option value="smoothstep">Elbow</option>
            <option value="bezier">Bezier</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Color</label>
            <input
              type="color"
              value={edata.color || '#6366f1'}
              onChange={e => updateEdgeData(edge.id, { color: e.target.value })}
              className="mt-1 w-full h-8 rounded border border-gray-200 dark:border-gray-600 cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Thickness</label>
            <input
              type="number" min={1} max={8}
              value={edata.thickness || 2}
              onChange={e => updateEdgeData(edge.id, { thickness: Number(e.target.value) })}
              className="input-field mt-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={!!edata.dashed}
              onChange={e => updateEdgeData(edge.id, { dashed: e.target.checked })}
            /> Dashed
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={edata.arrow !== false}
              onChange={e => updateEdgeData(edge.id, { arrow: e.target.checked })}
            /> Arrow
          </label>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Condition Label</label>
          <select
            value={edata.conditionLabel || ''}
            onChange={e => updateEdgeData(edge.id, { conditionLabel: e.target.value })}
            className="input-field mt-1"
          >
            <option value="">None</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="Maybe">Maybe</option>
            <option value="Retry">Retry</option>
            <option value="Escalate">Escalate</option>
            <option value="Custom">Custom</option>
          </select>
        </div>
      </div>
    );
  }
  return null;
}

function MetadataEditor({ nodeId, metadata }: { nodeId: string; metadata: Record<string, string> }) {
  const { updateNodeData } = useZampFlowStore();
  const [entries, setEntries] = useState(Object.entries(metadata));

  const addEntry = () => setEntries(e => [...e, ['', '']]);
  const updateEntry = (i: number, k: string, v: string) => {
    const next = [...entries]; next[i] = [k, v]; setEntries(next);
    updateNodeData(nodeId, { metadata: Object.fromEntries(next.filter(([key]) => key)) });
  };
  const removeEntry = (i: number) => {
    const next = entries.filter((_, j) => j !== i); setEntries(next);
    updateNodeData(nodeId, { metadata: Object.fromEntries(next.filter(([key]) => key)) });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-gray-500 dark:text-gray-400">Metadata</label>
        <button onClick={addEntry} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-accent-500">
          <Plus size={12} />
        </button>
      </div>
      {entries.map(([k, v], i) => (
        <div key={i} className="flex gap-1 mb-1">
          <input value={k} onChange={e => updateEntry(i, e.target.value, v)} placeholder="Key" className="input-field !text-xs flex-1" />
          <input value={v} onChange={e => updateEntry(i, k, e.target.value)} placeholder="Value" className="input-field !text-xs flex-1" />
          <button onClick={() => removeEntry(i)} className="p-1 text-gray-400 hover:text-red-500">
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── AI Generator Tab ─────────────────────────────────────────────────────────
export function AIGeneratorTab() {
  const [text, setText] = useState('');
  const { setNodes, setEdges } = useZampFlowStore();
  const { fitView } = useReactFlow();

  const generate = () => {
    if (!text.trim()) return;
    const { nodes, edges } = parseTextToFlow(text);
    // Namespace parser-generated IDs with a session prefix so they cannot collide
    // with any pre-existing node IDs in the active process. Even though the
    // generator REPLACES the active flow today, this defense survives any future
    // shift to append/merge mode without producing dangling edges.
    const sessionPrefix = `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-`;
    const nsNodes = nodes.map(n => ({ ...n, id: sessionPrefix + n.id }));
    const nsEdges = edges.map(e => ({
      ...e,
      id: sessionPrefix + e.id,
      source: sessionPrefix + e.source,
      target: sessionPrefix + e.target,
    }));
    const cleanEdges = pruneOrphanEdges(nsNodes, nsEdges);
    setNodes(nsNodes);
    setEdges(cleanEdges);
    // fitView after a short tick so React has rendered the new nodes
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  };

  const example = `Start\nReceive request -> Validate input\nif valid?\nProcess request\nEnd\nif invalid? -> Return error -> End`;

  return (
    <div className="p-3 space-y-3">
      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
        <Wand2 size={12} /> Text to Flowchart
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
        <strong>Syntax:</strong> Each line = node. Use <code>-&gt;</code> for flow.
        Keywords: <code>if/decide/check</code> → diamond. <code>start/end</code> → oval.
      </div>
      <textarea
        value={text} onChange={e => setText(e.target.value)}
        placeholder={example}
        className="input-field h-36 resize-none font-mono text-xs"
      />
      <div className="flex gap-2">
        <button onClick={generate} className="btn-primary flex-1 flex items-center justify-center gap-1 !text-xs">
          <Wand2 size={12} /> Generate
        </button>
        <button onClick={() => setText(example)} className="btn-secondary !text-xs">Example</button>
      </div>
    </div>
  );
}

// ─── Versions Tab ─────────────────────────────────────────────────────────────
function VersionsTab() {
  const { activeProcess, saveVersion, restoreVersion, deleteVersion } = useZampFlowStore();
  const [note, setNote] = useState('');
  const proc = activeProcess();
  if (!proc) return <div className="p-4 text-xs text-gray-400">No process selected</div>;

  const versions = [...proc.versions].reverse();

  return (
    <div className="p-3 space-y-3">
      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
        <GitBranch size={12} /> Versions
      </div>
      <div className="flex gap-2">
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Version note..."
          className="input-field flex-1 !text-xs"
        />
        <button
          onClick={() => { saveVersion(note || 'Manual save'); setNote(''); }}
          className="btn-primary !text-xs !px-2"
        >Save</button>
      </div>
      <div className="space-y-2">
        {versions.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-3">No versions saved yet</div>
        )}
        {versions.map(v => (
          <div key={v.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-accent-600 dark:text-accent-400">{v.label}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => { if (confirm('Restore this version?')) restoreVersion(v.id); }}
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500"
                  title="Restore"
                ><RotateCcw size={11} /></button>
                <button
                  onClick={() => { if (confirm('Delete version?')) deleteVersion(v.id); }}
                  className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400"
                  title="Delete"
                ><Trash2 size={11} /></button>
              </div>
            </div>
            {v.note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{v.note}</p>}
            <p className="text-xs text-gray-400 mt-0.5">{new Date(v.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── RightSidebar ─────────────────────────────────────────────────────────────
export function RightSidebar() {
  const [tab, setTab] = useState<Tab>('palette');
  const [collapsed, setCollapsed] = useState(false);
  const { updateEdgeData } = useZampFlowStore();
  const selectedEdges = useStore(s => s.edges.filter(e => e.selected));

  if (collapsed) {
    return (
      <div className="w-8 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col items-center py-2">
        <button onClick={() => setCollapsed(false)} className="toolbar-btn w-6 h-6">
          <ChevronLeft size={14} />
        </button>
      </div>
    );
  }

  // Tab order: Node Palette | Properties | Versions
  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'palette',    icon: <Layers size={13} />,    label: 'Node Palette' },
    { id: 'properties', icon: <Settings size={13} />,  label: 'Properties'   },
    { id: 'versions',   icon: <GitBranch size={13} />, label: 'Versions'     },
  ];

  return (
    <div className="w-60 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 flex flex-col items-center py-2 px-1 gap-0.5 text-[9px] transition-colors ${
              tab === t.id
                ? 'text-accent-600 dark:text-accent-400 border-b-2 border-accent-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            style={{ minWidth: 44 }}
          >
            {t.icon}
            <span className="leading-tight text-center">{t.label}</span>
          </button>
        ))}
        <button
          onClick={() => setCollapsed(true)}
          className="ml-auto px-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
        >
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'palette'    && <NodePaletteTab selectedEdges={selectedEdges} updateEdgeData={updateEdgeData} />}
        {tab === 'properties' && <PropertiesTab />}
        {tab === 'versions'   && <VersionsTab />}
      </div>
    </div>
  );
}
