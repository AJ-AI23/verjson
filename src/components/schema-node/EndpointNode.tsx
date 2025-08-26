import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NodeNotations } from './NodeNotations';
import { NotationComment } from '@/types/notations';

interface EndpointMethod {
  method: string;
  summary?: string;
  description?: string;
  requestBody?: any;
  responses?: Record<string, any>;
}

interface EndpointNodeProps {
  data: {
    path: string;
    methods: EndpointMethod[];
    label?: string;
    notations?: NotationComment[];
    notationCount?: number;
    hasNotations?: boolean;
  };
  id: string;
  isConnectable: boolean;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
}

export const EndpointNode = memo(({ data, isConnectable, id, onAddNotation }: EndpointNodeProps) => {
  const { path, methods, label, notations = [], notationCount = 0, hasNotations = false } = data;

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
    <div className={cn(
      'px-3 py-2 rounded-md shadow-sm border min-w-[200px] max-w-[300px]',
      'bg-indigo-50 border-indigo-200',
      hasNotations && 'border-l-2 border-l-amber-400'
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="custom-handle"
        isConnectable={isConnectable}
      />
      
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">
              {path}
            </div>
            <NodeNotations
              notations={notations}
              notationCount={notationCount}
              hasNotations={hasNotations}
              onAddNotation={onAddNotation ? (user, message) => onAddNotation(id, user, message) : undefined}
            />
          </div>
          <div className="text-xs text-slate-600">
            {methods.length === 1 ? 'API Endpoint' : `${methods.length} Methods`}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1">
          {methods.map((methodData, index) => (
            <Badge 
              key={index}
              variant="outline" 
              className={cn('text-xs px-2', getMethodColor(methodData.method))}
            >
              {methodData.method.toUpperCase()}
            </Badge>
          ))}
        </div>

        {methods.length === 1 && methods[0].summary && (
          <div className="text-xs text-slate-600 truncate" title={methods[0].summary}>
            {methods[0].summary}
          </div>
        )}
        
        {methods.length > 1 && (
          <div className="text-xs text-slate-600">
            Multiple operations available
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

EndpointNode.displayName = 'EndpointNode';