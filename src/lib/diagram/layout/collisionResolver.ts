/**
 * Collision resolver for diagram nodes.
 * Uses a force-based algorithm to push overlapping nodes apart,
 * with directional bias to minimize upward movement.
 */

import { Node } from '@xyflow/react';
import { estimateNodeSize } from './nodeSizeCalculator';

export interface CollisionConfig {
  minDistance: number;         // Minimum gap between node edges
  iterations: number;          // Max iterations to resolve
  damping: number;             // Movement dampening (0-1)
  upwardResistance: number;    // Multiplier for upward movement (0-1)
  animationDuration: number;   // Smooth transition duration in ms
}

export interface NodeBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CollisionPair {
  nodeA: NodeBounds;
  nodeB: NodeBounds;
  overlapX: number;
  overlapY: number;
}

export const DEFAULT_COLLISION_CONFIG: CollisionConfig = {
  minDistance: 30,           // 30px minimum gap
  iterations: 50,            // Up to 50 resolution passes
  damping: 0.7,              // 70% of calculated movement applied
  upwardResistance: 0.1,     // Only 10% of upward movement allowed
  animationDuration: 300     // 300ms smooth transition
};

/**
 * Get bounding boxes for all nodes.
 * Uses React Flow's measured dimensions when available (actual rendered size),
 * otherwise falls back to estimated size.
 */
export function getNodeBounds(nodes: Node[]): NodeBounds[] {
  return nodes.map(node => {
    // Prefer React Flow's measured dimensions (actual DOM size) when available
    const measuredWidth = (node as any).measured?.width;
    const measuredHeight = (node as any).measured?.height;
    
    // Fall back to estimated size if measured dimensions not available
    const estimatedSize = estimateNodeSize(node.data, node.id);
    
    return {
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: measuredWidth ?? estimatedSize.width,
      height: measuredHeight ?? estimatedSize.height
    };
  });
}

/**
 * Check if two nodes overlap using proper bounding box collision detection.
 * Returns collision info if boxes overlap or are within minDistance of each other.
 */
function checkCollision(a: NodeBounds, b: NodeBounds, minDistance: number): CollisionPair | null {
  // Calculate the actual edges of each node
  const aLeft = a.x;
  const aRight = a.x + a.width;
  const aTop = a.y;
  const aBottom = a.y + a.height;
  
  const bLeft = b.x;
  const bRight = b.x + b.width;
  const bTop = b.y;
  const bBottom = b.y + b.height;

  // Check for actual bounding box overlap first (AABB collision)
  const actualOverlapX = Math.min(aRight, bRight) - Math.max(aLeft, bLeft);
  const actualOverlapY = Math.min(aBottom, bBottom) - Math.max(aTop, bTop);
  
  // If boxes actually overlap (not just close), this is a definite collision
  if (actualOverlapX > 0 && actualOverlapY > 0) {
    return { 
      nodeA: a, 
      nodeB: b, 
      overlapX: actualOverlapX + minDistance, // Add minDistance to push them apart enough
      overlapY: actualOverlapY + minDistance 
    };
  }

  // Check if boxes are within minDistance of each other (proximity collision)
  // Expand each box by minDistance/2 on each side and check for overlap
  const expandedOverlapX = Math.min(aRight + minDistance, bRight + minDistance) - Math.max(aLeft - minDistance, bLeft - minDistance);
  const expandedOverlapY = Math.min(aBottom + minDistance, bBottom + minDistance) - Math.max(aTop - minDistance, bTop - minDistance);
  
  // Calculate actual gap between boxes
  const gapX = Math.max(bLeft - aRight, aLeft - bRight, 0);
  const gapY = Math.max(bTop - aBottom, aTop - bBottom, 0);
  
  // If either gap is 0, boxes are adjacent or overlapping on that axis
  // If both gaps are less than minDistance, boxes are too close
  if (gapX < minDistance && gapY < minDistance) {
    // Calculate how much we need to push to achieve minDistance gap
    const neededPushX = gapX < minDistance ? minDistance - gapX : 0;
    const neededPushY = gapY < minDistance ? minDistance - gapY : 0;
    
    if (neededPushX > 0 || neededPushY > 0) {
      return { 
        nodeA: a, 
        nodeB: b, 
        overlapX: neededPushX, 
        overlapY: neededPushY 
      };
    }
  }

  return null;
}

/**
 * Detect all collisions between nodes
 */
function detectCollisions(bounds: NodeBounds[], minDistance: number): CollisionPair[] {
  const collisions: CollisionPair[] = [];

  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      const collision = checkCollision(bounds[i], bounds[j], minDistance);
      if (collision) {
        collisions.push(collision);
      }
    }
  }

  return collisions;
}

/**
 * Calculate repulsion vector with directional bias
 */
function calculateRepulsion(
  nodeA: NodeBounds,
  nodeB: NodeBounds,
  overlapX: number,
  overlapY: number,
  config: CollisionConfig
): { dxA: number; dyA: number; dxB: number; dyB: number } {
  // Calculate centers
  const centerAX = nodeA.x + nodeA.width / 2;
  const centerAY = nodeA.y + nodeA.height / 2;
  const centerBX = nodeB.x + nodeB.width / 2;
  const centerBY = nodeB.y + nodeB.height / 2;

  // Direction from A to B
  const dx = centerBX - centerAX;
  const dy = centerBY - centerAY;

  // Determine push direction based on which overlap is smaller
  // (push along the axis with less overlap for smoother resolution)
  let pushX = 0;
  let pushY = 0;

  if (overlapX < overlapY) {
    // Push horizontally
    pushX = dx >= 0 ? overlapX / 2 : -overlapX / 2;
  } else {
    // Push vertically
    pushY = dy >= 0 ? overlapY / 2 : -overlapY / 2;
  }

  // Apply upward resistance - reduce upward movement significantly
  let dyA = -pushY * config.damping;
  let dyB = pushY * config.damping;

  // If node would move up, apply resistance
  if (dyA < 0) {
    dyA *= config.upwardResistance;
    // Transfer the blocked movement to the other node (push it down more)
    dyB += Math.abs(pushY * config.damping * (1 - config.upwardResistance));
  }
  if (dyB < 0) {
    dyB *= config.upwardResistance;
    // Transfer the blocked movement to the other node
    dyA += Math.abs(pushY * config.damping * (1 - config.upwardResistance));
  }

  return {
    dxA: -pushX * config.damping,
    dyA,
    dxB: pushX * config.damping,
    dyB
  };
}

/**
 * Resolve all collisions iteratively
 */
export function resolveCollisions(
  nodes: Node[],
  config: CollisionConfig = DEFAULT_COLLISION_CONFIG
): Node[] {
  if (nodes.length < 2) return nodes;

  // Create mutable bounds array
  const bounds = getNodeBounds(nodes);
  const boundsMap = new Map<string, NodeBounds>();
  bounds.forEach(b => boundsMap.set(b.id, b));

  for (let iteration = 0; iteration < config.iterations; iteration++) {
    const collisions = detectCollisions(Array.from(boundsMap.values()), config.minDistance);

    if (collisions.length === 0) {
      break; // No more collisions, we're done
    }

    // Apply repulsion for each collision
    for (const collision of collisions) {
      const nodeA = boundsMap.get(collision.nodeA.id);
      const nodeB = boundsMap.get(collision.nodeB.id);

      if (!nodeA || !nodeB) continue;

      const repulsion = calculateRepulsion(
        nodeA,
        nodeB,
        collision.overlapX,
        collision.overlapY,
        config
      );

      // Update positions
      nodeA.x += repulsion.dxA;
      nodeA.y += repulsion.dyA;
      nodeB.x += repulsion.dxB;
      nodeB.y += repulsion.dyB;
    }
  }

  // Map resolved positions back to nodes
  return nodes.map(node => {
    const resolved = boundsMap.get(node.id);
    if (resolved) {
      return {
        ...node,
        position: {
          x: resolved.x,
          y: resolved.y
        }
      };
    }
    return node;
  });
}

/**
 * Easing function for smooth animation
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animate nodes from current to target positions
 */
export function animateNodes(
  currentNodes: Node[],
  targetNodes: Node[],
  setNodes: (updater: (nodes: Node[]) => Node[]) => void,
  duration: number = DEFAULT_COLLISION_CONFIG.animationDuration
): void {
  const startTime = performance.now();
  const startPositions = new Map(currentNodes.map(n => [n.id, { ...n.position }]));
  const targetPositions = new Map(targetNodes.map(n => [n.id, { ...n.position }]));

  function animate(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);

    setNodes(nodes => 
      nodes.map(node => {
        const start = startPositions.get(node.id);
        const target = targetPositions.get(node.id);

        if (!start || !target) return node;

        // Check if position actually changed
        if (start.x === target.x && start.y === target.y) {
          return node;
        }

        return {
          ...node,
          position: {
            x: start.x + (target.x - start.x) * eased,
            y: start.y + (target.y - start.y) * eased
          }
        };
      })
    );

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

/**
 * Resolve collisions with optional animation
 */
export function resolveCollisionsAnimated(
  nodes: Node[],
  setNodes: (updater: (nodes: Node[]) => Node[]) => void,
  config: CollisionConfig = DEFAULT_COLLISION_CONFIG,
  animate: boolean = true
): void {
  const resolved = resolveCollisions(nodes, config);

  if (animate) {
    animateNodes(nodes, resolved, setNodes, config.animationDuration);
  } else {
    setNodes(() => resolved);
  }
}
