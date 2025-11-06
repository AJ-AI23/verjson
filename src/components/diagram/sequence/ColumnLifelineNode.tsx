import React from 'react';
import { Lifeline } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';

interface ColumnLifelineNodeProps {
  data: {
    column: Lifeline; // Using 'column' property name for backward compatibility
    styles?: DiagramStyleTheme;
  };
}

export const ColumnLifelineNode: React.FC<ColumnLifelineNodeProps> = ({ data }) => {
  const { column: lifeline, styles } = data;

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

      {/* Vertical Lifeline */}
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
      />
    </div>
  );
};
