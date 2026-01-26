import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { NodeNotations } from './NodeNotations';
import { NotationComment } from '@/types/notations';
import { BaseNodeContainer } from './BaseNodeContainer';

interface ComponentSchema {
  name: string;
  type: string;
  description?: string;
  propertiesCount: number;
}

export interface ComponentsNodeProps {
  data: {
    schemasCount: number;
    schemas: ComponentSchema[];
    notations?: NotationComment[];
    notationCount?: number;
    hasNotations?: boolean;
    hasMoreLevels?: boolean;
    isCollapsed?: boolean;
    nodePath?: string;
    hasCollapsibleContent?: boolean;
  };
  id: string;
  isConnectable: boolean;
  selected?: boolean;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const ComponentsNode = memo(({ data, isConnectable, id, selected, onAddNotation, onToggleCollapse }: ComponentsNodeProps) => {
  const { schemasCount, schemas = [], notations = [], notationCount = 0, hasNotations = false, hasMoreLevels = false, isCollapsed = false, nodePath: dataNodePath, hasCollapsibleContent } = data;

  // Determine if node has children
  const hasChildren = hasCollapsibleContent || hasMoreLevels || schemas.length > 0;
  const nodePath = dataNodePath || 'root.components';

  return (
    <BaseNodeContainer
      id={id}
      isConnectable={isConnectable}
      selected={selected}
      className={cn(
        'px-3 py-2 rounded-md shadow-sm border min-w-[200px] max-w-[280px]',
        'bg-emerald-50 border-emerald-200',
        hasMoreLevels && 'border-2 border-dashed',
        isCollapsed && 'border-dashed bg-emerald-50/50',
        hasNotations && 'border-l-2 border-l-amber-400'
      )}
      // Pass expand/collapse props to BaseNodeContainer
      nodePath={nodePath}
      isCollapsed={isCollapsed}
      hasChildren={hasChildren}
      onToggleCollapse={onToggleCollapse}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-900 flex-1">Components</div>
            <NodeNotations
              notations={notations}
              notationCount={notationCount}
              hasNotations={hasNotations}
              onAddNotation={onAddNotation ? (user, message) => onAddNotation(id, user, message) : undefined}
            />
          </div>
          <div className="text-xs text-emerald-600">{schemasCount} schemas</div>
        </div>
        
        {!isCollapsed && schemas.length > 0 && (
          <div className="border-t pt-2">
            <div className="text-xs font-medium mb-1">Schema Components:</div>
            <div className="grid gap-1">
              {schemas.slice(0, 5).map((schema, index) => (
                <div key={index} className="flex items-start gap-1 text-xs">
                  <span className="font-medium text-slate-600 min-w-0 flex-shrink-0">{schema.name}</span>
                  <span className="text-slate-500 text-[10px]">
                    ({schema.type}, {schema.propertiesCount} props)
                  </span>
                </div>
              ))}
              {schemas.length > 5 && (
                <div className="text-xs text-slate-400">
                  +{schemas.length - 5} more schemas
                </div>
              )}
            </div>
          </div>
        )}
        
        {isCollapsed && schemas.length > 0 && (
          <div className="text-xs text-slate-400">
            {schemas.length} schema{schemas.length > 1 ? 's' : ''} collapsed
          </div>
        )}
      </div>
    </BaseNodeContainer>
  );
});

ComponentsNode.displayName = 'ComponentsNode';
