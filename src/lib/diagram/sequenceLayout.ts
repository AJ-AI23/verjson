import { Node, Edge } from '@xyflow/react';
import { DiagramNode, DiagramEdge, Swimlane, Column } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';
import { getNodeTypeConfig } from './sequenceNodeTypes';

interface LayoutOptions {
  swimlanes: Swimlane[];
  columns: Column[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  horizontalSpacing?: number;
  verticalSpacing?: number;
  swimlaneHeight?: number;
  styles?: DiagramStyleTheme;
}

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

const COLUMN_WIDTH = 300;
const COLUMN_HEADER_HEIGHT = 100;
const NODE_VERTICAL_SPACING = 120;
const NODE_HORIZONTAL_PADDING = 150;

export const calculateSequenceLayout = (options: LayoutOptions): LayoutResult => {
  const {
    columns,
    nodes,
    edges,
    horizontalSpacing = 100,
    styles
  } = options;

  // Sort columns by order
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  // Create a map of column positions
  const columnPositions = new Map<string, number>();
  sortedColumns.forEach((column, index) => {
    columnPositions.set(column.id, index);
  });

  // Group nodes by column
  const nodesByColumn = new Map<string, DiagramNode[]>();
  nodes.forEach(node => {
    const columnId = node.columnId || '';
    if (!nodesByColumn.has(columnId)) {
      nodesByColumn.set(columnId, []);
    }
    nodesByColumn.get(columnId)!.push(node);
  });

  // Calculate positions for each node
  const layoutNodes: Node[] = nodes.map(node => {
    const config = getNodeTypeConfig(node.type);
    const columnIndex = columnPositions.get(node.columnId || '') ?? 0;

    // If node has manual position, use it
    if (node.position) {
      return {
        id: node.id,
        type: 'sequenceNode',
        position: node.position,
        data: {
          ...node,
          config,
          styles
        }
      };
    }

    // Calculate automatic position based on column
    const columnId = node.columnId || '';
    const nodesInColumn = nodesByColumn.get(columnId) || [];
    const nodeIndexInColumn = nodesInColumn.indexOf(node);

    const x = columnIndex * (COLUMN_WIDTH + horizontalSpacing) + NODE_HORIZONTAL_PADDING;
    const y = COLUMN_HEADER_HEIGHT + nodeIndexInColumn * NODE_VERTICAL_SPACING + 40;

    return {
      id: node.id,
      type: 'sequenceNode',
      position: { x, y },
      data: {
        ...node,
        config,
        styles
      }
    };
  });

  // Convert edges
  const layoutEdges: Edge[] = edges.map(edge => {
    const edgeStyles = getEdgeStyle(edge.type || 'default');
    
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'sequenceEdge',
      animated: edge.animated || edge.type === 'async',
      style: edge.style || edgeStyles,
      data: {
        edgeType: edge.type || 'default',
        styles
      }
    };
  });

  return {
    nodes: layoutNodes,
    edges: layoutEdges
  };
};

export const getEdgeStyle = (type: string) => {
  const baseStyle = {
    strokeWidth: 2
  };

  switch (type) {
    case 'sync':
      return {
        ...baseStyle,
        stroke: '#3b82f6'
      };
    case 'async':
      return {
        ...baseStyle,
        stroke: '#10b981',
        strokeDasharray: '5,5'
      };
    case 'return':
      return {
        ...baseStyle,
        stroke: '#8b5cf6',
        strokeDasharray: '3,3'
      };
    default:
      return {
        ...baseStyle,
        stroke: '#64748b'
      };
  }
};

export const calculateColumnLayout = (columns: Column[], horizontalSpacing: number = 100) => {
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  return sortedColumns.map((column, index) => ({
    ...column,
    x: index * (COLUMN_WIDTH + horizontalSpacing) + NODE_HORIZONTAL_PADDING
  }));
};
