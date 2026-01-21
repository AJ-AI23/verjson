import { DiagramNode, ProcessNode, Lifeline } from '@/types/diagram';

/**
 * Generates a new unique node ID based on counting existing nodes
 * If there are 4 nodes, the next ID will be "node-5"
 */
export const generateNodeId = (existingNodes: DiagramNode[]): string => {
  return `node-${existingNodes.length + 1}`;
};

/**
 * Generates new unique anchor IDs based on counting existing anchors in all nodes
 * Returns a tuple of two anchor IDs (source and target)
 */
export const generateAnchorIds = (existingNodes: DiagramNode[]): [string, string] => {
  let anchorCount = 0;
  
  for (const node of existingNodes) {
    if (node.anchors) {
      anchorCount += node.anchors.length;
    }
  }
  
  return [`anchor-${anchorCount + 1}`, `anchor-${anchorCount + 2}`];
};

/**
 * Generates a new unique lifeline ID based on counting existing lifelines
 */
export const generateLifelineId = (existingLifelines: Lifeline[]): string => {
  return `lifeline-${existingLifelines.length + 1}`;
};

/**
 * Generates a new unique process ID based on counting existing processes
 */
export const generateProcessId = (existingProcesses: ProcessNode[]): string => {
  return `process-${existingProcesses.length + 1}`;
};

/**
 * Generates multiple unique anchor IDs for batch operations (like importing multiple nodes)
 * Returns an array of anchor ID pairs
 */
export const generateBatchAnchorIds = (
  existingNodes: DiagramNode[], 
  count: number
): [string, string][] => {
  let anchorCount = 0;
  
  for (const node of existingNodes) {
    if (node.anchors) {
      anchorCount += node.anchors.length;
    }
  }
  
  const result: [string, string][] = [];
  
  for (let i = 0; i < count; i++) {
    const id1 = `anchor-${anchorCount + 1}`;
    anchorCount++;
    const id2 = `anchor-${anchorCount + 1}`;
    anchorCount++;
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
  const startCount = existingNodes.length;
  const result: string[] = [];
  
  for (let i = 0; i < count; i++) {
    result.push(`node-${startCount + i + 1}`);
  }
  
  return result;
};
