import { DiagramElements } from '../types';
import { createEdge } from '../edgeGenerator';
import { Node } from '@xyflow/react';

export interface ArrayItemGroupingOptions {
  maxIndividualArrayItems: number;
  xSpacing: number;
  parentNodeId: string;
  parentPath: string;
  yPosition: number;
  startXPosition: number;
  collapsedPaths?: Record<string, boolean>;
}

export interface ArrayItemGroupingResult {
  totalNodesCreated: number;
  itemsProcessed: number;
}

/**
 * Generic utility to handle array item grouping
 * Groups array items when count exceeds maxIndividualArrayItems
 */
export function processArrayItemsWithGrouping(
  items: any[],
  result: DiagramElements,
  options: ArrayItemGroupingOptions,
  createItemNode: (itemData: any, index: number, xPos: number, yPos: number, isExpanded?: boolean) => Node,
  createGroupedNode: (groupedItems: any[], xPos: number, yPos: number, parentNodeId: string) => Node
): ArrayItemGroupingResult {
  const { maxIndividualArrayItems, parentNodeId, yPosition, startXPosition, xSpacing, collapsedPaths, parentPath } = options;
  
  const totalItems = items.length;
  
  if (totalItems === 0) {
    return { totalNodesCreated: 0, itemsProcessed: 0 };
  }
  
  // Determine if we need to group items
  const shouldGroupItems = totalItems > maxIndividualArrayItems;
  
  if (shouldGroupItems) {
    // Prioritize expanded items for individual display
    let expandedIndices: number[] = [];
    let nonExpandedIndices: number[] = [];
    
    if (collapsedPaths && parentPath) {
      // Separate expanded and non-expanded items
      items.forEach((_, index) => {
        const itemPath = `${parentPath}[${index}]`;
        if (collapsedPaths[itemPath] === false) {
          expandedIndices.push(index);
        } else {
          nonExpandedIndices.push(index);
        }
      });
    } else {
      // Fallback: no expansion info, use original order
      nonExpandedIndices = items.map((_, i) => i);
    }
    
    // Calculate how many individual slots we have (reserving 1 for grouped node)
    const individualSlots = maxIndividualArrayItems - 1;
    const expandedCount = expandedIndices.length;
    
    // Take expanded items first, then fill remaining slots with non-expanded
    const remainingSlotsForNonExpanded = Math.max(0, individualSlots - expandedCount);
    const individualNonExpandedIndices = nonExpandedIndices.slice(0, remainingSlotsForNonExpanded);
    const groupedIndices = nonExpandedIndices.slice(remainingSlotsForNonExpanded);
    
    // Combine for display: expanded first, then individual non-expanded
    const individualIndices = [...expandedIndices, ...individualNonExpandedIndices];
    
    // Calculate positions
    const totalNodesToShow = maxIndividualArrayItems;
    const centerOffset = (totalNodesToShow - 1) * xSpacing / 2;
    
    // Create individual item nodes
    individualIndices.forEach((itemIndex, displayIndex) => {
      const xPos = startXPosition - centerOffset + (displayIndex * xSpacing);
      
      // Check if this item is expanded
      const itemPath = `${parentPath}[${itemIndex}]`;
      const isExpanded = collapsedPaths ? collapsedPaths[itemPath] === false : false;
      
      const itemNode = createItemNode(
        items[itemIndex],
        itemIndex,
        xPos,
        yPosition,
        isExpanded
      );
      
      const edge = createEdge(parentNodeId, itemNode.id, undefined, false, {}, 'structure');
      result.nodes.push(itemNode);
      result.edges.push(edge);
    });
    
    // Create grouped node for remaining items
    const groupedItems = groupedIndices.map(i => items[i]);
    const groupedXPos = startXPosition - centerOffset + ((maxIndividualArrayItems - 1) * xSpacing);
    const groupedNode = createGroupedNode(groupedItems, groupedXPos, yPosition, parentNodeId);
    
    const groupedEdge = createEdge(parentNodeId, groupedNode.id, undefined, false, {}, 'structure');
    result.nodes.push(groupedNode);
    result.edges.push(groupedEdge);
    
    return { 
      totalNodesCreated: maxIndividualArrayItems, 
      itemsProcessed: totalItems 
    };
  } else {
    // Show all items individually
    const centerOffset = (totalItems - 1) * xSpacing / 2;
    
    items.forEach((item, index) => {
      const xPos = startXPosition - centerOffset + (index * xSpacing);
      
      // Check if this item is expanded
      const itemPath = `${parentPath}[${index}]`;
      const isExpanded = collapsedPaths ? collapsedPaths[itemPath] === false : false;
      
      const itemNode = createItemNode(
        item,
        index,
        xPos,
        yPosition,
        isExpanded
      );
      
      const edge = createEdge(parentNodeId, itemNode.id, undefined, false, {}, 'structure');
      result.nodes.push(itemNode);
      result.edges.push(edge);
    });
    
    return { 
      totalNodesCreated: totalItems, 
      itemsProcessed: totalItems 
    };
  }
}
