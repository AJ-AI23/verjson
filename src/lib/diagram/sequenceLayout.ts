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

const SWIMLANE_WIDTH = 200;
const COLUMN_WIDTH = 300;
const SWIMLANE_HEADER_HEIGHT = 60;
const NODE_VERTICAL_SPACING = 120;
const NODE_HORIZONTAL_PADDING = 40;

export const calculateSequenceLayout = (options: LayoutOptions): LayoutResult => {
  const {
    swimlanes,
    columns,
    nodes,
    edges,
    horizontalSpacing = 100,
    verticalSpacing = 120,
    swimlaneHeight = 150,
    styles
  } = options;

  // Sort swimlanes and columns by order
  const sortedSwimlanes = [...swimlanes].sort((a, b) => a.order - b.order);
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  // Create a map of swimlane positions
  const swimlanePositions = new Map<string, number>();
  sortedSwimlanes.forEach((swimlane, index) => {
    swimlanePositions.set(swimlane.id, index);
  });

  // Create a map of column positions
  const columnPositions = new Map<string, number>();
  sortedColumns.forEach((column, index) => {
    columnPositions.set(column.id, index);
  });

  // Group nodes by swimlane and column
  const nodesByPosition = new Map<string, DiagramNode[]>();
  nodes.forEach(node => {
    const key = `${node.swimlaneId}-${node.columnId}`;
    if (!nodesByPosition.has(key)) {
      nodesByPosition.set(key, []);
    }
    nodesByPosition.get(key)!.push(node);
  });

  // Calculate positions for each node
  const layoutNodes: Node[] = nodes.map(node => {
    const config = getNodeTypeConfig(node.type);
    const swimlaneIndex = swimlanePositions.get(node.swimlaneId || '') ?? 0;
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

    // Calculate automatic position
    const key = `${node.swimlaneId}-${node.columnId}`;
    const nodesInCell = nodesByPosition.get(key) || [];
    const nodeIndexInCell = nodesInCell.indexOf(node);

    const x = columnIndex * (COLUMN_WIDTH + horizontalSpacing) + NODE_HORIZONTAL_PADDING;
    const y = SWIMLANE_HEADER_HEIGHT + 
              swimlaneIndex * (swimlaneHeight + verticalSpacing) + 
              nodeIndexInCell * NODE_VERTICAL_SPACING +
              20;

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

export const calculateSwimlaneLayout = (swimlanes: Swimlane[], height: number = 600) => {
  const sortedSwimlanes = [...swimlanes].sort((a, b) => a.order - b.order);
  const swimlaneHeight = height / swimlanes.length;

  return sortedSwimlanes.map((swimlane, index) => ({
    ...swimlane,
    y: index * swimlaneHeight,
    height: swimlaneHeight
  }));
};
