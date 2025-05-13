
import React, { memo } from 'react';
import { SchemaTypeBadge } from './SchemaTypeBadge';

interface NodeHeaderProps {
  label: string;
  type: string;
  description?: string;
  format?: string;
  reference?: string;
}

export const NodeHeader = memo(({ 
  label,
  type,
  description,
  format,
  reference
}: NodeHeaderProps) => {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm truncate" title={label}>
          {label}
        </span>
        <SchemaTypeBadge type={type} />
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
    </>
  );
});

NodeHeader.displayName = 'NodeHeader';
