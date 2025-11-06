import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getStraightPath, EdgeProps } from '@xyflow/react';
import { DiagramStyleTheme } from '@/types/diagramStyles';

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
  const styles = data?.styles as DiagramStyleTheme | undefined;
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
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

  const edgeStyle = {
    ...style,
    stroke: style.stroke || styles?.colors.edgeStroke || '#64748b',
    strokeWidth: style.strokeWidth || 2
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={edgeStyle} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              color: styles?.colors.edgeLabel || '#475569'
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
