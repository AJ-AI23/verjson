import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { NodeNotations } from './NodeNotations';
import { NodeExpandCollapseButton } from './NodeExpandCollapseButton';
import { NotationComment } from '@/types/notations';
import { BaseNodeContainer } from './BaseNodeContainer';

interface InfoProperty {
  name: string;
  value: string;
  type: string;
}

export interface InfoNodeProps {
  data: {
    title: string;
    version: string;
    description?: string;
    properties: InfoProperty[];
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

export const InfoNode = memo(({ data, isConnectable, id, selected, onAddNotation, onToggleCollapse }: InfoNodeProps) => {
  const { title, version, description, properties = [], notations = [], notationCount = 0, hasNotations = false, hasMoreLevels = false, isCollapsed = false, path } = data;

  // Add safety check for properties array
  const safeProperties = Array.isArray(properties) ? properties : [];
  
  // Determine if node has children
  const hasChildren = hasMoreLevels || safeProperties.length > 0;
  const nodePath = path || id;

  return (
    <BaseNodeContainer
      id={id}
      isConnectable={isConnectable}
      selected={selected}
      className={cn(
        'px-3 py-2 rounded-md shadow-sm border min-w-[200px] max-w-[280px]',
        'bg-blue-50 border-blue-200',
        hasMoreLevels && 'border-2 border-dashed',
        isCollapsed && 'border-dashed bg-blue-50/50',
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
                path={nodePath}
                onToggleCollapse={onToggleCollapse}
                className="flex-shrink-0"
              />
            )}
            <div className="text-sm font-semibold text-slate-900 flex-1">{title}</div>
            <NodeNotations
              notations={notations}
              notationCount={notationCount}
              hasNotations={hasNotations}
              onAddNotation={onAddNotation ? (user, message) => onAddNotation(id, user, message) : undefined}
            />
          </div>
          <div className="text-xs text-blue-600">v{version}</div>
          {description && (
            <div className="text-xs text-slate-600 line-clamp-2" title={description}>
              {description}
            </div>
          )}
        </div>
        
        {!isCollapsed && safeProperties.length > 0 && (
          <div className="border-t pt-2">
            <div className="text-xs font-medium mb-1">Info Properties:</div>
            <div className="grid gap-1">
              {safeProperties.slice(0, 4).map((prop, index) => (
                <div key={index} className="flex flex-col gap-0.5 text-xs">
                  <span className="font-medium text-slate-600">{prop.name}:</span>
                  <span className="text-slate-500 break-words leading-tight" title={prop.value}>
                    {prop.value}
                  </span>
                </div>
              ))}
              {safeProperties.length > 4 && (
                <div className="text-xs text-slate-400">
                  +{safeProperties.length - 4} more properties
                </div>
              )}
            </div>
          </div>
        )}
        
        {isCollapsed && safeProperties.length > 0 && (
          <div className="text-xs text-slate-400">
            {safeProperties.length} properties collapsed
          </div>
        )}
      </div>
    </BaseNodeContainer>
  );
});

InfoNode.displayName = 'InfoNode';
