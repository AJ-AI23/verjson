
import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SchemaTypeBadgeProps {
  type: string;
  format?: string;
  isSmall?: boolean;
}

export const SchemaTypeBadge = memo(({ type, format, isSmall = false }: SchemaTypeBadgeProps) => {
  // Generate badge classes based on type
  const typeBadgeClasses = cn(
    isSmall ? 'text-[9px] py-0 px-1 h-4' : 'text-xs px-2',
    type === 'string' && 'bg-blue-100 text-blue-800 border-blue-200',
    type === 'number' && 'bg-green-100 text-green-800 border-green-200',
    type === 'integer' && 'bg-green-100 text-green-800 border-green-200',
    type === 'boolean' && 'bg-purple-100 text-purple-800 border-purple-200',
    type === 'array' && 'bg-amber-100 text-amber-800 border-amber-200',
    type === 'object' && 'bg-slate-100 text-slate-800 border-slate-200',
    type === 'reference' && 'bg-pink-100 text-pink-800 border-pink-200',
    type === 'openapi' && 'bg-indigo-100 text-indigo-800 border-indigo-200',
    type === 'info' && 'bg-blue-100 text-blue-800 border-blue-200',
    type === 'endpoint' && 'bg-indigo-100 text-indigo-800 border-indigo-200',
    type === 'method' && 'bg-violet-100 text-violet-800 border-violet-200',
    type === 'response' && 'bg-green-100 text-green-800 border-green-200',
    type === 'requestBody' && 'bg-amber-100 text-amber-800 border-amber-200',
    type === 'components' && 'bg-emerald-100 text-emerald-800 border-emerald-200',
  );

  return (
    <Badge variant="outline" className={typeBadgeClasses}>
      {type}
      {format && `:${format}`}
    </Badge>
  );
});

SchemaTypeBadge.displayName = 'SchemaTypeBadge';
