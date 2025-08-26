import React, { memo } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotationsIndicatorProps {
  count: number;
  isExpanded: boolean;
  onClick: () => void;
}

export const NotationsIndicator = memo(({ count, isExpanded, onClick }: NotationsIndicatorProps) => {
  if (count === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
        "hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500",
        isExpanded ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-600"
      )}
      aria-label={`${count} comment${count === 1 ? '' : 's'}`}
    >
      <MessageCircle className="w-3 h-3" />
      <span className="font-medium">{count}</span>
    </button>
  );
});

NotationsIndicator.displayName = 'NotationsIndicator';