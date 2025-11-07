import React, { useState, useRef } from 'react';
import { useViewport } from '@xyflow/react';
import { Lifeline } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface ColumnLifelineNodeProps {
  data: {
    column: Lifeline; // Using 'column' property name for backward compatibility
    styles?: DiagramStyleTheme;
    customLifelineColors?: Record<string, string>;
    onAddNode?: (lifelineId: string, yPosition: number) => void;
    readOnly?: boolean;
  };
}

export const ColumnLifelineNode: React.FC<ColumnLifelineNodeProps> = ({ data }) => {
  const { column: lifeline, styles, customLifelineColors, onAddNode, readOnly } = data;
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const lifelineRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const viewport = useViewport();

  const handleAddNode = (yPosition: number) => {
    if (onAddNode && !readOnly) {
      // Convert screen position back to diagram coordinates
      onAddNode(lifeline.id, yPosition / viewport.zoom);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!lifelineRef.current || readOnly || !onAddNode) return;
    
    // Cancel any pending animation frame
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    
    // Use requestAnimationFrame to throttle updates
    rafRef.current = requestAnimationFrame(() => {
      if (!lifelineRef.current) return;
      
      // Calculate position relative to the lifeline div consistently
      const rect = lifelineRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      // Only show button if mouse is over the lifeline area
      if (relativeY >= 0 && relativeY <= rect.height) {
        setHoverPosition(relativeY);
      }
    });
  };

  const handleMouseLeave = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    setHoverPosition(null);
  };

  // Get custom color for this lifeline, fallback to lifeline.color, then to default
  const lifelineColor = customLifelineColors?.[`lifeline-${lifeline.id}`] || lifeline.color || styles?.colors.swimlaneBackground || '#f8fafc';

  return (
    <div
      className="flex flex-col items-center pointer-events-none"
      style={{
        width: '200px',
        transform: 'translateX(-50%)'
      }}
    >
      {/* Column Header */}
      <div
        className="rounded-lg shadow-sm px-4 py-3 mb-4 text-center w-full pointer-events-auto"
        style={{
          backgroundColor: lifelineColor,
          borderWidth: '2px',
          borderColor: styles?.colors.nodeBorder || '#64748b',
          color: styles?.colors.nodeText || '#0f172a'
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
        className="relative pointer-events-auto"
        style={{
          width: '60px',
          height: '2000px',
          marginLeft: '-30px',
          marginRight: '-30px'
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Visual line */}
        <div
          className="absolute"
          style={{
            left: '30px',
            width: '2px',
            height: '100%',
            background: `repeating-linear-gradient(
              to bottom,
              ${styles?.colors.nodeBorder || '#cbd5e1'} 0px,
              ${styles?.colors.nodeBorder || '#cbd5e1'} 8px,
              transparent 8px,
              transparent 16px
            )`,
            pointerEvents: 'none'
          }}
        />
        {!readOnly && onAddNode && hoverPosition !== null && (
          <div
            className="absolute pointer-events-none"
            style={{ top: `${hoverPosition}px`, left: '30px', transform: 'translate(-50%, -50%)' }}
          >
            {/* Large Clickable Area */}
            <button
              onClick={() => handleAddNode(hoverPosition)}
              className="w-12 h-12 rounded-full flex items-center justify-center relative pointer-events-auto"
              style={{
                backgroundColor: 'transparent'
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
