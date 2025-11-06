import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NodeNotations } from './NodeNotations';
import { NotationComment } from '@/types/notations';

interface ParametersNodeProps {
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
  };
  id: string;
  isConnectable: boolean;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
}

export const ParametersNode = memo(({ data, isConnectable, id, onAddNotation }: ParametersNodeProps) => {
  const { label, paramDetails = [], notations = [], notationCount = 0, hasNotations = false } = data;

  return (
    <div className={cn(
      'px-3 py-2 rounded-md shadow-sm border min-w-[200px] max-w-[280px]',
      'bg-purple-50 border-purple-200',
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
          <div className="text-sm font-semibold text-purple-900">{label}</div>
          <NodeNotations
            notations={notations}
            notationCount={notationCount}
            hasNotations={hasNotations}
            onAddNotation={onAddNotation ? (user, message) => onAddNotation(id, user, message) : undefined}
          />
        </div>
        
        {paramDetails.length > 0 && (
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

ParametersNode.displayName = 'ParametersNode';
