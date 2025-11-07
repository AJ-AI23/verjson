import React, { useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { DiagramNode } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';
import { NodeTypeConfig, getMethodColor } from '@/lib/diagram/sequenceNodeTypes';
import { cn } from '@/lib/utils';

interface SequenceNodeProps {
  data: DiagramNode & { 
    config: NodeTypeConfig;
    styles?: DiagramStyleTheme;
    width?: number;
    onHeightChange?: (nodeId: string, height: number) => void;
  };
  selected?: boolean;
  positionAbsoluteX: number;
  positionAbsoluteY: number;
}

export const SequenceNode: React.FC<SequenceNodeProps> = ({ data, selected, positionAbsoluteY }) => {
  const { config, label, type, data: nodeData, styles, width, onHeightChange, id } = data;
  const nodeRef = useRef<HTMLDivElement>(null);

  // Track node height changes and notify parent
  useEffect(() => {
    if (!nodeRef.current || !onHeightChange) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use offsetHeight to include borders and padding in the measurement
        const height = entry.target instanceof HTMLElement ? entry.target.offsetHeight : entry.contentRect.height;
        onHeightChange(id, height);
      }
    });

    resizeObserver.observe(nodeRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [id, onHeightChange]);

  const getNodeColors = () => {
    const typeColors = styles?.colors.nodeTypes?.[type];
    return {
      background: nodeData?.color || typeColors?.background || styles?.colors.nodeBackground || '#ffffff',
      border: typeColors?.border || styles?.colors.nodeBorder || '#94a3b8',
      text: typeColors?.text || styles?.colors.nodeText || '#0f172a'
    };
  };

  const nodeColors = getNodeColors();

  const renderNodeContent = () => {
    const NodeIcon = config.icon;
    
    if (type === 'endpoint' && nodeData?.method && nodeData?.path) {
      return (
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <NodeIcon className="h-5 w-5 opacity-60" style={{ color: nodeColors.text }} />
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <Badge className={cn('text-xs font-semibold', getMethodColor(nodeData.method))}>
                {nodeData.method}
              </Badge>
              <span className="text-xs font-mono truncate" style={{ color: nodeColors.text }}>
                {nodeData.path}
              </span>
            </div>
            <div className="text-sm font-medium" style={{ color: nodeColors.text }}>
              {label}
            </div>
            {nodeData.description && (
              <div className="text-xs opacity-70 line-clamp-2" style={{ color: nodeColors.text }}>
                {nodeData.description}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <NodeIcon className="h-5 w-5 opacity-60" style={{ color: nodeColors.text }} />
        </div>
        <div className="flex-1 space-y-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: nodeColors.text }}>
            {label}
          </div>
          {nodeData?.description && (
            <div className="text-xs opacity-70 line-clamp-2" style={{ color: nodeColors.text }}>
              {nodeData.description}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={nodeRef}
      className={cn(
        'px-4 py-3 border-2 shadow-md transition-all rounded-lg',
        'hover:shadow-lg cursor-pointer',
        selected && 'ring-2 ring-primary ring-offset-2 shadow-xl'
      )}
      style={{
        width: width && width > 0 ? `${width}px` : undefined,
        minWidth: width && width > 0 ? undefined : config.defaultWidth,
        minHeight: config.defaultHeight,
        backgroundColor: nodeColors.background,
        borderColor: selected ? 'hsl(var(--primary))' : nodeColors.border,
        color: nodeColors.text
      }}
    >
      {/* Left side handles - both source and target for bidirectional flow */}
      <Handle type="target" position={Position.Left} id="target-left" className="w-3 h-3 !bg-slate-400" />
      <Handle type="source" position={Position.Left} id="source-left" className="w-3 h-3 !bg-slate-400" />
      
      {renderNodeContent()}
      
      {/* Debug coordinates */}
      <div className="mt-2 pt-2 border-t text-xs opacity-50" style={{ color: nodeColors.text }}>
        y: {positionAbsoluteY.toFixed(0)}
      </div>
      
      {/* Right side handles - both source and target for bidirectional flow */}
      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-slate-400" />
      <Handle type="target" position={Position.Right} id="target-right" className="w-3 h-3 !bg-slate-400" />
    </div>
  );
};
