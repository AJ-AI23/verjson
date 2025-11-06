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
    lifelines = [],
    nodes = [],
    edges = [],
    horizontalSpacing = 100,
    styles
  } = options;

  // Guard against undefined lifelines
  if (!lifelines || lifelines.length === 0) {
    console.warn('⚠️ No lifelines provided to calculateSequenceLayout');
    return { nodes: [], edges: [] };
  }

  // Sort lifelines by order
  const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);

  // Create a map of lifeline positions
  const lifelineXPositions = new Map<string, number>();
  sortedLifelines.forEach((lifeline, index) => {
    const xPos = index * (LIFELINE_WIDTH + horizontalSpacing) + NODE_HORIZONTAL_PADDING;
    lifelineXPositions.set(lifeline.id, xPos);
  });

  // Create lifeline nodes
  const lifelineNodes: Node[] = sortedLifelines.map((lifeline, index) => {
    const xPos = index * (LIFELINE_WIDTH + horizontalSpacing) + NODE_HORIZONTAL_PADDING;
    return {
      id: `lifeline-${lifeline.id}`,
      type: 'columnLifeline',
      position: { x: xPos, y: 0 },
      data: {
        column: lifeline,
        styles
      },
      draggable: false,
      selectable: false,
      focusable: false
    };
  });

  // Build a dependency graph to determine node order
  const nodeOrder = calculateNodeSequence(nodes, edges);

  // Calculate positions for each node
  const layoutNodes: Node[] = nodes.map((node, index) => {
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

    // Find the sequence order of this node
    const sequenceIndex = nodeOrder.indexOf(node.id);
    const yPos = LIFELINE_HEADER_HEIGHT + 40 + sequenceIndex * NODE_VERTICAL_SPACING;

    // Determine horizontal positioning based on connected edges
    const incomingEdge = edges.find(e => e.target === node.id);
    const outgoingEdge = edges.find(e => e.source === node.id);
    
    let startX = 0;
    let endX = 0;
    let width = 180; // Default width

    if (incomingEdge && outgoingEdge) {
      // Node connects two lifelines - span between them
      const sourceNode = nodes.find(n => n.id === incomingEdge.source);
      const targetNode = nodes.find(n => n.id === outgoingEdge.target);
      
      const sourceX = lifelineXPositions.get(sourceNode?.lifelineId || '') || 0;
      const targetX = lifelineXPositions.get(targetNode?.lifelineId || '') || 0;
      
      startX = Math.min(sourceX, targetX);
      endX = Math.max(sourceX, targetX);
      width = Math.abs(endX - startX);
    } else if (incomingEdge) {
      // Only incoming edge - position at source lifeline
      const sourceNode = nodes.find(n => n.id === incomingEdge.source);
      startX = lifelineXPositions.get(sourceNode?.lifelineId || '') || 0;
    } else if (outgoingEdge) {
      // Only outgoing edge - position at source lifeline
      const targetNode = nodes.find(n => n.id === outgoingEdge.target);
      startX = lifelineXPositions.get(targetNode?.lifelineId || '') || 0;
    } else if (node.lifelineId) {
      // No edges - position at assigned lifeline
      startX = lifelineXPositions.get(node.lifelineId) || 0;
    }

    // Center the node if it doesn't span lifelines
    if (width === 180) {
      startX -= width / 2;
    }

    return {
      id: node.id,
      type: 'sequenceNode',
      position: { x: startX, y: yPos },
      data: {
        ...node,
        config,
        styles,
        width: width > 180 ? width : undefined
      }
    };
  });

  // Convert edges with proper styling
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

// Calculate the vertical order of nodes based on edge dependencies
function calculateNodeSequence(nodes: DiagramNode[], edges: DiagramEdge[]): string[] {
  const nodeIds = nodes.map(n => n.id);
  const ordered: string[] = [];
  const visited = new Set<string>();
  
  // Build adjacency map
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  
  nodeIds.forEach(id => {
    outgoing.set(id, []);
    incoming.set(id, 0);
  });
  
  edges.forEach(edge => {
    if (nodeIds.includes(edge.source) && nodeIds.includes(edge.target)) {
      outgoing.get(edge.source)?.push(edge.target);
      incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
    }
  });
  
  // Topological sort using Kahn's algorithm
  const queue: string[] = [];
  nodeIds.forEach(id => {
    if (incoming.get(id) === 0) {
      queue.push(id);
    }
  });
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    visited.add(current);
    
    const neighbors = outgoing.get(current) || [];
    neighbors.forEach(neighbor => {
      const inCount = incoming.get(neighbor) || 0;
      incoming.set(neighbor, inCount - 1);
      
      if (incoming.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    });
  }
  
  // Add any remaining nodes that weren't in the dependency graph
  nodeIds.forEach(id => {
    if (!visited.has(id)) {
      ordered.push(id);
    }
  });
  
  return ordered;
}

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
