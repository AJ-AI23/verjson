
import React, { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { NodeHeader } from './NodeHeader';
import { NodeMetaInfo } from './NodeMetaInfo';
import { PropertyDetails } from './PropertyDetails';
import { NodeCollapseIndicator } from './NodeCollapseIndicator';

interface PropertyDetail {
  name: string;
  type: string;
  required?: boolean;
  format?: string;
  description?: string;
  reference?: string;
}

interface AdditionalProperty {
  name: string;
  value: string;
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
    hasCollapsibleContent?: boolean;
    additionalProperties?: AdditionalProperty[];
    additionalPropsCount?: number;
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
    hasCollapsibleContent,
    additionalProperties,
    additionalPropsCount,
  } = data;

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
        <NodeHeader 
          label={label}
          type={type}
          description={description}
          format={format}
          reference={reference}
        />
        
        <NodeMetaInfo
          properties={properties}
          minItems={minItems}
          maxItems={maxItems}
          isGroup={isGroup}
          required={required}
        />
        
        {isGroup && propertyDetails && propertyDetails.length > 0 && (
          <PropertyDetails propertyDetails={propertyDetails} />
        )}

        {!isCollapsed && additionalProperties && additionalProperties.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <div className="text-xs font-medium mb-1">Additional Properties:</div>
            <div className="grid gap-1">
              {additionalProperties.map((prop, index) => (
                <div key={index} className="flex items-start gap-1 text-xs">
                  <span className="font-medium text-slate-600">{prop.name}:</span>
                  <span className="text-slate-500 truncate" title={prop.value}>
                    {prop.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <NodeCollapseIndicator 
          hasMoreLevels={hasMoreLevels}
          isCollapsed={isCollapsed}
          hasCollapsibleContent={hasCollapsibleContent}
          additionalPropsCount={additionalPropsCount}
        />
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
