import React, { useState } from 'react';
import { HardDrive, X, Trash2 } from 'lucide-react';
import { UseFlowsReturn } from '../lib/useFlows';

// All localStorage keys written by the legacy (pre-auth) version of ZampFlow.
const LEGACY_KEYS = ['zampflow.state.v1'];

function discardLegacyData() {
  LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
  // Also wipe any other zampflow.* keys that aren't the auth key
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('zampflow.') && k !== 'zampflow.auth.v1') {
      toRemove.push(k);
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}

interface LegacyImportBannerProps {
  flowsApi: UseFlowsReturn;
  onImported: () => void;
}

const BANNER_DISMISSED_KEY = 'zampflow.legacy_banner_dismissed.v1';

export function LegacyImportBanner({ flowsApi, onImported }: LegacyImportBannerProps) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(BANNER_DISMISSED_KEY) === 'true'
  );
  const [importing, setImporting] = useState(false);

  const dismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  // Only show if there is actual legacy pre-auth data and not dismissed.
  if (dismissed || !flowsApi.hasLegacyData()) return null;

  const handleImport = async () => {
    setImporting(true);
    await flowsApi.importLegacyData();
    setImporting(false);
    onImported();
    dismiss();
  };

  const handleDiscard = () => {
    discardLegacyData();
    dismiss();
  };

  return (
    <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-4 py-3 text-sm max-w-md">
      <HardDrive size={16} className="text-accent-600 flex-shrink-0 mt-0.5" />
      <span className="text-gray-700 dark:text-gray-300 flex-1 leading-snug">
        A flow from a previous session is saved in your browser. Import it to your account so it's available everywhere.{' '}
        <span className="text-gray-400 dark:text-gray-500">(New flows are saved to your account automatically.)</span>
      </span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleImport}
          disabled={importing}
          className="btn-primary !text-xs !py-1 !px-3"
        >
          {importing ? 'Importing…' : 'Import'}
        </button>
        <button
          onClick={handleDiscard}
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Discard local data permanently"
        >
          <Trash2 size={11} />
          Discard
        </button>
        <button
          onClick={dismiss}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1"
          title="Dismiss (keeps local data)"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
