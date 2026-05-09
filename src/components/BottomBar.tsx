import React from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import { useZampFlowStore } from '../store/useZampFlowStore';

export function BottomBar() {
  const { activeProcess, lastSaved, preferences } = useZampFlowStore();
  const proc = activeProcess();

  const savedText = lastSaved
    ? (() => {
        const secs = Math.round((Date.now() - lastSaved.getTime()) / 1000);
        if (secs < 5) return 'Saved • just now';
        if (secs < 60) return `Saved • ${secs}s ago`;
        return `Saved • ${Math.round(secs/60)}m ago`;
      })()
    : 'Unsaved changes';

  return (
    <div className="h-7 flex items-center gap-3 px-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
      <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-xs">
        {proc?.name || 'No process'}
      </span>
      <span className="text-gray-300 dark:text-gray-600">•</span>
      <span>{proc?.versions.length ? `${proc.versions[proc.versions.length-1].label}` : 'Unsaved'}</span>
      <span className="flex-1" />
      {preferences.snapToGrid && <span className="text-accent-500 font-medium">Snap</span>}
      <div className="flex items-center gap-1">
        {lastSaved ? <CheckCircle size={11} className="text-green-500" /> : <Clock size={11} className="text-yellow-500" />}
        <span>{savedText}</span>
      </div>
    </div>
  );
}
