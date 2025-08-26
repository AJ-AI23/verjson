import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';

interface InfoProperty {
  name: string;
  value: string;
  type: string;
}

interface InfoNodeProps {
  data: {
    title: string;
    version: string;
    description?: string;
    properties: InfoProperty[];
  };
  id: string;
  isConnectable: boolean;
}

export const InfoNode = memo(({ data, isConnectable }: InfoNodeProps) => {
  const { title, version, description, properties } = data;

  return (
    <div className={cn(
      'px-3 py-2 rounded-md shadow-sm border min-w-[200px] max-w-[280px]',
      'bg-blue-50 border-blue-200'
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="custom-handle"
        isConnectable={isConnectable}
      />
      
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-blue-600">v{version}</div>
          {description && (
            <div className="text-xs text-slate-600 line-clamp-2" title={description}>
              {description}
            </div>
          )}
        </div>
        
        {properties.length > 0 && (
          <div className="border-t pt-2">
            <div className="text-xs font-medium mb-1">Info Properties:</div>
            <div className="grid gap-1">
              {properties.slice(0, 4).map((prop, index) => (
                <div key={index} className="flex flex-col gap-0.5 text-xs">
                  <span className="font-medium text-slate-600">{prop.name}:</span>
                  <span className="text-slate-500 break-words leading-tight" title={prop.value}>
                    {prop.value}
                  </span>
                </div>
              ))}
              {properties.length > 4 && (
                <div className="text-xs text-slate-400">
                  +{properties.length - 4} more properties
                </div>
              )}
            </div>
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

InfoNode.displayName = 'InfoNode';