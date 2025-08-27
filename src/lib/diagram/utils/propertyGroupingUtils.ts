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
    // Show first (maxIndividualProperties - 1) individual properties + 1 grouped node
    const individualProperties = propertyEntries.slice(0, maxIndividualProperties - 1);
    const groupedProperties = propertyEntries.slice(maxIndividualProperties - 1);
    
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
    
    // Enhanced grouped node data
    groupedNode.data.label = `${groupedProperties.length} More Properties`;
    groupedNode.data.isGroupedProperties = true; // Special flag for styling
    
    console.log('🔧 DEBUG [PROPERTY GROUPING] Creating grouped node:', {
      nodeId: groupedNode.id,
      label: groupedNode.data.label,
      position: { x: groupedXPos, y: yPosition },
      propertyCount: groupedProperties.length,
      hasPropertyDetails: !!groupedNode.data.propertyDetails,
      isCollapsed: groupedNode.data.isCollapsed
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
 * Process schema properties specifically (for components.schemas, etc.)
 */
export function processSchemasWithGrouping(
  schemas: Record<string, any>,
  parentNodeId: string,
  xPos: number,
  yPos: number,
  xSpacing: number,
  result: DiagramElements,
  maxIndividualSchemas: number = 4
): PropertyGroupingResult {
  return processPropertiesWithGrouping(
    schemas,
    [], // schemas don't have required props in the same way
    result,
    {
      maxIndividualProperties: maxIndividualSchemas,
      xSpacing,
      parentNodeId,
      parentPath: '',
      yPosition: yPos,
      startXPosition: xPos
    }
  );
}