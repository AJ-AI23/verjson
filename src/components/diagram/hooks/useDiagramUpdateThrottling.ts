
import { useRef, useCallback } from 'react';

/**
 * Hook to manage throttling of diagram updates with improved performance
 */
export const useDiagramUpdateThrottling = () => {
  const updateTimeoutRef = useRef<number | null>(null);
  const processingUpdateRef = useRef<boolean>(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  
  // Throttle updates to prevent excessive rendering - more aggressive throttling
  const throttleUpdates = useCallback(() => {
    const now = Date.now();
    // Only process updates if more than 500ms has passed since last update
    return (now - lastUpdateTimeRef.current) < 500;
  }, []);
  
  const startProcessingUpdate = useCallback(() => {
    processingUpdateRef.current = true;
    lastUpdateTimeRef.current = Date.now();
  }, []);
  
  const finishProcessingUpdate = useCallback(() => {
    processingUpdateRef.current = false;
    updateTimeoutRef.current = null;
  }, []);
  
  const clearPendingUpdates = useCallback(() => {
    if (updateTimeoutRef.current !== null) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
  }, []);
  
  const isProcessingUpdate = useCallback(() => processingUpdateRef.current, []);
  
  return {
    throttleUpdates,
    startProcessingUpdate,
    finishProcessingUpdate,
    clearPendingUpdates,
    isProcessingUpdate
  };
};
