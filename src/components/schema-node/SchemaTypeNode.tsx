
import React, { memo, useMemo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { NodeHeader } from './NodeHeader';
import { NodeMetaInfo } from './NodeMetaInfo';
import { PropertyDetails } from './PropertyDetails';
import { NodeCollapseIndicator } from './NodeCollapseIndicator';
import { NotationsIndicator } from './NotationsIndicator';
import { NotationsPanel } from './NotationsPanel';
import { NotationComment } from '@/types/notations';

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
    isGrouped?: boolean; // For grouped property nodes
    isGroupedProperties?: boolean; // Special flag for enhanced styling of grouped properties
    reference?: string;
    propertyDetails?: PropertyDetail[];
    hasMoreLevels?: boolean;
    isCollapsed?: boolean;
    hasCollapsibleContent?: boolean;
    additionalProperties?: AdditionalProperty[];
    additionalPropsCount?: number;
    notations?: NotationComment[];
    notationCount?: number;
    hasNotations?: boolean;
    path?: string; // For tracking paths in grouped nodes
  };
  id: string;
  isConnectable: boolean;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  expandedNotationPaths?: Set<string>;
}

export const SchemaTypeNode = memo(({ data, isConnectable, id, onAddNotation, expandedNotationPaths }: SchemaTypeNodeProps) => {
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
    isGrouped,
    reference,
    propertyDetails,
    hasMoreLevels,
    isCollapsed,
    hasCollapsibleContent,
    additionalProperties,
    additionalPropsCount,
    notations = [],
    notationCount = 0,
    hasNotations = false,
    path,
  } = data;

  const [isNotationsExpanded, setIsNotationsExpanded] = useState(false);

  // Check if this node's notations should be expanded based on JSON editor state
  const nodePath = id.startsWith('prop-') ? id.substring(5) : id;
  const shouldExpandFromEditor = expandedNotationPaths?.has(nodePath) || expandedNotationPaths?.has(id);
  
  // Update local state when external state changes
  useEffect(() => {
    if (shouldExpandFromEditor !== undefined) {
      setIsNotationsExpanded(shouldExpandFromEditor);
    }
  }, [shouldExpandFromEditor]);

  const handleAddNotation = (user: string, message: string) => {
    if (onAddNotation) {
      onAddNotation(id, user, message);
    }
  };

  // Memoize the node container classes to prevent recalculation
  const nodeContainerClasses = useMemo(() => {
    const isGroupedProperties = data.isGroupedProperties || type === 'grouped-properties';
    
    return cn(
      'px-3 py-2 rounded-md shadow-sm border min-w-[160px] w-fit',
      (isGroup || isGrouped || isGroupedProperties) ? 'max-w-[420px]' : 'max-w-[280px]',
      `node-${type}`,
      required && 'node-required',
      isRoot && 'border-2 border-blue-500 bg-blue-50',
      isGroup && 'border-2 border-slate-300 bg-slate-50',
      isGrouped && !isGroupedProperties && 'border-2 border-orange-300 bg-orange-50',
      // Enhanced styling for grouped properties - more distinct
      isGroupedProperties && 'border-2 border-purple-400 bg-gradient-to-br from-purple-50 to-indigo-50',
      isCollapsed && 'border-dashed bg-slate-50',
      hasMoreLevels && !isCollapsed && 'border-dashed',
      hasNotations && 'border-l-2 border-l-amber-400'
    );
  }, [type, required, isRoot, isGroup, isGrouped, data.isGroupedProperties, isCollapsed, hasMoreLevels, hasNotations]);

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
      
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <NodeHeader 
              label={label}
              type={type}
              description={description}
              format={format}
              reference={reference}
            />
          </div>
          {(hasNotations || onAddNotation) && (
            <div className="flex-shrink-0">
              <NotationsIndicator
                count={notationCount}
                isExpanded={isNotationsExpanded}
                onClick={() => setIsNotationsExpanded(!isNotationsExpanded)}
                hasAddFunction={!!onAddNotation}
              />
            </div>
          )}
        </div>
        
        <NodeMetaInfo
          properties={properties}
          minItems={minItems}
          maxItems={maxItems}
          isGroup={isGroup}
          isGrouped={isGrouped}
          required={required}
        />
        
        {/* Property details section */}
        {propertyDetails && propertyDetails.length > 0 && (
          <PropertyDetails 
            propertyDetails={propertyDetails} 
            isGrouped={isGrouped}
            nodeId={id}
            onExpandProperty={onAddNotation ? (propName: string) => {
              // When expanding a property from a grouped node, we need to trigger the expansion
              const groupedPath = path || id.replace('grouped-', '').replace('-properties', '');
              const expandPath = groupedPath === 'root' ? 
                'root.properties._grouped' : 
                `${groupedPath}._grouped`;
              onAddNotation(expandPath, 'expand', `Expand property ${propName}`);
            } : undefined}
          />
        )}

        {(hasNotations || onAddNotation) && (
          <NotationsPanel
            notations={notations}
            isExpanded={isNotationsExpanded}
            onAddNotation={onAddNotation ? handleAddNotation : undefined}
          />
        )}

        {!isCollapsed && additionalProperties && additionalProperties.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <div className="text-xs font-medium mb-1">Additional Properties:</div>
            <div className="grid gap-1">
              {additionalProperties.map((prop, index) => (
                <div key={index} className="flex items-start gap-1 text-xs">
                  <span className="font-medium text-slate-600">{prop.name}:</span>
                  <span className="text-slate-500 break-words" title={prop.value}>
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

      {(type === 'object' || type === 'array' || type === 'reference' || type === 'openapi' || type === 'info' || type === 'components' || type === 'endpoint' || type === 'method') && (
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
