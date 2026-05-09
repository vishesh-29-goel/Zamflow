import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Plus, Search, Folder, Archive, Copy, Trash2, Edit2 } from 'lucide-react';
import { useZampFlowStore } from '../store/useZampFlowStore';
import { TEMPLATES } from '../templates';

// ─── LeftSidebar ──────────────────────────────────────────────────────────────
// Node Palette has moved to the RIGHT sidebar (Node Palette tab).
// This sidebar now contains only: process list + search/filter.

export function LeftSidebar() {
  const {
    processes, activeProcessId,
    setActiveProcess, createProcess, deleteProcess, duplicateProcess, archiveProcess, updateProcess,
  } = useZampFlowStore();

  const [search, setSearch]           = useState('');
  const [showNew, setShowNew]         = useState(false);
  const [newName, setNewName]         = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editName, setEditName]       = useState('');
  const [collapsed, setCollapsed]     = useState(false);

  const filtered = processes.filter(p => !p.archived && p.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = () => {
    if (!newName.trim()) return;
    createProcess(newName.trim(), selectedTemplate || undefined);
    setNewName(''); setSelectedTemplate(''); setShowNew(false);
  };

  // ── Collapsed pill ────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="w-8 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col items-center py-2">
        <button onClick={() => setCollapsed(false)} className="toolbar-btn w-6 h-6" title="Expand sidebar">
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  // ── Full sidebar ──────────────────────────────────────────────────────────
  return (
    <div className="w-52 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">

      {/* ── Processes section header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Processes</span>
        <div className="flex gap-1">
          <button onClick={() => setShowNew(v => !v)} className="toolbar-btn w-6 h-6" title="New process">
            <Plus size={13} />
          </button>
          <button onClick={() => setCollapsed(true)} className="toolbar-btn w-6 h-6" title="Collapse sidebar">
            <ChevronLeft size={11} />
          </button>
        </div>
      </div>

      {showNew && (
        <div className="px-3 py-2 space-y-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Process name..."
            className="input-field text-xs"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <select
            value={selectedTemplate}
            onChange={e => setSelectedTemplate(e.target.value)}
            className="input-field text-xs"
          >
            <option value="">Blank</option>
            {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
          </select>
          <div className="flex gap-1">
            <button onClick={handleCreate} className="btn-primary flex-1 !text-xs !py-1">Create</button>
            <button onClick={() => setShowNew(false)} className="btn-secondary flex-1 !text-xs !py-1">Cancel</button>
          </div>
        </div>
      )}

      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search processes..."
            className="input-field !pl-6 text-xs"
          />
        </div>
      </div>

      {/* Process list */}
      <div className="flex-1 overflow-y-auto py-1 space-y-0.5 px-1">
        {filtered.map(p => (
          <div
            key={p.id}
            className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
              p.id === activeProcessId
                ? 'bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
            onClick={() => setActiveProcess(p.id)}
          >
            <Folder size={13} className="flex-shrink-0" />
            {editingId === p.id ? (
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="flex-1 text-xs bg-transparent border-b border-accent-400 outline-none"
                autoFocus
                onBlur={() => { updateProcess(p.id, { name: editName }); setEditingId(null); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { updateProcess(p.id, { name: editName }); setEditingId(null); }
                }}
              />
            ) : (
              <span className="flex-1 text-xs truncate">{p.name}</span>
            )}
            <div className="hidden group-hover:flex items-center gap-0.5">
              <button
                onClick={e => { e.stopPropagation(); setEditingId(p.id); setEditName(p.name); }}
                className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              ><Edit2 size={10} /></button>
              <button
                onClick={e => { e.stopPropagation(); duplicateProcess(p.id); }}
                className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              ><Copy size={10} /></button>
              <button
                onClick={e => { e.stopPropagation(); archiveProcess(p.id); }}
                className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              ><Archive size={10} /></button>
              <button
                onClick={e => { e.stopPropagation(); if (confirm('Delete this process?')) deleteProcess(p.id); }}
                className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
              ><Trash2 size={10} /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-4">No processes</div>
        )}
      </div>
    </div>
  );
}
