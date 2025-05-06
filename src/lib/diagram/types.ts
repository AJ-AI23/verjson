import { Node, Edge } from '@xyflow/react';

export interface DiagramElements {
  nodes: any[];
  edges: any[];
}

export interface PropertyDetails {
  name: string;
  type: string;
  required: boolean;
  format?: string;
  description?: string;
  reference?: string;
}

export interface DiagramOptions {
  maxDepth: number;       // Maximum depth to render by default
  expandedNodes: string[]; // IDs of nodes that should be expanded beyond max depth
}

export interface DiagramGeneratorParams {
  schema: any;
  options: DiagramOptions;
  groupProperties: boolean;
}
