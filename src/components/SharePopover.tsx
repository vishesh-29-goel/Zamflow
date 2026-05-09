import React, { useState, useRef, useEffect } from 'react';
import { Share2, Check, Copy, Globe, Lock, X } from 'lucide-react';
import { UseFlowsReturn, FlowMeta } from '../lib/useFlows';

interface SharePopoverProps {
  flow: FlowMeta;
  flowsApi: UseFlowsReturn;
}

export function SharePopover({ flow, flowsApi }: SharePopoverProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timer on unmount to prevent setState-after-unmount warning
  useEffect(() => { return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }; }, []);

  const publicUrl = flow.publicSlug
    ? `${window.location.origin}/#/view/${flow.publicSlug}`
    : null;

  const handleToggle = async () => {
    setLoading(true);
    try {
      await flowsApi.togglePublic(flow.id, flow.isPublic, flow.publicSlug);
    } catch (err) {
      console.error('Toggle public failed', err);
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

  // Close on outside click (capture-phase pointerdown beats ReactFlow's listeners)
  // and on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current && ref.current.contains(t)) return;
      if (btnRef.current && btnRef.current.contains(t)) return; // let trigger button handle its own toggle
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', handler, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Share flow"
      >
        <Share2 size={11} />
        <span>Share</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-8 z-50 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Close"
          >
            <X size={13} />
          </button>

          <div className="flex items-center gap-2 mb-3 pr-6">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${flow.isPublic ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
              {flow.isPublic ? <Globe size={15} className="text-green-600" /> : <Lock size={15} className="text-gray-500" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Share this flow</p>
              <p className="text-[10px] text-gray-500">{flow.isPublic ? 'Anyone with link can view' : 'Only you can access'}</p>
            </div>
          </div>

          {/* Toggle */}
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

          {/* URL + copy */}
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
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}

          {flow.isPublic && (
            <p className="text-[9px] text-gray-400 mt-2">
              Viewers see the canvas read-only. Comments and notes are visible but not editable.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
