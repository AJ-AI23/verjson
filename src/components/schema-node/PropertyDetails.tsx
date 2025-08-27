
import React, { memo } from 'react';
import { SchemaTypeBadge } from './SchemaTypeBadge';

interface PropertyDetail {
  name: string;
  type: string;
  required?: boolean;
  format?: string;
  description?: string;
  reference?: string;
}

interface PropertyDetailsProps {
  propertyDetails: PropertyDetail[];
  isGrouped?: boolean;
  nodeId?: string;
  onExpandProperty?: (propName: string) => void;
}

export const PropertyDetails = memo(({ 
  propertyDetails, 
  isGrouped = false, 
  nodeId, 
  onExpandProperty 
}: PropertyDetailsProps) => {
  if (!propertyDetails || propertyDetails.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 border-t pt-2">
      <div className="text-xs font-medium mb-1">
        {isGrouped ? 'Grouped Properties:' : 'Properties:'}
      </div>
      <div className="grid gap-2">
        {propertyDetails.map((prop, index) => (
          <div 
            key={index} 
            className={`flex items-start gap-1 text-xs ${
              isGrouped && onExpandProperty ? 'cursor-pointer hover:bg-accent/50 p-1 rounded' : ''
            }`}
            onClick={isGrouped && onExpandProperty ? () => onExpandProperty(prop.name) : undefined}
            title={isGrouped ? `Click to expand ${prop.name} individually` : prop.description}
          >
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <span className="font-medium">{prop.name}</span>
                {prop.required && (
                  <span className="text-[10px] text-blue-600">*</span>
                )}
                {isGrouped && (
                  <span className="text-[10px] text-muted-foreground ml-1">↗</span>
                )}
              </div>
              {prop.description && !isGrouped && (
                <p className="text-slate-500 text-[10px] break-words leading-relaxed" title={prop.description}>
                  {prop.description}
                </p>
              )}
            </div>
            <SchemaTypeBadge type={prop.type} format={prop.format} isSmall />
          </div>
        ))}
      </div>
      {isGrouped && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          Click any property to expand it individually
        </div>
      )}
    </div>
  );
});

PropertyDetails.displayName = 'PropertyDetails';
