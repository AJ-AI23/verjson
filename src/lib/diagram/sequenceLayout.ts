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

  // Calculate max parallel processes per lifeline for spacing adjustment
  const PROCESS_BOX_WIDTH = 50;
  let maxParallelProcesses = 0;
  
  if (options.processes && options.processes.length > 0) {
    sortedLifelines.forEach(lifeline => {
      const lifelineProcesses = options.processes!.filter(p => p.lifelineId === lifeline.id);
      const yGroups = new Map<number, number>();
      
      lifelineProcesses.forEach(process => {
        // Count processes per Y group
        const yGroup = Math.floor(process.anchorIds.length * 100 / 200) * 200;
        yGroups.set(yGroup, (yGroups.get(yGroup) || 0) + 1);
      });
      
      if (yGroups.size > 0) {
        const maxForThisLifeline = Math.max(...yGroups.values());
        maxParallelProcesses = Math.max(maxParallelProcesses, maxForThisLifeline);
      }
    });
  }

  // Add extra spacing for process boxes on both sides (source and target)
  const processSpacing = maxParallelProcesses > 0 ? (PROCESS_BOX_WIDTH * maxParallelProcesses + 20) * 2 : 0;

  // Create a map of lifeline positions with adjusted spacing
  const lifelineXPositions = new Map<string, number>();
  sortedLifelines.forEach((lifeline, index) => {
    const xPos = index * (LIFELINE_WIDTH + horizontalSpacing + processSpacing) + NODE_HORIZONTAL_PADDING;
    lifelineXPositions.set(lifeline.id, xPos);
  });

  // Helper function to get anchor center Y position
  const getAnchorCenterY = (anchorId: string): number | null => {
    const node = nodesWithPositions.find(n => n.anchors?.some(a => a.id === anchorId));
    if (!node || node.yPosition === undefined) return null;
    
    const nodeConfig = node ? getNodeTypeConfig(node.type) : null;
    const measuredHeight = nodeHeights ? nodeHeights.get(node.id) : undefined;
    const nodeHeight = measuredHeight || nodeConfig?.defaultHeight || 70;
    
    return node.yPosition + (nodeHeight / 2);
  };

  // Helper function to calculate process margin for a lifeline
  const getProcessMargin = (lifelineId: string, nodeY: number, nodeHeight: number): number => {
    if (!options.processes || options.processes.length === 0) return 0;
    
    const PROCESS_BOX_WIDTH = 50;
    const MARGIN_GAP = 10; // Gap between process box and lifeline
    const ANCHOR_MARGIN = 25; // Margin that process boxes have above/below anchors
    
    // Calculate this node's center Y and its range
    const nodeCenterY = nodeY + (nodeHeight / 2);
    const nodeTopY = nodeY;
    const nodeBottomY = nodeY + nodeHeight;
    
    // Find processes on this lifeline that overlap with this node's Y position
    const overlappingProcesses = options.processes.filter(process => {
      if (process.lifelineId !== lifelineId) return false;
      
      // Get Y range of the process by checking anchor centers
      const anchorYPositions: number[] = [];
      process.anchorIds.forEach(anchorId => {
        const anchorY = getAnchorCenterY(anchorId);
        if (anchorY !== null) {
          anchorYPositions.push(anchorY);
        }
      });
      
      if (anchorYPositions.length === 0) return false;
      
      const minAnchorY = Math.min(...anchorYPositions);
      const maxAnchorY = Math.max(...anchorYPositions);
      
      // Process box extends ANCHOR_MARGIN above/below the anchors
      const processTopY = minAnchorY - ANCHOR_MARGIN;
      const processBottomY = maxAnchorY + ANCHOR_MARGIN;
      
      // Check if node overlaps with process Y range
      return !(nodeBottomY < processTopY || nodeTopY > processBottomY);
    });
    
    if (overlappingProcesses.length === 0) return 0;
    
    // Group by Y range to find parallel processes
    const yGroup = Math.floor(nodeCenterY / 200) * 200;
    const parallelProcesses = overlappingProcesses.filter(process => {
      const anchorYPositions: number[] = [];
      process.anchorIds.forEach(anchorId => {
        const anchorY = getAnchorCenterY(anchorId);
        if (anchorY !== null) {
          anchorYPositions.push(anchorY);
        }
      });
      
      if (anchorYPositions.length === 0) return false;
      
      const avgY = anchorYPositions.reduce((sum, y) => sum + y, 0) / anchorYPositions.length;
      const processYGroup = Math.floor(avgY / 200) * 200;
      
      return processYGroup === yGroup;
    });
    
    const parallelCount = parallelProcesses.length;
    const totalProcessWidth = PROCESS_BOX_WIDTH * parallelCount;
    
    return totalProcessWidth + MARGIN_GAP + 15; // Total margin including gap and extra space
  };

  // Create lifeline nodes
  const lifelineNodes: Node[] = sortedLifelines.map((lifeline, index) => {
    const xPos = lifelineXPositions.get(lifeline.id) || (index * (LIFELINE_WIDTH + horizontalSpacing) + NODE_HORIZONTAL_PADDING);
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

  // Ensure all nodes have yPositions before layout calculation
  // Assign default positions to new nodes or dragged nodes that don't have yPosition yet
  const nodesWithPositions = nodes.map((node, index) => {
    if (node.yPosition === undefined) {
      // Assign a default yPosition based on array order
      // This ensures new nodes get positioned at the end in order
      const maxYPosition = nodes.reduce((max, n) => 
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
  const alignedNodePositions = calculateEvenSpacing(nodesWithPositions, nodeHeights, lifelines);
  
  // Create a map to store calculated yPosition values (center Y)
  const calculatedYPositions = new Map<string, number>();

  // Helper function to find process and parallel index for an anchor on its specific lifeline
  const getAnchorProcessInfo = (anchorId: string, anchorLifelineId: string): { processId: string; parallelIndex: number; parallelCount: number } | null => {
    if (!options.processes) return null;
    
    const process = options.processes.find(p => p.anchorIds.includes(anchorId));
    if (!process) return null;
    
    // Get the anchor to determine its type
    const currentAnchor = anchors.find(a => a.id === anchorId);
    if (!currentAnchor) return null;
    
    // Find parallel processes in the same Y range that have anchors on this lifeline with the same type
    const processAnchorPositions = process.anchorIds
      .map(id => {
        const anchor = anchors.find(a => a.id === id);
        const node = anchor ? nodesWithPositions.find(n => n.anchors?.some(a => a.id === id)) : null;
        return node?.yPosition;
      })
      .filter(y => y !== undefined);
    
    if (processAnchorPositions.length === 0) return null;
    
    const avgY = processAnchorPositions.reduce((sum, y) => sum + y!, 0) / processAnchorPositions.length;
    const yGroup = Math.floor(avgY / 200) * 200;
    
    // Find all processes in same Y group that have anchors on this lifeline with the same type
    const parallelProcesses = options.processes.filter(p => {
      // Check if this process has any anchor on the target lifeline with matching type
      const hasMatchingAnchor = p.anchorIds.some(id => {
        const anchor = anchors.find(a => a.id === id);
        return anchor?.lifelineId === anchorLifelineId && anchor?.anchorType === currentAnchor.anchorType;
      });
      
      if (!hasMatchingAnchor) return false;
      
      const pAnchorPositions = p.anchorIds
        .map(id => {
          const anchor = anchors.find(a => a.id === id);
          const node = anchor ? nodesWithPositions.find(n => n.anchors?.some(a => a.id === id)) : null;
          return node?.yPosition;
        })
        .filter(y => y !== undefined);
      
      if (pAnchorPositions.length === 0) return false;
      
      const pAvgY = pAnchorPositions.reduce((sum, y) => sum + y!, 0) / pAnchorPositions.length;
      const pYGroup = Math.floor(pAvgY / 200) * 200;
      
      return pYGroup === yGroup;
    });
    
    const parallelIndex = parallelProcesses.findIndex(p => p.id === process.id);
    
    return {
      processId: process.id,
      parallelIndex,
      parallelCount: parallelProcesses.length
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
      const PROCESS_CONTAINER_WIDTH = PROCESS_BOX_WIDTH * processInfo.parallelCount;
      
      // Determine side based on anchor type
      const isSourceAnchor = anchor.anchorType === 'source';
      const processContainerX = isSourceAnchor 
        ? lifelineX - PROCESS_CONTAINER_WIDTH - 10  // Left side for source
        : lifelineX + 10;                            // Right side for target
      
      // Center anchor in its process box
      xPos = processContainerX + (processInfo.parallelIndex * PROCESS_BOX_WIDTH) + (PROCESS_BOX_WIDTH / 2);
    } else {
      // Position on lifeline
      xPos = lifelineX;
    }
    
    // Find the connected node to get its Y position and height
    const connectedNode = nodesWithPositions.find(n => 
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

  // Calculate positions for each node (use nodesWithPositions for consistency)
  const layoutNodes: Node[] = nodesWithPositions.map((node, index) => {
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
    const MARGIN = 40; // Base margin from lifeline for edges
    let startX = 0;
    let width = 180; // Default width

    if (sourceAnchor && targetAnchor) {
      // Node connects two lifelines via anchors - span between them with margins
      const sourceX = lifelineXPositions.get(sourceAnchor.lifelineId) || 0;
      const targetX = lifelineXPositions.get(targetAnchor.lifelineId) || 0;
      
      // Calculate process margins for both lifelines at this node's Y position
      const sourceProcessMargin = getProcessMargin(sourceAnchor.lifelineId, topY, nodeHeight);
      const targetProcessMargin = getProcessMargin(targetAnchor.lifelineId, topY, nodeHeight);
      
      const leftX = Math.min(sourceX, targetX);
      const rightX = Math.max(sourceX, targetX);
      
      // Determine which side has processes and add extra margin
      const leftIsSource = sourceX < targetX;
      const leftProcessMargin = leftIsSource ? sourceProcessMargin : targetProcessMargin;
      const rightProcessMargin = leftIsSource ? targetProcessMargin : sourceProcessMargin;
      
      // Add margins to accommodate edges and process boxes
      const totalLeftMargin = MARGIN + leftProcessMargin;
      const totalRightMargin = MARGIN + rightProcessMargin;
      
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
  if (layoutEdges.length === 0 && nodesWithPositions.length > 0) {
    console.error('❌ [SequenceLayout] NO EDGES CREATED despite having nodes!', {
      nodeCount: nodesWithPositions.length,
      anchorCount: anchors.length,
      nodesWithAnchors: nodesWithPositions.filter(n => n.anchors && n.anchors.length === 2).length
    });
  }

  // Calculate process nodes if processes exist
  const processNodes: Node[] = [];
  if (options.processes && options.processes.length > 0) {
    try {
      const processLayout = calculateProcessLayout(
        options.processes,
        anchors,
        nodesWithPositions,
        lifelineXPositions,
        styles,
        nodeHeights
      );
      processNodes.push(...processLayout);
    } catch (error) {
      console.error('Error creating process layout:', error);
    }
  }

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

// Calculate spacing that allows nodes to share Y positions when they don't overlap horizontally
function calculateEvenSpacing(nodes: DiagramNode[], nodeHeights?: Map<string, number>, lifelines?: Lifeline[]): Map<string, number> {
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
  
  // Sort nodes by yPosition (all nodes should have yPosition at this point)
  // Use array index as fallback for safety
  const sortedNodes = [...nodes].sort((a, b) => {
    const aPos = a.yPosition !== undefined ? a.yPosition : nodes.indexOf(a) * 120;
    const bPos = b.yPosition !== undefined ? b.yPosition : nodes.indexOf(b) * 120;
    return aPos - bPos;
  });
  
  // Assign Y positions based on sorted nodes, allowing sharing when no overlap
  sortedNodes.forEach((node) => {
    if (!node || !node.anchors || node.anchors.length !== 2) {
      positions.set(node.id, startY);
      return;
    }
    
    const nodeConfig = getNodeTypeConfig(node.type);
    const measuredHeight = nodeHeights?.get(node.id);
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
        level.nodesWithRanges.push({ nodeId: node.id, range: nodeRange });
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
        nodesWithRanges: [{ nodeId: node.id, range: nodeRange }]
      };
      yLevels.push(assignedLevel);
    }
    
    positions.set(node.id, assignedLevel.y);
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

// Calculate layout for process nodes
const calculateProcessLayout = (
  processes: ProcessNode[],
  anchors: AnchorNode[],
  nodes: DiagramNode[],
  lifelinePositions: Map<string, number>,
  styles?: DiagramStyleTheme,
  nodeHeights?: Map<string, number>
): Node[] => {
  if (!processes || processes.length === 0) {
    return [];
  }

  const processNodes: Node[] = [];

  // Helper to get actual anchor Y position (center of node)
  const getAnchorCenterY = (anchorId: string): number | null => {
    const node = nodes.find(n => n && n.anchors?.some(a => a && a.id === anchorId));
    if (!node || node.yPosition === undefined) return null;
    
    const nodeConfig = node ? getNodeTypeConfig(node.type) : null;
    const measuredHeight = nodeHeights?.get(node.id);
    const nodeHeight = measuredHeight || nodeConfig?.defaultHeight || 70;
    
    return node.yPosition + (nodeHeight / 2);
  };

  // Group processes by lifeline-anchorType-Y range to determine parallel positioning
  const processGroups = new Map<string, Map<number, ProcessNode[]>>();

  // Create entries for each lifeline-anchorType combination per process
  processes.forEach(process => {
    if (!process || !process.anchorIds || process.anchorIds.length === 0) {
      console.warn('Process missing anchorIds:', process);
      return;
    }

    // Get all anchors for this process and group by lifeline-anchorType
    const lifelineAnchorGroups = new Map<string, string[]>();
    
    process.anchorIds.forEach(anchorId => {
      const anchor = anchors.find(a => a.id === anchorId);
      if (!anchor) return;
      
      const key = `${anchor.lifelineId}-${anchor.anchorType}`;
      if (!lifelineAnchorGroups.has(key)) {
        lifelineAnchorGroups.set(key, []);
      }
      lifelineAnchorGroups.get(key)!.push(anchorId);
    });

    // For each lifeline-anchorType group, add to processGroups
    lifelineAnchorGroups.forEach((anchorIds, key) => {
      const anchorYPositions: number[] = [];
      
      anchorIds.forEach(anchorId => {
        const anchorY = getAnchorCenterY(anchorId);
        if (anchorY !== null) {
          anchorYPositions.push(anchorY);
        }
      });

      if (anchorYPositions.length === 0) return;

      // Calculate average Y position for grouping
      const avgY = anchorYPositions.reduce((sum, y) => sum + y, 0) / anchorYPositions.length;
      const yGroup = Math.floor(avgY / 200) * 200;

      if (!processGroups.has(key)) {
        processGroups.set(key, new Map());
      }
      
      const lifelineGroups = processGroups.get(key)!;
      if (!lifelineGroups.has(yGroup)) {
        lifelineGroups.set(yGroup, []);
      }
      
      lifelineGroups.get(yGroup)!.push(process);
    });
  });

  // Now create process nodes for each lifeline-anchorType combination
  processes.forEach(process => {
    if (!process || !process.anchorIds || process.anchorIds.length === 0) {
      return;
    }

    // Group anchors by lifeline-anchorType
    const lifelineAnchorGroups = new Map<string, { lifelineId: string; anchorType: string; anchorIds: string[] }>();
    
    process.anchorIds.forEach(anchorId => {
      const anchor = anchors.find(a => a.id === anchorId);
      if (!anchor) return;
      
      const key = `${anchor.lifelineId}-${anchor.anchorType}`;
      if (!lifelineAnchorGroups.has(key)) {
        lifelineAnchorGroups.set(key, {
          lifelineId: anchor.lifelineId,
          anchorType: anchor.anchorType,
          anchorIds: []
        });
      }
      lifelineAnchorGroups.get(key)!.anchorIds.push(anchorId);
    });

    // Create a process box for each lifeline-anchorType combination
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

      // Calculate bounds based on actual anchor positions with node heights
      const ANCHOR_MARGIN = 25;
      const NODE_HEIGHT = 70;
      const minAnchorY = Math.min(...anchorYPositions);
      const maxAnchorY = Math.max(...anchorYPositions);
      
      // Get height of bottom anchor's node to extend below it
      const bottomAnchorId = connectedAnchors[anchorYPositions.indexOf(maxAnchorY)];
      const bottomNode = nodes.find(n => n.anchors?.some(a => a.id === bottomAnchorId));
      const bottomNodeHeight = bottomNode ? (nodeHeights?.get(bottomNode.id) || getNodeTypeConfig(bottomNode.type)?.defaultHeight || NODE_HEIGHT) : NODE_HEIGHT;
      
      // Process box: top margin from top anchor center, bottom margin from bottom anchor's bottom edge
      const yPosition = minAnchorY - ANCHOR_MARGIN;
      const bottomY = maxAnchorY + (bottomNodeHeight / 2) + ANCHOR_MARGIN;
      const height = Math.max(bottomY - yPosition, 60);
      
      const avgY = (minAnchorY + maxAnchorY) / 2;
      const yGroup = Math.floor(avgY / 200) * 200;

      const lifelineX = lifelinePositions.get(group.lifelineId);
      if (lifelineX === undefined) {
        console.warn('Lifeline position not found for process:', group.lifelineId);
        return;
      }

      // Determine parallel count for this lifeline-anchorType-Y group
      const lifelineGroups = processGroups.get(key);
      const parallelProcesses = lifelineGroups?.get(yGroup) || [];
      const parallelCount = parallelProcesses.length;
      
      // Find this process's index in the parallel group
      const parallelIndex = parallelProcesses.findIndex(p => p.id === process.id);

      // Calculate dimensions
      const PROCESS_BOX_WIDTH = 50;
      const PROCESS_CONTAINER_WIDTH = PROCESS_BOX_WIDTH * parallelCount;
      
      // Position based on anchor type
      const isSourceSide = group.anchorType === 'source';
      const baseContainerX = isSourceSide
        ? lifelineX - PROCESS_CONTAINER_WIDTH - 10  // Left side for source
        : lifelineX + 10;                            // Right side for target
      
      // Offset each parallel process horizontally based on its index
      const processX = baseContainerX + (parallelIndex * PROCESS_BOX_WIDTH);

      processNodes.push({
        id: `process-${process.id}-${key}`,
        type: 'processNode',
        position: { x: processX, y: yPosition },
        data: {
          processNode: process,
          processId: process.id,
          theme: styles,
          parallelCount
        },
        style: {
          width: PROCESS_BOX_WIDTH,
          height: height,
          zIndex: 50
        },
        draggable: false,
        selectable: true
      });
    });
  });

  return processNodes;
};
