import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NodeNotations } from './NodeNotations';
import { NodeExpandCollapseButton } from './NodeExpandCollapseButton';
import { NotationComment } from '@/types/notations';
import { Shield } from 'lucide-react';

export interface SecurityNodeProps {
  data: {
    label: string;
    securityDetails: Array<{
      scheme: string;
      scopes: string[];
    }>;
    notations?: NotationComment[];
    notationCount?: number;
    hasNotations?: boolean;
    hasMoreLevels?: boolean;
    isCollapsed?: boolean;
    path?: string;
  };
  id: string;
  isConnectable: boolean;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const SecurityNode = memo(({ data, isConnectable, id, onAddNotation, onToggleCollapse }: SecurityNodeProps) => {
  const { label, securityDetails = [], notations = [], notationCount = 0, hasNotations = false, hasMoreLevels = false, isCollapsed = false, path } = data;

  // Determine if node has children
  const hasChildren = hasMoreLevels || securityDetails.length > 0;
  const nodePath = path || id;

  return (
    <div className={cn(
      'px-3 py-2 rounded-md shadow-sm border min-w-[200px] max-w-[280px]',
      'bg-amber-50 border-amber-200',
      isCollapsed && 'border-dashed bg-amber-50/50',
      hasNotations && 'border-l-2 border-l-amber-400'
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="custom-handle"
        isConnectable={isConnectable}
      />
      
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {hasChildren && onToggleCollapse && (
            <NodeExpandCollapseButton
              isCollapsed={isCollapsed}
              hasChildren={hasChildren}
              path={nodePath}
              onToggleCollapse={onToggleCollapse}
              className="flex-shrink-0"
            />
          )}
          <div className="flex items-center gap-1.5 flex-1">
            <Shield className="w-3.5 h-3.5 text-amber-700" />
            <div className="text-sm font-semibold text-amber-900">{label}</div>
          </div>
          <NodeNotations
            notations={notations}
            notationCount={notationCount}
            hasNotations={hasNotations}
            onAddNotation={onAddNotation ? (user, message) => onAddNotation(id, user, message) : undefined}
          />
        </div>
        
        {!isCollapsed && securityDetails.length > 0 && (
          <ul className="text-xs text-amber-700 space-y-2">
            {securityDetails.map((security, idx) => (
              <li key={idx} className="flex items-start gap-1">
                <span className="flex-shrink-0">•</span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{security.scheme}</span>
                  {security.scopes && security.scopes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {security.scopes.map((scope, scopeIdx) => (
                        <Badge 
                          key={scopeIdx}
                          variant="outline" 
                          className="text-xs px-1.5 bg-amber-100 text-amber-700 border-amber-300"
                        >
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        
        {isCollapsed && securityDetails.length > 0 && (
          <div className="text-xs text-slate-400">
            {securityDetails.length} security scheme{securityDetails.length > 1 ? 's' : ''} collapsed
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

SecurityNode.displayName = 'SecurityNode';
