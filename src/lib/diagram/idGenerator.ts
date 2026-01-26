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

/**
 * Generates multiple unique lifeline IDs for batch operations
 */
export const generateBatchLifelineIds = (
  existingLifelines: Lifeline[],
  count: number
): string[] => {
  const startCount = existingLifelines.length;
  const result: string[] = [];
  
  for (let i = 0; i < count; i++) {
    result.push(`lifeline-${startCount + i + 1}`);
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
  const startCount = existingProcesses.length;
  const result: string[] = [];
  
  for (let i = 0; i < count; i++) {
    result.push(`process-${startCount + i + 1}`);
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
  
  // Generate node IDs
  const newNodeIds = generateBatchNodeIds(existingNodes, clipboardNodes.length);
  clipboardNodes.forEach((node, index) => {
    nodeMapping.set(node.id, newNodeIds[index]);
  });
  
  // Generate anchor IDs for all nodes
  // First, count existing anchors
  let anchorCount = 0;
  for (const node of existingNodes) {
    if (node.anchors) {
      anchorCount += node.anchors.length;
    }
  }
  
  // Map anchors from clipboard nodes
  for (const node of clipboardNodes) {
    if (node.anchors) {
      for (const anchor of node.anchors) {
        anchorCount++;
        anchorMapping.set(anchor.id, `anchor-${anchorCount}`);
      }
    }
  }
  
  // Generate lifeline IDs
  const newLifelineIds = generateBatchLifelineIds(existingLifelines, clipboardLifelines.length);
  clipboardLifelines.forEach((lifeline, index) => {
    lifelineMapping.set(lifeline.id, newLifelineIds[index]);
  });
  
  // Generate process IDs
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
  clipboardNodes.forEach((node, index) => {
    nodeMapping.set(node.id, `node-${nodeOffset + index + 1}`);
  });
  
  // Generate anchor IDs
  let anchorIdx = 0;
  for (const node of clipboardNodes) {
    if (node.anchors) {
      for (const anchor of node.anchors) {
        anchorIdx++;
        anchorMapping.set(anchor.id, `anchor-${anchorOffset + anchorIdx}`);
      }
    }
  }
  
  // Generate lifeline IDs
  clipboardLifelines.forEach((lifeline, index) => {
    lifelineMapping.set(lifeline.id, `lifeline-${lifelineOffset + index + 1}`);
  });
  
  // Generate process IDs
  clipboardProcesses.forEach((process, index) => {
    processMapping.set(process.id, `process-${processOffset + index + 1}`);
  });
  
  return {
    nodes: nodeMapping,
    anchors: anchorMapping,
    lifelines: lifelineMapping,
    processes: processMapping
  };
};
