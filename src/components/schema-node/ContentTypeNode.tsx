import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NodeNotations } from './NodeNotations';
import { NotationComment } from '@/types/notations';

interface ContentTypeNodeProps {
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
  };
  id: string;
  isConnectable: boolean;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
}

export const ContentTypeNode = memo(({ data, isConnectable, id, onAddNotation }: ContentTypeNodeProps) => {
  const { contentType, contentTypes, isConsolidated, description, notations = [], notationCount = 0, hasNotations = false, hasMoreLevels = false } = data;

  const getContentTypeColor = (type: string) => {
    if (type.includes('json')) {
      return 'bg-primary/10 text-primary border-primary/20';
    } else if (type.includes('xml')) {
      return 'bg-accent/10 text-accent-foreground border-accent/20';
    } else if (type.includes('text')) {
      return 'bg-secondary/10 text-secondary-foreground border-secondary/20';
    }
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <div className={cn(
      'px-3 py-2 rounded-md shadow-sm min-w-[120px] max-w-[250px]',
      'bg-card text-card-foreground border-border',
      hasMoreLevels ? 'border-2 border-dashed' : 'border',
      hasNotations && 'border-l-2 border-l-amber-400'
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="custom-handle"
        isConnectable={isConnectable}
      />
      
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {isConsolidated ? (
            // Consolidated view showing multiple content types
            <div className="flex flex-col gap-1">
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
              <span className="text-xs font-medium text-foreground">
                {contentTypes?.length === 1 ? 'Content Type' : 'Content Types'}
              </span>
            </div>
          ) : (
            // Individual content type view
            <div className="flex flex-col gap-1">
              <Badge 
                variant="outline" 
                className={cn('text-xs px-2 w-fit', getContentTypeColor(contentType!))}
              >
                {contentType}
              </Badge>
              <span className="text-xs font-medium text-foreground">Content Type</span>
            </div>
          )}
          <NodeNotations
            notations={notations}
            notationCount={notationCount}
            hasNotations={hasNotations}
            onAddNotation={onAddNotation ? (user, message) => onAddNotation(id, user, message) : undefined}
          />
        </div>
        
        {description && (
          <div className="text-xs text-muted-foreground line-clamp-2" title={description}>
            {description}
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
