import { useState, useCallback } from 'react';
import { DiagramNode, Lifeline, ProcessNode as ProcessNodeType } from '@/types/diagram';
import { generateNodeId, generateAnchorIds, generateLifelineId, generateProcessId } from '@/lib/diagram/idGenerator';

export type ClipboardElementType = 'node' | 'lifeline' | 'process';

export interface DiagramClipboardItem {
  type: ClipboardElementType;
  data: DiagramNode | Lifeline | ProcessNodeType;
  timestamp: number;
}

interface UseDiagramClipboardResult {
  clipboard: DiagramClipboardItem | null;
  copyNode: (node: DiagramNode) => void;
  copyLifeline: (lifeline: Lifeline) => void;
  copyProcess: (process: ProcessNodeType) => void;
  pasteNode: (
    existingNodes: DiagramNode[],
    existingLifelines: Lifeline[]
  ) => DiagramNode | null;
  pasteLifeline: (existingLifelines: Lifeline[]) => Lifeline | null;
  pasteProcess: (
    existingProcesses: ProcessNodeType[],
    existingNodes: DiagramNode[]
  ) => { process: ProcessNodeType; updatedNodes: DiagramNode[] } | null;
  hasClipboard: boolean;
  clipboardType: ClipboardElementType | null;
  clearClipboard: () => void;
}

export function useDiagramClipboard(): UseDiagramClipboardResult {
  const [clipboard, setClipboard] = useState<DiagramClipboardItem | null>(null);

  const copyNode = useCallback((node: DiagramNode) => {
    setClipboard({
      type: 'node',
      data: JSON.parse(JSON.stringify(node)), // Deep clone
      timestamp: Date.now(),
    });
  }, []);

  const copyLifeline = useCallback((lifeline: Lifeline) => {
    setClipboard({
      type: 'lifeline',
      data: JSON.parse(JSON.stringify(lifeline)),
      timestamp: Date.now(),
    });
  }, []);

  const copyProcess = useCallback((process: ProcessNodeType) => {
    setClipboard({
      type: 'process',
      data: JSON.parse(JSON.stringify(process)),
      timestamp: Date.now(),
    });
  }, []);

  const pasteNode = useCallback((
    existingNodes: DiagramNode[],
    existingLifelines: Lifeline[]
  ): DiagramNode | null => {
    if (!clipboard || clipboard.type !== 'node') return null;

    const originalNode = clipboard.data as DiagramNode;
    const newNodeId = generateNodeId(existingNodes);
    const [anchorId1, anchorId2] = generateAnchorIds(existingNodes);

    // Clone and update with new IDs
    const newNode: DiagramNode = {
      ...JSON.parse(JSON.stringify(originalNode)),
      id: newNodeId,
      // Offset position slightly to show it's a copy
      yPosition: (originalNode.yPosition || 100) + 80,
      anchors: originalNode.anchors?.map((anchor, index) => ({
        ...anchor,
        id: index === 0 ? anchorId1 : anchorId2,
      })),
    };

    return newNode;
  }, [clipboard]);

  const pasteLifeline = useCallback((
    existingLifelines: Lifeline[]
  ): Lifeline | null => {
    if (!clipboard || clipboard.type !== 'lifeline') return null;

    const originalLifeline = clipboard.data as Lifeline;
    const newLifelineId = generateLifelineId(existingLifelines);

    // Clone and update with new ID, place at end
    const newLifeline: Lifeline = {
      ...JSON.parse(JSON.stringify(originalLifeline)),
      id: newLifelineId,
      name: `${originalLifeline.name} (copy)`,
      order: existingLifelines.length,
    };

    return newLifeline;
  }, [clipboard]);

  const pasteProcess = useCallback((
    existingProcesses: ProcessNodeType[],
    existingNodes: DiagramNode[]
  ): { process: ProcessNodeType; updatedNodes: DiagramNode[] } | null => {
    if (!clipboard || clipboard.type !== 'process') return null;

    const originalProcess = clipboard.data as ProcessNodeType;
    const newProcessId = generateProcessId(existingProcesses);

    // For process paste, we need to create new anchors on existing nodes
    // This is complex - for now, create an empty process that user can populate
    const newProcess: ProcessNodeType = {
      ...JSON.parse(JSON.stringify(originalProcess)),
      id: newProcessId,
      description: originalProcess.description 
        ? `${originalProcess.description} (copy)` 
        : 'Copied process',
      anchorIds: [], // Empty - user will need to add anchors
    };

    return { process: newProcess, updatedNodes: existingNodes };
  }, [clipboard]);

  const clearClipboard = useCallback(() => {
    setClipboard(null);
  }, []);

  return {
    clipboard,
    copyNode,
    copyLifeline,
    copyProcess,
    pasteNode,
    pasteLifeline,
    pasteProcess,
    hasClipboard: clipboard !== null,
    clipboardType: clipboard?.type || null,
    clearClipboard,
  };
}
