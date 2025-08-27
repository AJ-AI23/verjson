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
    console.log('🔧 DEBUG [PROPERTY GROUPING] Entering grouping logic');
    // Show first (maxIndividualProperties - 1) individual properties + 1 grouped node
    const individualProperties = propertyEntries.slice(0, maxIndividualProperties - 1);
    const groupedProperties = propertyEntries.slice(maxIndividualProperties - 1);
    
    console.log('🔧 DEBUG [PROPERTY GROUPING] Property slicing:', {
      individualCount: individualProperties.length,
      groupedCount: groupedProperties.length,
      totalEntries: propertyEntries.length
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
 * Process schema properties specifically (for components.schemas, etc.)
 */
export function processSchemasWithGrouping(
  schemas: Record<string, any>,
  parentNodeId: string,
  xPos: number,
  yPos: number,
  xSpacing: number,
  result: DiagramElements,
  maxIndividualSchemas: number = 4,
  collapsedPaths: Record<string, boolean> = {},
  parentPath: string = ''
): PropertyGroupingResult {
  // Check if any schemas are already individually expanded
  const schemaEntries = Object.entries(schemas);
  const expandedSchemasCount = schemaEntries.filter(([schemaName]) => {
    const schemaPath = parentPath ? `${parentPath}.${schemaName}` : schemaName;
    return collapsedPaths[schemaPath] === false; // explicitly expanded
  }).length;
  
  // Don't group if we have individual schemas already expanded
  const shouldGroup = expandedSchemasCount === 0;
  
  console.log('🔧 DEBUG [SCHEMAS WITH GROUPING] Grouping decision:', {
    parentPath,
    expandedSchemasCount,
    totalSchemas: schemaEntries.length,
    shouldGroup,
    maxIndividualSchemas
  });
  
  return processPropertiesWithGrouping(
    schemas,
    [], // schemas don't have required props in the same way
    result,
    {
      maxIndividualProperties: shouldGroup ? maxIndividualSchemas : schemaEntries.length, // Show all individually if some are expanded
      xSpacing,
      parentNodeId,
      parentPath,
      yPosition: yPos,
      startXPosition: xPos
    }
  );
}