import { DiagramNode, ProcessNode, Lifeline } from '@/types/diagram';

/**
 * Extracts the numeric suffix from an ID (e.g., "node-5" returns 5)
 */
const extractNumber = (id: string, prefix: string): number | null => {
  if (!id.startsWith(`${prefix}-`)) return null;
  const suffix = id.slice(prefix.length + 1);
  // Handle IDs like "anchor-3" or "node-5" (just a number)
  const parsed = parseInt(suffix, 10);
  if (!isNaN(parsed)) return parsed;
  return null;
};

/**
 * Gets the next incremental ID for a given prefix based on existing IDs
 */
const getNextId = (existingIds: string[], prefix: string): string => {
  let maxNumber = 0;
  
  for (const id of existingIds) {
    const num = extractNumber(id, prefix);
    if (num !== null && num > maxNumber) {
      maxNumber = num;
    }
  }
  
  return `${prefix}-${maxNumber + 1}`;
};

/**
 * Generates a new unique node ID based on existing nodes
 */
export const generateNodeId = (existingNodes: DiagramNode[]): string => {
  const existingIds = existingNodes.map(n => n.id);
  return getNextId(existingIds, 'node');
};

/**
 * Generates new unique anchor IDs based on existing anchors in all nodes
 * Returns a tuple of two anchor IDs (source and target)
 */
export const generateAnchorIds = (existingNodes: DiagramNode[]): [string, string] => {
  const existingAnchorIds: string[] = [];
  
  for (const node of existingNodes) {
    if (node.anchors) {
      for (const anchor of node.anchors) {
        existingAnchorIds.push(anchor.id);
      }
    }
  }
  
  const id1 = getNextId(existingAnchorIds, 'anchor');
  // Add the first ID to the list so the second one increments properly
  existingAnchorIds.push(id1);
  const id2 = getNextId(existingAnchorIds, 'anchor');
  
  return [id1, id2];
};

/**
 * Generates a new unique lifeline ID based on existing lifelines
 */
export const generateLifelineId = (existingLifelines: Lifeline[]): string => {
  const existingIds = existingLifelines.map(l => l.id);
  return getNextId(existingIds, 'lifeline');
};

/**
 * Generates a new unique process ID based on existing processes
 */
export const generateProcessId = (existingProcesses: ProcessNode[]): string => {
  const existingIds = existingProcesses.map(p => p.id);
  return getNextId(existingIds, 'process');
};

/**
 * Generates multiple unique anchor IDs for batch operations (like importing multiple nodes)
 * Returns an array of anchor ID pairs
 */
export const generateBatchAnchorIds = (
  existingNodes: DiagramNode[], 
  count: number
): [string, string][] => {
  const existingAnchorIds: string[] = [];
  
  for (const node of existingNodes) {
    if (node.anchors) {
      for (const anchor of node.anchors) {
        existingAnchorIds.push(anchor.id);
      }
    }
  }
  
  const result: [string, string][] = [];
  
  for (let i = 0; i < count; i++) {
    const id1 = getNextId(existingAnchorIds, 'anchor');
    existingAnchorIds.push(id1);
    const id2 = getNextId(existingAnchorIds, 'anchor');
    existingAnchorIds.push(id2);
    result.push([id1, id2]);
  }
  
  return result;
};

/**
 * Generates multiple unique node IDs for batch operations
 */
export const generateBatchNodeIds = (
  existingNodes: DiagramNode[], 
  count: number
): string[] => {
  const existingIds = existingNodes.map(n => n.id);
  const result: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const id = getNextId(existingIds, 'node');
    existingIds.push(id);
    result.push(id);
  }
  
  return result;
};
