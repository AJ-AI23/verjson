import { useState, useCallback } from 'react';
import { DiagramNode, Lifeline, ProcessNode as ProcessNodeType } from '@/types/diagram';
import { 
  generateNodeId, 
  generateAnchorIds, 
  generateLifelineId, 
  generateProcessId,
  generateIdMappingForClipboard
} from '@/lib/diagram/idGenerator';
import { toast } from 'sonner';

export type ClipboardElementType = 'node' | 'lifeline' | 'process' | 'multi';

/**
 * Multi-entity clipboard data structure
 * Stores nodes, lifelines, and processes together with relationship metadata
 */
export interface DiagramClipboardData {
  nodes: DiagramNode[];
  lifelines: Lifeline[];
  processes: ProcessNodeType[];
  timestamp: number;
  
  // Metadata for relationship resolution
  // Maps original anchor ID to original process ID
  anchorToProcessMap: Record<string, string>;
}

/**
 * ID mapping for paste operations
 * Maps old IDs to new IDs for all entity types
 */
export interface IdMapping {
  nodes: Map<string, string>;
  anchors: Map<string, string>;
  lifelines: Map<string, string>;
  processes: Map<string, string>;
}

/**
 * Selection state for copy operation
 */
export interface DiagramSelection {
  nodeIds: string[];
  lifelineIds: string[];
  processIds: string[];
}

/**
 * Result of analyzing a selection for copy validity
 */
export interface SelectionAnalysis {
  canCopy: boolean;
  nodesToCopy: DiagramNode[];
  lifelinesToCopy: Lifeline[];
  processesToCopy: ProcessNodeType[];
  warnings: string[];
  anchorToProcessMap: Record<string, string>;
}

/**
 * Result of a paste operation
 */
export interface PasteResult {
  newNodes: DiagramNode[];
  newLifelines: Lifeline[];
  newProcesses: ProcessNodeType[];
  updatedProcesses: ProcessNodeType[]; // Existing processes with new anchor IDs added
  idMapping: IdMapping;
}

interface UseDiagramClipboardResult {
  clipboard: DiagramClipboardData | null;
  hasClipboard: boolean;
  clipboardType: ClipboardElementType | null;
  
  // New multi-entity operations
  analyzeSelection: (
    selection: DiagramSelection,
    allNodes: DiagramNode[],
    allLifelines: Lifeline[],
    allProcesses: ProcessNodeType[]
  ) => SelectionAnalysis;
  
  copySelection: (
    selection: DiagramSelection,
    allNodes: DiagramNode[],
    allLifelines: Lifeline[],
    allProcesses: ProcessNodeType[]
  ) => boolean;
  
  pasteSelection: (
    existingNodes: DiagramNode[],
    existingLifelines: Lifeline[],
    existingProcesses: ProcessNodeType[]
  ) => PasteResult | null;
  
  // Legacy single-item operations (for backward compatibility)
  copyNode: (node: DiagramNode) => void;
  copyLifeline: (lifeline: Lifeline) => void;
  pasteNode: (existingNodes: DiagramNode[], existingLifelines: Lifeline[]) => DiagramNode | null;
  pasteLifeline: (existingLifelines: Lifeline[]) => Lifeline | null;
  
  clearClipboard: () => void;
}

/**
 * Checks if all anchors of a process come from the given set of nodes
 */
function areAllProcessAnchorsFromNodes(
  process: ProcessNodeType,
  nodeIds: Set<string>,
  allNodes: DiagramNode[]
): boolean {
  const anchorIdsFromNodes = new Set<string>();
  
  for (const node of allNodes) {
    if (nodeIds.has(node.id) && node.anchors) {
      for (const anchor of node.anchors) {
        anchorIdsFromNodes.add(anchor.id);
      }
    }
  }
  
  return process.anchorIds.every(anchorId => anchorIdsFromNodes.has(anchorId));
}

/**
 * Gets the anchor ID to process ID mapping for selected nodes
 */
function buildAnchorToProcessMap(
  selectedNodes: DiagramNode[],
  allProcesses: ProcessNodeType[]
): Record<string, string> {
  const map: Record<string, string> = {};
  
  for (const node of selectedNodes) {
    if (!node.anchors) continue;
    
    for (const anchor of node.anchors) {
      // Find which process this anchor belongs to
      for (const process of allProcesses) {
        if (process.anchorIds.includes(anchor.id)) {
          map[anchor.id] = process.id;
          break;
        }
      }
    }
  }
  
  return map;
}

/**
 * Finds all processes that should be auto-included because all their anchors
 * are from the selected nodes
 */
function findAutoIncludedProcesses(
  selectedNodeIds: Set<string>,
  allNodes: DiagramNode[],
  allProcesses: ProcessNodeType[]
): ProcessNodeType[] {
  const result: ProcessNodeType[] = [];
  
  for (const process of allProcesses) {
    if (areAllProcessAnchorsFromNodes(process, selectedNodeIds, allNodes)) {
      result.push(process);
    }
  }
  
  return result;
}

export function useDiagramClipboard(): UseDiagramClipboardResult {
  const [clipboard, setClipboard] = useState<DiagramClipboardData | null>(null);

  /**
   * Analyzes a selection to determine what can be copied and any issues
   */
  const analyzeSelection = useCallback((
    selection: DiagramSelection,
    allNodes: DiagramNode[],
    allLifelines: Lifeline[],
    allProcesses: ProcessNodeType[]
  ): SelectionAnalysis => {
    const warnings: string[] = [];
    const selectedNodeIdSet = new Set(selection.nodeIds);
    
    // Collect selected entities
    const nodesToCopy = allNodes.filter(n => selection.nodeIds.includes(n.id));
    const lifelinesToCopy = allLifelines.filter(l => selection.lifelineIds.includes(l.id));
    
    // Check explicitly selected processes
    const explicitlySelectedProcesses = allProcesses.filter(p => selection.processIds.includes(p.id));
    const validExplicitProcesses: ProcessNodeType[] = [];
    
    for (const process of explicitlySelectedProcesses) {
      if (areAllProcessAnchorsFromNodes(process, selectedNodeIdSet, allNodes)) {
        validExplicitProcesses.push(process);
      } else {
        warnings.push(`Process "${process.description || process.id}" cannot be copied without all its connected nodes selected`);
      }
    }
    
    // Auto-include processes whose all anchors come from selected nodes
    const autoIncludedProcesses = findAutoIncludedProcesses(selectedNodeIdSet, allNodes, allProcesses);
    
    // Merge explicit and auto-included, avoiding duplicates
    const processIdSet = new Set<string>();
    const processesToCopy: ProcessNodeType[] = [];
    
    for (const p of [...validExplicitProcesses, ...autoIncludedProcesses]) {
      if (!processIdSet.has(p.id)) {
        processIdSet.add(p.id);
        processesToCopy.push(p);
      }
    }
    
    // Build anchor-to-process mapping for relationship resolution during paste
    const anchorToProcessMap = buildAnchorToProcessMap(nodesToCopy, allProcesses);
    
    // Determine if anything can be copied
    const canCopy = nodesToCopy.length > 0 || lifelinesToCopy.length > 0;
    
    if (!canCopy && selection.processIds.length > 0) {
      warnings.push('Processes cannot be copied without their connected nodes');
    }
    
    return {
      canCopy,
      nodesToCopy,
      lifelinesToCopy,
      processesToCopy,
      warnings,
      anchorToProcessMap
    };
  }, []);

  /**
   * Copies the current selection to clipboard with validation
   */
  const copySelection = useCallback((
    selection: DiagramSelection,
    allNodes: DiagramNode[],
    allLifelines: Lifeline[],
    allProcesses: ProcessNodeType[]
  ): boolean => {
    const analysis = analyzeSelection(selection, allNodes, allLifelines, allProcesses);
    
    // Show warnings
    for (const warning of analysis.warnings) {
      toast.warning(warning);
    }
    
    if (!analysis.canCopy) {
      return false;
    }
    
    // Deep clone all entities
    const clipboardData: DiagramClipboardData = {
      nodes: JSON.parse(JSON.stringify(analysis.nodesToCopy)),
      lifelines: JSON.parse(JSON.stringify(analysis.lifelinesToCopy)),
      processes: JSON.parse(JSON.stringify(analysis.processesToCopy)),
      timestamp: Date.now(),
      anchorToProcessMap: analysis.anchorToProcessMap
    };
    
    setClipboard(clipboardData);
    return true;
  }, [analyzeSelection]);

  /**
   * Pastes clipboard content with proper ID regeneration and relationship resolution
   */
  const pasteSelection = useCallback((
    existingNodes: DiagramNode[],
    existingLifelines: Lifeline[],
    existingProcesses: ProcessNodeType[]
  ): PasteResult | null => {
    if (!clipboard) return null;
    
    // Generate ID mappings for all entities
    const idMapping = generateIdMappingForClipboard(
      clipboard.nodes,
      clipboard.lifelines,
      clipboard.processes,
      existingNodes,
      existingLifelines,
      existingProcesses
    );
    
    // Track processes that are in the clipboard (by their original ID)
    const clipboardProcessIds = new Set(clipboard.processes.map(p => p.id));
    
    // Clone nodes with new IDs
    const newNodes: DiagramNode[] = clipboard.nodes.map(originalNode => {
      const newNodeId = idMapping.nodes.get(originalNode.id)!;
      
      const newAnchors = originalNode.anchors?.map(anchor => {
        const newAnchorId = idMapping.anchors.get(anchor.id)!;
        const originalProcessId = clipboard.anchorToProcessMap[anchor.id];
        
        let newProcessId: string | undefined;
        
        if (originalProcessId) {
          if (clipboardProcessIds.has(originalProcessId)) {
            // Process is in clipboard - use the new process ID
            newProcessId = idMapping.processes.get(originalProcessId);
          } else {
            // Process is NOT in clipboard - keep original process ID
            // (will be handled by updatedProcesses)
            newProcessId = originalProcessId;
          }
        }
        
        return {
          ...anchor,
          id: newAnchorId,
          processId: newProcessId
        };
      });
      
      return {
        ...JSON.parse(JSON.stringify(originalNode)),
        id: newNodeId,
        yPosition: (originalNode.yPosition || 100) + 80, // Offset to show it's a copy
        anchors: newAnchors
      };
    });
    
    // Clone lifelines with new IDs
    const newLifelines: Lifeline[] = clipboard.lifelines.map(originalLifeline => {
      const newLifelineId = idMapping.lifelines.get(originalLifeline.id)!;
      
      return {
        ...JSON.parse(JSON.stringify(originalLifeline)),
        id: newLifelineId,
        name: `${originalLifeline.name} (copy)`,
        order: existingLifelines.length + clipboard.lifelines.indexOf(originalLifeline)
      };
    });
    
    // Clone processes with new IDs and updated anchor references
    const newProcesses: ProcessNodeType[] = clipboard.processes.map(originalProcess => {
      const newProcessId = idMapping.processes.get(originalProcess.id)!;
      
      // Map old anchor IDs to new anchor IDs
      const newAnchorIds = originalProcess.anchorIds.map(oldAnchorId => 
        idMapping.anchors.get(oldAnchorId) || oldAnchorId
      );
      
      return {
        ...JSON.parse(JSON.stringify(originalProcess)),
        id: newProcessId,
        description: originalProcess.description 
          ? `${originalProcess.description} (copy)` 
          : 'Copied process',
        anchorIds: newAnchorIds
      };
    });
    
    // Handle processes that are NOT in clipboard but have anchors from copied nodes
    // We need to add the new anchor IDs to those existing processes
    const updatedProcesses: ProcessNodeType[] = [];
    
    for (const node of newNodes) {
      if (!node.anchors) continue;
      
      for (const anchor of node.anchors) {
        // If this anchor references an existing process (not in clipboard)
        if (anchor.processId && !idMapping.processes.has(anchor.processId)) {
          // Find the existing process
          const existingProcess = existingProcesses.find(p => p.id === anchor.processId);
          if (existingProcess) {
            // Check if we've already tracked this process for updates
            let trackedProcess = updatedProcesses.find(p => p.id === existingProcess.id);
            
            if (!trackedProcess) {
              // Clone the existing process for modification
              trackedProcess = JSON.parse(JSON.stringify(existingProcess));
              updatedProcesses.push(trackedProcess);
            }
            
            // Add the new anchor ID to this process
            if (!trackedProcess.anchorIds.includes(anchor.id)) {
              trackedProcess.anchorIds.push(anchor.id);
            }
          }
        }
      }
    }
    
    return {
      newNodes,
      newLifelines,
      newProcesses,
      updatedProcesses,
      idMapping
    };
  }, [clipboard]);

  // Legacy single-item operations for backward compatibility
  const copyNode = useCallback((node: DiagramNode) => {
    setClipboard({
      nodes: [JSON.parse(JSON.stringify(node))],
      lifelines: [],
      processes: [],
      timestamp: Date.now(),
      anchorToProcessMap: {}
    });
  }, []);

  const copyLifeline = useCallback((lifeline: Lifeline) => {
    setClipboard({
      nodes: [],
      lifelines: [JSON.parse(JSON.stringify(lifeline))],
      processes: [],
      timestamp: Date.now(),
      anchorToProcessMap: {}
    });
  }, []);

  const pasteNode = useCallback((
    existingNodes: DiagramNode[],
    existingLifelines: Lifeline[]
  ): DiagramNode | null => {
    if (!clipboard || clipboard.nodes.length === 0) return null;

    const originalNode = clipboard.nodes[0];
    const newNodeId = generateNodeId(existingNodes);
    const [anchorId1, anchorId2] = generateAnchorIds(existingNodes);

    const newNode: DiagramNode = {
      ...JSON.parse(JSON.stringify(originalNode)),
      id: newNodeId,
      yPosition: (originalNode.yPosition || 100) + 80,
      anchors: originalNode.anchors?.map((anchor, index) => ({
        ...anchor,
        id: index === 0 ? anchorId1 : anchorId2,
        processId: undefined // Clear process reference for simple paste
      })),
    };

    return newNode;
  }, [clipboard]);

  const pasteLifeline = useCallback((
    existingLifelines: Lifeline[]
  ): Lifeline | null => {
    if (!clipboard || clipboard.lifelines.length === 0) return null;

    const originalLifeline = clipboard.lifelines[0];
    const newLifelineId = generateLifelineId(existingLifelines);

    const newLifeline: Lifeline = {
      ...JSON.parse(JSON.stringify(originalLifeline)),
      id: newLifelineId,
      name: `${originalLifeline.name} (copy)`,
      order: existingLifelines.length,
    };

    return newLifeline;
  }, [clipboard]);

  const clearClipboard = useCallback(() => {
    setClipboard(null);
  }, []);

  // Determine clipboard type for UI hints
  const getClipboardType = (): ClipboardElementType | null => {
    if (!clipboard) return null;
    
    const hasNodes = clipboard.nodes.length > 0;
    const hasLifelines = clipboard.lifelines.length > 0;
    const hasProcesses = clipboard.processes.length > 0;
    
    const typeCount = [hasNodes, hasLifelines, hasProcesses].filter(Boolean).length;
    
    if (typeCount === 0) return null;
    if (typeCount > 1) return 'multi';
    if (hasNodes) return 'node';
    if (hasLifelines) return 'lifeline';
    if (hasProcesses) return 'process';
    
    return null;
  };

  return {
    clipboard,
    hasClipboard: clipboard !== null && (
      clipboard.nodes.length > 0 || 
      clipboard.lifelines.length > 0 || 
      clipboard.processes.length > 0
    ),
    clipboardType: getClipboardType(),
    analyzeSelection,
    copySelection,
    pasteSelection,
    copyNode,
    copyLifeline,
    pasteNode,
    pasteLifeline,
    clearClipboard,
  };
}
