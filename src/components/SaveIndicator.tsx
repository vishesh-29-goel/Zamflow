import React from 'react';
import { CloudOff, Loader2, CheckCircle2 } from 'lucide-react';
import { SaveStatus } from '../lib/useFlows';

interface SaveIndicatorProps {
  status: SaveStatus;
  flowName?: string;
}

export function SaveIndicator({ status }: SaveIndicatorProps) {
  if (status === 'idle') return null;

  return (
    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
      {status === 'saving' && (
        <>
          <Loader2 size={11} className="animate-spin" />
          <span>Saving\u2026</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <CheckCircle2 size={11} className="text-green-500" />
          <span className="text-green-600 dark:text-green-400">Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <CloudOff size={11} className="text-red-500" />
          <span className="text-red-500">Save failed</span>
        </>
      )}
    </div>
  );
}
