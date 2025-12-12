import React, { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NodeExpandCollapseButtonProps {
  isCollapsed: boolean;
  hasChildren: boolean;
  path: string;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  className?: string;
}

export const NodeExpandCollapseButton = memo(({
  isCollapsed,
  hasChildren,
  path,
  onToggleCollapse,
  className
}: NodeExpandCollapseButtonProps) => {
  if (!hasChildren || !onToggleCollapse) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse(path, !isCollapsed);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center justify-center w-5 h-5 rounded transition-colors",
        "hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring",
        "text-muted-foreground hover:text-foreground",
        className
      )}
      title={isCollapsed ? "Expand" : "Collapse"}
      aria-label={isCollapsed ? "Expand node" : "Collapse node"}
    >
      {isCollapsed ? (
        <ChevronRight size={14} />
      ) : (
        <ChevronDown size={14} />
      )}
    </button>
  );
});

NodeExpandCollapseButton.displayName = 'NodeExpandCollapseButton';
