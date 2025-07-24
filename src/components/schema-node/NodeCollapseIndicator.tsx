
import React, { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface NodeCollapseIndicatorProps {
  hasMoreLevels?: boolean;
  isCollapsed?: boolean;
  hasCollapsibleContent?: boolean;
  additionalPropsCount?: number;
}

export const NodeCollapseIndicator = memo(({ 
  hasMoreLevels,
  isCollapsed,
  hasCollapsibleContent,
  additionalPropsCount = 0
}: NodeCollapseIndicatorProps) => {
  if (!hasMoreLevels && !isCollapsed && !hasCollapsibleContent && additionalPropsCount === 0) {
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

      {(hasCollapsibleContent || additionalPropsCount > 0) && !isCollapsed && !hasMoreLevels && (
        <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
          <ChevronDown size={12} />
          <span>
            Expandable
            {additionalPropsCount > 0 && ` (${additionalPropsCount})`}
          </span>
        </div>
      )}
    </>
  );
});

NodeCollapseIndicator.displayName = 'NodeCollapseIndicator';
