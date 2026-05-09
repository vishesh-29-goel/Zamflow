import React, { useCallback, useRef, DragEvent, useState } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap, BackgroundVariant,
  useReactFlow, ConnectionMode
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes } from '../nodes/CustomNodes';
import { edgeTypes } from '../edges/CustomEdge';
import { WhiteboardLayer } from './WhiteboardLayer';
import { useZampFlowStore } from '../store/useZampFlowStore';
import { NodeData } from '../store/types';

interface CanvasProps {
  whiteboardMode: boolean;
  canvasRef: React.RefObject<HTMLDivElement>;
}

// ─── Context menu for right-click on nodes ───────────────────────────────────
interface ContextMenu {
  nodeId: string;
  x: number;
  y: number;
}

function NodeContextMenu({
  menu,
  onDelete,
  onClose,
}: {
  menu: ContextMenu;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Invisible overlay to dismiss menu on click outside */}
      <div
        className="fixed inset-0 z-40"
        onMouseDown={onClose}
      />
      <div
        className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px] text-sm"
        style={{ left: menu.x, top: menu.y }}
      >
        <button
          className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 flex items-center gap-2"
          onMouseDown={e => { e.stopPropagation(); onDelete(menu.nodeId); onClose(); }}
        >
          <span>🗑</span> Delete node
        </button>
      </div>
    </>
  );
}

// ─── FlowCanvas (must be inside ReactFlowProvider from App.tsx) ───────────────
export function Canvas({ whiteboardMode, canvasRef }: CanvasProps) {
  const {
    activeProcess, onNodesChange, onEdgesChange, onConnect,
    setNodes, setEdges, pushHistory, preferences,
  } = useZampFlowStore();
  const { screenToFlowPosition } = useReactFlow();
  const proc = activeProcess();

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow');
    if (!type || !proc) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const id = crypto.randomUUID();
    const colorMap: Record<string, { color: string; borderColor: string }> = {
      start:         { color: '#dcfce7', borderColor: '#16a34a' },
      end:           { color: '#fee2e2', borderColor: '#dc2626' },
      decision:      { color: '#fef9c3', borderColor: '#ca8a04' },
      data:          { color: '#f0fdf4', borderColor: '#16a34a' },
      database:      { color: '#eff6ff', borderColor: '#2563eb' },
      document:      { color: '#fff7ed', borderColor: '#ea580c' },
      annotation:    { color: '#fefce8', borderColor: '#ca8a04' },
      manual_action: { color: '#faf5ff', borderColor: '#7c3aed' },
      connector:     { color: '#f3f4f6', borderColor: '#6366f1' },
      delay:         { color: '#f0fdf4', borderColor: '#16a34a' },
      subprocess:    { color: '#eff6ff', borderColor: '#6366f1' },
    };
    const colors = colorMap[type] || { color: '#eff6ff', borderColor: '#6366f1' };
    const node = {
      id,
      type,
      position: pos,
      // Ensure selectable/deletable are NOT set to false
      selectable: true,
      deletable: true,
      data: {
        label: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
        nodeType: type as any,
        ...colors,
        fontSize: 13,
        notes: '',
        metadata: {},
      } as NodeData,
      style: {
        width:  type === 'connector' ? 48 : 160,
        height: type === 'connector' ? 48 : type === 'decision' ? 80 : 60,
      },
    };
    pushHistory();
    const currentProc = useZampFlowStore.getState().activeProcess();
    if (!currentProc) return;
    setNodes([...currentProc.nodes, node]);
  }, [proc, screenToFlowPosition, setNodes, pushHistory]);

  // Right-click on a node → show context menu
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: any) => {
    e.preventDefault();
    setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
  }, []);

  // Delete a node by id
  const deleteNodeById = useCallback((nodeId: string) => {
    const currentProc = useZampFlowStore.getState().activeProcess();
    if (!currentProc) return;
    useZampFlowStore.getState().pushHistory();
    setNodes(currentProc.nodes.filter(n => n.id !== nodeId));
    setEdges(currentProc.edges.filter(e => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  if (!proc) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-500 dark:text-gray-400">Create or select a process to start</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={canvasRef} className="flex-1 relative overflow-hidden bg-gray-50 dark:bg-gray-900">
      <ReactFlow
        nodes={proc.nodes}
        edges={proc.edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeContextMenu={onNodeContextMenu}
        connectionMode={ConnectionMode.Loose}
        snapToGrid={preferences.snapToGrid}
        snapGrid={[16, 16]}
        fitView
        deleteKeyCode={['Delete', 'Backspace']}
        style={{ pointerEvents: whiteboardMode ? 'none' : 'all' }}
        proOptions={{ hideAttribution: true }}
      >
        {preferences.showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#d1d5db"
            className="dark:!bg-gray-900"
          />
        )}
        <Controls className="!border-gray-200 dark:!border-gray-700 !bg-white dark:!bg-gray-800 !shadow-lg !rounded-xl overflow-hidden" />
        <MiniMap
          className="!border-gray-200 dark:!border-gray-700 !bg-white dark:!bg-gray-800"
          nodeColor={n => n.data?.color || '#e5e7eb'}
          maskColor="rgba(0,0,0,0.07)"
        />
      </ReactFlow>

      {contextMenu && (
        <NodeContextMenu
          menu={contextMenu}
          onDelete={deleteNodeById}
          onClose={() => setContextMenu(null)}
        />
      )}

      <WhiteboardLayer active={whiteboardMode} />
    </div>
  );
}
