import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ResponseNodeProps {
  data: {
    statusCode: string;
    description?: string;
    schema?: any;
    label: string;
  };
  id: string;
  isConnectable: boolean;
}

export const ResponseNode = memo(({ data, isConnectable }: ResponseNodeProps) => {
  const { statusCode, description } = data;

  const getStatusColor = (code: string) => {
    const statusNum = parseInt(code);
    if (statusNum >= 200 && statusNum < 300) {
      return 'bg-green-100 text-green-800 border-green-200';
    } else if (statusNum >= 300 && statusNum < 400) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    } else if (statusNum >= 400 && statusNum < 500) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    } else if (statusNum >= 500) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className={cn(
      'px-3 py-2 rounded-md shadow-sm border min-w-[120px] max-w-[200px]',
      'bg-slate-50 border-slate-200'
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="custom-handle"
        isConnectable={isConnectable}
      />
      
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <Badge 
            variant="outline" 
            className={cn('text-xs px-2 w-fit', getStatusColor(statusCode))}
          >
            {statusCode}
          </Badge>
          <span className="text-xs font-medium text-slate-700">Response</span>
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

ResponseNode.displayName = 'ResponseNode';