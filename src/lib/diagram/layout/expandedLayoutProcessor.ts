
import { DiagramElements, CollapsedState } from '../types';
import { 
  createPropertyNode, 
  createNestedPropertyNode, 
  createArrayItemNode 
} from '../nodeGenerator';
import { createEdge } from '../edgeGenerator';

/**
 * Process a single property and add it to the diagram with all of its children
 * according to the schema, maxDepth and collapsedPaths
 */
export const processProperty = (
  propName: string,
  propSchema: any,
  requiredProps: string[],
  xPos: number,
  yPos: number,
  result: DiagramElements,
  parentId: string,
  currentPath: string,
  currentDepth: number,
  maxDepth: number,
  collapsedPaths: CollapsedState = {}
): void => {
  // Skip if propSchema is null or undefined
  if (!propSchema) return;
  
  const propPath = `${currentPath}.properties.${propName}`;
  
  // Check if this path or any parent is collapsed
  // Default to collapsed (true) if not explicitly set to false
  const isExplicitlyCollapsed = collapsedPaths[propPath] === true;
  const isExplicitlyExpanded = collapsedPaths[propPath] === false;
  const isCollapsed = isExplicitlyCollapsed || (!isExplicitlyExpanded && true); // Default to true if not set
  
  console.log(`Processing property ${propName}, path: ${propPath}, collapsed: ${isCollapsed}`);
  
  if (isCollapsed) {
    console.log(`Skipping collapsed property: ${propName} at path ${propPath}`);
    return;
  }
  
  // Create node for property
  const propNode = createPropertyNode(propName, propSchema, requiredProps, xPos, yPos);
  
  // Add edge from parent to property
  const edge = createEdge(parentId, propNode.id);
  
  result.nodes.push(propNode);
  result.edges.push(edge);
  
  // Only process nested properties if we haven't reached max depth and not collapsed
  if (currentDepth < maxDepth) {
    if (propSchema.type === 'object' && propSchema.properties) {
      const nestedPath = `${propPath}.properties`;
      const nestedCollapsed = collapsedPaths[nestedPath] !== false; // Default to true
      
      if (nestedCollapsed) {
        console.log(`Nested properties at ${nestedPath} are collapsed, marking node`);
        propNode.data.isCollapsed = true;
        return;
      }
      
      const nestedProps = propSchema.properties;
      const nestedRequired = propSchema.required || [];
      
      // Update the parent node data with property count
      propNode.data.properties = Object.keys(nestedProps).length;
      
      // Process each nested property
      let childXPos = xPos - (Object.keys(nestedProps).length * 100) / 2;
      const childYPos = yPos + 150;
      const xSpacing = 200;
      
      Object.entries(nestedProps).forEach(([childName, childSchema], index) => {
        const childPos = childXPos + (index * xSpacing);
        const childPath = `${propPath}.properties.${childName}`;
        
        // Check if this specific child is collapsed
        const childCollapsed = collapsedPaths[childPath] !== false; // Default to true
        
        if (!childCollapsed) {
          processProperty(
            childName,
            childSchema,
            nestedRequired,
            childPos,
            childYPos,
            result,
            propNode.id,
            propPath,
            currentDepth + 1,
            maxDepth,
            collapsedPaths
          );
        }
      });
    }
    
    if (propSchema.type === 'array' && propSchema.items) {
      const itemsPath = `${propPath}.items`;
      const itemsCollapsed = collapsedPaths[itemsPath] !== false; // Default to true
      
      if (itemsCollapsed) {
        console.log(`Array items at ${itemsPath} are collapsed, marking node`);
        propNode.data.isCollapsed = true;
        return;
      }
      
      const itemSchema = propSchema.items;
      
      // Update the parent node with minItems/maxItems if defined
      propNode.data.minItems = propSchema.minItems;
      propNode.data.maxItems = propSchema.maxItems;
      
      // Create node for array items
      const itemNode = createArrayItemNode(propNode.id, itemSchema, xPos, yPos + 150);
      
      // Add edge from array to items
      const itemsEdge = createEdge(propNode.id, itemNode.id, 'items');
      
      result.nodes.push(itemNode);
      result.edges.push(itemsEdge);
      
      // If array items are objects with properties, process them too
      if (itemSchema.type === 'object' && itemSchema.properties) {
        const objectItemsPath = `${itemsPath}.properties`;
        const objectItemsCollapsed = collapsedPaths[objectItemsPath] !== false; // Default to true
        
        if (!objectItemsCollapsed && currentDepth + 1 < maxDepth) {
          const itemProps = itemSchema.properties;
          const itemRequired = itemSchema.required || [];
          
          // Process the object properties
          let childXPos = xPos - (Object.keys(itemProps).length * 100) / 2;
          const childYPos = yPos + 300;
          const xSpacing = 200;
          
          Object.entries(itemProps).forEach(([childName, childSchema], index) => {
            const childPos = childXPos + (index * xSpacing);
            processProperty(
              childName,
              childSchema,
              itemRequired,
              childPos,
              childYPos,
              result,
              itemNode.id,
              itemsPath,
              currentDepth + 2,
              maxDepth,
              collapsedPaths
            );
          });
        } else if (objectItemsCollapsed) {
          itemNode.data.isCollapsed = true;
        }
      }
    }
  } else if (currentDepth >= maxDepth) {
    // At max depth, add indicator that there are more levels
    if ((propSchema.type === 'object' && propSchema.properties) || 
        (propSchema.type === 'array' && propSchema.items && 
         propSchema.items.type === 'object' && propSchema.items.properties)) {
      propNode.data.hasMoreLevels = true;
    }
  }
};
