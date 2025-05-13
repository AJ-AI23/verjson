
/**
 * Utility for normalizing and building paths for properties
 */
export const buildPropertyPath = (
  currentPath: string,
  propName: string,
  includeProperties: boolean = true
): { nodePath: string; fullPath: string } => {
  const nodePath = currentPath ? `${currentPath}.${propName}` : propName;
  
  // For diagram consistency, we need to include .properties in paths
  const fullPath = includeProperties ? 
    `${currentPath}.properties.${propName}` : nodePath;
  
  return { nodePath, fullPath };
};

/**
 * Checks if we can process further based on depth
 */
export const canProcessFurther = (depth: number, maxDepth: number): boolean => {
  return depth < maxDepth;
};
