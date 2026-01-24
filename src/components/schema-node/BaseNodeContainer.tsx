import React, { memo, ReactNode } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useDebug } from '@/contexts/DebugContext';

export interface BaseNodeContainerProps {
  id: string;
  isConnectable: boolean;
  className?: string;
  children: ReactNode;
  /** Whether to show the target (top) handle. Default true. */
  showTargetHandle?: boolean;
  /** Whether to show the source (bottom) handle. Default true. */
  showSourceHandle?: boolean;
  /** Whether the node is currently selected in React Flow */
  selected?: boolean;
}

/**
 * Base container component for all diagram nodes.
 * Provides consistent layout, handles, and debug info display.
 * 
 * Note: Click events are handled by React Flow's onNodeClick.
 * This container should NOT have onClick handlers that stopPropagation,
 * as that would prevent node selection.
 */
export const BaseNodeContainer = memo(({ 
  id,
  isConnectable, 
  className,
  children,
  showTargetHandle = true,
  showSourceHandle = true,
  selected = false
}: BaseNodeContainerProps) => {
  const { showDiagramDebug } = useDebug();
  
  // Get measured dimensions from React Flow store
  const node = useStore((state) => state.nodeLookup.get(id));
  const measuredWidth = node?.measured?.width;
  const measuredHeight = node?.measured?.height;
  const nodeX = node?.position?.x ?? 0;
  const nodeY = node?.position?.y ?? 0;

  return (
    <div 
      className={cn(
        'relative',
        // Selection ring styling
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        className
      )}
      // Do NOT add onClick here - let React Flow handle node clicks
      // Adding onClick with stopPropagation would break node selection
    >
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className="custom-handle"
          isConnectable={isConnectable}
        />
      )}
      
      {children}

      {/* Debug info footer */}
      {showDiagramDebug && (
        <div className="mt-2 pt-2 border-t border-dashed border-muted-foreground/30 text-[10px] font-mono text-muted-foreground/70 space-y-0.5">
          <div className="flex gap-2">
            <span>x: {Math.round(nodeX)}</span>
            <span>y: {Math.round(nodeY)}</span>
          </div>
          <div className="flex gap-2">
            <span>w: {measuredWidth ?? '?'}</span>
            <span>h: {measuredHeight ?? '?'}</span>
          </div>
          <div className="flex gap-2">
            <span>sel: {selected ? 'Y' : 'N'}</span>
          </div>
        </div>
      )}

      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="custom-handle"
          isConnectable={isConnectable}
        />
      )}
    </div>
  );
});

BaseNodeContainer.displayName = 'BaseNodeContainer';
