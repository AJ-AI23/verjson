
import { CollapsedState } from '../types';

// Grid layout configuration
export interface GridConfig {
  initialX: number;
  startY: number;
  xGap: number;
  yGap: number;
  columnWidth: number;
}

// Track node positions in a grid
export interface GridState {
  grid: Record<number, Record<number, boolean>>;
  maxNodesPerLevel: Record<number, number>;
}

// Object to process in the layout
export interface ProcessingQueueItem {
  parentId: string;
  schema: {
    properties: Record<string, any>;
    required: string[];
  };
  level: number;
  index: number;
  depth: number;
  path: string;
}

// Context for layout generation
export interface LayoutContext {
  gridConfig: GridConfig;
  gridState: GridState;
  collapsedPaths: CollapsedState;
  maxDepth: number;
  nodes: any[];
  edges: any[];
}

// Path tracking for property paths
export interface PropertyPath {
  nodePath: string;
  fullPath: string;
}
