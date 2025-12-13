import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NodeNotations } from './NodeNotations';
import { NodeExpandCollapseButton } from './NodeExpandCollapseButton';
import { NotationComment } from '@/types/notations';

export interface ContentTypeNodeProps {
  data: {
    contentType?: string;
    contentTypes?: string[];
    isConsolidated?: boolean;
    description?: string;
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
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const ContentTypeNode = memo(({ data, isConnectable, id, onAddNotation, onToggleCollapse }: ContentTypeNodeProps) => {
  const { contentType, contentTypes, isConsolidated, description, notations = [], notationCount = 0, hasNotations = false, hasMoreLevels = false, isCollapsed = false, path } = data;

  // Determine if node has children
  const hasChildren = hasMoreLevels || !!data.schema;
  const nodePath = path || id;

  const getContentTypeColor = (type: string) => {
    if (type.includes('json')) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    } else if (type.includes('xml')) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    } else if (type.includes('text')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className={cn(
      'px-3 py-2 rounded-md shadow-sm min-w-[120px] max-w-[250px]',
      'bg-slate-50 border-slate-200',
      hasMoreLevels ? 'border-2 border-dashed' : 'border',
      isCollapsed && 'border-dashed bg-slate-50/50',
      hasNotations && 'border-l-2 border-l-amber-400'
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="custom-handle"
        isConnectable={isConnectable}
      />
      
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
          {isConsolidated ? (
            // Consolidated view showing multiple content types
            <div className="flex flex-col gap-1 flex-1">
              <div className="flex flex-wrap gap-1">
                {contentTypes?.map((type) => (
                  <Badge 
                    key={type}
                    variant="outline" 
                    className={cn('text-xs px-2', getContentTypeColor(type))}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
              <span className="text-xs font-medium text-slate-700">
                {contentTypes?.length === 1 ? 'Content Type' : 'Content Types'}
              </span>
            </div>
          ) : (
            // Individual content type view
            <div className="flex flex-col gap-1 flex-1">
              <Badge 
                variant="outline" 
                className={cn('text-xs px-2 w-fit', getContentTypeColor(contentType!))}
              >
                {contentType}
              </Badge>
              <span className="text-xs font-medium text-slate-700">Content Type</span>
            </div>
          )}
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

      <Handle
        type="source"
        position={Position.Bottom}
        className="custom-handle"
        isConnectable={isConnectable}
      />
    </div>
  );
});

ContentTypeNode.displayName = 'ContentTypeNode';
