import { DiagramNodeType } from '@/types/diagram';

export interface NodeTypeConfig {
  type: DiagramNodeType;
  label: string;
  shape: 'rectangle' | 'rounded' | 'diamond' | 'cylinder';
  defaultWidth: number;
  defaultHeight: number;
}

export const nodeTypeConfigs: Record<DiagramNodeType, NodeTypeConfig> = {
  endpoint: {
    type: 'endpoint',
    label: 'API Endpoint',
    shape: 'rectangle',
    defaultWidth: 200,
    defaultHeight: 80
  },
  process: {
    type: 'process',
    label: 'Process',
    shape: 'rounded',
    defaultWidth: 180,
    defaultHeight: 70
  },
  decision: {
    type: 'decision',
    label: 'Decision',
    shape: 'diamond',
    defaultWidth: 160,
    defaultHeight: 90
  },
  data: {
    type: 'data',
    label: 'Data Store',
    shape: 'cylinder',
    defaultWidth: 140,
    defaultHeight: 80
  },
  custom: {
    type: 'custom',
    label: 'Custom',
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
