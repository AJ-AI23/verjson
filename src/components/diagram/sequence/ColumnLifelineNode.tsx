import React, { useState, useRef } from 'react';
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
  const [hoveredAnchor, setHoveredAnchor] = useState<number | null>(null);

  const handleAddNode = (yPosition: number) => {
    if (onAddNode && !readOnly) {
      onAddNode(lifeline.id, yPosition);
    }
  };

  // Get custom color for this lifeline, fallback to lifeline.color, then to default
  const lifelineColor = customLifelineColors?.[`lifeline-${lifeline.id}`] || lifeline.color || styles?.colors.swimlaneBackground || '#f8fafc';

  // Create anchor points every 150px along the lifeline
  const anchorPoints = Array.from({ length: 13 }, (_, i) => i * 150 + 75);

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

      {/* Vertical Lifeline with Anchor Points */}
      <div
        className="relative"
        style={{
          width: '2px',
          height: '2000px',
          background: `repeating-linear-gradient(
            to bottom,
            ${styles?.colors.nodeBorder || '#cbd5e1'} 0px,
            ${styles?.colors.nodeBorder || '#cbd5e1'} 8px,
            transparent 8px,
            transparent 16px
          )`
        }}
      >
        {!readOnly && onAddNode && anchorPoints.map((yPos, index) => (
          <div
            key={index}
            className="absolute left-1/2 -translate-x-1/2 pointer-events-auto"
            style={{ top: `${yPos}px` }}
            onMouseEnter={() => setHoveredAnchor(index)}
            onMouseLeave={() => setHoveredAnchor(null)}
          >
            {/* Large Clickable Area */}
            <button
              onClick={() => handleAddNode(yPos)}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 relative"
              style={{
                backgroundColor: 'transparent'
              }}
              title="Add node here"
            >
              {/* Visual Circle - Always slightly visible */}
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
                  hoveredAnchor === index ? 'scale-125' : 'scale-100'
                }`}
                style={{
                  backgroundColor: styles?.colors.nodeBackground || '#ffffff',
                  border: `2px solid ${styles?.colors.nodeBorder || '#64748b'}`,
                  boxShadow: hoveredAnchor === index ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 6px rgba(0,0,0,0.1)',
                  opacity: hoveredAnchor === index ? 1 : 0.4
                }}
              >
                <Plus 
                  className={`h-2.5 w-2.5 transition-transform duration-200 ${
                    hoveredAnchor === index ? 'scale-110' : 'scale-90'
                  }`}
                  style={{ color: styles?.colors.nodeText || '#0f172a' }} 
                />
              </div>
            </button>
            
            {/* Tooltip */}
            {hoveredAnchor === index && (
              <div 
                className="absolute left-10 top-1/2 -translate-y-1/2 whitespace-nowrap animate-fade-in z-50"
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
