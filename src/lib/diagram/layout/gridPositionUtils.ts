
// Calculate positions for nodes in a grid layout

/**
 * Calculate positions for nodes in a grid layout
 * @param count Number of nodes to position
 * @param maxPerRow Maximum nodes per row (defaults to 3)
 * @returns Array of positions with x and y coordinates
 */
export function getGroupPositions(count: number, maxPerRow: number = 3): Array<{x: number, y: number}> {
  const positions: Array<{x: number, y: number}> = [];
  const spacing = 300;
  const rowSpacing = 250;
  
  // Calculate total width based on count (up to maxPerRow)
  const itemsPerRow = Math.min(count, maxPerRow);
  const totalWidth = itemsPerRow * spacing;
  const startX = -totalWidth / 2 + spacing / 2;
  
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / maxPerRow);
    const col = i % maxPerRow;
    
    const x = startX + col * spacing;
    const y = 150 + row * rowSpacing;
    
    positions.push({ x, y });
  }
  
  return positions;
}

/**
 * Calculate position for a node in a grid
 * @param level The level in the hierarchy
 * @param index The index at the current level
 * @param gridState Current grid state tracking
 * @param gridConfig Configuration options for the grid
 * @returns Position with x and y coordinates
 */
export function calculateGridPosition(
  level: number, 
  index: number, 
  gridState: Record<number, number> = {}, 
  gridConfig: { spacing: number, levelSpacing: number } = { spacing: 200, levelSpacing: 150 }
): { x: number, y: number } {
  const { spacing, levelSpacing } = gridConfig;
  
  // Update count at this level
  if (!gridState[level]) {
    gridState[level] = 0;
  }
  
  const position = {
    x: (index - (gridState[level] / 2)) * spacing,
    y: level * levelSpacing
  };
  
  // Increment the count at this level
  gridState[level]++;
  
  return position;
}
