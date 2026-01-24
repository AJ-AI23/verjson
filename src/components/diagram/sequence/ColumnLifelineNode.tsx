import React, { useState, useRef } from 'react';
import { useViewport } from '@xyflow/react';
import { Lifeline } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface ColumnLifelineNodeProps {
  data: {
    column: Lifeline;
    styles?: DiagramStyleTheme;
    customLifelineColors?: Record<string, string>;
    onAddNode?: (lifelineId: string, yPosition: number) => void;
    readOnly?: boolean;
    lifelineHeight?: number;
    isRenderMode?: boolean;
  };
  selected?: boolean;
}

export const ColumnLifelineNode: React.FC<ColumnLifelineNodeProps> = ({ data, selected }) => {
  const { column: lifeline, styles, customLifelineColors, onAddNode, readOnly, lifelineHeight = 2000, isRenderMode } = data;
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [diagramYPosition, setDiagramYPosition] = useState<number | null>(null);
  const lifelineRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const viewport = useViewport();

  const handleAddNode = (yPosition: number) => {
    if (onAddNode && !readOnly) {
      onAddNode(lifeline.id, yPosition);
    }
  };

  // The lifeline header height - this must match the header's rendered height
  const LIFELINE_HEADER_HEIGHT = 100; // Same as in sequenceLayout.ts

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!lifelineRef.current || readOnly || !onAddNode) return;
    
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      if (!lifelineRef.current) return;
      
      const rect = lifelineRef.current.getBoundingClientRect();
      const screenY = e.clientY - rect.top;
      // Visual position for the hover button (relative to the lifeline element)
      const visualY = screenY / viewport.zoom;
      // Diagram coordinate for node placement (add header offset to match diagram coordinate system)
      const diagramY = visualY + LIFELINE_HEADER_HEIGHT;
      
      if (screenY >= 0 && screenY <= rect.height) {
        setHoverPosition(visualY);
        setDiagramYPosition(diagramY);
      }
    });
  };

  const handleMouseLeave = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    setHoverPosition(null);
    setDiagramYPosition(null);
  };

  // Get custom color for this lifeline from theme, fallback to lifeline.color, then to theme-specific default
  const defaultLifelineBg = styles?.id === 'dark' ? '#475569' : '#e0f2fe';
  const baseColor = styles?.lifelineColors?.[lifeline.id]?.background || customLifelineColors?.[`lifeline-${lifeline.id}`] || defaultLifelineBg;
  
  // Blend lifeline.color with base theme color (40% base + 60% custom)
  const getBlendedLifelineColor = () => {
    if (!lifeline.color) return baseColor;
    
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    
    const baseRgb = hexToRgb(baseColor);
    const customRgb = hexToRgb(lifeline.color);
    
    if (baseRgb && customRgb) {
      const blendedR = Math.round(baseRgb.r * 0.4 + customRgb.r * 0.6);
      const blendedG = Math.round(baseRgb.g * 0.4 + customRgb.g * 0.6);
      const blendedB = Math.round(baseRgb.b * 0.4 + customRgb.b * 0.6);
      return `#${blendedR.toString(16).padStart(2, '0')}${blendedG.toString(16).padStart(2, '0')}${blendedB.toString(16).padStart(2, '0')}`;
    }
    
    return baseColor;
  };
  
  const lifelineColor = getBlendedLifelineColor();

  return (
    <div
      className="flex flex-col items-center"
      style={{
        width: '200px',
        transform: 'translateX(-50%)',
        pointerEvents: 'none'
      }}
    >
      {/* Column Header */}
      <div
        className="rounded-lg shadow-sm px-4 py-3 mb-4 text-center w-full pointer-events-auto transition-all"
        style={{
          backgroundColor: lifelineColor,
          borderWidth: '2px',
          borderColor: selected && !isRenderMode ? '#3b82f6' : (styles?.colors.nodeBorder || '#64748b'),
          color: styles?.colors.nodeText || '#0f172a',
          boxShadow: selected && !isRenderMode ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : undefined,
          cursor: isRenderMode ? 'default' : 'pointer'
        }}
      >
        <div className="font-semibold text-sm">
          {lifeline.name}
        </div>
        {lifeline.description && (
          <div 
            className="text-xs mt-1 line-clamp-1"
            style={{ color: styles?.colors.edgeLabel || '#475569' }}
          >
            {lifeline.description}
          </div>
        )}
      </div>

      {/* Vertical Lifeline with Hover Button */}
      <div
        ref={lifelineRef}
        className="relative"
        style={{
          width: '60px',
          height: `${lifelineHeight}px`,
          marginLeft: '-30px',
          marginRight: '-30px',
          pointerEvents: isRenderMode || readOnly ? 'none' : 'auto'
        }}
        onMouseMove={isRenderMode ? undefined : handleMouseMove}
        onMouseLeave={isRenderMode ? undefined : handleMouseLeave}
      >
        {/* Visual line */}
        <div
          className="absolute"
          style={{
            left: '30px',
            width: '4px',
            height: '100%',
            background: `repeating-linear-gradient(
              to bottom,
              ${styles?.colors.lifelineAxis || styles?.colors.nodeBorder || '#cbd5e1'} 0px,
              ${styles?.colors.lifelineAxis || styles?.colors.nodeBorder || '#cbd5e1'} 10px,
              transparent 10px,
              transparent 20px
            )`,
            pointerEvents: 'none'
          }}
        />
        {!readOnly && onAddNode && hoverPosition !== null && diagramYPosition !== null && (
          <div
            className="absolute"
            style={{ top: `${hoverPosition}px`, left: '30px', transform: 'translate(-50%, -50%)', pointerEvents: 'auto' }}
          >
            {/* Large Clickable Area */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Use diagramYPosition which includes the header offset for correct diagram coordinates
                handleAddNode(diagramYPosition);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center relative cursor-pointer"
              style={{
                backgroundColor: 'transparent',
                zIndex: 10000
              }}
              title="Add node here"
            >
              {/* Visual Circle */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: styles?.colors.nodeBackground || '#ffffff',
                  border: `2px solid #3b82f6`,
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
                }}
              >
                <Plus 
                  className="h-3.5 w-3.5"
                  style={{ color: '#3b82f6' }} 
                />
              </div>
            </button>
            
            {/* Tooltip */}
            <div 
              className="absolute left-10 top-1/2 -translate-y-1/2 whitespace-nowrap z-50"
              style={{ pointerEvents: 'none' }}
            >
              <div
                className="px-3 py-1.5 rounded text-xs font-medium shadow-lg"
                style={{
                  backgroundColor: styles?.colors.nodeBackground || '#ffffff',
                  border: `1px solid ${styles?.colors.nodeBorder || '#cbd5e1'}`,
                  color: styles?.colors.nodeText || '#0f172a'
                }}
              >
                Add Node
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
