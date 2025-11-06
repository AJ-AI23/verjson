import React from 'react';
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
  };
  selected?: boolean;
}

export const SequenceNode: React.FC<SequenceNodeProps> = ({ data, selected }) => {
  const { config, label, type, data: nodeData, styles, width } = data;

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
    if (type === 'endpoint' && nodeData?.method && nodeData?.path) {
      return (
        <div className="space-y-2">
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
      );
    }

    if (type === 'decision') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <span className="text-sm font-medium" style={{ color: nodeColors.text }}>
            {label}
          </span>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="text-sm font-medium" style={{ color: nodeColors.text }}>
          {label}
        </div>
        {nodeData?.description && (
          <div className="text-xs opacity-70 line-clamp-2" style={{ color: nodeColors.text }}>
            {nodeData.description}
          </div>
        )}
      </div>
    );
  };

  const getNodeShape = () => {
    switch (config.shape) {
      case 'diamond':
        return 'clip-path-diamond';
      case 'cylinder':
        return 'rounded-full';
      case 'rounded':
        return 'rounded-lg';
      default:
        return 'rounded-md';
    }
  };

  return (
    <div
      className={cn(
        'px-4 py-3 border-2 shadow-md transition-all',
        getNodeShape(),
        'hover:shadow-lg cursor-pointer',
        config.shape === 'diamond' && 'w-32 h-32 flex items-center justify-center',
        selected && 'ring-2 ring-primary ring-offset-2 shadow-xl'
      )}
      style={{
        width: width && width > 0 ? `${width}px` : undefined,
        minWidth: config.shape === 'diamond' ? undefined : (width && width > 0 ? undefined : config.defaultWidth),
        minHeight: config.shape === 'diamond' ? undefined : config.defaultHeight,
        backgroundColor: nodeColors.background,
        borderColor: selected ? 'hsl(var(--primary))' : nodeColors.border,
        color: nodeColors.text
      }}
    >
      <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 !bg-slate-400" />
      {renderNodeContent()}
      <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 !bg-slate-400" />
    </div>
  );
};
