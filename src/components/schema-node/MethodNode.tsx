import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NodeNotations } from './NodeNotations';
import { NodeExpandCollapseButton } from './NodeExpandCollapseButton';
import { NotationComment } from '@/types/notations';
import { BaseNodeContainer } from './BaseNodeContainer';

export interface MethodNodeProps {
  data: {
    path: string;
    method: string;
    summary?: string;
    description?: string;
    requestBody?: any;
    responses?: Record<string, any>;
    label: string;
    notations?: NotationComment[];
    notationCount?: number;
    hasNotations?: boolean;
    hasMoreLevels?: boolean;
    isCollapsed?: boolean;
    nodePath?: string;
  };
  id: string;
  isConnectable: boolean;
  selected?: boolean;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const MethodNode = memo(({ data, isConnectable, id, selected, onAddNotation, onToggleCollapse }: MethodNodeProps) => {
  const { path, method, summary, description, label, notations = [], notationCount = 0, hasNotations = false, hasMoreLevels = false, isCollapsed = false, nodePath } = data;

  // Determine if node has children (responses, request body, etc.)
  const hasChildren = hasMoreLevels || !!data.requestBody || (data.responses && Object.keys(data.responses).length > 0);
  const collapsePath = nodePath || id;

  const getMethodColor = (method: string) => {
    const colors = {
      get: 'bg-green-100 text-green-800 border-green-200',
      post: 'bg-blue-100 text-blue-800 border-blue-200',
      put: 'bg-orange-100 text-orange-800 border-orange-200',
      patch: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      delete: 'bg-red-100 text-red-800 border-red-200',
      head: 'bg-purple-100 text-purple-800 border-purple-200',
      options: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[method.toLowerCase() as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <BaseNodeContainer
      id={id}
      isConnectable={isConnectable}
      selected={selected}
      className={cn(
        'px-3 py-2 rounded-md shadow-sm border min-w-[160px] max-w-[240px]',
        'bg-slate-50 border-slate-200',
        isCollapsed && 'border-dashed bg-slate-50/50',
        hasNotations && 'border-l-2 border-l-amber-400'
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            {hasChildren && onToggleCollapse && (
              <NodeExpandCollapseButton
                isCollapsed={isCollapsed}
                hasChildren={hasChildren}
                path={collapsePath}
                onToggleCollapse={onToggleCollapse}
                className="flex-shrink-0"
              />
            )}
            <Badge 
              variant="outline" 
              className={cn('text-xs px-2 w-fit', getMethodColor(method))}
            >
              {method.toUpperCase()}
            </Badge>
            <NodeNotations
              notations={notations}
              notationCount={notationCount}
              hasNotations={hasNotations}
              onAddNotation={onAddNotation ? (user, message) => onAddNotation(id, user, message) : undefined}
            />
          </div>
          <div className="text-sm font-semibold text-slate-900">
            {path}
          </div>
        </div>
        
        {!isCollapsed && summary && (
          <div className="text-xs text-slate-600 line-clamp-2" title={summary}>
            {summary}
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

MethodNode.displayName = 'MethodNode';
