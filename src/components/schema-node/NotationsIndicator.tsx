import React, { memo } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotationsIndicatorProps {
  count: number;
  isExpanded: boolean;
  onClick: () => void;
  hasAddFunction?: boolean;
}

export const NotationsIndicator = memo(({ count, isExpanded, onClick, hasAddFunction }: NotationsIndicatorProps) => {
  // Show indicator if there are comments OR if we can add comments
  if (count === 0 && !hasAddFunction) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
        "hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500",
        isExpanded ? "bg-blue-50 text-blue-700" : 
        count > 0 ? "bg-slate-50 text-slate-600" : 
        "bg-green-50 text-green-600 border border-green-200"
      )}
      aria-label={count > 0 ? `${count} comment${count === 1 ? '' : 's'}` : 'Add comment'}
    >
      <MessageCircle className="w-3 h-3" />
      {count > 0 && <span className="font-medium">{count}</span>}
      {count === 0 && hasAddFunction && <span className="text-[10px]">+</span>}
    </button>
  );
});

NotationsIndicator.displayName = 'NotationsIndicator';