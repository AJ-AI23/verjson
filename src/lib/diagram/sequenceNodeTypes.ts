import { DiagramNodeType } from '@/types/diagram';

export interface NodeTypeConfig {
  type: DiagramNodeType;
  label: string;
  icon: string;
  baseColor: string;
  borderColor: string;
  textColor: string;
  shape: 'rectangle' | 'rounded' | 'diamond' | 'cylinder';
  defaultWidth: number;
  defaultHeight: number;
}

export const nodeTypeConfigs: Record<DiagramNodeType, NodeTypeConfig> = {
  endpoint: {
    type: 'endpoint',
    label: 'API Endpoint',
    icon: '🔌',
    baseColor: 'bg-blue-50',
    borderColor: 'border-blue-400',
    textColor: 'text-blue-900',
    shape: 'rectangle',
    defaultWidth: 200,
    defaultHeight: 80
  },
  process: {
    type: 'process',
    label: 'Process',
    icon: '⚙️',
    baseColor: 'bg-slate-50',
    borderColor: 'border-slate-400',
    textColor: 'text-slate-900',
    shape: 'rounded',
    defaultWidth: 180,
    defaultHeight: 70
  },
  decision: {
    type: 'decision',
    label: 'Decision',
    icon: '❓',
    baseColor: 'bg-amber-50',
    borderColor: 'border-amber-400',
    textColor: 'text-amber-900',
    shape: 'diamond',
    defaultWidth: 160,
    defaultHeight: 90
  },
  data: {
    type: 'data',
    label: 'Data Store',
    icon: '💾',
    baseColor: 'bg-green-50',
    borderColor: 'border-green-400',
    textColor: 'text-green-900',
    shape: 'cylinder',
    defaultWidth: 140,
    defaultHeight: 80
  },
  custom: {
    type: 'custom',
    label: 'Custom',
    icon: '📦',
    baseColor: 'bg-purple-50',
    borderColor: 'border-purple-400',
    textColor: 'text-purple-900',
    shape: 'rounded',
    defaultWidth: 160,
    defaultHeight: 70
  }
};

export const getNodeTypeConfig = (type: DiagramNodeType): NodeTypeConfig => {
  return nodeTypeConfigs[type] || nodeTypeConfigs.custom;
};

export const getMethodColor = (method: string): string => {
  const colors: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-800 border-blue-300',
    POST: 'bg-green-100 text-green-800 border-green-300',
    PUT: 'bg-orange-100 text-orange-800 border-orange-300',
    PATCH: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    DELETE: 'bg-red-100 text-red-800 border-red-300',
    OPTIONS: 'bg-gray-100 text-gray-800 border-gray-300',
    HEAD: 'bg-purple-100 text-purple-800 border-purple-300'
  };
  return colors[method.toUpperCase()] || colors.GET;
};
