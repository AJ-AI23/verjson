import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NodeNotations } from './NodeNotations';
import { NodeExpandCollapseButton } from './NodeExpandCollapseButton';
import { NotationComment } from '@/types/notations';
import { BaseNodeContainer } from './BaseNodeContainer';

export interface ParametersNodeProps {
  data: {
    label: string;
    paramDetails: Array<{
      name: string;
      in: string;
      required: boolean;
      type: string;
      description?: string;
    }>;
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

export const ParametersNode = memo(({ data, isConnectable, id, selected, onAddNotation, onToggleCollapse }: ParametersNodeProps) => {
  const { label, paramDetails = [], notations = [], notationCount = 0, hasNotations = false, hasMoreLevels = false, isCollapsed = false, path } = data;

  // Determine if node has children
  const hasChildren = hasMoreLevels || paramDetails.length > 0;
  const nodePath = path || id;

  return (
    <BaseNodeContainer
      id={id}
      isConnectable={isConnectable}
      selected={selected}
      className={cn(
        'px-3 py-2 rounded-md shadow-sm border min-w-[200px] max-w-[280px]',
        'bg-purple-50 border-purple-200',
        isCollapsed && 'border-dashed bg-purple-50/50',
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
          <div className="text-sm font-semibold text-purple-900 flex-1">{label}</div>
          <NodeNotations
            notations={notations}
            notationCount={notationCount}
            hasNotations={hasNotations}
            onAddNotation={onAddNotation ? (user, message) => onAddNotation(id, user, message) : undefined}
          />
        </div>
        
        {!isCollapsed && paramDetails.length > 0 && (
          <ul className="text-xs text-purple-700 space-y-1">
            {paramDetails.map((param, idx) => (
              <li key={idx} className="flex items-start gap-1">
                <span className="flex-shrink-0">•</span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-medium">{param.name}</span>
                    <Badge variant="outline" className="text-xs px-1 bg-purple-100 text-purple-700 border-purple-300">
                      {param.in}
                    </Badge>
                    {param.required && (
                      <Badge variant="outline" className="text-xs px-1 bg-red-100 text-red-700 border-red-300">
                        required
                      </Badge>
                    )}
                    <span className="text-purple-600">({param.type})</span>
                  </div>
                  {param.description && (
                    <span className="text-xs text-purple-600 line-clamp-2 mt-0.5">{param.description}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        
        {isCollapsed && paramDetails.length > 0 && (
          <div className="text-xs text-slate-400">
            {paramDetails.length} parameter{paramDetails.length > 1 ? 's' : ''} collapsed
          </div>
        )}
      </div>
    </BaseNodeContainer>
  );
});

ParametersNode.displayName = 'ParametersNode';
