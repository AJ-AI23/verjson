
import React, { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface NodeCollapseIndicatorProps {
  hasMoreLevels?: boolean;
  isCollapsed?: boolean;
  hasCollapsibleContent?: boolean;
}

export const NodeCollapseIndicator = memo(({ 
  hasMoreLevels,
  isCollapsed,
  hasCollapsibleContent
}: NodeCollapseIndicatorProps) => {
  if (!hasMoreLevels && !isCollapsed && !hasCollapsibleContent) {
    return null;
  }
  
  return (
    <>
      {hasMoreLevels && !isCollapsed && (
        <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
          <ChevronDown size={12} />
          <span>More levels not shown</span>
        </div>
      )}

      {isCollapsed && (
        <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
          <ChevronRight size={12} />
          <span>Collapsed in editor</span>
        </div>
      )}

      {hasCollapsibleContent && !isCollapsed && !hasMoreLevels && (
        <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
          <ChevronDown size={12} />
          <span>Expandable</span>
        </div>
      )}
    </>
  );
});

NodeCollapseIndicator.displayName = 'NodeCollapseIndicator';
