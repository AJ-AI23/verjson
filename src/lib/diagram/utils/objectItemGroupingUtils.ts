import { DiagramElements } from '../types';
import { createEdge } from '../edgeGenerator';
import { Node } from '@xyflow/react';

export interface ObjectItemGroupingOptions {
  maxIndividualItems: number;
  xSpacing: number;
  parentNodeId: string;
  parentPath: string;
  yPosition: number;
  startXPosition: number;
  collapsedPaths?: Record<string, boolean>;
}

export interface ObjectItemGroupingResult {
  totalNodesCreated: number;
  itemsProcessed: number;
}

/**
 * Generic utility to handle object item grouping (for Record<string, any> items like paths)
 * Groups items when count exceeds maxIndividualItems
 */
export function processObjectItemsWithGrouping<T>(
  items: Record<string, T>,
  result: DiagramElements,
  options: ObjectItemGroupingOptions,
  createItemNode: (key: string, itemData: T, xPos: number, yPos: number, isExpanded?: boolean) => Node,
  createGroupedNode: (groupedItems: Array<{ key: string; data: T }>, xPos: number, yPos: number, parentNodeId: string) => Node,
  processExpandedItem?: (key: string, itemData: T, itemNode: Node, collapsedPaths: Record<string, boolean>, itemPath: string) => void
): ObjectItemGroupingResult {
  const { maxIndividualItems, parentNodeId, yPosition, startXPosition, xSpacing, collapsedPaths = {}, parentPath } = options;
  
  const itemEntries = Object.entries(items);
  const totalItems = itemEntries.length;
  
  if (totalItems === 0) {
    return { totalNodesCreated: 0, itemsProcessed: 0 };
  }
  
  // Determine if we need to group items
  const shouldGroupItems = totalItems > maxIndividualItems;
  
  if (shouldGroupItems) {
    // Prioritize expanded items for individual display
    let expandedEntries: [string, T][] = [];
    let nonExpandedEntries: [string, T][] = [];
    
    // Separate expanded and non-expanded items
    itemEntries.forEach(([key, data]) => {
      const itemPath = `${parentPath}.${key}`;
      if (collapsedPaths[itemPath] === false) {
        expandedEntries.push([key, data]);
      } else {
        nonExpandedEntries.push([key, data]);
      }
    });
    
    // Calculate how many individual slots we have (reserving 1 for grouped node)
    const individualSlots = maxIndividualItems - 1;
    const expandedCount = expandedEntries.length;
    
    // Take expanded items first, then fill remaining slots with non-expanded
    const remainingSlotsForNonExpanded = Math.max(0, individualSlots - expandedCount);
    const individualNonExpanded = nonExpandedEntries.slice(0, remainingSlotsForNonExpanded);
    const groupedEntries = nonExpandedEntries.slice(remainingSlotsForNonExpanded);
    
    // Combine for display: expanded first, then individual non-expanded
    const individualEntries = [...expandedEntries, ...individualNonExpanded];
    
    // Calculate positions
    const totalNodesToShow = maxIndividualItems;
    const centerOffset = (totalNodesToShow - 1) * xSpacing / 2;
    
    // Create individual item nodes
    individualEntries.forEach(([key, data], displayIndex) => {
      const xPos = startXPosition - centerOffset + (displayIndex * xSpacing);
      const itemPath = `${parentPath}.${key}`;
      
      // Check if this item is expanded
      const isExpanded = collapsedPaths[itemPath] === false;
      
      const itemNode = createItemNode(key, data, xPos, yPosition, isExpanded);
      
      const edge = createEdge(parentNodeId, itemNode.id, undefined, false, {}, 'structure');
      result.nodes.push(itemNode);
      result.edges.push(edge);
      
      // Process expanded item details if callback provided
      if (isExpanded && processExpandedItem) {
        processExpandedItem(key, data, itemNode, collapsedPaths, itemPath);
      }
    });
    
    // Create grouped node for remaining items
    if (groupedEntries.length > 0) {
      const groupedItems = groupedEntries.map(([key, data]) => ({ key, data }));
      const groupedXPos = startXPosition - centerOffset + ((maxIndividualItems - 1) * xSpacing);
      const groupedNode = createGroupedNode(groupedItems, groupedXPos, yPosition, parentNodeId);
      
      const groupedEdge = createEdge(parentNodeId, groupedNode.id, undefined, false, {}, 'structure');
      result.nodes.push(groupedNode);
      result.edges.push(groupedEdge);
    }
    
    return { 
      totalNodesCreated: Math.min(maxIndividualItems, individualEntries.length + (groupedEntries.length > 0 ? 1 : 0)), 
      itemsProcessed: totalItems 
    };
  } else {
    // Show all items individually
    const centerOffset = (totalItems - 1) * xSpacing / 2;
    
    itemEntries.forEach(([key, data], index) => {
      const xPos = startXPosition - centerOffset + (index * xSpacing);
      const itemPath = `${parentPath}.${key}`;
      
      // Check if this item is expanded
      const isExpanded = collapsedPaths[itemPath] === false;
      
      const itemNode = createItemNode(key, data, xPos, yPosition, isExpanded);
      
      const edge = createEdge(parentNodeId, itemNode.id, undefined, false, {}, 'structure');
      result.nodes.push(itemNode);
      result.edges.push(edge);
      
      // Process expanded item details if callback provided
      if (isExpanded && processExpandedItem) {
        processExpandedItem(key, data, itemNode, collapsedPaths, itemPath);
      }
    });
    
    return { 
      totalNodesCreated: totalItems, 
      itemsProcessed: totalItems 
    };
  }
}
