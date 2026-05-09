import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import { Toolbar } from './components/Toolbar';
import { LeftSidebar } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { Canvas } from './components/Canvas';
import { BottomBar } from './components/BottomBar';
import { SignInScreen } from './components/SignInScreen';
import { FlowsPanel } from './components/FlowsPanel';
import { LegacyImportBanner } from './components/LegacyImportBanner';
import { TextPanel } from './components/TextPanel';
import { PublicViewer } from './components/PublicViewer';
// TEST-ONLY: import is present only when VITE_TEST_LOGIN_TOKEN is defined at build time.
// Vite tree-shakes the import when the constant is undefined (falsy branch never executes).
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { TestLogin } from './components/TestLogin';
import { useZampFlowStore } from './store/useZampFlowStore';
import { useAuthStore } from './auth/useAuth';
import { useFlows } from './lib/useFlows';
import { getImportFromURL } from './lib/urlImport';
import { config, configIsValid } from './config';
import { supabase } from './lib/supabase';
import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData } from './store/types';
import { FlowData } from './lib/supabase';
import { pruneOrphanEdges } from './lib/textToFlow';
import { normalizeEdges } from './lib/normalizeEdges';

// ── Route detection (hash-based for SPA on static host) ──────────────────────
// Public viewer: https://zampflow-app.zampapps.com/#/view/<slug>
// Also support pathname-based for when platform adds SPA support

function getPublicSlug(): string | null {
  // Check hash route first: /#/view/:slug
  const hashMatch = window.location.hash.match(/^#\/view\/([a-z0-9_-]+)$/i);
  if (hashMatch) return hashMatch[1];
  // Fall back to pathname route: /view/:slug
  const pathMatch = window.location.pathname.match(/^\/view\/([a-z0-9_-]+)$/i);
  if (pathMatch) return pathMatch[1];
  return null;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#1e293b', color: '#f8fafc', padding: '10px 20px',
      borderRadius: 8, zIndex: 9999, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      pointerEvents: 'none',
    }}>
      {message}
    </div>
  );
}

// ── Expiry watcher ────────────────────────────────────────────────────────────

function ExpiryWatcher({ onExpired }: { onExpired: () => void }) {
  const { user, checkExpiry } = useAuthStore();
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const valid = checkExpiry();
      if (!valid) onExpired();
    }, 60_000);
    return () => clearInterval(interval);
  }, [user, checkExpiry, onExpired]);
  return null;
}

// ── Inner app ─────────────────────────────────────────────────────────────────

function EmptyStateCard({ onNewFlow, onOpenText }: { onNewFlow: () => void; onOpenText: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-sm w-full mx-auto text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="text-5xl mb-4">🚀</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Welcome to ZampFlow</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Turn your process descriptions into beautiful flowcharts — instantly.
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={onNewFlow} className="btn-primary w-full py-2 text-sm">New Flow</button>
          <button onClick={onOpenText} className="btn-secondary w-full py-2 text-sm">Open Text Editor</button>
          <button onClick={() => useZampFlowStore.getState().setShowTextPanel(true)} className="btn-secondary w-full py-2 text-sm">Try AI Generator</button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-4">
          💡 Paste a process description in the Text Editor to auto-generate a flow.
        </p>
      </div>
    </div>
  );
}
function AppInner() {
  const [whiteboardMode, setWhiteboardMode] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { theme, setTheme, undo, redo, saveVersion, preferences, setPreference, showTextPanel, setNodesMeta } = useZampFlowStore();
  const { user } = useAuthStore();
  const flowsApi = useFlows(user);
  const { setViewport } = useReactFlow();
  const cloudEnabled = configIsValid();

  // ── Bug 2 fix: keep a ref to the latest flows array so the auto-save
  // subscription always reads the current name (post-rename) rather than the
  // stale name that was loaded into the Zustand process object.
  const flowsRef = useRef(flowsApi.flows);
  useEffect(() => { flowsRef.current = flowsApi.flows; }, [flowsApi.flows]);

  useEffect(() => {
    if (!user || !cloudEnabled) return;
    useZampFlowStore.setState({ processes: [], activeProcessId: null });

    // On first sign-in with the new auth flow, re-attribute any pre-existing rows
    // that were written before Supabase Auth was integrated (user_id was NULL).
    // The function is a no-op if there are no unattributed rows for this user.
    supabase.rpc('reattribute_flows_to_caller').then(({ data, error }) => {
      if (!error && data && data > 0) {
        console.log(`[ZampFlow] Re-attributed ${data} legacy flow(s) to your account.`);
      }
    });
  }, [user?.supabaseUid, cloudEnabled]); // eslint-disable-line

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  const handleExpired = useCallback(() => {
    setToast('Session expired. Please sign in again.');
  }, []);

  const loadFlowIntoCanvas = useCallback(async (id: string) => {
    const row = await flowsApi.loadFlow(id);
    if (!row) return;
    const data = row.data as FlowData;

    if (row.nodes_meta) setNodesMeta(row.nodes_meta);
    else setNodesMeta({});

    useZampFlowStore.setState(state => {
      const loadedNodes = (data.nodes as Node<NodeData>[]) ?? [];
      const loadedEdges = (data.edges as Edge<EdgeData>[]) ?? [];
      const cleanEdges = normalizeEdges(pruneOrphanEdges(loadedNodes, loadedEdges));
      const proc = {
        id, name: row.name, description: '', category: 'General', tags: [],
        created_at: row.created_at, updated_at: row.updated_at,
        archived: false, nodes: loadedNodes, edges: cleanEdges,
        whiteboard: { strokes: [], stickies: [] }, versions: [], history: { undo: [], redo: [] },
      };
      return { processes: [proc], activeProcessId: id };
    });
    if (data.viewport) setViewport(data.viewport);
  }, [flowsApi, setViewport, setNodesMeta]);

  useEffect(() => {
    if (flowsApi.currentFlowId) loadFlowIntoCanvas(flowsApi.currentFlowId);
  }, [flowsApi.currentFlowId]); // eslint-disable-line

  // Auto-save (nodes/edges + nodes_meta)
  // Bug 2 fix: use flowsRef.current to get the authoritative current name from
  // the flows list (which is updated optimistically by renameFlow), NOT from
  // proc.name (which is the name that was in the DB when the flow was loaded).
  const metaSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user || !cloudEnabled || !flowsApi.currentFlowId) return;
    const unsubscribe = useZampFlowStore.subscribe((state) => {
      const proc = state.processes.find(p => p.id === flowsApi.currentFlowId);
      if (!proc) return;

      // Prefer the name from the flows list (reflects renames) over the process
      // object (which has the name as-of the last loadFlowIntoCanvas call).
      const currentFlowMeta = flowsRef.current.find(f => f.id === flowsApi.currentFlowId);
      const nameToSave = currentFlowMeta ? currentFlowMeta.name : proc.name;

      const flowData: FlowData = { version: 1, nodes: proc.nodes, edges: proc.edges };
      flowsApi.scheduleSave(flowsApi.currentFlowId, nameToSave, flowData);
      if (metaSaveRef.current) clearTimeout(metaSaveRef.current);
      metaSaveRef.current = setTimeout(() => {
        flowsApi.saveFlowNodesMeta(flowsApi.currentFlowId!, state.nodesMeta).catch(() => {});
      }, 2000);
    });
    return unsubscribe;
  }, [user, cloudEnabled, flowsApi.currentFlowId]); // eslint-disable-line

  // URL import
  useEffect(() => {
    let cancelled = false;
    getImportFromURL().then(result => {
      if (cancelled || !result) return;
      if (result.error) { setToast(result.toastMessage); return; }
      const s = useZampFlowStore.getState();
      useZampFlowStore.setState({ processes: [...s.processes, result.process], activeProcessId: result.process.id });
      useZampFlowStore.getState().triggerSave();
      setToast(result.toastMessage);
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      else if (mod && e.key === 's') { e.preventDefault(); saveVersion(); }
      else if ((e.key === 'w' || e.key === 'W') && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA')
        setWhiteboardMode(v => !v);
      else if ((e.key === 'g' || e.key === 'G') && (e.target as HTMLElement).tagName !== 'INPUT')
        setPreference('showGrid', !preferences.showGrid);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, saveVersion, preferences.showGrid, setPreference]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      <ExpiryWatcher onExpired={handleExpired} />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      <Toolbar
        whiteboardMode={whiteboardMode}
        onToggleWhiteboard={() => setWhiteboardMode(v => !v)}
        canvasRef={canvasRef}
        flowsApi={cloudEnabled ? flowsApi : undefined}
      />
      <div className="flex flex-1 overflow-hidden">
        {user && cloudEnabled ? (
          <FlowsPanel flowsApi={flowsApi} onFlowSelect={loadFlowIntoCanvas} />
        ) : (
          <LeftSidebar />
        )}
        {user && cloudEnabled && !flowsApi.loading && flowsApi.flows.length === 0 ? (
          <EmptyStateCard
            onNewFlow={async () => {
              const id = await flowsApi.createFlow('My first flow');
              if (id) await loadFlowIntoCanvas(id);
            }}
            onOpenText={() => useZampFlowStore.getState().setShowTextPanel(true)}
          />
        ) : (
          <Canvas whiteboardMode={whiteboardMode} canvasRef={canvasRef} />
        )}
        <RightSidebar />
        {showTextPanel && <TextPanel />}
      </div>
      <BottomBar />
      {user && cloudEnabled && (
        <LegacyImportBanner flowsApi={flowsApi} onImported={() => setToast('Local flows imported to your account!')} />
      )}
      {user && !cloudEnabled && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-xl px-4 py-2 text-xs text-yellow-800 dark:text-yellow-200 shadow-md">
          ⚠️ Supabase not configured — add anon key + URL to complete cloud save setup.
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { user } = useAuthStore();

  // TEST-ONLY route: /#/test-login?token=...
  // Uses hash routing so the static host never sees a non-root path (no 404).
  // Only active when VITE_TEST_LOGIN_TOKEN is set at build time.
  // The TestLogin component validates the token; this just routes the hash.
  if (window.location.hash.startsWith('#/test-login')) return <TestLogin />;

  // Public viewer — no auth, hash or path-based routing
  const publicSlug = getPublicSlug();
  if (publicSlug) return <PublicViewer slug={publicSlug} />;

  if (!user) return <SignInScreen />;

  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  );
}
// v2.1.2-rename-fix
