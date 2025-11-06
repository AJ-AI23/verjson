import React from 'react';
import { Swimlane } from '@/types/diagram';
import { cn } from '@/lib/utils';

interface SwimlaneHeaderProps {
  swimlane: Swimlane & { y: number; height: number };
  isFirst: boolean;
}

export const SwimlaneHeader: React.FC<SwimlaneHeaderProps> = ({ swimlane, isFirst }) => {
  return (
    <div
      className={cn(
        'absolute left-0 w-48 border-r-2 border-slate-300 flex flex-col justify-center px-4',
        !isFirst && 'border-t-2'
      )}
      style={{
        top: swimlane.y,
        height: swimlane.height,
        backgroundColor: swimlane.color ? `${swimlane.color}10` : '#f8fafc'
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: swimlane.color || '#64748b' }}
        />
        <div>
          <div className="font-semibold text-sm text-slate-900">
            {swimlane.name}
          </div>
          {swimlane.description && (
            <div className="text-xs text-slate-500 line-clamp-1">
              {swimlane.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
