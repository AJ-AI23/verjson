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
}

export interface SequenceDiagramData {
  lifelines: Lifeline[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
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
}

export interface DiagramNode {
  id: string;
  type: 'endpoint' | 'process' | 'decision' | 'data' | 'custom';
  label: string;
  anchors: [AnchorNode, AnchorNode];
  position?: { x: number; y: number };
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
  yPosition: number;
  anchorType: 'source' | 'target';
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
