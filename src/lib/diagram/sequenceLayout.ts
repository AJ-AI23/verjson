import { Node, Edge } from '@xyflow/react';
import { DiagramNode, DiagramEdge, Lifeline } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';
import { getNodeTypeConfig } from './sequenceNodeTypes';

interface LayoutOptions {
  lifelines: Lifeline[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  horizontalSpacing?: number;
  styles?: DiagramStyleTheme;
}

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

const LIFELINE_WIDTH = 300;
const LIFELINE_HEADER_HEIGHT = 100;
const NODE_VERTICAL_SPACING = 120;
const NODE_HORIZONTAL_PADDING = 150;

export const calculateSequenceLayout = (options: LayoutOptions): LayoutResult => {
  const {
    lifelines,
    nodes,
    edges,
    horizontalSpacing = 100,
    styles
  } = options;

  // Sort lifelines by order
  const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);

  // Create a map of lifeline positions and indices
  const lifelinePositions = new Map<string, number>();
  const lifelineXPositions = new Map<string, number>();
  sortedLifelines.forEach((lifeline, index) => {
    lifelinePositions.set(lifeline.id, index);
    const xPos = index * (LIFELINE_WIDTH + horizontalSpacing) + NODE_HORIZONTAL_PADDING;
    lifelineXPositions.set(lifeline.id, xPos);
  });

  // Create lifeline nodes for each lifeline
  const lifelineNodes: Node[] = sortedLifelines.map((lifeline, index) => {
    const xPos = index * (LIFELINE_WIDTH + horizontalSpacing) + NODE_HORIZONTAL_PADDING;
    return {
      id: `lifeline-${lifeline.id}`,
      type: 'columnLifeline',
      position: { x: xPos, y: 0 },
      data: {
        column: lifeline, // Keep as 'column' for ColumnLifelineNode component compatibility
        styles
      },
      draggable: false,
      selectable: false,
      focusable: false
    };
  });

  // Track vertical position for layout
  let currentY = LIFELINE_HEADER_HEIGHT + 40;

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
    
    let startLifelineId = node.lifelineId || '';
    let endLifelineId = node.lifelineId || '';
    
    // Determine span based on connected edges
    if (connectedEdges.length > 0) {
      const edge = connectedEdges[0];
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (sourceNode?.lifelineId && targetNode?.lifelineId) {
        startLifelineId = sourceNode.lifelineId;
        endLifelineId = targetNode.lifelineId;
      }
    }

    const startX = lifelineXPositions.get(startLifelineId) || 0;
    const endX = lifelineXPositions.get(endLifelineId) || startX;
    
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

export const calculateLifelineLayout = (lifelines: Lifeline[], horizontalSpacing: number = 100) => {
  const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);

  return sortedLifelines.map((lifeline, index) => ({
    ...lifeline,
    x: index * (LIFELINE_WIDTH + horizontalSpacing) + NODE_HORIZONTAL_PADDING
  }));
};
