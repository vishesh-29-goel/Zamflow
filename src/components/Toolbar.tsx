import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Save, Download,
  Sun, Moon, Pencil, ChevronDown, Upload, Layers, AlignLeft, Share2,
  Globe, Lock, Copy, Check, Sparkles, X,
} from 'lucide-react';
import { useZampFlowStore } from '../store/useZampFlowStore';
import { exportPNG, exportJPG, exportSVG, exportPDF, exportJSON, importJSON } from '../lib/exporters';
import { UserPill } from './UserPill';
import { SaveIndicator } from './SaveIndicator';
import { UseFlowsReturn, FlowMeta } from '../lib/useFlows';
import { AIGeneratorTab } from './RightSidebar';

interface ToolbarProps {
  whiteboardMode: boolean;
  onToggleWhiteboard: () => void;
  canvasRef: React.RefObject<HTMLDivElement>;
  flowsApi?: UseFlowsReturn;
}

// ── Inline share panel for the active flow in the toolbar ──────────────────

interface ToolbarShareProps {
  flow: FlowMeta;
  flowsApi: UseFlowsReturn;
  onClose: () => void;
}

function ToolbarSharePanel({ flow, flowsApi, onClose }: ToolbarShareProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Clear timer on unmount to prevent setState-after-unmount
  useEffect(() => {
    return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const publicUrl = flow.publicSlug
    ? `${window.location.origin}/#/view/${flow.publicSlug}`
    : null;

  const handleToggle = async () => {
    setLoading(true);
    try {
      await flowsApi.togglePublic(flow.id, flow.isPublic, flow.publicSlug);
    } catch (err) {
      console.error('[zampflow] toggle public failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      ref={ref}
      className="w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${flow.isPublic ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
          {flow.isPublic ? <Globe size={15} className="text-green-600" /> : <Lock size={15} className="text-gray-500" />}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Share "{flow.name}"</p>
          <p className="text-[10px] text-gray-500">{flow.isPublic ? 'Anyone with link can view' : 'Only you can access'}</p>
        </div>
      </div>

      <label className="flex items-center justify-between cursor-pointer mb-3">
        <span className="text-xs text-gray-700 dark:text-gray-300">Public link</span>
        <div className="relative">
          <input
            type="checkbox"
            checked={flow.isPublic}
            onChange={handleToggle}
            disabled={loading}
            className="sr-only peer"
          />
          <div className="w-10 h-5 rounded-full transition-colors bg-gray-200 dark:bg-gray-700 peer-checked:bg-indigo-600 peer-disabled:opacity-50" />
          <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
        </div>
      </label>

      {flow.isPublic && publicUrl && (
        <div className="flex gap-1">
          <input
            readOnly
            value={publicUrl}
            className="flex-1 text-[10px] font-mono bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 outline-none text-gray-600 dark:text-gray-300"
          />
          <button
            onClick={handleCopy}
            className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex-shrink-0 flex items-center gap-1 text-xs"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Toolbar ───────────────────────────────────────────────────────────

export function Toolbar({ whiteboardMode, onToggleWhiteboard, canvasRef, flowsApi }: ToolbarProps) {
  const { undo, redo, saveVersion, theme, setTheme, activeProcess, showTextPanel, setShowTextPanel } = useZampFlowStore();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [versionNote, setVersionNote] = useState('');
  const [showVersionInput, setShowVersionInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const proc = activeProcess();

  // Cmd+/ shortcut to toggle text panel
  const toggleTextPanel = useCallback(() => setShowTextPanel(!showTextPanel), [showTextPanel, setShowTextPanel]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') { e.preventDefault(); toggleTextPanel(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggleTextPanel]);

  const handleSaveVersion = () => {
    saveVersion(versionNote || 'Manual save');
    setVersionNote('');
    setShowVersionInput(false);
  };

  const handleExport = async (type: string) => {
    setExportOpen(false);
    const el = canvasRef.current;
    if (!el && type !== 'json') return;
    try {
      if (type === 'png' && el) await exportPNG(el);
      else if (type === 'jpg' && el) await exportJPG(el);
      else if (type === 'svg' && el) await exportSVG(el);
      else if (type === 'pdf' && el) await exportPDF(el);
      else if (type === 'json' && proc) exportJSON(proc);
    } catch (err) {
      console.error('[zampflow] export failed', err);
      alert(`Export failed: ${(err as Error).message || err}`);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importJSON(file);
    alert('Import: Use the process panel to import (paste JSON). Full import coming soon.');
  };

  // Find the active flow in the flows list for the share panel
  const activeFlow: FlowMeta | undefined = flowsApi && proc
    ? flowsApi.flows.find(f => f.id === proc.id)
    : undefined;

  return (
    <div className="h-12 flex items-center gap-1 px-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm z-20">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-3">
        <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Layers size={14} className="text-white" />
        </div>
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">ZampFlow</span>
      </div>

      <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

      <button onClick={undo} className="toolbar-btn" title="Undo (Ctrl+Z)"><Undo2 size={15} /></button>
      <button onClick={redo} className="toolbar-btn" title="Redo (Ctrl+Shift+Z)"><Redo2 size={15} /></button>

      <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

      <button onClick={() => zoomIn()} className="toolbar-btn" title="Zoom In"><ZoomIn size={15} /></button>
      <button onClick={() => zoomOut()} className="toolbar-btn" title="Zoom Out"><ZoomOut size={15} /></button>
      <button onClick={() => fitView({ padding: 0.1 })} className="toolbar-btn" title="Fit View"><Maximize size={15} /></button>

      <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

      {showVersionInput ? (
        <div className="flex items-center gap-1">
          <input value={versionNote} onChange={e => setVersionNote(e.target.value)} placeholder="Version note..." className="input-field !py-1 !w-36 text-xs" onKeyDown={e => e.key === 'Enter' && handleSaveVersion()} autoFocus />
          <button onClick={handleSaveVersion} className="btn-primary !py-1 !text-xs">Save</button>
          <button onClick={() => setShowVersionInput(false)} className="btn-secondary !py-1 !text-xs">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setShowVersionInput(true)} className="toolbar-btn" title="Save Version (Ctrl+S)"><Save size={15} /></button>
      )}

      {/* Export */}
      <div className="relative">
        <button onClick={() => setExportOpen(v => !v)} className="toolbar-btn flex items-center gap-0.5" title="Export">
          <Download size={15} /><ChevronDown size={10} />
        </button>
        {exportOpen && (
          <div className="absolute top-9 left-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 w-36">
            {['PNG', 'JPG', 'SVG', 'PDF', 'JSON'].map(t => (
              <button key={t} onClick={() => handleExport(t.toLowerCase())} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">{t}</button>
            ))}
          </div>
        )}
      </div>

      {/* Import */}
      <button onClick={() => fileInputRef.current?.click()} className="toolbar-btn" title="Import JSON">
        <Upload size={15} />
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </button>

      {/* Save indicator (cloud) */}
      {flowsApi && (
        <div className="ml-2">
          <SaveIndicator status={flowsApi.saveStatus} flowName={proc?.name} />
        </div>
      )}

      <div className="flex-1" />

      {/* Share button for active flow in toolbar */}
      {flowsApi && activeFlow && (
        <div className="relative">
          <button
            onClick={() => setShareOpen(v => !v)}
            className="toolbar-btn !w-auto px-2 gap-1"
            title="Share active flow"
          >
            <Share2 size={15} />
            <span className="text-xs font-medium">Share</span>
          </button>
          {shareOpen && (
            <div className="absolute top-10 right-0 z-50">
              <ToolbarSharePanel
                flow={activeFlow}
                flowsApi={flowsApi}
                onClose={() => setShareOpen(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* AI Generate button */}
      <div className="relative">
        <button
          onClick={() => setAiOpen(v => !v)}
          className={`toolbar-btn !w-auto px-2 gap-1 ${aiOpen ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : ''}`}
          title="AI Generate — Text to Flowchart"
        >
          <Sparkles size={15} />
          <span className="text-xs font-medium">AI Generate</span>
        </button>
        {aiOpen && (
          <div className="absolute top-10 right-0 z-50 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Sparkles size={12} className="text-indigo-500" /> AI Generate
              </span>
              <button onClick={() => setAiOpen(false)} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <X size={13} />
              </button>
            </div>
            <AIGeneratorTab />
          </div>
        )}
      </div>

      {/* Text panel toggle — icon + label + Cmd+/ shortcut hint */}
      <button
        onClick={toggleTextPanel}
        className={`toolbar-btn !w-auto px-2 gap-1.5 ${
          showTextPanel ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : ''
        }`}
        title="Toggle Text Editor (Cmd+/ or Ctrl+/)"
      >
        <AlignLeft size={15} />
        <span className="text-xs font-medium">Text</span>
        <span className="text-[9px] text-gray-400 dark:text-gray-500 font-mono hidden sm:inline">⌘/</span>
      </button>

      <button
        onClick={onToggleWhiteboard}
        className={`toolbar-btn ${whiteboardMode ? 'toolbar-btn-active' : ''}`}
        title="Whiteboard Mode (W)"
      >
        <Pencil size={15} />
      </button>

      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="toolbar-btn" title="Toggle Dark Mode">
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

      <UserPill />
    </div>
  );
}
