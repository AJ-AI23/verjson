
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
