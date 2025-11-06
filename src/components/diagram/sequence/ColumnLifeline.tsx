import React from 'react';
import { Column } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';
import { cn } from '@/lib/utils';

interface ColumnLifelineProps {
  column: Column & { x: number };
  height: number;
  styles?: DiagramStyleTheme;
}

export const ColumnLifeline: React.FC<ColumnLifelineProps> = ({ column, height, styles }) => {
  return (
    <div
      className="absolute top-0 flex flex-col items-center"
      style={{
        left: column.x,
        transform: 'translateX(-50%)',
        width: '200px'
      }}
    >
      {/* Column Header */}
      <div
        className="rounded-lg shadow-sm px-4 py-3 mb-4 text-center w-full"
        style={{
          backgroundColor: styles?.colors.nodeBackground || '#ffffff',
          borderWidth: '2px',
          borderColor: styles?.colors.nodeBorder || '#64748b',
          color: styles?.colors.nodeText || '#0f172a'
        }}
      >
        <div className="font-semibold text-sm">
          {column.name}
        </div>
        {column.description && (
          <div 
            className="text-xs mt-1 line-clamp-1"
            style={{ color: styles?.colors.edgeLabel || '#475569' }}
          >
            {column.description}
          </div>
        )}
      </div>

      {/* Vertical Lifeline */}
      <div
        className="relative"
        style={{
          width: '2px',
          height: `${height}px`,
          background: `repeating-linear-gradient(
            to bottom,
            ${styles?.colors.nodeBorder || '#cbd5e1'} 0px,
            ${styles?.colors.nodeBorder || '#cbd5e1'} 8px,
            transparent 8px,
            transparent 16px
          )`
        }}
      />
    </div>
  );
};
