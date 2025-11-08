import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { DiagramStyleTheme } from '@/types/diagramStyles';
import { DiagramStyles } from '@/types/diagramStyles';
import { Lifeline } from '@/types/diagram';

interface AnchorNodeProps {
  data: {
    lifelineId: string;
    lifelines?: Lifeline[];
    styles?: DiagramStyleTheme;
    customStyles?: DiagramStyles;
  };
}

export const AnchorNode: React.FC<AnchorNodeProps> = ({ data }) => {
  const { lifelineId, lifelines, styles, customStyles } = data;
  
  // Find the lifeline for this anchor
  const lifeline = lifelines?.find(l => l.id === lifelineId);
  
  // Check customNodeStyles first, then lifeline.anchorColor, then default
  const customAnchorColor = customStyles?.customNodeStyles?.[`lifeline-${lifelineId}-anchor`]?.backgroundColor;
  const anchorColor = customAnchorColor || lifeline?.anchorColor || '#3b82f6';
  const anchorBorderColor = adjustColorBrightness(anchorColor, -20);
  
  return (
    <div
      className="relative"
      style={{
        width: '16px',
        height: '16px',
      }}
    >
      {/* Both source and target handles on left side */}
      <Handle 
        type="target" 
        position={Position.Left}
        id="left"
        className="!opacity-0 !pointer-events-none" 
      />
      <Handle 
        type="source" 
        position={Position.Left}
        id="left"
        className="!opacity-0 !pointer-events-none" 
      />
      
      <div
        className="w-full h-full rounded-full border-2 shadow-md cursor-move transition-all hover:scale-125 hover:shadow-lg"
        style={{
          backgroundColor: anchorColor,
          borderColor: anchorBorderColor,
        }}
      />
      
      {/* Both source and target handles on right side */}
      <Handle 
        type="source" 
        position={Position.Right}
        id="right"
        className="!opacity-0 !pointer-events-none" 
      />
      <Handle 
        type="target" 
        position={Position.Right}
        id="right"
        className="!opacity-0 !pointer-events-none" 
      />
    </div>
  );
};

// Helper function to darken a color for the border
function adjustColorBrightness(color: string, amount: number): string {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
