import { useCallback, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { DiagramDocument, SequenceDiagramData, DiagramNode, DiagramEdge } from '@/types/diagram';

interface UseSequenceDiagramSyncProps {
  document: DiagramDocument;
  onDocumentChange: (document: DiagramDocument) => void;
}

export const useSequenceDiagramSync = ({
  document,
  onDocumentChange
}: UseSequenceDiagramSyncProps) => {
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  const debouncedUpdate = useCallback((updater: () => DiagramDocument) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      const updated = updater();
      onDocumentChange(updated);
    }, 300);
  }, [onDocumentChange]);

  const updateNode = useCallback((nodeId: string, updates: Partial<DiagramNode>) => {
    debouncedUpdate(() => {
      const data = document.data as SequenceDiagramData;
      const nodes = data.nodes.map(node =>
        node.id === nodeId ? { ...node, ...updates } : node
      );
      
      return {
        ...document,
        data: { ...data, nodes }
      };
    });
  }, [document, debouncedUpdate]);

  const updateEdge = useCallback((edgeId: string, updates: Partial<DiagramEdge>) => {
    // Edges are auto-generated, no manual updates supported
  }, []);

  const updateNodePosition = useCallback((nodeId: string, order: number) => {
    // Node positioning is now determined by array order, not stored position
    // Reordering is handled by the diagram renderer
  }, []);

  const addNode = useCallback((node: DiagramNode) => {
    const data = document.data as SequenceDiagramData;
    const nodes = [...data.nodes, node];
    
    onDocumentChange({
      ...document,
      data: { ...data, nodes }
    });
  }, [document, onDocumentChange]);

  const deleteNode = useCallback((nodeId: string) => {
    const data = document.data as SequenceDiagramData;
    const nodes = data.nodes.filter(n => n.id !== nodeId);
    
    onDocumentChange({
      ...document,
      data: { ...data, nodes }
    });
  }, [document, onDocumentChange]);

  const addEdge = useCallback((edge: DiagramEdge) => {
    // Edges are auto-generated, no manual additions supported
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    // Edges are auto-generated, no manual deletion supported
  }, []);

  const syncNodesFromFlow = useCallback((flowNodes: Node[]) => {
    // Positions are calculated dynamically, no sync needed
  }, []);

  return {
    updateNode,
    updateEdge,
    updateNodePosition,
    addNode,
    deleteNode,
    addEdge,
    deleteEdge,
    syncNodesFromFlow
  };
};
