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

  // Create a map of column positions and indices
  const columnPositions = new Map<string, number>();
  const columnXPositions = new Map<string, number>();
  sortedColumns.forEach((column, index) => {
    columnPositions.set(column.id, index);
    const xPos = index * (COLUMN_WIDTH + horizontalSpacing) + NODE_HORIZONTAL_PADDING;
    columnXPositions.set(column.id, xPos);
  });

  // Create lifeline nodes for each column
  const lifelineNodes: Node[] = sortedColumns.map((column, index) => {
    const xPos = index * (COLUMN_WIDTH + horizontalSpacing) + NODE_HORIZONTAL_PADDING;
    return {
      id: `lifeline-${column.id}`,
      type: 'columnLifeline',
      position: { x: xPos, y: 0 },
      data: {
        column,
        styles
      },
      draggable: false,
      selectable: false,
      focusable: false
    };
  });

  // Create a map of node to column
  const nodeToColumn = new Map<string, string>();
  nodes.forEach(node => {
    if (node.columnId) {
      nodeToColumn.set(node.id, node.columnId);
    }
  });

  // Track vertical position for layout
  let currentY = COLUMN_HEADER_HEIGHT + 40;

  // Calculate positions for each node based on connected edges
  const layoutNodes: Node[] = nodes.map(node => {
    const config = getNodeTypeConfig(node.type);

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

    // Find edges connected to this node
    const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
    
    let startColumnId = node.columnId || '';
    let endColumnId = node.columnId || '';
    
    // Determine span based on connected edges
    if (connectedEdges.length > 0) {
      const edge = connectedEdges[0];
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (sourceNode?.columnId && targetNode?.columnId) {
        startColumnId = sourceNode.columnId;
        endColumnId = targetNode.columnId;
      }
    }

    const startX = columnXPositions.get(startColumnId) || 0;
    const endX = columnXPositions.get(endColumnId) || startX;
    
    // Position node between the two columns
    const x = Math.min(startX, endX);
    const width = Math.abs(endX - startX);
    
    const y = currentY;
    currentY += NODE_VERTICAL_SPACING;

    return {
      id: node.id,
      type: 'sequenceNode',
      position: { x, y },
      data: {
        ...node,
        config,
        styles,
        width: width > 0 ? width : 180
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
    nodes: [...lifelineNodes, ...layoutNodes],
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
