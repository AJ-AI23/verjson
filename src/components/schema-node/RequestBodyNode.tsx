import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NodeNotations } from './NodeNotations';
import { NodeExpandCollapseButton } from './NodeExpandCollapseButton';
import { NotationComment } from '@/types/notations';
import { BaseNodeContainer } from './BaseNodeContainer';

export interface RequestBodyNodeProps {
  data: {
    description?: string;
    required?: boolean;
    schema?: any;
    label: string;
    notations?: NotationComment[];
    notationCount?: number;
    hasNotations?: boolean;
    hasMoreLevels?: boolean;
    isCollapsed?: boolean;
    path?: string;
  };
  id: string;
  isConnectable: boolean;
  selected?: boolean;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const RequestBodyNode = memo(({ data, isConnectable, id, selected, onAddNotation, onToggleCollapse }: RequestBodyNodeProps) => {
  const { description, required, label, notations = [], notationCount = 0, hasNotations = false, hasMoreLevels = false, isCollapsed = false, path } = data;

  // Determine if node has children
  const hasChildren = hasMoreLevels || !!data.schema;
  const nodePath = path || id;

  return (
    <BaseNodeContainer
      id={id}
      isConnectable={isConnectable}
      selected={selected}
      className={cn(
        'px-3 py-2 rounded-md shadow-sm border min-w-[120px] max-w-[200px]',
        'bg-amber-50 border-amber-200',
        isCollapsed && 'border-dashed bg-amber-50/50',
        hasNotations && 'border-l-2 border-l-amber-400'
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
          <div className="flex items-center gap-2 flex-1">
            <Badge variant="outline" className="text-xs px-2 bg-amber-100 text-amber-800 border-amber-200">
              Request Body
            </Badge>
            {required && (
              <Badge variant="outline" className="text-xs px-1 bg-red-100 text-red-800 border-red-200">
                Required
              </Badge>
            )}
          </div>
          <NodeNotations
            notations={notations}
            notationCount={notationCount}
            hasNotations={hasNotations}
            onAddNotation={onAddNotation ? (user, message) => onAddNotation(id, user, message) : undefined}
          />
        </div>
        
        {!isCollapsed && description && (
          <div className="text-xs text-slate-600 line-clamp-2" title={description}>
            {description}
          </div>
        )}
        
        {isCollapsed && (
          <div className="text-xs text-slate-400">
            Content collapsed
          </div>
        )}
      </div>
    </BaseNodeContainer>
  );
});

RequestBodyNode.displayName = 'RequestBodyNode';
