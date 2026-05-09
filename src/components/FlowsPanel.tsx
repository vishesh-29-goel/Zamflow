import React, { useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, MoreVertical,
  Edit2, Copy, Trash2, Loader2, MoreHorizontal,
} from 'lucide-react';
import { UseFlowsReturn, FlowMeta } from '../lib/useFlows';
import { formatRelative } from '../lib/formatRelative';
import { SharePopover } from './SharePopover';

interface FlowsPanelProps {
  flowsApi: UseFlowsReturn;
  onFlowSelect: (id: string) => void;
}

export function FlowsPanel({ flowsApi, onFlowSelect }: FlowsPanelProps) {
  const {
    flows, currentFlowId, loading,
    createFlow, renameFlow, duplicateFlow, deleteFlow,
    setCurrentFlowId,
  } = flowsApi;

  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSelect = (id: string) => {
    setCurrentFlowId(id);
    onFlowSelect(id);
    setMenuId(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(false);
    const id = await createFlow(newName.trim());
    if (id) onFlowSelect(id);
    setNewName('');
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await renameFlow(id, editName.trim());
    setEditingId(null);
  };

  const handleDuplicate = async (id: string) => {
    setMenuId(null);
    const newId = await duplicateFlow(id);
    if (newId) onFlowSelect(newId);
  };

  const handleDelete = async (flow: FlowMeta) => {
    setMenuId(null);
    if (!confirm(`Delete "${flow.name}"? This cannot be undone.`)) return;
    await deleteFlow(flow.id);
  };

  if (collapsed) {
    return (
      <div className="w-8 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col items-center py-2">
        <button onClick={() => setCollapsed(false)} className="toolbar-btn w-6 h-6" title="Expand flows panel">
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">My Flows</span>
        <div className="flex gap-1">
          <button onClick={() => setCreating(v => !v)} className="toolbar-btn w-6 h-6" title="New flow">
            <Plus size={13} />
          </button>
          <button onClick={() => setCollapsed(true)} className="toolbar-btn w-6 h-6" title="Collapse panel">
            <ChevronLeft size={11} />
          </button>
        </div>
      </div>

      {/* New flow input */}
      {creating && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-1">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Flow name..."
            className="input-field text-xs"
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
            autoFocus
          />
          <div className="flex gap-1">
            <button onClick={handleCreate} className="btn-primary flex-1 !text-xs !py-1">Create</button>
            <button onClick={() => setCreating(false)} className="btn-secondary flex-1 !text-xs !py-1">Cancel</button>
          </div>
        </div>
      )}

      {/* Flow list */}
      <div className="flex-1 overflow-y-auto py-1 space-y-0.5 px-1">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={16} className="animate-spin text-gray-400" />
          </div>
        )}
        {!loading && flows.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-4">No flows yet</div>
        )}
        {!loading && flows.map(flow => (
          <div
            key={flow.id}
            className={`group relative flex items-start gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
              flow.id === currentFlowId
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
            onClick={() => handleSelect(flow.id)}
          >
            <div className="flex-1 min-w-0">
              {editingId === flow.id ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full text-xs bg-transparent border-b border-indigo-400 outline-none"
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  onBlur={() => handleRename(flow.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRename(flow.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs truncate block font-medium">{flow.name}</span>
                  {flow.isPublic && (
                    <span className="text-[8px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1 rounded-full flex-shrink-0">pub</span>
                  )}
                </div>
              )}
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {formatRelative(flow.updatedAt)}
              </span>
            </div>

            {/* Always-visible share icon — toggles the same share/actions dropdown */}
            <button
              onClick={e => { e.stopPropagation(); setMenuId(menuId === flow.id ? null : flow.id); }}
              className="flex-shrink-0 mt-0.5 p-0.5 rounded text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              title="Share / actions"
            >
              <MoreHorizontal size={12} />
            </button>

            {/* Dropdown menu */}
            {menuId === flow.id && (
              <div
                className="absolute right-2 top-7 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 w-40"
                onClick={e => e.stopPropagation()}
              >
                {/* Share row */}
                <div className="px-1 py-0.5 border-b border-gray-100 dark:border-gray-700 mb-0.5">
                  <SharePopover flow={flow} flowsApi={flowsApi} />
                </div>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => { setMenuId(null); setEditingId(flow.id); setEditName(flow.name); }}
                >
                  <Edit2 size={11} /> Rename
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => handleDuplicate(flow.id)}
                >
                  <Copy size={11} /> Duplicate
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => handleDelete(flow)}
                >
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
