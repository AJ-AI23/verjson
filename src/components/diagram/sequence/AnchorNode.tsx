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
  
  // Get colors from theme first, then fall back to custom styles or defaults
  const lifelineColors = styles?.lifelineColors?.[lifelineId];
  const defaultLifelineBg = styles?.id === 'dark' ? '#475569' : '#e0f2fe';
  const lifelineColor = lifelineColors?.background || customStyles?.customNodeStyles?.[`lifeline-${lifelineId}`]?.backgroundColor || lifeline?.color || defaultLifelineBg;
  
  // Calculate default anchor colors as 50% lighter than lifeline background
  const defaultAnchorColor = lightenColor(lifelineColor, 50);
  const defaultAnchorBorderColor = lightenColor(lifelineColor, 30);
  
  // Use theme colors first, then custom styles, then calculated defaults
  const anchorColor = lifelineColors?.anchorColor || customStyles?.customNodeStyles?.[`lifeline-${lifelineId}-anchor`]?.backgroundColor || lifeline?.anchorColor || defaultAnchorColor;
  const anchorBorderColor = lifelineColors?.anchorBorder || customStyles?.customNodeStyles?.[`lifeline-${lifelineId}-anchor`]?.borderColor || defaultAnchorBorderColor;
  
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

// Helper function to lighten a color by a percentage
function lightenColor(color: string, percent: number): string {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Lighten by moving toward white (255)
  r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Helper function to darken a color for the border (kept for backward compatibility)
function adjustColorBrightness(color: string, amount: number): string {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
