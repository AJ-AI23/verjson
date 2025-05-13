
import React, { memo } from 'react';

interface NodeMetaInfoProps {
  properties?: number;
  minItems?: number;
  maxItems?: number;
  isGroup?: boolean;
  required?: boolean;
}

export const NodeMetaInfo = memo(({ 
  properties, 
  minItems, 
  maxItems,
  isGroup,
  required
}: NodeMetaInfoProps) => {
  return (
    <>
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
    </>
  );
});

NodeMetaInfo.displayName = 'NodeMetaInfo';
