import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface RequestBodyNodeProps {
  data: {
    description?: string;
    required?: boolean;
    schema?: any;
    label: string;
  };
  id: string;
  isConnectable: boolean;
}

export const RequestBodyNode = memo(({ data, isConnectable }: RequestBodyNodeProps) => {
  const { description, required, label } = data;

  return (
    <div className={cn(
      'px-3 py-2 rounded-md shadow-sm border min-w-[120px] max-w-[200px]',
      'bg-amber-50 border-amber-200'
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="custom-handle"
        isConnectable={isConnectable}
      />
      
      <div className="flex flex-col gap-2">
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