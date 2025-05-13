
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
}

export const PropertyDetails = memo(({ propertyDetails }: PropertyDetailsProps) => {
  if (!propertyDetails || propertyDetails.length === 0) {
    return null;
  }

  return (
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
            <SchemaTypeBadge type={prop.type} format={prop.format} isSmall />
          </div>
        ))}
      </div>
    </div>
  );
});

PropertyDetails.displayName = 'PropertyDetails';
