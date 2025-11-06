import React from 'react';
import { Swimlane } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';
import { cn } from '@/lib/utils';

interface SwimlaneHeaderProps {
  swimlane: Swimlane & { y: number; height: number };
  isFirst: boolean;
  styles?: DiagramStyleTheme;
}

export const SwimlaneHeader: React.FC<SwimlaneHeaderProps> = ({ swimlane, isFirst, styles }) => {
  return (
    <div
      className={cn(
        'absolute left-0 w-48 flex flex-col justify-center px-4',
        !isFirst && 'border-t-2'
      )}
      style={{
        top: swimlane.y,
        height: swimlane.height,
        backgroundColor: swimlane.color ? `${swimlane.color}10` : styles?.colors.swimlaneBackground || '#f8fafc',
        borderRightWidth: '2px',
        borderRightColor: styles?.colors.swimlaneBorder || '#cbd5e1',
        borderTopColor: styles?.colors.swimlaneBorder || '#cbd5e1'
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: swimlane.color || styles?.colors.nodeBorder || '#64748b' }}
        />
        <div>
          <div 
            className="font-semibold text-sm"
            style={{ color: styles?.colors.nodeText || '#0f172a' }}
          >
            {swimlane.name}
          </div>
          {swimlane.description && (
            <div 
              className="text-xs line-clamp-1"
              style={{ color: styles?.colors.edgeLabel || '#475569' }}
            >
              {swimlane.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
