
import React, { memo } from 'react';

interface NodeMetaInfoProps {
  properties?: number;
  minItems?: number;
  maxItems?: number;
  isGroup?: boolean;
  isGrouped?: boolean;
  required?: boolean;
}

export const NodeMetaInfo = memo(({ 
  properties, 
  minItems, 
  maxItems, 
  isGroup, 
  isGrouped,
  required 
}: NodeMetaInfoProps) => {
  const showMeta = Boolean(
    properties || 
    (minItems !== undefined && minItems !== null) || 
    (maxItems !== undefined && maxItems !== null) || 
    required || 
    isGroup || 
    isGrouped
  );

  if (!showMeta) {
    return null;
  }

  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-2 text-xs">
        {required && (
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-medium">
            Required
          </span>
        )}
        
        {(isGroup || isGrouped) && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            isGrouped 
              ? 'bg-orange-100 text-orange-800'
              : 'bg-slate-100 text-slate-800'
          }`}>
            {isGrouped ? 'Grouped' : 'Group'}
          </span>
        )}
        
        {properties && (
          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-medium">
            {properties} properties
          </span>
        )}
        
        {(minItems !== undefined && minItems !== null) && (
          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px] font-medium">
            min: {minItems}
          </span>
        )}
        
        {(maxItems !== undefined && maxItems !== null) && (
          <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-[10px] font-medium">
            max: {maxItems}
          </span>
        )}
      </div>
    </div>
  );
});

NodeMetaInfo.displayName = 'NodeMetaInfo';
