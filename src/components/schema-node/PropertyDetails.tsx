
import React, { memo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SchemaTypeBadge } from './SchemaTypeBadge';
import { cn } from '@/lib/utils';

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
  defaultExpanded?: boolean;
}

export const PropertyDetails = memo(({ 
  propertyDetails, 
  isGrouped = false, 
  nodeId, 
  onExpandProperty,
  defaultExpanded = false
}: PropertyDetailsProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!propertyDetails || propertyDetails.length === 0) {
    return null;
  }

  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="mt-2 border-t pt-2">
      {/* Header with expand/collapse control */}
      <button
        onClick={toggleExpanded}
        className={cn(
          "flex items-center gap-1 text-xs font-medium mb-1 w-full",
          "hover:bg-accent/50 rounded px-1 py-0.5 transition-colors",
          "text-left cursor-pointer"
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        )}
        <span>{isGrouped ? 'Grouped Properties' : 'Properties'}</span>
        <span className="text-muted-foreground ml-1">({propertyDetails.length})</span>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <>
          {isGrouped ? (
            // Bullet point list for grouped properties
            <div className="space-y-1">
              {propertyDetails.slice(0, 20).map((prop, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 p-1 rounded"
                  onClick={onExpandProperty ? () => onExpandProperty(prop.name) : undefined}
                  title={`Click to expand ${prop.name} individually`}
                >
                  <span className="text-muted-foreground">•</span>
                  <span className="font-medium flex-1">{prop.name}</span>
                  {prop.required && (
                    <span className="text-[10px] text-blue-600">*</span>
                  )}
                  <SchemaTypeBadge type={prop.type} format={prop.format} isSmall />
                </div>
              ))}
              {propertyDetails.length > 20 && (
                <div className="text-xs text-muted-foreground italic pl-3">
                  ... and {propertyDetails.length - 20} more properties
                </div>
              )}
            </div>
          ) : (
            // Original grid layout for non-grouped properties
            <div className="grid gap-2">
              {propertyDetails.map((prop, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-1 text-xs"
                  title={prop.description}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{prop.name}</span>
                      {prop.required && (
                        <span className="text-[10px] text-blue-600">*</span>
                      )}
                    </div>
                    {prop.description && (
                      <p className="text-slate-500 text-[10px] break-words leading-relaxed" title={prop.description}>
                        {prop.description}
                      </p>
                    )}
                  </div>
                  <SchemaTypeBadge type={prop.type} format={prop.format} isSmall />
                </div>
              ))}
            </div>
          )}
          {isGrouped && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              Click any property to expand it individually
            </div>
          )}
        </>
      )}
    </div>
  );
});

PropertyDetails.displayName = 'PropertyDetails';
