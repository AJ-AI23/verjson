import { DiagramStyles } from './diagramStyles';

export interface DiagramDocument {
  version: string;
  type: 'sequence' | 'flowchart';
  metadata: {
    title: string;
    description?: string;
    author?: string;
    created?: string;
    modified?: string;
  };
  data: SequenceDiagramData | FlowchartData;
  styles?: DiagramStyles;
  selectedTheme?: string; // Current active theme (e.g., 'light' or 'dark')
}

export interface SequenceDiagramData {
  lifelines: Lifeline[];
  nodes: DiagramNode[];
  processes?: ProcessNode[];
}

export interface FlowchartData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface Lifeline {
  id: string;
  name: string;
  order: number;
  width?: number;
  description?: string;
  color?: string;
  anchorColor?: string;
}

export interface DiagramNode {
  id: string;
  type: 'endpoint' | 'process' | 'decision' | 'data' | 'custom';
  label: string;
  anchors: [AnchorNode, AnchorNode];
  yPosition?: number;
  data?: {
    method?: string;
    path?: string;
    description?: string;
    openApiRef?: {
      documentId: string;
      path: string;
      method: string;
    };
    icon?: string;
    color?: string;
    [key: string]: any;
  };
}

export interface AnchorNode {
  id: string;
  lifelineId: string;
  anchorType: 'source' | 'target';
  processId?: string; // ID of the process this anchor belongs to (if any)
}

export interface ProcessNode {
  id: string;
  type: 'lifelineProcess';
  lifelineId: string;
  anchorIds: string[]; // Array of anchor IDs connected to this process
  description: string;
  parallelIndex?: number; // 0, 1, or 2 for positioning (max 3 parallel)
  color?: string; // Optional custom color
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: 'default' | 'sync' | 'async' | 'return';
  animated?: boolean;
  style?: {
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
  };
}

export type DiagramNodeType = 'endpoint' | 'process' | 'decision' | 'data' | 'custom';
export type DiagramEdgeType = 'default' | 'sync' | 'async' | 'return';
