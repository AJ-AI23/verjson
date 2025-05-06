
import React, { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface PropertyDetail {
  name: string;
  type: string;
  required?: boolean;
  format?: string;
  description?: string;
  reference?: string;
}

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
    isGroup?: boolean;
    reference?: string;
    propertyDetails?: PropertyDetail[];
    hasMoreLevels?: boolean;
    isCollapsed?: boolean;
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
    isGroup,
    reference,
    propertyDetails,
    hasMoreLevels,
    isCollapsed,
  } = data;

  // Memoize type badge classes to prevent recalculation
  const typeBadgeClasses = useMemo(() => {
    return cn(
      'text-xs px-2',
      type === 'string' && 'bg-blue-100 text-blue-800 border-blue-200',
      type === 'number' && 'bg-green-100 text-green-800 border-green-200',
      type === 'integer' && 'bg-green-100 text-green-800 border-green-200',
      type === 'boolean' && 'bg-purple-100 text-purple-800 border-purple-200',
      type === 'array' && 'bg-amber-100 text-amber-800 border-amber-200',
      type === 'object' && 'bg-slate-100 text-slate-800 border-slate-200',
      type === 'reference' && 'bg-pink-100 text-pink-800 border-pink-200',
    );
  }, [type]);

  // Memoize the node container classes to prevent recalculation
  const nodeContainerClasses = useMemo(() => {
    return cn(
      'px-3 py-2 rounded-md shadow-sm border min-w-[160px]',
      isGroup ? 'max-w-[380px]' : 'max-w-[240px]',
      `node-${type}`,
      required && 'node-required',
      isRoot && 'border-2 border-blue-500 bg-blue-50',
      isGroup && 'border-2 border-slate-300 bg-slate-50',
      isCollapsed && 'border-dashed bg-slate-50',
      hasMoreLevels && !isCollapsed && 'border-dashed'
    );
  }, [type, required, isRoot, isGroup, isCollapsed, hasMoreLevels]);

  return (
    <div className={nodeContainerClasses}>
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
          <Badge variant="outline" className={typeBadgeClasses}>
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

        {properties !== undefined && !isGroup && (
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

        {required && !isGroup && (
          <div className="text-xs font-medium text-blue-600">Required</div>
        )}
        
        {isGroup && propertyDetails && propertyDetails.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <div className="text-xs font-medium mb-1">Properties:</div>
            <div className="grid gap-2">
              {propertyDetails.map((prop, index) => (
                <div key={index} className="flex items-start gap-1 text-xs">
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{prop.name}</span>
                      {prop.required && (
                        <span className="text-[10px] text-blue-600">*</span>
                      )}
                    </div>
                    {prop.description && (
                      <p className="text-slate-500 text-[10px] truncate" title={prop.description}>
                        {prop.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-[9px] py-0 px-1 h-4", typeBadgeClasses)}>
                    {prop.type}
                    {prop.format && `:${prop.format}`}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasMoreLevels && !isCollapsed && (
          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
            <ChevronDown size={12} />
            <span>More levels not shown</span>
          </div>
        )}

        {isCollapsed && (
          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
            <ChevronRight size={12} />
            <span>Collapsed in editor</span>
          </div>
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
