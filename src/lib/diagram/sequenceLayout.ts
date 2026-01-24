import { Node, Edge, MarkerType } from '@xyflow/react';
import { DiagramNode, DiagramEdge, Lifeline, AnchorNode, ProcessNode } from '@/types/diagram';
import { DiagramStyleTheme, DiagramStyles } from '@/types/diagramStyles';
import { getNodeTypeConfig } from './sequenceNodeTypes';

interface LayoutOptions {
  lifelines: Lifeline[];
  nodes: DiagramNode[];
  processes?: ProcessNode[];
  horizontalSpacing?: number;
  styles?: DiagramStyleTheme;
  fullStyles?: DiagramStyles;
  nodeHeights?: Map<string, number>;
  isRenderMode?: boolean;
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
    nodeHeights,
    isRenderMode = false
  } = options;

  // Validate lifelines - filter out incomplete ones (missing id, name, or order)
  const validLifelines = lifelines.filter(lifeline => 
    lifeline && 
    typeof lifeline.id === 'string' && 
    lifeline.id.length > 0 &&
    typeof lifeline.name === 'string' && 
    lifeline.name.length > 0 &&
    typeof lifeline.order === 'number'
  );

  // Validate nodes - filter out incomplete ones (missing id, type, label, or valid anchors)
  const validNodes = nodes.filter(node => 
    node &&
    typeof node.id === 'string' && 
    node.id.length > 0 &&
    typeof node.type === 'string' && 
    node.type.length > 0 &&
    typeof node.label === 'string' && 
    node.label.length > 0 &&
    Array.isArray(node.anchors) && 
    node.anchors.length === 2 &&
    node.anchors.every(anchor => 
      anchor &&
      typeof anchor.id === 'string' && 
      anchor.id.length > 0 &&
      typeof anchor.lifelineId === 'string' && 
      anchor.lifelineId.length > 0 &&
      typeof anchor.anchorType === 'string'
    )
  );

  // Validate processes - filter out incomplete ones (missing id, type, or valid anchorIds)
  const validProcesses = (options.processes || []).filter(process =>
    process &&
    typeof process.id === 'string' && 
    process.id.length > 0 &&
    process.type === 'lifelineProcess' &&
    Array.isArray(process.anchorIds) && 
    process.anchorIds.length > 0 &&
    typeof process.description === 'string'
  );

  // Extract all anchors from valid nodes
  const anchors: AnchorNode[] = validNodes.flatMap(node => 
    node.anchors?.map(anchor => ({ ...anchor })) || []
  );

  // Guard against undefined lifelines
  if (!validLifelines || validLifelines.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Sort lifelines by order
  const sortedLifelines = [...validLifelines].sort((a, b) => a.order - b.order);

  // Calculate max parallel processes per lifeline for spacing
  const PROCESS_BOX_WIDTH = 50;
  const PROCESS_HORIZONTAL_GAP = 8;
  const MARGIN_GAP = 10;
  
  // Track which lifelines have processes
  const lifelineProcessCounts = new Map<string, number>();
  if (validProcesses.length > 0) {
    sortedLifelines.forEach(lifeline => {
      const processesOnLifeline = validProcesses.filter(process => {
        return process.anchorIds.some(id => {
          const anchor = anchors.find(a => a.id === id);
          return anchor?.lifelineId === lifeline.id;
        });
      });
      lifelineProcessCounts.set(lifeline.id, processesOnLifeline.length);
    });
  }

  // Create a map of lifeline positions with dynamic spacing per lifeline
  const lifelineXPositions = new Map<string, number>();
  let currentX = NODE_HORIZONTAL_PADDING;
  
  sortedLifelines.forEach((lifeline, index) => {
    lifelineXPositions.set(lifeline.id, currentX);
    
    // Calculate spacing after this lifeline
    const processCount = lifelineProcessCounts.get(lifeline.id) || 0;
    const maxParallelOnThisLifeline = Math.min(processCount, 3);
    const processSpacingForThisLifeline = maxParallelOnThisLifeline > 0 
      ? (PROCESS_BOX_WIDTH * maxParallelOnThisLifeline) + (PROCESS_HORIZONTAL_GAP * (maxParallelOnThisLifeline - 1)) + 20
      : 0;
    
    // Move to next lifeline position
    currentX += LIFELINE_WIDTH + horizontalSpacing + processSpacingForThisLifeline;
  });

  // Helper function to get anchor center Y position
  // Note: node.yPosition now represents the CENTER of the node
  const getAnchorCenterY = (anchorId: string): number | null => {
    const node = nodesWithPositions.find(n => n.anchors?.some(a => a.id === anchorId));
    if (!node || node.yPosition === undefined) return null;
    
    // yPosition is already the center, so return it directly
    return node.yPosition;
  };

  // Helper function to calculate process margin for a lifeline (right side only)
  // All processes are always positioned on the right side of lifelines
  const getProcessMargin = (
    lifelineId: string, 
    nodeY: number, 
    nodeHeight: number
  ): number => {
    if (validProcesses.length === 0) return 0;
    
    const PROCESS_BOX_WIDTH = 50;
    const MARGIN_GAP = 10;
    const PROCESS_HORIZONTAL_GAP = 8;
    const ANCHOR_MARGIN = 15;
    
    const nodeTopY = nodeY;
    const nodeBottomY = nodeY + nodeHeight;
    const nodeCenterY = nodeY + (nodeHeight / 2);
    
    // Find UNIQUE processes on this lifeline that overlap with this node's Y position
    // Use a Set to track unique process IDs
    const overlappingProcessIds = new Set<string>();
    
    validProcesses.forEach(process => {
      const processAnchorsOnLifeline = process.anchorIds.filter(id => {
        const anchor = anchors.find(a => a.id === id);
        return anchor?.lifelineId === lifelineId;
      });
      
      if (processAnchorsOnLifeline.length === 0) return;
      
      // Get Y range of the process
      const anchorYPositions: number[] = [];
      processAnchorsOnLifeline.forEach(anchorId => {
        const anchorY = getAnchorCenterY(anchorId);
        if (anchorY !== null) {
          anchorYPositions.push(anchorY);
        }
      });
      
      if (anchorYPositions.length === 0) return;
      
      const minAnchorY = Math.min(...anchorYPositions);
      const maxAnchorY = Math.max(...anchorYPositions);
      
      const processTopY = minAnchorY - ANCHOR_MARGIN;
      const processBottomY = maxAnchorY + ANCHOR_MARGIN;
      
      // Check if this process overlaps with the node
      const overlaps = !(nodeBottomY < processTopY || nodeTopY > processBottomY);
      
      if (overlaps) {
        overlappingProcessIds.add(process.id);
      }
    });
    
    const parallelCount = overlappingProcessIds.size;
    
    if (parallelCount === 0) return 0;
    
    const totalProcessWidth = (PROCESS_BOX_WIDTH * parallelCount) + (PROCESS_HORIZONTAL_GAP * (parallelCount - 1));
    
    return totalProcessWidth + MARGIN_GAP + 30;
  };

  // Create lifeline nodes (height will be updated after node positions are calculated)
  const lifelineNodes: Node[] = sortedLifelines.map((lifeline, index) => {
    const xPos = lifelineXPositions.get(lifeline.id) || (index * (LIFELINE_WIDTH + horizontalSpacing) + NODE_HORIZONTAL_PADDING);
    return {
      id: `lifeline-${lifeline.id}`,
      type: 'columnLifeline',
      position: { x: xPos, y: 0 },
      data: {
        column: lifeline,
        styles,
        lifelineHeight: 2000 // Will be updated below after calculating node positions
      },
      draggable: false,
      selectable: false,
      focusable: false,
      width: 200,
      height: 60,
      style: {
        zIndex: -1
      }
    };
  });

  // Ensure all nodes have yPositions before layout calculation
  // Assign default positions to new nodes or dragged nodes that don't have yPosition yet
  const nodesWithPositions = validNodes.map((node, index) => {
    if (node.yPosition === undefined) {
      // Assign a default yPosition based on array order
      // This ensures new nodes get positioned at the end in order
      const maxYPosition = validNodes.reduce((max, n) => 
        n.yPosition !== undefined ? Math.max(max, n.yPosition) : max, 
        LIFELINE_HEADER_HEIGHT + 40
      );
      return {
        ...node,
        yPosition: maxYPosition + (index * 120)
      };
    }
    return node;
  });

  // Auto-align all nodes with even vertical spacing based on actual heights
  // Allow nodes to share Y positions when they connect to non-overlapping lifelines
  const alignedNodePositions = calculateEvenSpacing(nodesWithPositions, nodeHeights, validLifelines);
  
  // Create a map to store calculated yPosition values (center Y)
  const calculatedYPositions = new Map<string, number>();

  // Helper function to find process and parallel index for an anchor on its specific lifeline
  // Uses actual Y range overlap detection to match the process box positioning
  const getAnchorProcessInfo = (anchorId: string, anchorLifelineId: string): { processId: string; parallelIndex: number; parallelCount: number } | null => {
    if (validProcesses.length === 0) return null;
    
    const process = validProcesses.find(p => p.anchorIds.includes(anchorId));
    if (!process) return null;
    
    // Get the anchor to determine its type
    const currentAnchor = anchors.find(a => a.id === anchorId);
    if (!currentAnchor) return null;
    
    // Get all anchor IDs for this process on this specific lifeline (allow mixed types)
    const lifelineAnchorIds = process.anchorIds.filter(id => {
      const anchor = anchors.find(a => a.id === id);
      return anchor?.lifelineId === anchorLifelineId;
    });
    
    if (lifelineAnchorIds.length === 0) return null;
    
    // Calculate the Y range for this process segment
    const anchorYPositions = lifelineAnchorIds
      .map(id => {
        const node = nodesWithPositions.find(n => n.anchors?.some(a => a.id === id));
        return node?.yPosition;
      })
      .filter(y => y !== undefined) as number[];
    
    if (anchorYPositions.length === 0) return null;
    
    const minAnchorY = Math.min(...anchorYPositions);
    const maxAnchorY = Math.max(...anchorYPositions);
    
    // Get node heights for accurate Y range calculation
    const topNode = nodesWithPositions.find(n => n.yPosition === minAnchorY);
    const topNodeHeight = topNode ? (nodeHeights?.get(topNode.id) || getNodeTypeConfig(topNode.type)?.defaultHeight || 70) : 70;
    
    const bottomNode = nodesWithPositions.find(n => n.yPosition === maxAnchorY);
    const bottomNodeHeight = bottomNode ? (nodeHeights?.get(bottomNode.id) || getNodeTypeConfig(bottomNode.type)?.defaultHeight || 70) : 70;
    
    const ANCHOR_MARGIN = 15; // Match process box margin
    const thisYStart = minAnchorY - (topNodeHeight / 2) - ANCHOR_MARGIN;
    const thisYEnd = maxAnchorY + (bottomNodeHeight / 2) + ANCHOR_MARGIN;
    
    // Helper to check if two Y ranges overlap
    const rangesOverlap = (start1: number, end1: number, start2: number, end2: number): boolean => {
      return !(end1 < start2 || end2 < start1);
    };
    
    // Find all processes that have anchors on this lifeline and overlap Y range
    const overlappingProcesses = validProcesses.filter(p => {
      // Check if this process has any anchor on the target lifeline
      const pLifelineAnchorIds = p.anchorIds.filter(id => {
        const anchor = anchors.find(a => a.id === id);
        return anchor?.lifelineId === anchorLifelineId;
      });
      
      if (pLifelineAnchorIds.length === 0) return false;
      
      // Get Y range for this process
      const pAnchorYPositions = pLifelineAnchorIds
        .map(id => {
          const node = nodesWithPositions.find(n => n.anchors?.some(a => a.id === id));
          return node?.yPosition;
        })
        .filter(y => y !== undefined) as number[];
      
      if (pAnchorYPositions.length === 0) return false;
      
      const pMinY = Math.min(...pAnchorYPositions);
      const pMaxY = Math.max(...pAnchorYPositions);
      
      // Get node heights for this process
      const pTopNode = nodesWithPositions.find(n => n.yPosition === pMinY);
      const pTopHeight = pTopNode ? (nodeHeights?.get(pTopNode.id) || getNodeTypeConfig(pTopNode.type)?.defaultHeight || 70) : 70;
      
      const pBottomNode = nodesWithPositions.find(n => n.yPosition === pMaxY);
      const pBottomHeight = pBottomNode ? (nodeHeights?.get(pBottomNode.id) || getNodeTypeConfig(pBottomNode.type)?.defaultHeight || 70) : 70;
      
      const pYStart = pMinY - (pTopHeight / 2) - 15; // Match ANCHOR_MARGIN
      const pYEnd = pMaxY + (pBottomHeight / 2) + 15; // Match ANCHOR_MARGIN
      
      return rangesOverlap(thisYStart, thisYEnd, pYStart, pYEnd);
    });
    
    const parallelIndex = overlappingProcesses.findIndex(p => p.id === process.id);
    
    return {
      processId: process.id,
      parallelIndex,
      parallelCount: overlappingProcesses.length
    };
  };

  // Create anchor nodes - positioned at the same Y as their connected node's center
  const anchorNodes: Node[] = anchors.map(anchor => {
    const lifelineX = lifelineXPositions.get(anchor.lifelineId) || 0;
    
    // Check if anchor is in a process (pass lifeline ID for proper filtering)
    const processInfo = getAnchorProcessInfo(anchor.id, anchor.lifelineId);
    
    // Calculate X position - either centered in process box or on lifeline
    let xPos: number;
    if (processInfo) {
      const PROCESS_BOX_WIDTH = 50;
      const PROCESS_HORIZONTAL_GAP = 8; // Match the gap used in process positioning
      const PROCESS_CONTAINER_WIDTH = (PROCESS_BOX_WIDTH * processInfo.parallelCount) + (PROCESS_HORIZONTAL_GAP * (processInfo.parallelCount - 1));
      
      // Always position processes on the right side of lifelines
      const processContainerX = lifelineX + 10;
      
      // Center anchor in its process box (including gaps)
      xPos = processContainerX + (processInfo.parallelIndex * (PROCESS_BOX_WIDTH + PROCESS_HORIZONTAL_GAP)) + (PROCESS_BOX_WIDTH / 2);
    } else {
      // Position on lifeline
      xPos = lifelineX;
    }
    
    // Find the connected node to get its Y position and height
    const connectedNode = nodesWithPositions.find(n => 
      n.anchors?.some(a => a.id === anchor.id)
    );
    
    // Use the calculated aligned position for layout (this is now the CENTER Y of the node)
    const connectedNodeYPos = connectedNode 
      ? (alignedNodePositions.get(connectedNode.id) || (LIFELINE_HEADER_HEIGHT + 40))
      : (LIFELINE_HEADER_HEIGHT + 40);
    
    // Position anchor at the vertical center of the node
    // connectedNodeYPos is already the center Y, so just offset by half anchor height
    const anchorY = connectedNodeYPos - 8; // Center 16px anchor on node center
    
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

  // Calculate positions for each node (use nodesWithPositions for consistency)
  const layoutNodes: Node[] = nodesWithPositions.map((node, index) => {
    const config = getNodeTypeConfig(node.type);
    
    // Get anchors for this node directly
    const sourceAnchor = node.anchors?.[0];
    const targetAnchor = node.anchors?.[1];
    
    // Use auto-aligned position for consistent spacing (this is now CENTER Y)
    const centerY = alignedNodePositions.get(node.id) || (LIFELINE_HEADER_HEIGHT + 40);
    
    // Get node height to calculate top Y for positioning
    const measuredHeight = nodeHeights?.get(node.id);
    const nodeHeight = measuredHeight || config?.defaultHeight || 70;
    
    // Calculate the TOP Y coordinate for React Flow positioning
    const topY = centerY - (nodeHeight / 2);
    
    // Store the calculated center yPosition for later persistence
    calculatedYPositions.set(node.id, centerY);

    // Determine horizontal positioning based on connected anchors
    const BASE_MARGIN = 60; // Base margin from lifeline for edges and minimum spacing
    const RIGHT_MARGIN = 40; // Increased margin for right side
    let startX = 0;
    let width = 180; // Default width

    if (sourceAnchor && targetAnchor) {
      // Node connects two lifelines via anchors - span between them with margins
      const sourceX = lifelineXPositions.get(sourceAnchor.lifelineId) || 0;
      const targetX = lifelineXPositions.get(targetAnchor.lifelineId) || 0;
      
      // Calculate dynamic margin based on processes that overlap this node's Y position
      const leftLifelineId = sourceX < targetX ? sourceAnchor.lifelineId : targetAnchor.lifelineId;
      const leftProcessMargin = getProcessMargin(leftLifelineId, topY, nodeHeight);
      
      const leftX = Math.min(sourceX, targetX);
      const rightX = Math.max(sourceX, targetX);
      
      // Add margins: dynamic left margin based on processes, fixed right margin
      const totalLeftMargin = BASE_MARGIN + leftProcessMargin;
      const totalRightMargin = RIGHT_MARGIN;
      
      startX = leftX + totalLeftMargin;
      width = Math.abs(rightX - leftX) - totalLeftMargin - totalRightMargin;
      
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
      },
      style: {
        zIndex: 10
      },
      draggable: true // Enable dragging for sequence nodes
    };
  });

  // Convert edges - connect anchors to nodes only
  const layoutEdges: Edge[] = [];
  
  // Create edges between anchors and their nodes
  anchors.forEach(anchor => {
    const node = nodesWithPositions.find(n => 
      n.anchors?.some(a => a.id === anchor.id)
    );
    
    if (!node) {
      return;
    }
    
    // Validate that node has both anchors
    if (!node.anchors || node.anchors.length !== 2) {
      return;
    }
    
    const edgeStrokeColor = styles?.colors.edgeStroke || '#64748b';
    const edgeStyles = getEdgeStyle('default', edgeStrokeColor);
    
    // Determine anchor position relative to node by comparing lifeline X positions
    const otherAnchor = node.anchors?.find(a => a.id !== anchor.id);
    const thisAnchorX = lifelineXPositions.get(anchor.lifelineId) || 0;
    const otherAnchorX = otherAnchor ? lifelineXPositions.get(otherAnchor.lifelineId) || 0 : thisAnchorX;
    
    // Simple rule:
    // - Anchor on LEFT side of node (thisX < otherX) → connect from RIGHT edge point of anchor
    // - Anchor on RIGHT side of node (thisX > otherX) → connect from LEFT edge point of anchor
    const isAnchorOnLeftOfNode = thisAnchorX < otherAnchorX;
    const anchorEdgeHandle = isAnchorOnLeftOfNode ? 'right' : 'left';
    
    if (anchor.anchorType === 'source') {
      // Edge from anchor to node (arrow points TO the node)
      const edge = {
        id: `anchor-edge-${anchor.id}`,
        source: anchor.id,
        target: node.id,
        sourceHandle: anchorEdgeHandle,
        targetHandle: isAnchorOnLeftOfNode ? 'target-left' : 'target-right',
        type: 'sequenceEdge',
        animated: false,
        style: edgeStyles,
        zIndex: 5,
        markerEnd: { type: MarkerType.ArrowClosed, width: 28, height: 28, color: edgeStrokeColor },
        data: { edgeType: 'default', styles, isRenderMode }
      };
      layoutEdges.push(edge);
    } else if (anchor.anchorType === 'target') {
      // Edge from node to anchor (arrow points TO the anchor)
      const edge = {
        id: `anchor-edge-${anchor.id}`,
        source: node.id,
        target: anchor.id,
        sourceHandle: isAnchorOnLeftOfNode ? 'source-left' : 'source-right',
        targetHandle: anchorEdgeHandle,
        type: 'sequenceEdge',
        animated: false,
        style: edgeStyles,
        zIndex: 5,
        markerEnd: { type: MarkerType.ArrowClosed, width: 28, height: 28, color: edgeStrokeColor },
        data: { edgeType: 'default', styles, isRenderMode }
      };
      layoutEdges.push(edge);
    }
  });
  
  // Calculate process nodes if processes exist
  const processNodes: Node[] = [];
  if (validProcesses.length > 0) {
    try {
      const processLayout = calculateProcessLayout(
        validProcesses,
        anchors,
        nodesWithPositions,
        lifelineXPositions,
        styles,
        nodeHeights,
        alignedNodePositions // Pass calculated Y positions (top Y)
      );
      processNodes.push(...processLayout);
    } catch (error) {
      // Error creating process layout
    }
  }

  // Calculate required lifeline height based on the LOWEST anchor position
  // Anchors are the connection points on lifelines, so lifelines must extend below them
  let maxBottomY = LIFELINE_HEADER_HEIGHT + 40; // Start with minimum height
  
  // Check all anchor nodes - these are positioned on the lifelines and are the critical points
  anchorNodes.forEach(node => {
    const anchorBottomY = node.position.y + 16; // Anchor height is 16px
    maxBottomY = Math.max(maxBottomY, anchorBottomY);
  });
  
  // Also check layout nodes for safety
  layoutNodes.forEach(node => {
    const measuredHeight = nodeHeights?.get(node.id);
    const nodeHeight = measuredHeight || 70;
    const bottomY = node.position.y + nodeHeight;
    maxBottomY = Math.max(maxBottomY, bottomY);
  });
  
  // Check process nodes (they store height in data)
  processNodes.forEach(node => {
    const processHeight = (node.data as any).height || 100;
    const bottomY = node.position.y + processHeight;
    maxBottomY = Math.max(maxBottomY, bottomY);
  });
  
  // Add generous padding at the bottom to ensure lifeline extends well beyond last anchor
  const calculatedLifelineHeight = maxBottomY + 300;
  
  // Update lifeline nodes with calculated height
  lifelineNodes.forEach(lifelineNode => {
    lifelineNode.data.lifelineHeight = calculatedLifelineHeight;
  });

  return {
    nodes: [...lifelineNodes, ...processNodes, ...anchorNodes, ...layoutNodes],
    edges: layoutEdges,
    calculatedYPositions // Return the map of calculated yPosition values
  };
};


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

// Matrix-based layout algorithm: nodes are placed in slots (rows) with horizontal lane-based conflict detection
// This ensures nodes compact toward the top while maintaining proper spacing when they overlap horizontally
// Now uses dynamic slot heights based on actual node heights
function calculateEvenSpacing(nodes: DiagramNode[], nodeHeights?: Map<string, number>, lifelines?: Lifeline[]): Map<string, number> {
  const positions = new Map<string, number>();
  
  if (nodes.length === 0) {
    return positions;
  }
  
  const SLOT_GAP = 50; // Gap between slots
  const SLOT_START_Y = LIFELINE_HEADER_HEIGHT + 40; // First slot starts after lifeline header + margin
  const MAX_SLOTS = 50; // Maximum number of slots
  const DEFAULT_NODE_HEIGHT = 70;
  
  // Build lifeline position map (lifeline ID -> lane index)
  const lifelinePositions = new Map<string, number>();
  if (lifelines) {
    const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
    sortedLifelines.forEach((lifeline, index) => {
      lifelinePositions.set(lifeline.id, index);
    });
  }
  
  // Type for node span (horizontal bounds in lanes)
  interface NodeSpan {
    leftLane: number;
    rightLane: number;
    width: number;
  }
  
  // Type for node position in the matrix
  interface NodePosition {
    slot: number;
    leftLane: number;
    rightLane: number;
    width: number;
  }
  
  // Compute horizontal span for a node (which lanes it occupies)
  const computeSpan = (node: DiagramNode): NodeSpan | null => {
    if (!node.anchors || node.anchors.length < 2) return null;
    
    const ll0Pos = lifelinePositions.get(node.anchors[0].lifelineId);
    const ll1Pos = lifelinePositions.get(node.anchors[1].lifelineId);
    
    if (ll0Pos === undefined || ll1Pos === undefined) {
      return null;
    }
    
    // Lanes are gaps between lifelines (0 = gap between lifeline 0 and 1)
    const leftLane = Math.min(ll0Pos, ll1Pos);
    const rightLane = Math.max(ll0Pos, ll1Pos) - 1; // -1 because lane is the gap
    const width = rightLane - leftLane + 1;
    
    return { leftLane, rightLane, width };
  };
  
  // Check if a span conflicts with any node already placed in the same slot
  // Rule: There must be at least 1 empty lane gap between nodes horizontally
  const conflicts = (
    span: NodeSpan, 
    slotNodes: DiagramNode[], 
    nodePositions: Map<string, NodePosition>
  ): boolean => {
    for (const n of slotNodes) {
      const other = nodePositions.get(n.id);
      if (!other) continue;
      
      const aLeft = span.leftLane;
      const aRight = span.rightLane;
      const bLeft = other.leftLane;
      const bRight = other.rightLane;
      
      // We require at least 2 lanes gap: aRight + 2 <= bLeft OR bRight + 2 <= aLeft
      const ok = (aRight + 2 <= bLeft) || (bRight + 2 <= aLeft);
      
      if (!ok) return true;
    }
    return false;
  };
  
  // Calculate spans for all nodes
  const nodeSpans = new Map<string, NodeSpan>();
  nodes.forEach(node => {
    const span = computeSpan(node);
    if (span) {
      nodeSpans.set(node.id, span);
    }
  });
  
  // Sort nodes by their current Y position to preserve relative ordering
  const sortedNodes = [...nodes]
    .filter(n => nodeSpans.has(n.id))
    .sort((a, b) => {
      const aY = a.yPosition ?? 0;
      const bY = b.yPosition ?? 0;
      return aY - bY;
    });
  
  // Matrix layout: slots array and positions map
  const nodePositions = new Map<string, NodePosition>();
  const slots: DiagramNode[][] = Array.from({ length: MAX_SLOTS }, () => []);
  
  // Place each node at the first available slot from top
  sortedNodes.forEach((node) => {
    const span = nodeSpans.get(node.id)!;
    let placedSlot: number | null = null;
    
    // Scan from slot 0 upward, find first slot without conflicts
    for (let s = 0; s < MAX_SLOTS; s++) {
      if (!conflicts(span, slots[s], nodePositions)) {
        placedSlot = s;
        break;
      }
    }
    
    // Fallback to last slot if nothing fits
    if (placedSlot === null) {
      placedSlot = MAX_SLOTS - 1;
    }
    
    nodePositions.set(node.id, {
      slot: placedSlot,
      leftLane: span.leftLane,
      rightLane: span.rightLane,
      width: span.width
    });
    slots[placedSlot].push(node);
  });
  
  // Calculate dynamic slot heights based on the tallest node in each slot
  const slotHeights: number[] = [];
  for (let s = 0; s < MAX_SLOTS; s++) {
    if (slots[s].length === 0) {
      slotHeights.push(DEFAULT_NODE_HEIGHT);
    } else {
      let maxHeight = 0;
      slots[s].forEach(node => {
        const h = nodeHeights?.get(node.id) || DEFAULT_NODE_HEIGHT;
        if (h > maxHeight) maxHeight = h;
      });
      slotHeights.push(maxHeight);
    }
  }
  
  // Calculate cumulative Y positions for each slot (center Y)
  const slotCenterYPositions: number[] = [];
  let currentY = SLOT_START_Y;
  for (let s = 0; s < MAX_SLOTS; s++) {
    const slotHeight = slotHeights[s];
    const centerY = currentY + (slotHeight / 2);
    slotCenterYPositions.push(centerY);
    currentY += slotHeight + SLOT_GAP;
  }
  
  // Convert slots to Y positions (center Y)
  nodePositions.forEach((pos, nodeId) => {
    positions.set(nodeId, slotCenterYPositions[pos.slot]);
  });
  
  return positions;
}

export const getEdgeStyle = (type: string, themeEdgeStroke?: string) => {
  const defaultStroke = themeEdgeStroke || '#64748b';
  const baseStyle = {
    strokeWidth: 2,
    stroke: defaultStroke
  };

  switch (type) {
    case 'sync':
      return {
        ...baseStyle,
        stroke: themeEdgeStroke || '#3b82f6'
      };
    case 'async':
      return {
        ...baseStyle,
        stroke: themeEdgeStroke || '#10b981',
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

// Calculate layout for process nodes
export const calculateProcessLayout = (
  processes: ProcessNode[],
  anchors: AnchorNode[],
  nodes: DiagramNode[],
  lifelinePositions: Map<string, number>,
  styles?: DiagramStyleTheme,
  nodeHeights?: Map<string, number>,
  calculatedYPositions?: Map<string, number>
): Node[] => {
  if (!processes || processes.length === 0) {
    return [];
  }

  const processNodes: Node[] = [];

  // Helper to get actual anchor Y position (center of node) using calculated layout positions
  const getAnchorCenterY = (anchorId: string): number | null => {
    const node = nodes.find(n => n && n.anchors?.some(a => a && a.id === anchorId));
    if (!node) return null;
    
    // Use calculated Y position from layout if available, otherwise fall back to node.yPosition
    // Note: these positions now represent the CENTER Y of the node
    const nodeY = calculatedYPositions?.get(node.id) ?? node.yPosition;
    if (nodeY === undefined) return null;
    
    // nodeY is already the center, so return it directly
    return nodeY;
  };

  // Group processes by lifeline-anchorType to determine parallel positioning
  // We need to check for actual Y range overlaps, not just arbitrary Y groups
  const processGroups = new Map<string, Array<{
    process: ProcessNode;
    anchorIds: string[];
    yRange: { min: number; max: number };
  }>>();

  // First pass: collect all process segments with their Y ranges
  processes.forEach(process => {
    if (!process || !process.anchorIds || process.anchorIds.length === 0) {
      return;
    }

    // Get all anchors for this process and group by lifeline only (not by anchor type)
    const lifelineAnchorGroups = new Map<string, string[]>();
    
    process.anchorIds.forEach(anchorId => {
      const anchor = anchors.find(a => a.id === anchorId);
      if (!anchor) return;
      
      const key = anchor.lifelineId; // Group by lifeline only, allowing mixed anchor types
      if (!lifelineAnchorGroups.has(key)) {
        lifelineAnchorGroups.set(key, []);
      }
      lifelineAnchorGroups.get(key)!.push(anchorId);
    });

    // For each lifeline-anchorType group, calculate Y range and store
    lifelineAnchorGroups.forEach((anchorIds, key) => {
      const anchorYPositions: number[] = [];
      
      anchorIds.forEach(anchorId => {
        const anchorY = getAnchorCenterY(anchorId);
        if (anchorY !== null) {
          anchorYPositions.push(anchorY);
        }
      });

      if (anchorYPositions.length === 0) return;

      const minY = Math.min(...anchorYPositions);
      const maxY = Math.max(...anchorYPositions);

      if (!processGroups.has(key)) {
        processGroups.set(key, []);
      }
      
      processGroups.get(key)!.push({
        process,
        anchorIds,
        yRange: { min: minY, max: maxY }
      });
    });
  });

  // Now create process nodes for each lifeline-anchorType combination
  processes.forEach(process => {
    if (!process || !process.anchorIds || process.anchorIds.length === 0) {
      return;
    }

    // Group anchors by lifeline only (allow mixed source/target on same lifeline)
    const lifelineAnchorGroups = new Map<string, { lifelineId: string; anchorIds: string[] }>();
    
    process.anchorIds.forEach(anchorId => {
      const anchor = anchors.find(a => a.id === anchorId);
      if (!anchor) return;
      
      const key = anchor.lifelineId; // Group by lifeline only
      if (!lifelineAnchorGroups.has(key)) {
        lifelineAnchorGroups.set(key, {
          lifelineId: anchor.lifelineId,
          anchorIds: []
        });
      }
      lifelineAnchorGroups.get(key)!.anchorIds.push(anchorId);
    });

    // Create a process box for each lifeline (can contain mixed source/target anchors)
    lifelineAnchorGroups.forEach((group, key) => {
      // Get all anchor center positions for this group
      const anchorYPositions: number[] = [];
      const connectedAnchors: string[] = [];
      
      group.anchorIds.forEach(anchorId => {
        const anchorY = getAnchorCenterY(anchorId);
        if (anchorY !== null) {
          anchorYPositions.push(anchorY);
          connectedAnchors.push(anchorId);
        }
      });

      if (anchorYPositions.length === 0) return;

      // Always place process boxes on the right side of lifelines
      const isSourceSide = true;

      // Calculate bounds based on actual anchor positions with node heights
      const ANCHOR_MARGIN = 15; // Vertical margin above/below process boxes (reduced to prevent overlap)
      const NODE_HEIGHT = 70;
      const minAnchorY = Math.min(...anchorYPositions);
      const maxAnchorY = Math.max(...anchorYPositions);
      
      // Get height of bottom anchor's node to extend below it
      const bottomAnchorId = connectedAnchors[anchorYPositions.indexOf(maxAnchorY)];
      const bottomNode = nodes.find(n => n.anchors?.some(a => a.id === bottomAnchorId));
      const bottomNodeHeight = bottomNode ? (nodeHeights?.get(bottomNode.id) || getNodeTypeConfig(bottomNode.type)?.defaultHeight || NODE_HEIGHT) : NODE_HEIGHT;
      
      // Get height of top anchor's node to extend above it
      const topAnchorId = connectedAnchors[anchorYPositions.indexOf(minAnchorY)];
      const topNode = nodes.find(n => n.anchors?.some(a => a.id === topAnchorId));
      const topNodeHeight = topNode ? (nodeHeights?.get(topNode.id) || getNodeTypeConfig(topNode.type)?.defaultHeight || NODE_HEIGHT) : NODE_HEIGHT;
      
      // Process box: extends from above top anchor's top edge to below bottom anchor's bottom edge
      // anchor Y positions are at the center of nodes
      const yPosition = minAnchorY - (topNodeHeight / 2) - ANCHOR_MARGIN;
      const bottomY = maxAnchorY + (bottomNodeHeight / 2) + ANCHOR_MARGIN;
      const height = Math.max(bottomY - yPosition, 60);
      
      // Determine parallel count and index based on actual Y range overlaps
      const groupSegments = processGroups.get(key) || [];
      
      // Find all segments that overlap with this segment's Y range
      // Use the already calculated Y range from above
      const thisYStart = yPosition;
      const thisYEnd = yPosition + height;
      
      // Helper to check if two Y ranges overlap
      const rangesOverlap = (start1: number, end1: number, start2: number, end2: number): boolean => {
        return !(end1 < start2 || end2 < start1);
      };
      
      // Find overlapping segments and assign parallel indices
      const overlappingSegments = groupSegments.filter(seg => {
        if (seg.process.id === process.id) return true; // Include self
        
        // Get Y range for this segment
        const segMinY = Math.min(...seg.anchorIds.map(id => getAnchorCenterY(id) || 0).filter(y => y > 0));
        const segMaxY = Math.max(...seg.anchorIds.map(id => getAnchorCenterY(id) || 0).filter(y => y > 0));
        
        if (segMinY === 0 || segMaxY === 0) return false;
        
        // Get node heights for this segment
        const segTopAnchor = seg.anchorIds[0];
        const segTopNode = nodes.find(n => n.anchors?.some(a => a.id === segTopAnchor));
        const segTopHeight = segTopNode ? (nodeHeights?.get(segTopNode.id) || getNodeTypeConfig(segTopNode.type)?.defaultHeight || 70) : 70;
        
        const segBottomAnchor = seg.anchorIds[seg.anchorIds.length - 1];
        const segBottomNode = nodes.find(n => n.anchors?.some(a => a.id === segBottomAnchor));
        const segBottomHeight = segBottomNode ? (nodeHeights?.get(segBottomNode.id) || getNodeTypeConfig(segBottomNode.type)?.defaultHeight || 70) : 70;
        
        const segYStart = segMinY - (segTopHeight / 2) - 15; // Match ANCHOR_MARGIN
        const segYEnd = segMaxY + (segBottomHeight / 2) + 15; // Match ANCHOR_MARGIN
        
        return rangesOverlap(thisYStart, thisYEnd, segYStart, segYEnd);
      });
      
      const parallelCount = overlappingSegments.length;
      const parallelIndex = overlappingSegments.findIndex(seg => seg.process.id === process.id);
      
      const lifelineX = lifelinePositions.get(group.lifelineId);
      if (lifelineX === undefined) {
        return;
      }

      // Calculate dimensions
      const PROCESS_BOX_WIDTH = 50;
      const PROCESS_HORIZONTAL_GAP = 8; // Gap between parallel process boxes
      const PROCESS_CONTAINER_WIDTH = (PROCESS_BOX_WIDTH * parallelCount) + (PROCESS_HORIZONTAL_GAP * (parallelCount - 1));
      
      // Always position on right side of lifeline
      const baseContainerX = lifelineX + 10;
      
      // Offset each parallel process horizontally based on its index (including gaps)
      const processX = baseContainerX + (parallelIndex * (PROCESS_BOX_WIDTH + PROCESS_HORIZONTAL_GAP));

      processNodes.push({
        id: `process-${process.id}-${key}`,
        type: 'processNode',
        position: { x: processX, y: yPosition },
        data: {
          processNode: { ...process }, // Spread to ensure new reference
          processId: process.id,
          theme: styles,
          parallelCount,
          // Add a data hash to force updates when process changes
          dataVersion: `${process.description}-${process.color}`
        },
        style: {
          width: PROCESS_BOX_WIDTH,
          height: height,
          zIndex: 0
        },
        draggable: false,
        selectable: true
      });
    });
  });

  return processNodes;
};
