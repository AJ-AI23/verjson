
import { useRef, useCallback } from 'react';

/**
 * Hook to manage throttling of diagram updates
 */
export const useDiagramUpdateThrottling = () => {
  const updateTimeoutRef = useRef<number | null>(null);
  const processingUpdateRef = useRef<boolean>(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  
  // Throttle updates to prevent excessive rendering
  const throttleUpdates = useCallback(() => {
    const now = Date.now();
    // Only process updates if more than 300ms has passed since last update
    return (now - lastUpdateTimeRef.current) < 300;
  }, []);
  
  const startProcessingUpdate = () => {
    processingUpdateRef.current = true;
    lastUpdateTimeRef.current = Date.now();
  };
  
  const finishProcessingUpdate = () => {
    processingUpdateRef.current = false;
    updateTimeoutRef.current = null;
  };
  
  const clearPendingUpdates = () => {
    if (updateTimeoutRef.current !== null) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
  };
  
  const isProcessingUpdate = () => processingUpdateRef.current;
  
  return {
    throttleUpdates,
    startProcessingUpdate,
    finishProcessingUpdate,
    clearPendingUpdates,
    isProcessingUpdate
  };
};
