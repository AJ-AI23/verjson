import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, EdgeProps } from '@xyflow/react';

export const SequenceEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  label,
  data
}) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeType = data?.edgeType || 'default';

  const getLabelStyle = () => {
    const baseStyle = 'px-2 py-1 text-xs font-medium rounded shadow-sm';
    
    switch (edgeType) {
      case 'sync':
        return `${baseStyle} bg-blue-100 text-blue-800 border border-blue-300`;
      case 'async':
        return `${baseStyle} bg-green-100 text-green-800 border border-green-300`;
      case 'return':
        return `${baseStyle} bg-purple-100 text-purple-800 border border-purple-300`;
      default:
        return `${baseStyle} bg-slate-100 text-slate-800 border border-slate-300`;
    }
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={getLabelStyle()}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
