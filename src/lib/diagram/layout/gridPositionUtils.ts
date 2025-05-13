
import { GridConfig, GridState } from './types';

/**
 * Calculates a grid position that avoids overlapping nodes
 */
export const calculateGridPosition = (
  level: number, 
  index: number, 
  gridState: GridState,
  config: GridConfig
): { x: number, y: number } => {
  // Calculate appropriate column and ensure it's not already occupied
  let column = index % 3 - 1; // -1, 0, 1 for left, center, right
  const levelGrid = gridState.grid[level] || {};
  
  // Avoid collision by finding an open column
  if (levelGrid[column]) {
    // Try neighboring columns
    const alternatives = [-1, 0, 1].filter(c => !levelGrid[c]);
    if (alternatives.length > 0) {
      column = alternatives[0];
    } else {
      // If all columns are occupied, create a new column further out
      column = index >= 0 ? index + 1 : index - 1;
    }
  }
  
  // Mark this position as occupied
  if (!gridState.grid[level]) {
    gridState.grid[level] = {};
  }
  gridState.grid[level][column] = true;
  
  // Track max nodes at this level for y-coordinate calculation
  gridState.maxNodesPerLevel[level] = (gridState.maxNodesPerLevel[level] || 0) + 1;
  
  // Calculate actual x,y coordinates
  const x = config.initialX + (column * config.xGap);
  const y = config.startY + (level * config.yGap);
  
  return { x, y };
};
