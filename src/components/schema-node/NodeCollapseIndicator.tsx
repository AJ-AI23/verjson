
import React, { memo } from 'react';
import { ChevronDown } from 'lucide-react';
import { PropertyDetails } from './PropertyDetails';

interface PropertyDetail {
  name: string;
  type: string;
  required?: boolean;
  format?: string;
  description?: string;
  reference?: string;
}

interface NodeCollapseIndicatorProps {
  hasMoreLevels?: boolean;
  isCollapsed?: boolean;
  hasCollapsibleContent?: boolean;
  additionalPropsCount?: number;
  collapsedPropertyDetails?: PropertyDetail[];
}

export const NodeCollapseIndicator = memo(({ 
  hasMoreLevels,
  isCollapsed,
  hasCollapsibleContent,
  additionalPropsCount = 0,
  collapsedPropertyDetails
}: NodeCollapseIndicatorProps) => {
  if (!hasMoreLevels && !isCollapsed && !hasCollapsibleContent && additionalPropsCount === 0) {
    return null;
  }
  
  return (
    <>
      {hasMoreLevels && !isCollapsed && (
        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
          <ChevronDown size={12} />
          <span>More levels not shown</span>
        </div>
      )}

      {isCollapsed && collapsedPropertyDetails && collapsedPropertyDetails.length > 0 && (
        <PropertyDetails 
          propertyDetails={collapsedPropertyDetails}
          isGrouped={true}
          defaultExpanded={false}
        />
      )}

      {(hasCollapsibleContent || additionalPropsCount > 0) && !isCollapsed && !hasMoreLevels && (
        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
          <ChevronDown size={12} />
          <span>
            Expandable
            {additionalPropsCount > 0 && ` (${additionalPropsCount})`}
          </span>
        </div>
      )}
    </>
  );
});

NodeCollapseIndicator.displayName = 'NodeCollapseIndicator';
