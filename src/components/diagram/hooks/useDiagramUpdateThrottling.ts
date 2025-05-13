
import { useRef, useCallback } from 'react';

/**
 * Hook to manage throttling of diagram updates with improved performance
 */
export const useDiagramUpdateThrottling = () => {
  const updateTimeoutRef = useRef<number | null>(null);
  const processingUpdateRef = useRef<boolean>(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const updateCountRef = useRef<number>(0);
  
  // Throttle updates to prevent excessive rendering - aggressive throttling to fix performance
  const throttleUpdates = useCallback(() => {
    const now = Date.now();
    updateCountRef.current++;
    
    // Only allow updates every 1000ms (1 second)
    const shouldThrottle = (now - lastUpdateTimeRef.current) < 1000;
    
    // After 10 rapid updates, force an extra long throttle to break any potential loops
    if (updateCountRef.current > 10 && (now - lastUpdateTimeRef.current) < 2000) {
      console.log('Excessive updates detected, applying extended throttling');
      return true;
    }
    
    // Reset the counter periodically
    if ((now - lastUpdateTimeRef.current) > 3000) {
      updateCountRef.current = 0;
    }
    
    return shouldThrottle;
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
