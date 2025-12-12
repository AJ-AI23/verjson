import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NodeNotations } from './NodeNotations';
import { NotationComment } from '@/types/notations';

export interface ResponseNodeProps {
  data: {
    statusCode?: string;
    statusCodes?: string[];
    responses?: Record<string, any>;
    isConsolidated?: boolean;
    description?: string;
    schema?: any;
    label: string;
    notations?: NotationComment[];
    notationCount?: number;
    hasNotations?: boolean;
    hasMoreLevels?: boolean;
  };
  id: string;
  isConnectable: boolean;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const ResponseNode = memo(({ data, isConnectable, id, onAddNotation, onToggleCollapse }: ResponseNodeProps) => {
  const { statusCode, statusCodes, responses, isConsolidated, description, notations = [], notationCount = 0, hasNotations = false, hasMoreLevels = false } = data;

  const getStatusColor = (code: string) => {
    const statusNum = parseInt(code);
    if (statusNum >= 200 && statusNum < 300) {
      return 'bg-green-100 text-green-800 border-green-200';
    } else if (statusNum >= 300 && statusNum < 400) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    } else if (statusNum >= 400 && statusNum < 500) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    } else if (statusNum >= 500) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className={cn(
      'px-3 py-2 rounded-md shadow-sm min-w-[120px] max-w-[200px]',
      'bg-slate-50 border-slate-200',
      hasMoreLevels ? 'border-2 border-dashed' : 'border',
      hasNotations && 'border-l-2 border-l-amber-400'
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="custom-handle"
        isConnectable={isConnectable}
      />
      
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {isConsolidated ? (
            // Consolidated view showing multiple response codes
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap gap-1">
                {statusCodes?.map((code) => (
                  <Badge 
                    key={code}
                    variant="outline" 
                    className={cn('text-xs px-2', getStatusColor(code))}
                  >
                    {code}
                  </Badge>
                ))}
              </div>
              <span className="text-xs font-medium text-slate-700">
                {statusCodes?.length === 1 ? 'Response' : 'Responses'}
              </span>
            </div>
          ) : (
            // Individual response view
            <div className="flex flex-col gap-1">
              <Badge 
                variant="outline" 
                className={cn('text-xs px-2 w-fit', getStatusColor(statusCode!))}
              >
                {statusCode}
              </Badge>
              <span className="text-xs font-medium text-slate-700">Response</span>
            </div>
          )}
          <NodeNotations
            notations={notations}
            notationCount={notationCount}
            hasNotations={hasNotations}
            onAddNotation={onAddNotation ? (user, message) => onAddNotation(id, user, message) : undefined}
          />
        </div>
        
        {description && (
          <div className="text-xs text-slate-600 line-clamp-2" title={description}>
            {description}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="custom-handle"
        isConnectable={isConnectable}
      />
    </div>
  );
});

ResponseNode.displayName = 'ResponseNode';