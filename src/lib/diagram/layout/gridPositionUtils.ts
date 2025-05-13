
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

/**
 * Calculates positions for a group of nodes in a grid layout
 */
export const getGroupPositions = (groupCount: number): Array<{ x: number, y: number }> => {
  const positions: Array<{ x: number, y: number }> = [];
  const centerX = 0;
  const startY = 150;
  const xGap = 300;
  const yGap = 250;
  
  // Position groups in a balanced grid layout
  for (let i = 0; i < groupCount; i++) {
    // For odd number of groups, place one in the center and others symmetrically
    // For even number, place them symmetrically around the center
    let x = centerX;
    if (groupCount > 1) {
      const isEven = groupCount % 2 === 0;
      const offset = isEven ? (i % 2 === 0 ? -1 : 1) * Math.ceil(i / 2) : Math.floor(i - groupCount / 2);
      x = centerX + (offset * xGap);
    }
    
    // Calculate row based on maximum items per row (3)
    const row = Math.floor(i / 3);
    const y = startY + (row * yGap);
    
    positions.push({ x, y });
  }
  
  return positions;
};
