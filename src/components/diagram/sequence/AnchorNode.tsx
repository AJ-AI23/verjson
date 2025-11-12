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
    isInProcess?: boolean;
    isRenderMode?: boolean;
  };
  selected?: boolean;
}

export const AnchorNode: React.FC<AnchorNodeProps> = ({ data, selected }) => {
  const { lifelineId, lifelines, styles, customStyles, isInProcess, isRenderMode } = data;
  
  // Find the lifeline for this anchor
  const lifeline = lifelines?.find(l => l.id === lifelineId);
  
  // Get colors from theme first, then fall back to custom styles or defaults
  const lifelineColors = styles?.lifelineColors?.[lifelineId];
  const defaultLifelineBg = styles?.id === 'dark' ? '#475569' : '#e0f2fe';
  const baseLifelineColor = lifelineColors?.background || customStyles?.customNodeStyles?.[`lifeline-${lifelineId}`]?.backgroundColor || defaultLifelineBg;
  
  // Calculate default anchor colors as 50% lighter than lifeline background
  const defaultAnchorColor = lightenColor(baseLifelineColor, 50);
  const defaultAnchorBorderColor = lightenColor(baseLifelineColor, 30);
  
  // Get base anchor color from theme
  const baseAnchorColor = lifelineColors?.anchorColor || customStyles?.customNodeStyles?.[`lifeline-${lifelineId}-anchor`]?.backgroundColor || defaultAnchorColor;
  const baseAnchorBorderColor = lifelineColors?.anchorBorder || customStyles?.customNodeStyles?.[`lifeline-${lifelineId}-anchor`]?.borderColor || defaultAnchorBorderColor;
  
  // Blend custom anchor color with theme color (40% base + 60% custom)
  const getBlendedAnchorColor = (baseColor: string, customColor?: string) => {
    if (!customColor) return baseColor;
    
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    
    const baseRgb = hexToRgb(baseColor);
    const customRgb = hexToRgb(customColor);
    
    if (baseRgb && customRgb) {
      const blendedR = Math.round(baseRgb.r * 0.4 + customRgb.r * 0.6);
      const blendedG = Math.round(baseRgb.g * 0.4 + customRgb.g * 0.6);
      const blendedB = Math.round(baseRgb.b * 0.4 + customRgb.b * 0.6);
      return `#${blendedR.toString(16).padStart(2, '0')}${blendedG.toString(16).padStart(2, '0')}${blendedB.toString(16).padStart(2, '0')}`;
    }
    
    return baseColor;
  };
  
  // Use theme colors first, then blend with custom colors
  let anchorColor = getBlendedAnchorColor(baseAnchorColor, lifeline?.anchorColor);
  let anchorBorderColor = getBlendedAnchorColor(baseAnchorBorderColor, lifeline?.anchorColor);
  
  // Visual feedback when anchor is in a process
  if (isInProcess) {
    anchorColor = lightenColor(anchorColor, -10); // Slightly darker
    anchorBorderColor = lightenColor(anchorBorderColor, -15);
  }
  
  // Visual feedback when selected
  const isSelected = selected && !isRenderMode;
  const borderWidth = isSelected ? '3px' : '2px';
  const selectedBorderColor = isSelected ? '#3b82f6' : anchorBorderColor;
  
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
        className={`w-full h-full rounded-full shadow-md transition-all ${isRenderMode ? '' : 'cursor-move hover:scale-125 hover:shadow-lg'}`}
        style={{
          backgroundColor: anchorColor,
          borderColor: selectedBorderColor,
          borderWidth: borderWidth,
          borderStyle: 'solid',
          boxShadow: isSelected ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : undefined,
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
