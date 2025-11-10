import { useCallback } from 'react';
import { ProcessNode, AnchorNode, DiagramNode } from '@/types/diagram';
import { toast } from 'sonner';

interface UseProcessManagementProps {
  processes: ProcessNode[];
  nodes: DiagramNode[];
  onProcessesChange: (processes: ProcessNode[]) => void;
  onNodesChange?: (nodes: DiagramNode[]) => void;
}

export const useProcessManagement = ({
  processes,
  nodes,
  onProcessesChange,
  onNodesChange
}: UseProcessManagementProps) => {

  // Get all anchors from all nodes
  const getAllAnchors = useCallback((): AnchorNode[] => {
    return nodes.flatMap(node => node.anchors || []);
  }, [nodes]);

  // Check if an anchor is already in a process
  const isAnchorInProcess = useCallback((anchorId: string): boolean => {
    return processes.some(process => process.anchorIds.includes(anchorId));
  }, [processes]);

  // Get the lifeline ID for an anchor
  const getAnchorLifeline = useCallback((anchorId: string): string | null => {
    const allAnchors = getAllAnchors();
    const anchor = allAnchors.find(a => a.id === anchorId);
    return anchor?.lifelineId || null;
  }, [getAllAnchors]);

  // Get the Y position of an anchor
  const getAnchorYPosition = useCallback((anchorId: string): number | null => {
    const node = nodes.find(n => n.anchors.some(a => a.id === anchorId));
    return node?.yPosition || null;
  }, [nodes]);

  // Count parallel processes at a Y position on a lifeline
  const getParallelProcessCount = useCallback((lifelineId: string, yPosition: number, range: number = 100): number => {
    return processes.filter(process => {
      if (process.lifelineId !== lifelineId) return false;
      
      // Check if any anchor in the process is within the Y range
      return process.anchorIds.some(anchorId => {
        const anchorY = getAnchorYPosition(anchorId);
        return anchorY !== null && Math.abs(anchorY - yPosition) < range;
      });
    }).length;
  }, [processes, getAnchorYPosition]);

  // Determine the next available parallel index
  const getNextParallelIndex = useCallback((lifelineId: string, yPosition: number): number => {
    const existingProcesses = processes.filter(process => {
      if (process.lifelineId !== lifelineId) return false;
      
      return process.anchorIds.some(anchorId => {
        const anchorY = getAnchorYPosition(anchorId);
        return anchorY !== null && Math.abs(anchorY - yPosition) < 100;
      });
    });

    const usedIndices = existingProcesses.map(p => p.parallelIndex || 0);
    for (let i = 0; i < 3; i++) {
      if (!usedIndices.includes(i)) return i;
    }
    return 0;
  }, [processes, getAnchorYPosition]);

  // Create a new process
  const createProcess = useCallback((anchorId: string, description: string = 'New Process'): ProcessNode | null => {
    if (isAnchorInProcess(anchorId)) {
      toast.error('This anchor is already in a process');
      return null;
    }

    const lifelineId = getAnchorLifeline(anchorId);
    if (!lifelineId) {
      toast.error('Could not determine lifeline for anchor');
      return null;
    }

    const anchorY = getAnchorYPosition(anchorId);
    if (anchorY === null) {
      toast.error('Could not determine anchor position');
      return null;
    }

    const parallelCount = getParallelProcessCount(lifelineId, anchorY);
    if (parallelCount >= 3) {
      toast.error('Maximum 3 parallel processes reached');
      return null;
    }

    const parallelIndex = getNextParallelIndex(lifelineId, anchorY);

    const newProcess: ProcessNode = {
      id: `process-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'lifelineProcess',
      lifelineId,
      anchorIds: [anchorId],
      description,
      parallelIndex
    };

    onProcessesChange([...processes, newProcess]);
    toast.success('Process created');
    return newProcess;
  }, [processes, isAnchorInProcess, getAnchorLifeline, getAnchorYPosition, getParallelProcessCount, getNextParallelIndex, onProcessesChange]);

  // Add an anchor to an existing process
  const addAnchorToProcess = useCallback((anchorId: string, processId: string): boolean => {
    if (isAnchorInProcess(anchorId)) {
      toast.error('This anchor is already in a process');
      return false;
    }

    const process = processes.find(p => p.id === processId);
    if (!process) {
      toast.error('Process not found');
      return false;
    }

    const anchorLifeline = getAnchorLifeline(anchorId);
    if (anchorLifeline !== process.lifelineId) {
      toast.error('Anchor must be on the same lifeline as the process');
      return false;
    }

    const updatedProcesses = processes.map(p =>
      p.id === processId
        ? { ...p, anchorIds: [...p.anchorIds, anchorId] }
        : p
    );

    onProcessesChange(updatedProcesses);
    toast.success('Anchor added to process');
    return true;
  }, [processes, isAnchorInProcess, getAnchorLifeline, onProcessesChange]);

  // Remove an anchor from a process
  const removeAnchorFromProcess = useCallback((anchorId: string, processId: string): boolean => {
    const process = processes.find(p => p.id === processId);
    if (!process) return false;

    const updatedAnchorIds = process.anchorIds.filter(id => id !== anchorId);

    // If no anchors remain, delete the process
    if (updatedAnchorIds.length === 0) {
      const updatedProcesses = processes.filter(p => p.id !== processId);
      onProcessesChange(updatedProcesses);
      toast.info('Process deleted (no anchors remaining)');
      return true;
    }

    const updatedProcesses = processes.map(p =>
      p.id === processId
        ? { ...p, anchorIds: updatedAnchorIds }
        : p
    );

    onProcessesChange(updatedProcesses);
    return true;
  }, [processes, onProcessesChange]);

  // Delete a process
  const deleteProcess = useCallback((processId: string): boolean => {
    const updatedProcesses = processes.filter(p => p.id !== processId);
    onProcessesChange(updatedProcesses);
    toast.success('Process deleted');
    return true;
  }, [processes, onProcessesChange]);

  // Update process description
  const updateProcessDescription = useCallback((processId: string, description: string): boolean => {
    const updatedProcesses = processes.map(p =>
      p.id === processId
        ? { ...p, description }
        : p
    );
    onProcessesChange(updatedProcesses);
    return true;
  }, [processes, onProcessesChange]);

  // Get processes for a specific lifeline
  const getProcessesForLifeline = useCallback((lifelineId: string): ProcessNode[] => {
    return processes.filter(p => p.lifelineId === lifelineId);
  }, [processes]);

  // Validate process constraints
  const validateProcessConstraints = useCallback((): boolean => {
    // Check that each anchor is only in one process
    const anchorProcessMap = new Map<string, string>();
    
    for (const process of processes) {
      for (const anchorId of process.anchorIds) {
        if (anchorProcessMap.has(anchorId)) {
          console.error(`Anchor ${anchorId} is in multiple processes`);
          return false;
        }
        anchorProcessMap.set(anchorId, process.id);
      }
    }

    return true;
  }, [processes]);

  return {
    createProcess,
    addAnchorToProcess,
    removeAnchorFromProcess,
    deleteProcess,
    updateProcessDescription,
    getProcessesForLifeline,
    getParallelProcessCount,
    isAnchorInProcess,
    validateProcessConstraints
  };
};
