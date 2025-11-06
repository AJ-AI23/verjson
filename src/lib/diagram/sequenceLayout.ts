import { Node, Edge } from '@xyflow/react';
import { DiagramNode, DiagramEdge, Lifeline, AnchorNode } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';
import { getNodeTypeConfig } from './sequenceNodeTypes';

interface LayoutOptions {
  lifelines: Lifeline[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  anchors: AnchorNode[];
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
    anchors = [],
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
  const nodeOrder = calculateNodeSequence(nodes, anchors);

  // Create anchor nodes
  const anchorNodes: Node[] = anchors.map(anchor => {
    const xPos = lifelineXPositions.get(anchor.lifelineId) || 0;
    const yPos = anchor.yPosition;
    
    return {
      id: anchor.id,
      type: 'anchorNode',
      position: { x: xPos - 8, y: yPos }, // Center the 16px anchor
      data: {
        lifelineId: anchor.lifelineId,
        connectedNodeId: anchor.connectedNodeId,
        anchorType: anchor.anchorType,
        styles
      },
      draggable: true,
      selectable: false,
      focusable: false
    };
  });

  // Calculate positions for each node
  const layoutNodes: Node[] = nodes.map((node, index) => {
    const config = getNodeTypeConfig(node.type);
    
    // Get anchors for this node from node.anchors array
    const sourceAnchorInfo = node.anchors?.[0];
    const targetAnchorInfo = node.anchors?.[1];
    
    const sourceAnchor = sourceAnchorInfo ? anchors.find(a => a.id === sourceAnchorInfo.id) : undefined;
    const targetAnchor = targetAnchorInfo ? anchors.find(a => a.id === targetAnchorInfo.id) : undefined;
    
    // Find the sequence order of this node
    const sequenceIndex = nodeOrder.indexOf(node.id);
    
    // Use anchor positions for Y coordinate (average of both anchors)
    let yPos = LIFELINE_HEADER_HEIGHT + 40 + sequenceIndex * NODE_VERTICAL_SPACING;
    if (sourceAnchor && targetAnchor) {
      yPos = (sourceAnchor.yPosition + targetAnchor.yPosition) / 2;
    } else if (sourceAnchor) {
      yPos = sourceAnchor.yPosition;
    } else if (targetAnchor) {
      yPos = targetAnchor.yPosition;
    }

    // Determine horizontal positioning based on connected anchors
    let startX = 0;
    let endX = 0;
    let width = 180; // Default width

    if (sourceAnchor && targetAnchor) {
      // Node connects two lifelines via anchors - span between them
      const sourceX = lifelineXPositions.get(sourceAnchor.lifelineId) || 0;
      const targetX = lifelineXPositions.get(targetAnchor.lifelineId) || 0;
      
      startX = Math.min(sourceX, targetX);
      endX = Math.max(sourceX, targetX);
      width = Math.abs(endX - startX);
    } else if (sourceAnchorInfo) {
      // Position at source anchor lifeline
      startX = lifelineXPositions.get(sourceAnchorInfo.lifelineId) || 0;
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

  // Convert edges - connect anchors to nodes
  const layoutEdges: Edge[] = [];
  
  // Create edges between anchors and their nodes
  anchors.forEach(anchor => {
    const node = nodes.find(n => n.id === anchor.connectedNodeId);
    if (!node) return;
    
    const edgeStyles = getEdgeStyle('default');
    
    if (anchor.anchorType === 'source') {
      // Edge from anchor to node
      layoutEdges.push({
        id: `anchor-edge-${anchor.id}`,
        source: anchor.id,
        target: node.id,
        type: 'sequenceEdge',
        animated: false,
        style: edgeStyles,
        data: { edgeType: 'default', styles }
      });
    } else {
      // Edge from node to anchor
      layoutEdges.push({
        id: `anchor-edge-${anchor.id}`,
        source: node.id,
        target: anchor.id,
        type: 'sequenceEdge',
        animated: false,
        style: edgeStyles,
        data: { edgeType: 'default', styles }
      });
    }
  });
  
  // Add labeled edges between source and target anchors
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    const sourceTargetAnchorId = sourceNode?.anchors?.[1]?.id;
    const targetSourceAnchorId = targetNode?.anchors?.[0]?.id;
    
    if (sourceTargetAnchorId && targetSourceAnchorId) {
      const edgeStyles = getEdgeStyle(edge.type || 'default');
      
      layoutEdges.push({
        id: edge.id,
        source: sourceTargetAnchorId,
        target: targetSourceAnchorId,
        label: edge.label,
        type: 'sequenceEdge',
        animated: edge.animated || edge.type === 'async',
        style: edge.style || edgeStyles,
        data: {
          edgeType: edge.type || 'default',
          styles
        }
      });
    }
  });

  return {
    nodes: [...lifelineNodes, ...anchorNodes, ...layoutNodes],
    edges: layoutEdges
  };
};

// Calculate the vertical order of nodes based on anchor positions
function calculateNodeSequence(nodes: DiagramNode[], anchors: AnchorNode[]): string[] {
  // Sort nodes by their average anchor Y position
  const nodesWithPosition = nodes.map(node => {
    const sourceAnchorInfo = node.anchors?.[0];
    const targetAnchorInfo = node.anchors?.[1];
    
    const sourceAnchor = sourceAnchorInfo ? anchors.find(a => a.id === sourceAnchorInfo.id) : undefined;
    const targetAnchor = targetAnchorInfo ? anchors.find(a => a.id === targetAnchorInfo.id) : undefined;
    
    let avgY = 0;
    if (sourceAnchor && targetAnchor) {
      avgY = (sourceAnchor.yPosition + targetAnchor.yPosition) / 2;
    } else if (sourceAnchor) {
      avgY = sourceAnchor.yPosition;
    } else if (targetAnchor) {
      avgY = targetAnchor.yPosition;
    }
    
    return { id: node.id, yPosition: avgY };
  });
  
  // Sort by Y position
  nodesWithPosition.sort((a, b) => a.yPosition - b.yPosition);
  
  return nodesWithPosition.map(n => n.id);
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
