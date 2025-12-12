import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface MethodTagsNodeProps {
  data: {
    label: string;
    tags: string[];
    tagCount: number;
  };
  id: string;
  isConnectable: boolean;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const MethodTagsNode = memo(({ data, isConnectable, onToggleCollapse }: MethodTagsNodeProps) => {
  const { label, tags = [], tagCount } = data;

  return (
    <div className={cn(
      'px-3 py-2 rounded-md shadow-sm border min-w-[160px] max-w-[240px]',
      'bg-cyan-50 border-cyan-200'
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="custom-handle"
        isConnectable={isConnectable}
      />
      
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold text-cyan-900">{label}</div>
        
        {tagCount > 0 && (
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

MethodTagsNode.displayName = 'MethodTagsNode';
