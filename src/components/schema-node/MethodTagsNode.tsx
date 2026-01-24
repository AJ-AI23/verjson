import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NodeExpandCollapseButton } from './NodeExpandCollapseButton';
import { BaseNodeContainer } from './BaseNodeContainer';

export interface MethodTagsNodeProps {
  data: {
    label: string;
    tags: string[];
    tagCount: number;
    hasMoreLevels?: boolean;
    isCollapsed?: boolean;
    path?: string;
  };
  id: string;
  isConnectable: boolean;
  selected?: boolean;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const MethodTagsNode = memo(({ data, isConnectable, id, selected, onToggleCollapse }: MethodTagsNodeProps) => {
  const { label, tags = [], tagCount, hasMoreLevels = false, isCollapsed = false, path } = data;

  // Determine if node has children
  const hasChildren = hasMoreLevels || tagCount > 0;
  const nodePath = path || id;

  return (
    <BaseNodeContainer
      id={id}
      isConnectable={isConnectable}
      selected={selected}
      className={cn(
        'px-3 py-2 rounded-md shadow-sm border min-w-[160px] max-w-[240px]',
        'bg-cyan-50 border-cyan-200',
        isCollapsed && 'border-dashed bg-cyan-50/50'
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {hasChildren && onToggleCollapse && (
            <NodeExpandCollapseButton
              isCollapsed={isCollapsed}
              hasChildren={hasChildren}
              path={nodePath}
              onToggleCollapse={onToggleCollapse}
              className="flex-shrink-0"
            />
          )}
          <div className="text-sm font-semibold text-cyan-900 flex-1">{label}</div>
        </div>
        
        {!isCollapsed && tagCount > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, idx) => (
              <Badge 
                key={idx}
                variant="outline" 
                className="text-xs px-2 bg-cyan-100 text-cyan-800 border-cyan-300"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
        
        {isCollapsed && tagCount > 0 && (
          <div className="text-xs text-slate-400">
            {tagCount} tag{tagCount > 1 ? 's' : ''} collapsed
          </div>
        )}
      </div>
    </BaseNodeContainer>
  );
});

MethodTagsNode.displayName = 'MethodTagsNode';
