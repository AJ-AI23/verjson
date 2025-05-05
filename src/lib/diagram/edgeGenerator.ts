
import { Edge } from '@xyflow/react';

export const createEdge = (
  source: string, 
  target: string, 
  label?: string,
  animated: boolean = false,
  style: any = { stroke: '#64748b' }
): Edge => {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    type: 'smoothstep',
    animated,
    label,
    style
  };
};
