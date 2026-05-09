import React from 'react';
import {
  EdgeProps, getBezierPath, getSmoothStepPath, getStraightPath,
  EdgeLabelRenderer, BaseEdge,
} from 'reactflow';
import { EdgeData } from '../store/types';

export function CustomEdge({
  sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  data, label, markerEnd, markerStart,
}: EdgeProps<EdgeData>) {
  const edgeType = data?.edgeType || 'smoothstep';
  const color = data?.color || '#6366f1';
  const thickness = data?.thickness || 2;
  const dashed = data?.dashed || false;
  const condLabel = data?.conditionLabel || (label as string) || '';

  let pathFunc = getSmoothStepPath;
  if (edgeType === 'bezier') pathFunc = getBezierPath as any;
  else if (edgeType === 'straight') pathFunc = getStraightPath as any;

  const [edgePath, labelX, labelY] = pathFunc({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          stroke: color,
          strokeWidth: thickness,
          strokeDasharray: dashed ? '6 3' : undefined,
        }}
      />
      {condLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded-full shadow-sm border"
              style={{ background: 'white', color: '#0f172a', borderColor: '#e2e8f0' }}
            >
              {condLabel}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = { custom: CustomEdge };
