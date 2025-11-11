import React from 'react';
import { ProcessNode as ProcessNodeType } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';

interface ProcessNodeProps {
  data: {
    processNode: ProcessNodeType;
    theme?: DiagramStyleTheme;
    parallelCount?: number;
    onSelect?: (processId: string) => void;
  };
  selected?: boolean;
}

export const ProcessNode: React.FC<ProcessNodeProps> = ({ data, selected }) => {
  if (!data?.processNode) {
    return null;
  }
  
  const { processNode, theme, parallelCount = 1, onSelect } = data;
  
  if (!processNode.lifelineId || !processNode.description) {
    return null;
  }
  
  const { description, parallelIndex = 0, lifelineId, color } = processNode;

  // Get process color from theme or use default
  const getProcessColor = () => {
    // Get base lifeline process color
    const baseColor = theme?.lifelineColors?.[lifelineId]?.processColor || 
      (theme?.id === 'dark' ? 'rgba(100, 116, 139, 0.3)' : 'rgba(148, 163, 184, 0.3)');
    
    // If custom color is provided, blend it with the base color
    if (color) {
      // Convert hex to RGB
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      };
      
      // Extract RGB from rgba base color
      const rgbaMatch = baseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (rgbaMatch) {
        const baseRgb = {
          r: parseInt(rgbaMatch[1]),
          g: parseInt(rgbaMatch[2]),
          b: parseInt(rgbaMatch[3])
        };
        const baseAlpha = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
        
        const customRgb = hexToRgb(color);
        if (customRgb) {
          // Blend: 40% base color + 60% custom color
          const blendedR = Math.round(baseRgb.r * 0.4 + customRgb.r * 0.6);
          const blendedG = Math.round(baseRgb.g * 0.4 + customRgb.g * 0.6);
          const blendedB = Math.round(baseRgb.b * 0.4 + customRgb.b * 0.6);
          
          return `rgba(${blendedR}, ${blendedG}, ${blendedB}, ${baseAlpha})`;
        }
      }
    }
    
    return baseColor;
  };

  const processColor = getProcessColor();
  const borderColor = theme?.colors.nodeBorder || '#94a3b8';
  const textColor = theme?.colors.nodeText || '#0f172a';

  // Fixed width per process box (thin boxes)
  const PROCESS_BOX_WIDTH = 50; // 50px per process box
  const leftOffset = PROCESS_BOX_WIDTH * parallelIndex;

  return (
    <div
      className="process-node-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        pointerEvents: 'all'
      }}
    >
      <div
        className="process-box"
        style={{
          position: 'absolute',
          left: `${leftOffset}px`,
          width: `${PROCESS_BOX_WIDTH}px`,
          height: '100%',
          backgroundColor: processColor,
          border: selected ? `2px solid #3b82f6` : `1px solid ${borderColor}`,
          borderRadius: '6px',
          padding: '8px 4px',
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
            fontSize: '11px',
            fontWeight: 500,
            textAlign: 'center',
            wordBreak: 'break-word',
            opacity: 0.9,
            lineHeight: '1.3',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {description || 'Process'}
        </div>
        
        {parallelIndex < parallelCount - 1 && (
          <div
            className="process-divider"
            style={{
              position: 'absolute',
              right: '-2px',
              top: '8px',
              bottom: '8px',
              width: '1px',
              backgroundColor: borderColor,
              opacity: 0.2
            }}
          />
        )}
      </div>
    </div>
  );
};
