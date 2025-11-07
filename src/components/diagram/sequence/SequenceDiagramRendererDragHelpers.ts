import { Node } from '@xyflow/react';
import { DiagramNode, Lifeline, AnchorNode as AnchorNodeType } from '@/types/diagram';
import { getNodeTypeConfig } from '@/lib/diagram/sequenceNodeTypes';

/**
 * Helper to reorder nodes array based on their visual Y positions after drag
 */
export const reorderNodesByVisualPosition = (
  visualNodes: Node[],
  diagramNodes: DiagramNode[]
): DiagramNode[] => {
  // Sort visual nodes by Y position
  const sortedVisualNodes = visualNodes
    .filter(n => n.type === 'sequenceNode')
    .sort((a, b) => a.position.y - b.position.y);
  
  // Reorder diagram nodes to match visual order
  const reorderedNodes = sortedVisualNodes
    .map(visualNode => diagramNodes.find(n => n.id === visualNode.id))
    .filter(Boolean) as DiagramNode[];
  
  return reorderedNodes;
};

/**
 * Helper to update anchor lifelines when anchor is dragged
 */
export const updateAnchorLifelines = (
  anchorId: string,
  newLifelineId: string,
  diagramNodes: DiagramNode[]
): DiagramNode[] => {
  return diagramNodes.map(node => {
    const anchorIndex = node.anchors?.findIndex(a => a.id === anchorId);
    
    if (anchorIndex !== undefined && anchorIndex !== -1) {
      const updatedAnchors = [...node.anchors];
      const otherAnchorIndex = anchorIndex === 0 ? 1 : 0;
      const draggedAnchor = updatedAnchors[anchorIndex];
      const otherAnchor = updatedAnchors[otherAnchorIndex];
      
      // Check if we're swapping (dragging to the same lifeline as the other anchor)
      if (newLifelineId === otherAnchor.lifelineId) {
        // Swap lifelines AND anchor types
        updatedAnchors[anchorIndex] = {
          ...draggedAnchor,
          lifelineId: otherAnchor.lifelineId,
          anchorType: otherAnchor.anchorType
        };
        updatedAnchors[otherAnchorIndex] = {
          ...otherAnchor,
          lifelineId: draggedAnchor.lifelineId,
          anchorType: draggedAnchor.anchorType
        };
      } else {
        // Just update the dragged anchor's lifeline
        updatedAnchors[anchorIndex] = {
          ...draggedAnchor,
          lifelineId: newLifelineId
        };
      }
      
      return {
        ...node,
        anchors: updatedAnchors as [AnchorNodeType, AnchorNodeType]
      };
    }
    
    return node;
  });
};
