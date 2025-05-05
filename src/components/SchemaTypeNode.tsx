
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SchemaTypeNodeProps {
  data: {
    label: string;
    type: string;
    description?: string;
    required?: boolean;
    format?: string;
    properties?: number;
    minItems?: number;
    maxItems?: number;
    isRoot?: boolean;
    reference?: string;
  };
  id: string;
  isConnectable: boolean;
}

export const SchemaTypeNode = memo(({ data, isConnectable, id }: SchemaTypeNodeProps) => {
  const {
    label,
    type,
    description,
    required,
    format,
    properties,
    minItems,
    maxItems,
    isRoot,
    reference,
  } = data;

  return (
    <div
      className={cn(
        'px-3 py-2 rounded-md shadow-sm border min-w-[160px] max-w-[240px]',
        `node-${type}`,
        required && 'node-required',
        isRoot && 'border-2 border-blue-500 bg-blue-50'
      )}
    >
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Top}
          className="custom-handle"
          isConnectable={isConnectable}
        />
      )}
      
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm truncate" title={label}>
            {label}
          </span>
          <Badge variant="outline" className={cn(
            'text-xs px-2',
            type === 'string' && 'bg-blue-100 text-blue-800 border-blue-200',
            type === 'number' && 'bg-green-100 text-green-800 border-green-200',
            type === 'integer' && 'bg-green-100 text-green-800 border-green-200',
            type === 'boolean' && 'bg-purple-100 text-purple-800 border-purple-200',
            type === 'array' && 'bg-amber-100 text-amber-800 border-amber-200',
            type === 'object' && 'bg-slate-100 text-slate-800 border-slate-200',
            type === 'reference' && 'bg-pink-100 text-pink-800 border-pink-200',
          )}>
            {type}
          </Badge>
        </div>
        
        {description && (
          <p className="text-xs text-slate-500 truncate" title={description}>
            {description}
          </p>
        )}

        {format && (
          <div className="text-xs">
            <span className="text-slate-500">format:</span> {format}
          </div>
        )}

        {reference && (
          <div className="text-xs">
            <span className="text-slate-500">$ref:</span>{' '}
            <span className="font-mono text-[10px] truncate" title={reference}>
              {reference}
            </span>
          </div>
        )}

        {properties !== undefined && (
          <div className="text-xs">
            <span className="text-slate-500">properties:</span> {properties}
          </div>
        )}

        {(minItems !== undefined || maxItems !== undefined) && (
          <div className="text-xs">
            <span className="text-slate-500">items:</span>{' '}
            {minItems !== undefined ? minItems : '0'} 
            {maxItems !== undefined ? ` - ${maxItems}` : '+'}
          </div>
        )}

        {required && (
          <div className="text-xs font-medium text-blue-600">Required</div>
        )}
      </div>

      {(type === 'object' || type === 'array' || type === 'reference') && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="custom-handle"
          isConnectable={isConnectable}
        />
      )}
    </div>
  );
});

SchemaTypeNode.displayName = 'SchemaTypeNode';
