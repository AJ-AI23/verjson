
import { useCallback } from 'react';
import { CollapsedState } from '@/lib/diagram/types';

/**
 * Hook for managing collapsed paths state
 */
export const useCollapsedPaths = () => {
  const updateCollapsedPathsRef = useCallback((
    prevCollapsedPathsRef: React.MutableRefObject<CollapsedState>, 
    newPaths: CollapsedState
  ) => {
    prevCollapsedPathsRef.current = { ...newPaths };
  }, []);

  return {
    updateCollapsedPathsRef
  };
};
