import { DiagramNode, ProcessNode, Lifeline } from '@/types/diagram';

/**
 * ID mapping structure for paste operations
 */
export interface IdMapping {
  nodes: Map<string, string>;
  anchors: Map<string, string>;
  lifelines: Map<string, string>;
  processes: Map<string, string>;
}

/**
 * Extracts the numeric suffix from an ID string (e.g., "node-5" -> 5)
 * Returns 0 if no valid number is found
 */
const extractIdNumber = (id: string): number => {
  const match = id.match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
};

/**
 * Finds the maximum numeric ID from an array of IDs with a given prefix
 */
const findMaxId = (ids: string[], prefix: string): number => {
  let max = 0;
  for (const id of ids) {
    if (id.startsWith(prefix)) {
      const num = extractIdNumber(id);
      if (num > max) max = num;
    }
  }
  return max;
};

/**
 * Generates a new unique node ID based on finding the max existing node ID
 * Ensures no collisions even after deletions
 */
export const generateNodeId = (existingNodes: DiagramNode[]): string => {
  const existingIds = existingNodes.map(n => n.id);
  const maxId = findMaxId(existingIds, 'node-');
  return `node-${maxId + 1}`;
};

/**
 * Generates new unique anchor IDs based on finding the max existing anchor ID
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
  
  const maxId = findMaxId(existingAnchorIds, 'anchor-');
  return [`anchor-${maxId + 1}`, `anchor-${maxId + 2}`];
};

/**
 * Generates a new unique lifeline ID based on finding the max existing lifeline ID
 */
export const generateLifelineId = (existingLifelines: Lifeline[]): string => {
  const existingIds = existingLifelines.map(l => l.id);
  const maxId = findMaxId(existingIds, 'lifeline-');
  return `lifeline-${maxId + 1}`;
};

/**
 * Generates a new unique process ID based on finding the max existing process ID
 */
export const generateProcessId = (existingProcesses: ProcessNode[]): string => {
  const existingIds = existingProcesses.map(p => p.id);
  const maxId = findMaxId(existingIds, 'process-');
  return `process-${maxId + 1}`;
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
  
  let nextId = findMaxId(existingAnchorIds, 'anchor-') + 1;
  const result: [string, string][] = [];
  
  for (let i = 0; i < count; i++) {
    const id1 = `anchor-${nextId}`;
    nextId++;
    const id2 = `anchor-${nextId}`;
    nextId++;
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
  let nextId = findMaxId(existingIds, 'node-') + 1;
  const result: string[] = [];
  
  for (let i = 0; i < count; i++) {
    result.push(`node-${nextId}`);
    nextId++;
  }
  
  return result;
};

/**
 * Generates multiple unique lifeline IDs for batch operations
 */
export const generateBatchLifelineIds = (
  existingLifelines: Lifeline[],
  count: number
): string[] => {
  const existingIds = existingLifelines.map(l => l.id);
  let nextId = findMaxId(existingIds, 'lifeline-') + 1;
  const result: string[] = [];
  
  for (let i = 0; i < count; i++) {
    result.push(`lifeline-${nextId}`);
    nextId++;
  }
  
  return result;
};

/**
 * Generates multiple unique process IDs for batch operations
 */
export const generateBatchProcessIds = (
  existingProcesses: ProcessNode[],
  count: number
): string[] => {
  const existingIds = existingProcesses.map(p => p.id);
  let nextId = findMaxId(existingIds, 'process-') + 1;
  const result: string[] = [];
  
  for (let i = 0; i < count; i++) {
    result.push(`process-${nextId}`);
    nextId++;
  }
  
  return result;
};

/**
 * Generates a complete ID mapping for clipboard paste operations
 * Maps all old IDs to new IDs for nodes, anchors, lifelines, and processes
 */
export const generateIdMappingForClipboard = (
  clipboardNodes: DiagramNode[],
  clipboardLifelines: Lifeline[],
  clipboardProcesses: ProcessNode[],
  existingNodes: DiagramNode[],
  existingLifelines: Lifeline[],
  existingProcesses: ProcessNode[]
): IdMapping => {
  const nodeMapping = new Map<string, string>();
  const anchorMapping = new Map<string, string>();
  const lifelineMapping = new Map<string, string>();
  const processMapping = new Map<string, string>();
  
  // Generate node IDs using max-based approach
  const newNodeIds = generateBatchNodeIds(existingNodes, clipboardNodes.length);
  clipboardNodes.forEach((node, index) => {
    nodeMapping.set(node.id, newNodeIds[index]);
  });
  
  // Generate anchor IDs using max-based approach
  const existingAnchorIds: string[] = [];
  for (const node of existingNodes) {
    if (node.anchors) {
      for (const anchor of node.anchors) {
        existingAnchorIds.push(anchor.id);
      }
    }
  }
  
  let nextAnchorId = findMaxId(existingAnchorIds, 'anchor-') + 1;
  
  // Map anchors from clipboard nodes
  for (const node of clipboardNodes) {
    if (node.anchors) {
      for (const anchor of node.anchors) {
        anchorMapping.set(anchor.id, `anchor-${nextAnchorId}`);
        nextAnchorId++;
      }
    }
  }
  
  // Generate lifeline IDs using max-based approach
  const newLifelineIds = generateBatchLifelineIds(existingLifelines, clipboardLifelines.length);
  clipboardLifelines.forEach((lifeline, index) => {
    lifelineMapping.set(lifeline.id, newLifelineIds[index]);
  });
  
  // Generate process IDs using max-based approach
  const newProcessIds = generateBatchProcessIds(existingProcesses, clipboardProcesses.length);
  clipboardProcesses.forEach((process, index) => {
    processMapping.set(process.id, newProcessIds[index]);
  });
  
  return {
    nodes: nodeMapping,
    anchors: anchorMapping,
    lifelines: lifelineMapping,
    processes: processMapping
  };
};

/**
 * Generates ID mappings with a running total (useful when combining multiple pastes)
 * Takes offset counts to start numbering from
 */
export const generateIdMappingWithOffsets = (
  clipboardNodes: DiagramNode[],
  clipboardLifelines: Lifeline[],
  clipboardProcesses: ProcessNode[],
  nodeOffset: number,
  anchorOffset: number,
  lifelineOffset: number,
  processOffset: number
): IdMapping => {
  const nodeMapping = new Map<string, string>();
  const anchorMapping = new Map<string, string>();
  const lifelineMapping = new Map<string, string>();
  const processMapping = new Map<string, string>();
  
  // Generate node IDs
  let nextNodeId = nodeOffset + 1;
  clipboardNodes.forEach((node) => {
    nodeMapping.set(node.id, `node-${nextNodeId}`);
    nextNodeId++;
  });
  
  // Generate anchor IDs
  let nextAnchorId = anchorOffset + 1;
  for (const node of clipboardNodes) {
    if (node.anchors) {
      for (const anchor of node.anchors) {
        anchorMapping.set(anchor.id, `anchor-${nextAnchorId}`);
        nextAnchorId++;
      }
    }
  }
  
  // Generate lifeline IDs
  let nextLifelineId = lifelineOffset + 1;
  clipboardLifelines.forEach((lifeline) => {
    lifelineMapping.set(lifeline.id, `lifeline-${nextLifelineId}`);
    nextLifelineId++;
  });
  
  // Generate process IDs
  let nextProcessId = processOffset + 1;
  clipboardProcesses.forEach((process) => {
    processMapping.set(process.id, `process-${nextProcessId}`);
    nextProcessId++;
  });
  
  return {
    nodes: nodeMapping,
    anchors: anchorMapping,
    lifelines: lifelineMapping,
    processes: processMapping
  };
};
