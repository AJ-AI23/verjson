import React from 'react';
import { ProcessNode as ProcessNodeType } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';

interface ProcessNodeProps {
  data: {
    processNode: ProcessNodeType;
    theme?: DiagramStyleTheme;
    parallelCount?: number;
  };
  selected?: boolean;
}

export const ProcessNode: React.FC<ProcessNodeProps> = ({ data, selected }) => {
  if (!data?.processNode) return null;
  
  const { processNode, theme, parallelCount = 1 } = data;
  const { description, parallelIndex = 0, lifelineId, color } = processNode;

  // Get process color from theme or use default
  const getProcessColor = () => {
    if (color) return color;
    
    if (theme?.lifelineColors?.[lifelineId]?.processColor) {
      return theme.lifelineColors[lifelineId].processColor;
    }
    
    // Default process color (less vibrant than anchor)
    const isDark = theme?.id === 'dark';
    return isDark ? 'rgba(100, 116, 139, 0.3)' : 'rgba(148, 163, 184, 0.3)';
  };

  const processColor = getProcessColor();
  const borderColor = theme?.colors.nodeBorder || '#94a3b8';
  const textColor = theme?.colors.nodeText || '#0f172a';

  // Calculate width based on parallel processes
  const widthPercentage = 100 / parallelCount;
  const leftOffset = widthPercentage * parallelIndex;

  return (
    <div
      className="process-node-container"
      style={{
        position: 'absolute',
        left: `${leftOffset}%`,
        width: `${widthPercentage}%`,
        height: '100%',
        pointerEvents: 'all'
      }}
    >
      <div
        className="process-box"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: processColor,
          border: selected ? `2px solid #3b82f6` : `1px solid ${borderColor}`,
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: selected ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
      >
        <div
          className="process-description"
          style={{
            color: textColor,
            fontSize: '13px',
            fontWeight: 500,
            textAlign: 'center',
            wordBreak: 'break-word',
            opacity: 0.9
          }}
        >
          {description || 'Process'}
        </div>
        
        {parallelCount > 1 && parallelIndex < parallelCount - 1 && (
          <div
            className="process-divider"
            style={{
              position: 'absolute',
              right: 0,
              top: '8px',
              bottom: '8px',
              width: '1px',
              backgroundColor: borderColor,
              opacity: 0.3
            }}
          />
        )}
      </div>
    </div>
  );
};
