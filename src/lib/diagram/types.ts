
import { Node, Edge } from '@xyflow/react';

export interface DiagramElements {
  nodes: Node[];
  edges: Edge[];
}

export interface PropertyDetails {
  name: string;
  type: string;
  required: boolean;
  format?: string;
  description?: string;
  reference?: string;
}
