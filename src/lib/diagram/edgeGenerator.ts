
import { Edge } from '@xyflow/react';

export const createEdge = (
  sourceId: string,
  targetId: string,
  label?: string,
  animated = false,
  style?: Record<string, any>
): Edge => {
  return {
    id: `edge-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    animated,
    label,
    style: style || { stroke: '#64748b' }
  };
};
