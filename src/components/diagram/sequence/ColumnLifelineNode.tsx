import React, { useState, useRef } from 'react';
import { Lifeline } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface ColumnLifelineNodeProps {
  data: {
    column: Lifeline; // Using 'column' property name for backward compatibility
    styles?: DiagramStyleTheme;
    onAddNode?: (lifelineId: string) => void;
    readOnly?: boolean;
  };
}

export const ColumnLifelineNode: React.FC<ColumnLifelineNodeProps> = ({ data }) => {
  const { column: lifeline, styles, onAddNode, readOnly } = data;
  const [hoveredAnchor, setHoveredAnchor] = useState<number | null>(null);

  const handleAddNode = () => {
    if (onAddNode && !readOnly) {
      onAddNode(lifeline.id);
    }
  };

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
          backgroundColor: styles?.colors.nodeBackground || '#ffffff',
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
            className="absolute left-1/2 -translate-x-1/2 pointer-events-auto group"
            style={{ top: `${yPos}px` }}
            onMouseEnter={() => setHoveredAnchor(index)}
            onMouseLeave={() => setHoveredAnchor(null)}
          >
            {/* Anchor Button */}
            <button
              onClick={handleAddNode}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100"
              style={{
                backgroundColor: styles?.colors.nodeBackground || '#ffffff',
                border: `2px solid ${styles?.colors.nodeBorder || '#64748b'}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
              title="Add node here"
            >
              <Plus className="h-3 w-3" style={{ color: styles?.colors.nodeText || '#0f172a' }} />
            </button>
            
            {/* Tooltip */}
            {hoveredAnchor === index && (
              <div 
                className="absolute left-8 top-1/2 -translate-y-1/2 whitespace-nowrap animate-fade-in"
                style={{ pointerEvents: 'none' }}
              >
                <div
                  className="px-2 py-1 rounded text-xs shadow-lg"
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
