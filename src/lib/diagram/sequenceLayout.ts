import { Node, Edge, MarkerType } from '@xyflow/react';
import { DiagramNode, DiagramEdge, Lifeline, AnchorNode } from '@/types/diagram';
import { DiagramStyleTheme, DiagramStyles } from '@/types/diagramStyles';
import { getNodeTypeConfig } from './sequenceNodeTypes';

interface LayoutOptions {
  lifelines: Lifeline[];
  nodes: DiagramNode[];
  horizontalSpacing?: number;
  styles?: DiagramStyleTheme;
  fullStyles?: DiagramStyles;
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
    fullStyles,
    nodeHeights
  } = options;

  // Validate and extract anchors from nodes
  
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
  // Allow nodes to share Y positions when they connect to non-overlapping lifelines
  const alignedNodePositions = calculateEvenSpacing(nodes, nodeOrder, nodeHeights, lifelines);
  
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
        lifelines: sortedLifelines,
        styles,
        customStyles: fullStyles
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

// Helper to check if two lifeline ranges overlap
function lifelineRangesOverlap(range1: [string, string], range2: [string, string], lifelinePositions: Map<string, number>): boolean {
  const pos1Start = lifelinePositions.get(range1[0]) || 0;
  const pos1End = lifelinePositions.get(range1[1]) || 0;
  const pos2Start = lifelinePositions.get(range2[0]) || 0;
  const pos2End = lifelinePositions.get(range2[1]) || 0;
  
  const min1 = Math.min(pos1Start, pos1End);
  const max1 = Math.max(pos1Start, pos1End);
  const min2 = Math.min(pos2Start, pos2End);
  const max2 = Math.max(pos2Start, pos2End);
  
  // Check if ranges overlap
  return !(max1 < min2 || max2 < min1);
}

// Calculate spacing that allows nodes to share Y positions when they don't overlap horizontally
function calculateEvenSpacing(nodes: DiagramNode[], nodeOrder: string[], nodeHeights?: Map<string, number>, lifelines?: Lifeline[]): Map<string, number> {
  const positions = new Map<string, number>();
  
  if (nodes.length === 0) {
    return positions;
  }
  
  const startY = LIFELINE_HEADER_HEIGHT + 40;
  const SPACING_BETWEEN_ROWS = 50; // Spacing between different Y levels
  
  // Create a map of lifeline positions for overlap detection
  const lifelinePositions = new Map<string, number>();
  if (lifelines) {
    const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
    sortedLifelines.forEach((lifeline, index) => {
      lifelinePositions.set(lifeline.id, index);
    });
  }
  
  // Track which nodes are at each Y level and their lifeline ranges
  interface YLevel {
    y: number;
    height: number;
    nodesWithRanges: Array<{ nodeId: string; range: [string, string] }>;
  }
  const yLevels: YLevel[] = [];
  
  // Assign Y positions based on node order, allowing sharing when no overlap
  nodeOrder.forEach((nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.anchors || node.anchors.length !== 2) {
      positions.set(nodeId, startY);
      return;
    }
    
    const nodeConfig = getNodeTypeConfig(node.type);
    const measuredHeight = nodeHeights?.get(nodeId);
    const nodeHeight = measuredHeight || nodeConfig?.defaultHeight || 70;
    
    // Get the lifeline range this node spans
    const sourceLifelineId = node.anchors[0].lifelineId;
    const targetLifelineId = node.anchors[1].lifelineId;
    const nodeRange: [string, string] = [sourceLifelineId, targetLifelineId];
    
    // Try to find an existing Y level where this node can fit (no overlap)
    let assignedLevel: YLevel | null = null;
    
    for (const level of yLevels) {
      // Check if this node overlaps with any node at this level
      const hasOverlap = level.nodesWithRanges.some(existing => 
        lifelineRangesOverlap(nodeRange, existing.range, lifelinePositions)
      );
      
      if (!hasOverlap) {
        // This node can share this Y level
        assignedLevel = level;
        // Update level height if this node is taller
        level.height = Math.max(level.height, nodeHeight);
        level.nodesWithRanges.push({ nodeId, range: nodeRange });
        break;
      }
    }
    
    if (!assignedLevel) {
      // Need to create a new Y level
      const newY = yLevels.length === 0 
        ? startY 
        : yLevels[yLevels.length - 1].y + yLevels[yLevels.length - 1].height + SPACING_BETWEEN_ROWS;
      
      assignedLevel = {
        y: newY,
        height: nodeHeight,
        nodesWithRanges: [{ nodeId, range: nodeRange }]
      };
      yLevels.push(assignedLevel);
    }
    
    positions.set(nodeId, assignedLevel.y);
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
