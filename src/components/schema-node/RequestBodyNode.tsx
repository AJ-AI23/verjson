import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NodeNotations } from './NodeNotations';
import { NotationComment } from '@/types/notations';

export interface RequestBodyNodeProps {
  data: {
    description?: string;
    required?: boolean;
    schema?: any;
    label: string;
    notations?: NotationComment[];
    notationCount?: number;
    hasNotations?: boolean;
  };
  id: string;
  isConnectable: boolean;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const RequestBodyNode = memo(({ data, isConnectable, id, onAddNotation, onToggleCollapse }: RequestBodyNodeProps) => {
  const { description, required, label, notations = [], notationCount = 0, hasNotations = false } = data;

  return (
    <div className={cn(
      'px-3 py-2 rounded-md shadow-sm border min-w-[120px] max-w-[200px]',
      'bg-amber-50 border-amber-200',
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
          <div className="flex items-center gap-2">
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
        
        {description && (
          <div className="text-xs text-slate-600 line-clamp-2" title={description}>
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

RequestBodyNode.displayName = 'RequestBodyNode';