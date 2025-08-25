
import { Edge } from '@xyflow/react';

export type EdgeType = 'default' | 'reference' | 'structure';

export const createEdge = (
  sourceId: string,
  targetId: string,
  label?: string,
  animated = false,
  style?: Record<string, any>,
  edgeType: EdgeType = 'default'
): Edge => {
  const baseStyle: Record<string, any> = { stroke: '#64748b' };
  
  let finalStyle = { ...baseStyle, ...style };
  
  if (edgeType === 'reference') {
    finalStyle = {
      ...finalStyle,
      strokeDasharray: '5,5',
      stroke: '#8b5cf6',
      strokeWidth: 2
    };
  } else if (edgeType === 'structure') {
    finalStyle = {
      ...finalStyle,
      stroke: '#059669',
      strokeWidth: 2
    };
  }

  return {
    id: `edge-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    animated,
    label,
    style: finalStyle,
    type: edgeType === 'reference' ? 'step' : 'default'
  };
};
