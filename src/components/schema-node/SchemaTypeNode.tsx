
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

        <NodeCollapseIndicator 
          hasMoreLevels={hasMoreLevels}
          isCollapsed={isCollapsed}
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
