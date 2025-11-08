import { Node, Edge, MarkerType } from '@xyflow/react';
import { DiagramNode, DiagramEdge, Lifeline, AnchorNode } from '@/types/diagram';
import { DiagramStyleTheme } from '@/types/diagramStyles';
import { getNodeTypeConfig } from './sequenceNodeTypes';

interface LayoutOptions {
  lifelines: Lifeline[];
  nodes: DiagramNode[];
  horizontalSpacing?: number;
  styles?: DiagramStyleTheme;
  nodeHeights?: Map<string, number>;
}

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
  calculatedYPositions?: Map<string, number>;
}

const LIFELINE_WIDTH = 300;
const LIFELINE_HEADER_HEIGHT = 100;
const NODE_VERTICAL_SPACING = 120;
const NODE_HORIZONTAL_PADDING = 150;

export const calculateSequenceLayout = (options: LayoutOptions): LayoutResult => {
  const {
    lifelines = [],
    nodes = [],
    horizontalSpacing = 100,
    styles,
    nodeHeights
  } = options;

  // Validate and extract anchors from nodes
  console.log('[SequenceLayout] Validating nodes and anchors...', { nodeCount: nodes.length });
  
  // Check for nodes without anchors
  const nodesWithoutAnchors = nodes.filter(node => !node.anchors || node.anchors.length !== 2);
  if (nodesWithoutAnchors.length > 0) {
    console.error('❌ [SequenceLayout] Nodes missing anchors detected:', {
      nodesWithoutAnchors: nodesWithoutAnchors.map(n => ({
        id: n.id,
        label: n.label,
        hasAnchors: !!n.anchors,
        anchorCount: n.anchors?.length || 0
      }))
    });
  }
  
  // Extract all anchors from nodes
  const anchors: AnchorNode[] = nodes.flatMap(node => 
    node.anchors?.map(anchor => ({ ...anchor })) || []
  );
  
  console.log('[SequenceLayout] Anchor extraction complete:', {
    totalAnchors: anchors.length,
    expectedAnchors: nodes.length * 2
  });

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
  const nodeOrder = calculateNodeSequence(nodes);

  // Auto-align all nodes with even vertical spacing based on actual heights
  const alignedNodePositions = calculateEvenSpacing(nodes, nodeOrder, nodeHeights);
  
  // Create a map to store calculated yPosition values (center Y)
  const calculatedYPositions = new Map<string, number>();

  // Create anchor nodes - positioned at the same Y as their connected node's center
  const anchorNodes: Node[] = anchors.map(anchor => {
    const xPos = lifelineXPositions.get(anchor.lifelineId) || 0;
    
    // Find the connected node to get its Y position and height
    const connectedNode = nodes.find(n => 
      n.anchors?.some(a => a.id === anchor.id)
    );
    
    // Use the calculated aligned position for layout
    const connectedNodeYPos = connectedNode 
      ? (alignedNodePositions.get(connectedNode.id) || (LIFELINE_HEADER_HEIGHT + 40))
      : (LIFELINE_HEADER_HEIGHT + 40);
    
    // Get node height - use measured height if available, otherwise use default from config
    const measuredHeight = connectedNode && nodeHeights ? nodeHeights.get(connectedNode.id) : undefined;
    const nodeConfig = connectedNode ? getNodeTypeConfig(connectedNode.type) : null;
    const nodeHeight = measuredHeight || nodeConfig?.defaultHeight || 70;
    
    // Position anchor at the vertical center of the node
    const anchorY = connectedNodeYPos + (nodeHeight / 2) - 8; // Center 16px anchor on node center
    
    return {
      id: anchor.id,
      type: 'anchorNode',
      position: { x: xPos - 8, y: anchorY },
      data: {
        lifelineId: anchor.lifelineId,
        connectedNodeId: connectedNode?.id,
        anchorType: anchor.anchorType,
        styles
      },
      draggable: true,
      selectable: false,
      focusable: false,
      zIndex: 1000 // Ensure anchors are always on top
    };
  });

  // Calculate positions for each node
  const layoutNodes: Node[] = nodes.map((node, index) => {
    const config = getNodeTypeConfig(node.type);
    
    // Get anchors for this node directly
    const sourceAnchor = node.anchors?.[0];
    const targetAnchor = node.anchors?.[1];
    
    // Use auto-aligned position for consistent spacing (this is top Y)
    const topY = alignedNodePositions.get(node.id) || (LIFELINE_HEADER_HEIGHT + 40);
    
    // Get node height to calculate center Y
    const measuredHeight = nodeHeights?.get(node.id);
    const nodeHeight = measuredHeight || config?.defaultHeight || 70;
    
    // Calculate the CENTER Y coordinate and store it for later persistence
    const centerY = topY + (nodeHeight / 2);
    calculatedYPositions.set(node.id, centerY);

    // Determine horizontal positioning based on connected anchors
    const MARGIN = 40; // Margin from lifeline for edges
    let startX = 0;
    let width = 180; // Default width

    if (sourceAnchor && targetAnchor) {
      // Node connects two lifelines via anchors - span between them with margins
      const sourceX = lifelineXPositions.get(sourceAnchor.lifelineId) || 0;
      const targetX = lifelineXPositions.get(targetAnchor.lifelineId) || 0;
      
      const leftX = Math.min(sourceX, targetX);
      const rightX = Math.max(sourceX, targetX);
      
      // Add margins to accommodate edges
      startX = leftX + MARGIN;
      width = Math.abs(rightX - leftX) - (MARGIN * 2);
      
      // Ensure minimum width
      if (width < 180) {
        width = 180;
        startX = (leftX + rightX) / 2 - 90; // Center if too narrow
      }
    } else if (sourceAnchor) {
      // Position at source anchor lifeline (centered)
      startX = (lifelineXPositions.get(sourceAnchor.lifelineId) || 0) - width / 2;
    }

    return {
      id: node.id,
      type: 'sequenceNode',
      position: { x: startX, y: topY },
      data: {
        ...node,
        config,
        styles,
        width: width > 180 ? width : undefined,
        calculatedYPosition: centerY // Pass the calculated yPosition via data
      }
    };
  });

  // Convert edges - connect anchors to nodes only
  const layoutEdges: Edge[] = [];
  
  console.log('[SequenceLayout] Creating edges from anchors...', { anchorCount: anchors.length });
  
  // Create edges between anchors and their nodes
  anchors.forEach(anchor => {
    const node = nodes.find(n => 
      n.anchors?.some(a => a.id === anchor.id)
    );
    
    if (!node) {
      console.error('❌ [SequenceLayout] No node found for anchor:', {
        anchorId: anchor.id,
        lifelineId: anchor.lifelineId,
        anchorType: anchor.anchorType
      });
      return;
    }
    
    // Validate that node has both anchors
    if (!node.anchors || node.anchors.length !== 2) {
      console.error('❌ [SequenceLayout] Node has invalid anchors:', {
        nodeId: node.id,
        nodeLabel: node.label,
        anchorCount: node.anchors?.length || 0
      });
      return;
    }
    
    const edgeStyles = getEdgeStyle('default');
    
    // Determine which anchor is on the left and which is on the right
    const sourceAnchor = node.anchors?.[0];
    const targetAnchor = node.anchors?.[1];
    
    const sourceX = sourceAnchor ? lifelineXPositions.get(sourceAnchor.lifelineId) || 0 : 0;
    const targetX = targetAnchor ? lifelineXPositions.get(targetAnchor.lifelineId) || 0 : 0;
    
    const isLeftAnchor = anchor.id === (sourceX < targetX ? sourceAnchor?.id : targetAnchor?.id);
    
    if (anchor.anchorType === 'source') {
      // Edge from anchor to node
      const edge = {
        id: `anchor-edge-${anchor.id}`,
        source: anchor.id,
        target: node.id,
        sourceHandle: isLeftAnchor ? 'right' : 'left',
        targetHandle: isLeftAnchor ? 'target-left' : 'target-right',
        type: 'sequenceEdge',
        animated: false,
        style: edgeStyles,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { edgeType: 'default', styles }
      };
      layoutEdges.push(edge);
    } else if (anchor.anchorType === 'target') {
      // Edge from node to anchor
      const edge = {
        id: `anchor-edge-${anchor.id}`,
        source: node.id,
        target: anchor.id,
        sourceHandle: isLeftAnchor ? 'source-left' : 'source-right',
        targetHandle: isLeftAnchor ? 'right' : 'left',
        type: 'sequenceEdge',
        animated: false,
        style: edgeStyles,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { edgeType: 'default', styles }
      };
      layoutEdges.push(edge);
    }
  });
  
  console.log('[SequenceLayout] Edge creation complete:', {
    totalEdges: layoutEdges.length,
    expectedEdges: anchors.length,
    nodesProcessed: nodes.length
  });
  
  // Final validation
  if (layoutEdges.length === 0 && nodes.length > 0) {
    console.error('❌ [SequenceLayout] NO EDGES CREATED despite having nodes!', {
      nodeCount: nodes.length,
      anchorCount: anchors.length,
      nodesWithAnchors: nodes.filter(n => n.anchors && n.anchors.length === 2).length
    });
  }

  return {
    nodes: [...lifelineNodes, ...anchorNodes, ...layoutNodes],
    edges: layoutEdges,
    calculatedYPositions // Return the map of calculated yPosition values
  };
};

// Calculate the vertical order of nodes based on stored yPosition or array order
function calculateNodeSequence(nodes: DiagramNode[]): string[] {
  // If nodes have yPosition, use those for sorting, otherwise use array order
  const nodesWithPosition = nodes.map((node, index) => {
    const yPos = node.yPosition !== undefined ? node.yPosition : index * 120;
    return { id: node.id, yPosition: yPos };
  });
  
  // Sort by Y position
  nodesWithPosition.sort((a, b) => a.yPosition - b.yPosition);
  
  return nodesWithPosition.map(n => n.id);
}

// Calculate even spacing for nodes based on their sequence order and actual heights
// Always recalculates positions for all nodes to maintain even spacing
function calculateEvenSpacing(nodes: DiagramNode[], nodeOrder: string[], nodeHeights?: Map<string, number>): Map<string, number> {
  const positions = new Map<string, number>();
  
  if (nodes.length === 0) {
    return positions;
  }
  
  const startY = LIFELINE_HEADER_HEIGHT + 40;
  const SPACING_BETWEEN_NODES = 50; // Additional spacing between nodes
  
  let currentY = startY;
  
  // Assign Y positions based on actual node heights
  nodeOrder.forEach((nodeId) => {
    positions.set(nodeId, currentY);
    
    // Get the actual height of this node
    const node = nodes.find(n => n.id === nodeId);
    const nodeConfig = node ? getNodeTypeConfig(node.type) : null;
    const measuredHeight = nodeHeights?.get(nodeId);
    const nodeHeight = measuredHeight || nodeConfig?.defaultHeight || 70;
    
    // Move to next position: current position + node height + spacing
    currentY += nodeHeight + SPACING_BETWEEN_NODES;
  });
  
  return positions;
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
