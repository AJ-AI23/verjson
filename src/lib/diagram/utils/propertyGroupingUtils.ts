import { DiagramElements } from '../types';
import { createPropertyNode, createGroupedPropertiesNode } from '../nodeGenerator';
import { createEdge } from '../edgeGenerator';

export interface PropertyGroupingOptions {
  maxIndividualProperties: number;
  xSpacing: number;
  parentNodeId: string;
  parentPath: string;
  yPosition: number;
  startXPosition: number;
  collapsedPaths?: Record<string, boolean>;
}

export interface PropertyGroupingResult {
  totalNodesCreated: number;
  nodesProcessed: number;
}

/**
 * Generic utility to handle property grouping across all layout types
 * Groups properties when count exceeds maxIndividualProperties
 */
export function processPropertiesWithGrouping(
  properties: Record<string, any> | [string, any][],
  requiredProps: string[],
  result: DiagramElements,
  options: PropertyGroupingOptions
): PropertyGroupingResult {
  console.log('🔧 DEBUG [PROPERTY GROUPING] Called with:', {
    propertiesCount: Array.isArray(properties) ? properties.length : Object.keys(properties).length,
    maxIndividualProperties: options.maxIndividualProperties,
    parentNodeId: options.parentNodeId,
    parentPath: options.parentPath
  });
  
  const { maxIndividualProperties, parentNodeId, yPosition, startXPosition, xSpacing } = options;
  
  // Convert to array format if needed
  const propertyEntries = Array.isArray(properties) 
    ? properties 
    : Object.entries(properties);
    
  const totalProperties = propertyEntries.length;
  
  if (totalProperties === 0) {
    return { totalNodesCreated: 0, nodesProcessed: 0 };
  }
  
  // Determine if we need to group properties
  const shouldGroupProperties = totalProperties > maxIndividualProperties;
  
  console.log('🔧 DEBUG [PROPERTY GROUPING] Grouping decision:', {
    totalProperties,
    maxIndividualProperties, 
    shouldGroupProperties,
    willShowIndividual: shouldGroupProperties ? maxIndividualProperties - 1 : totalProperties,
    willShowGrouped: shouldGroupProperties ? totalProperties - (maxIndividualProperties - 1) : 0
  });
  
  if (shouldGroupProperties) {
    console.log('🔧 DEBUG [PROPERTY GROUPING] Entering grouping logic');
    
    // Prioritize expanded properties for individual display
    const { collapsedPaths, parentPath } = options;
    
    let expandedProperties: [string, any][] = [];
    let nonExpandedProperties: [string, any][] = [];
    
    if (collapsedPaths && parentPath) {
      // Separate expanded and non-expanded properties
      propertyEntries.forEach(([propName, propSchema]) => {
        const propPath = `${parentPath}.${propName}`;
        if (collapsedPaths[propPath] === false) {
          expandedProperties.push([propName, propSchema]);
        } else {
          nonExpandedProperties.push([propName, propSchema]);
        }
      });
    } else {
      // Fallback: no expansion info, use original order
      nonExpandedProperties = propertyEntries;
    }
    
    // Calculate how many individual slots we have (reserving 1 for grouped node)
    const individualSlots = maxIndividualProperties - 1;
    const expandedCount = expandedProperties.length;
    
    // Take expanded properties first, then fill remaining slots with non-expanded
    const remainingSlotsForNonExpanded = Math.max(0, individualSlots - expandedCount);
    const individualNonExpanded = nonExpandedProperties.slice(0, remainingSlotsForNonExpanded);
    const groupedProperties = nonExpandedProperties.slice(remainingSlotsForNonExpanded);
    
    // Combine for display: expanded first, then individual non-expanded
    const individualProperties = [...expandedProperties, ...individualNonExpanded];
    
    console.log('🔧 DEBUG [PROPERTY GROUPING] Property prioritization:', {
      expandedCount,
      individualSlots,
      remainingSlotsForNonExpanded,
      individualPropertiesCount: individualProperties.length,
      groupedPropertiesCount: groupedProperties.length,
      expandedPropertyNames: expandedProperties.map(([name]) => name),
      individualNonExpandedNames: individualNonExpanded.map(([name]) => name)
    });
    
    // Calculate positions
    const totalNodesToShow = maxIndividualProperties;
    const centerOffset = (totalNodesToShow - 1) * xSpacing / 2;
    
    // Create individual property nodes
    individualProperties.forEach(([propName, propSchema], index) => {
      const xPos = startXPosition - centerOffset + (index * xSpacing);
      
      const propNode = createPropertyNode(
        propName,
        propSchema,
        requiredProps,
        xPos,
        yPosition,
        false
      );
      
      console.log('🔧 DEBUG [PROPERTY GROUPING] Creating individual node:', {
        propName,
        nodeId: propNode.id,
        position: { x: xPos, y: yPosition }
      });
      
      const edge = createEdge(parentNodeId, propNode.id, undefined, false, {}, 'structure');
      result.nodes.push(propNode);
      result.edges.push(edge);
    });
    
    // Create grouped node for remaining properties
    const groupedXPos = startXPosition - centerOffset + ((maxIndividualProperties - 1) * xSpacing);
    const groupedNode = createGroupedPropertiesNode(
      `${parentNodeId}-grouped-${Date.now()}`,
      groupedProperties,
      requiredProps,
      groupedXPos,
      yPosition
    );
    
    // Enhanced grouped node data with proper PropertyDetails format
    const propertyDetails = groupedProperties.map(([propName, propSchema]) => ({
      name: propName,
      type: propSchema?.type || 'any',
      required: requiredProps.includes(propName),
      format: propSchema?.format,
      description: propSchema?.description,
      reference: propSchema?.$ref
    }));
    
    groupedNode.data = {
      ...groupedNode.data,
      label: `${groupedProperties.length} More Properties`,
      isGroupedProperties: true, // Special flag for styling
      propertyDetails: propertyDetails,
      hasCollapsibleContent: true,
      isCollapsed: false, // Grouped nodes show their content by default to display bullet points
      description: `View details of ${groupedProperties.length} grouped properties`
    };
    
    console.log('🔧 DEBUG [PROPERTY GROUPING] Creating grouped node:', {
      nodeId: groupedNode.id,
      label: groupedNode.data.label,
      position: { x: groupedXPos, y: yPosition },
      propertyCount: groupedProperties.length,
      hasPropertyDetails: !!groupedNode.data.propertyDetails,
      propertyDetailsCount: propertyDetails.length,
      isCollapsed: groupedNode.data.isCollapsed,
      samplePropertyDetail: propertyDetails[0]
    });
    
    const groupedEdge = createEdge(parentNodeId, groupedNode.id, undefined, false, {}, 'structure');
    result.nodes.push(groupedNode);
    result.edges.push(groupedEdge);
    
    return { 
      totalNodesCreated: maxIndividualProperties, 
      nodesProcessed: totalProperties 
    };
  } else {
    // Show all properties individually
    const centerOffset = (totalProperties - 1) * xSpacing / 2;
    
    propertyEntries.forEach(([propName, propSchema], index) => {
      const xPos = startXPosition - centerOffset + (index * xSpacing);
      
      const propNode = createPropertyNode(
        propName,
        propSchema,
        requiredProps,
        xPos,
        yPosition,
        false
      );
      
      const edge = createEdge(parentNodeId, propNode.id, undefined, false, {}, 'structure');
      result.nodes.push(propNode);
      result.edges.push(edge);
    });
    
    return { 
      totalNodesCreated: totalProperties, 
      nodesProcessed: totalProperties 
    };
  }
}

/**
 * Generic grouping function for any child elements (schemas, properties, etc.)
 * Groups children when count exceeds maxIndividualItems, but shows expanded children individually
 */
export function processWithGrouping(
  items: Record<string, any>,
  parentNodeId: string,
  xPos: number,
  yPos: number,
  xSpacing: number,
  result: DiagramElements,
  maxIndividualItems: number = 4,
  collapsedPaths: Record<string, boolean> = {},
  parentPath: string = '',
  requiredProps: string[] = []
): PropertyGroupingResult {
  const itemEntries = Object.entries(items);
  
  // Find which items are explicitly expanded
  const expandedItems = itemEntries.filter(([itemName]) => {
    const itemPath = `${parentPath}.${itemName}`;
    return collapsedPaths[itemPath] === false; // explicitly expanded
  });
  
  const totalItems = itemEntries.length;
  const expandedCount = expandedItems.length;
  
  console.log('🔧 DEBUG [GENERIC GROUPING] Analyzing items:', {
    parentPath,
    totalItems,
    expandedCount,
    maxIndividualItems,
    expandedPaths: expandedItems.map(([name]) => `${parentPath}.${name}`)
  });
  
  // If total items <= maxIndividualItems + 1, show all individually
  if (totalItems <= maxIndividualItems + 1) {
    console.log('🔧 DEBUG [GENERIC GROUPING] Showing all items individually (count within limit)');
    return processPropertiesWithGrouping(
      items,
      requiredProps,
      result,
      {
        maxIndividualProperties: totalItems, // Show all
        xSpacing,
        parentNodeId,
        parentPath,
        yPosition: yPos,
        startXPosition: xPos,
        collapsedPaths
      }
    );
  }
  
  // If we have expanded items, we need to handle them specially
  if (expandedCount > 0) {
    // Show expanded items individually + group the rest if needed
    const nonExpandedItems = itemEntries.filter(([itemName]) => {
      const itemPath = `${parentPath}.${itemName}`;
      return collapsedPaths[itemPath] !== false; // not explicitly expanded
    });
    
    const individualItemsToShow = Math.max(maxIndividualItems - expandedCount, 0);
    const willHaveGroupedNode = nonExpandedItems.length > individualItemsToShow;
    
    // Calculate how many individual items we'll show total
    const totalIndividualNodes = expandedCount + individualItemsToShow;
    const maxPropertiesToProcess = totalIndividualNodes + (willHaveGroupedNode ? 1 : 0);
    
    console.log('🔧 DEBUG [GENERIC GROUPING] Mixed mode - expanded + grouped:', {
      expandedCount,
      individualItemsToShow,
      totalIndividualNodes,
      willHaveGroupedNode,
      maxPropertiesToProcess,
      nonExpandedCount: nonExpandedItems.length
    });
    
    // Pass ALL original items but set maxIndividualProperties to control grouping
    return processPropertiesWithGrouping(
      items, // Pass all items, not just individual ones
      requiredProps,
      result,
      {
        maxIndividualProperties: maxPropertiesToProcess,
        xSpacing,
        parentNodeId,
        parentPath,
        yPosition: yPos,
        startXPosition: xPos,
        collapsedPaths
      }
    );
  }
  
  // Default grouping behavior - no items are expanded
  console.log('🔧 DEBUG [GENERIC GROUPING] Default grouping behavior');
  return processPropertiesWithGrouping(
    items,
    requiredProps,
    result,
    {
      maxIndividualProperties: maxIndividualItems + 1, // +1 for the grouped node
      xSpacing,
      parentNodeId,
      parentPath,
      yPosition: yPos,
      startXPosition: xPos,
      collapsedPaths
    }
  );
}