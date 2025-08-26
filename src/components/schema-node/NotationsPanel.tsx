import React, { memo } from 'react';
import { NotationComment } from '@/types/notations';

interface NotationsPanelProps {
  notations: NotationComment[];
  isExpanded: boolean;
}

export const NotationsPanel = memo(({ notations, isExpanded }: NotationsPanelProps) => {
  if (!isExpanded || notations.length === 0) {
    return null;
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="mt-2 border-t pt-2 space-y-2">
      <div className="text-xs font-medium text-slate-700">Comments:</div>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {notations.map((notation) => (
          <div 
            key={notation.id} 
            className="bg-amber-50 border border-amber-200 rounded p-2 text-xs"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-amber-900">@{notation.user}</span>
              <span className="text-amber-600 text-[10px]">
                {formatTimestamp(notation.timestamp)}
              </span>
            </div>
            <p className="text-amber-800 leading-relaxed break-words">
              {notation.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
});

NotationsPanel.displayName = 'NotationsPanel';