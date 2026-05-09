import { useState, useEffect, useRef, useCallback } from 'react';
import { sessionClient, FlowRow, FlowData, setFlowPublic, saveNodesMeta } from './supabase';
import { AuthUser } from '../auth/useAuth';
import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData, Process, NodesMeta } from '../store/types';

const LEGACY_KEY = 'zampflow.state.v1';
const DEBOUNCE_MS = 1500;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface FlowMeta {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  isPublic: boolean;
  publicSlug: string | null;
}

export interface UseFlowsReturn {
  flows: FlowMeta[];
  currentFlowId: string | null;
  saveStatus: SaveStatus;
  loading: boolean;
  loadFlow: (id: string) => Promise<FlowRow | null>;
  createFlow: (name: string, data?: FlowData) => Promise<string | null>;
  renameFlow: (id: string, name: string) => Promise<void>;
  duplicateFlow: (id: string) => Promise<string | null>;
  deleteFlow: (id: string) => Promise<void>;
  setCurrentFlowId: (id: string | null) => void;
  scheduleSave: (id: string, name: string, data: FlowData) => void;
  flushSave: () => void;
  hasLegacyData: () => boolean;
  importLegacyData: () => Promise<string | null>;
  refetchList: () => Promise<void>;
  // V2 additions
  togglePublic: (id: string, currentIsPublic: boolean, currentSlug: string | null) => Promise<{ isPublic: boolean; slug: string | null }>;
  saveFlowNodesMeta: (id: string, meta: NodesMeta) => Promise<void>;
}

export function useFlows(user: AuthUser | null): UseFlowsReturn {
  const [flows, setFlows] = useState<FlowMeta[]>([]);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ id: string; name: string; data: FlowData } | null>(null);

  // ── Session-scoped DB client ────────────────────────────────────────────────
  // Uses the user's Supabase session access token so auth.uid() resolves in RLS.
  // Every authenticated operation MUST go through this client.
  const db = useCallback(() => {
    if (!user?.accessToken) return null;
    return sessionClient(user.accessToken);
  }, [user?.accessToken]);

  const refetchList = useCallback(async () => {
    const client = db();
    if (!client) return;
    const { data, error } = await client
      .from('zampflow_flows')
      .select('id, name, created_at, updated_at, is_public, public_slug')
      .order('updated_at', { ascending: false });
    if (!error && data) {
      setFlows(data.map((r: any) => ({
        id: r.id,
        name: r.name,
        updatedAt: r.updated_at,
        createdAt: r.created_at,
        isPublic: r.is_public || false,
        publicSlug: r.public_slug || null,
      })));
    }
  }, [db]);

  useEffect(() => {
    if (!user) {
      setFlows([]);
      setCurrentFlowId(null);
      return;
    }
    (async () => {
      setLoading(true);
      const client = db()!;
      const { data, error } = await client
        .from('zampflow_flows')
        .select('id, name, created_at, updated_at, is_public, public_slug')
        .order('updated_at', { ascending: false });

      if (error || !data) { setLoading(false); return; }

      const list: FlowMeta[] = data.map((r: any) => ({
        id: r.id,
        name: r.name,
        updatedAt: r.updated_at,
        createdAt: r.created_at,
        isPublic: r.is_public || false,
        publicSlug: r.public_slug || null,
      }));
      setFlows(list);

      if (list.length > 0) {
        setCurrentFlowId(list[0].id);
      } else {
        const newId = await createFlowInner(client, user.supabaseUid, user.email, 'Untitled flow', emptyFlowData());
        if (newId) {
          setCurrentFlowId(newId);
          setFlows([{ id: newId, name: 'Untitled flow', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), isPublic: false, publicSlug: null }]);
        }
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.supabaseUid]);

  const loadFlow = useCallback(async (id: string): Promise<FlowRow | null> => {
    const client = db();
    if (!client) return null;
    const { data, error } = await client
      .from('zampflow_flows')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return data as FlowRow;
  }, [db]);

  const createFlow = useCallback(async (name: string, data?: FlowData): Promise<string | null> => {
    const client = db();
    if (!client || !user) return null;
    const id = await createFlowInner(client, user.supabaseUid, user.email, name, data ?? emptyFlowData());
    if (id) { await refetchList(); setCurrentFlowId(id); }
    return id;
  }, [db, user, refetchList]);

  const renameFlow = useCallback(async (id: string, name: string) => {
    const client = db();
    if (!client) return;
    await client.from('zampflow_flows').update({ name }).eq('id', id);
    setFlows(prev => prev.map(f => f.id === id ? { ...f, name } : f));
  }, [db]);

  const duplicateFlow = useCallback(async (id: string): Promise<string | null> => {
    const client = db();
    if (!client || !user) return null;
    const original = await loadFlow(id);
    if (!original) return null;
    const newId = await createFlowInner(client, user.supabaseUid, user.email, original.name + ' (Copy)', original.data);
    if (newId) { await refetchList(); setCurrentFlowId(newId); }
    return newId;
  }, [db, user, loadFlow, refetchList]);

  const deleteFlow = useCallback(async (id: string) => {
    const client = db();
    if (!client) return;
    const { error } = await client.from('zampflow_flows').delete().eq('id', id);
    if (error) {
      await refetchList();
      return;
    }
    const updated = flows.filter(f => f.id !== id);
    setFlows(updated);
    if (currentFlowId === id) {
      if (updated.length > 0) setCurrentFlowId(updated[0].id);
      else { const newId = await createFlow('Untitled flow'); setCurrentFlowId(newId); }
    }
    await refetchList();
  }, [db, flows, currentFlowId, createFlow, refetchList]);

  const scheduleSave = useCallback((id: string, name: string, data: FlowData) => {
    pendingRef.current = { id, name, data };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus('saving');
    debounceRef.current = setTimeout(async () => {
      const pending = pendingRef.current;
      if (!pending) return;
      const client = db();
      if (!client) return;
      const { error } = await client
        .from('zampflow_flows')
        .update({ data: pending.data, name: pending.name })
        .eq('id', pending.id);
      setSaveStatus(error ? 'error' : 'saved');
      pendingRef.current = null;
      setFlows(prev => prev.map(f => f.id === pending.id ? { ...f, name: pending.name, updatedAt: new Date().toISOString() } : f));
      setTimeout(() => setSaveStatus('idle'), 3000);
    }, DEBOUNCE_MS);
  }, [db]);

  const flushSave = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    const pending = pendingRef.current;
    if (!pending) return;
    const client = db();
    if (!client) return;
    client.from('zampflow_flows').update({ data: pending.data, name: pending.name }).eq('id', pending.id)
      .then(() => { setSaveStatus('saved'); pendingRef.current = null; });
  }, [db]);

  const hasLegacyData = useCallback((): boolean => {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.processes) && parsed.processes.length > 0;
    } catch { return false; }
  }, []);

  const importLegacyData = useCallback(async (): Promise<string | null> => {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const processes: Process[] = parsed?.processes ?? [];
      if (processes.length === 0) return null;
      const client = db();
      if (!client || !user) return null;
      let lastId: string | null = null;
      for (const proc of processes) {
        const flowData: FlowData = { version: 1, nodes: proc.nodes as Node<NodeData>[], edges: proc.edges as Edge<EdgeData>[] };
        const id = await createFlowInner(client, user.supabaseUid, user.email, proc.name, flowData);
        if (id) lastId = id;
      }
      await refetchList();
      if (lastId) setCurrentFlowId(lastId);
      localStorage.removeItem(LEGACY_KEY);
      return lastId;
    } catch { return null; }
  }, [db, user, refetchList]);

  // ── V2 ────────────────────────────────────────────────────────────────────────

  const togglePublic = useCallback(async (
    id: string,
    currentIsPublic: boolean,
    currentSlug: string | null
  ): Promise<{ isPublic: boolean; slug: string | null }> => {
    const client = db();
    if (!client) throw new Error('Not authenticated');
    const newIsPublic = !currentIsPublic;
    let slug = currentSlug;
    if (newIsPublic && !slug) {
      slug = Array.from(crypto.getRandomValues(new Uint8Array(7)))
        .map(b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36])
        .join('');
    }
    await setFlowPublic(client, id, newIsPublic, newIsPublic ? slug : currentSlug);
    setFlows(prev => prev.map(f => f.id === id ? { ...f, isPublic: newIsPublic, publicSlug: newIsPublic ? slug : currentSlug } : f));
    return { isPublic: newIsPublic, slug: newIsPublic ? slug : currentSlug };
  }, [db]);

  const saveFlowNodesMeta = useCallback(async (id: string, meta: NodesMeta) => {
    const client = db();
    if (!client) return;
    await saveNodesMeta(client, id, meta);
  }, [db]);

  return {
    flows, currentFlowId, saveStatus, loading,
    loadFlow, createFlow, renameFlow, duplicateFlow, deleteFlow,
    setCurrentFlowId, scheduleSave, flushSave,
    hasLegacyData, importLegacyData, refetchList,
    togglePublic, saveFlowNodesMeta,
  };
}

function emptyFlowData(): FlowData {
  return { version: 1, nodes: [], edges: [] };
}

// ── createFlowInner ──────────────────────────────────────────────────────────
// Inserts a new flow row. MUST set user_id to the Supabase auth UID so that
// the RLS INSERT policy (WITH CHECK auth.uid() = user_id) accepts the row.
// The user_email is retained for display/debugging but is NOT used for auth.
async function createFlowInner(
  client: ReturnType<typeof sessionClient>,
  supabaseUid: string,
  userEmail: string,
  name: string,
  data: FlowData
): Promise<string | null> {
  const { data: row, error } = await client
    .from('zampflow_flows')
    .insert({ user_id: supabaseUid, user_email: userEmail, name, data })
    .select('id')
    .single();
  if (error || !row) return null;
  return row.id as string;
}
