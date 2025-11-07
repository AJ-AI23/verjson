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
  const [isHovered, setIsHovered] = useState(false);
  const [mouseY, setMouseY] = useState(0);
  const lifelineRef = useRef<HTMLDivElement>(null);

  const handleAddNode = () => {
    if (onAddNode && !readOnly) {
      onAddNode(lifeline.id);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (lifelineRef.current) {
      const rect = lifelineRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      setMouseY(relativeY);
    }
  };

  return (
    <div
      className="flex flex-col items-center pointer-events-none"
      style={{
        width: '200px',
        transform: 'translateX(-50%)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
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

      {/* Vertical Lifeline with Add Node Button */}
      <div
        ref={lifelineRef}
        className="relative pointer-events-auto"
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
        {isHovered && !readOnly && onAddNode && (
          <div 
            className="absolute left-1/2 -translate-x-1/2"
            style={{ 
              pointerEvents: 'auto',
              top: `${mouseY}px`,
              transform: 'translateX(-50%) translateY(-50%)'
            }}
          >
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAddNode}
              className="gap-1 shadow-lg h-7 text-xs"
              title="Add node on this lifeline"
            >
              <Plus className="h-3 w-3" />
              Add Node
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
