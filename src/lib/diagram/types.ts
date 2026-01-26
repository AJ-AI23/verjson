
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

export interface DiagramSettings {
  maxDepth: number;
  groupProperties: boolean;
}

export interface CollapsedState {
  [path: string]: boolean;
}

/**
 * Base interface for all diagram node data.
 * Provides consistent expand/collapse behavior across node types.
 */
export interface BaseNodeData {
  /** Display label for the node */
  label: string;
  /** Canonical path used for collapse state tracking (e.g., "root.properties.user") */
  nodePath: string;
  /** Whether the node is currently collapsed */
  isCollapsed?: boolean;
  /** Whether the node has collapsible children */
  hasChildren?: boolean;
  /** Whether this node has content that can be expanded further */
  hasCollapsibleContent?: boolean;
  /** Callback to toggle collapsed state */
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}
