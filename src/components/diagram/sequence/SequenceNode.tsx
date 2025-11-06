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
  };
}

export const SequenceNode: React.FC<SequenceNodeProps> = ({ data }) => {
  const { config, label, type, data: nodeData, styles } = data;

  const renderNodeContent = () => {
    if (type === 'endpoint' && nodeData?.method && nodeData?.path) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge className={cn('text-xs font-semibold', getMethodColor(nodeData.method))}>
              {nodeData.method}
            </Badge>
            <span className="text-xs font-mono text-slate-600 truncate">
              {nodeData.path}
            </span>
          </div>
          <div className={cn('text-sm font-medium', config.textColor)}>
            {label}
          </div>
          {nodeData.description && (
            <div className="text-xs text-slate-500 line-clamp-2">
              {nodeData.description}
            </div>
          )}
        </div>
      );
    }

    if (type === 'decision') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <span className="text-lg mb-1">{config.icon}</span>
          <span className={cn('text-sm font-medium', config.textColor)}>
            {label}
          </span>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-base">{config.icon}</span>
          <span className={cn('text-sm font-medium', config.textColor)}>
            {label}
          </span>
        </div>
        {nodeData?.description && (
          <div className="text-xs text-slate-500 line-clamp-2">
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
        config.shape === 'diamond' && 'w-32 h-32 flex items-center justify-center'
      )}
      style={{
        minWidth: config.shape === 'diamond' ? undefined : config.defaultWidth,
        minHeight: config.shape === 'diamond' ? undefined : config.defaultHeight,
        backgroundColor: nodeData?.color || styles?.colors.nodeBackground || '#ffffff',
        borderColor: styles?.colors.nodeBorder || '#94a3b8',
        color: styles?.colors.nodeText || '#0f172a'
      }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-slate-400" />
      {renderNodeContent()}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-slate-400" />
    </div>
  );
};
