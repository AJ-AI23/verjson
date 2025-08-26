
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
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm break-words flex-1" title={label}>
          {label}
        </span>
        <SchemaTypeBadge type={type} />
      </div>
      
      {description && (
        <p className="text-xs text-slate-500 break-words mt-1" title={description}>
          {description}
        </p>
      )}

      {format && (
        <div className="text-xs mt-1">
          <span className="text-slate-500">format:</span> <span className="break-words">{format}</span>
        </div>
      )}

      {reference && (
        <div className="text-xs mt-1">
          <span className="text-slate-500">$ref:</span>{' '}
          <span className="font-mono text-[10px] break-all" title={reference}>
            {reference}
          </span>
        </div>
      )}
    </>
  );
});

NodeHeader.displayName = 'NodeHeader';
