
import { useRef, useCallback } from 'react';

/**
 * Hook to manage throttling of diagram updates with improved performance
 */
export const useDiagramUpdateThrottling = () => {
  const updateTimeoutRef = useRef<number | null>(null);
  const processingUpdateRef = useRef<boolean>(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const updateCountRef = useRef<number>(0);
  const consecutiveUpdatesRef = useRef<number>(0);
  const lastCollapsedPathsRef = useRef<string>('');
  
  // Enhanced throttling system with more aggressive limits
  const throttleUpdates = useCallback((collapsedPathsString: string = '') => {
    const now = Date.now();
    updateCountRef.current++;
    
    // If same collapsedPaths are triggering updates, count as consecutive
    if (collapsedPathsString === lastCollapsedPathsRef.current) {
      consecutiveUpdatesRef.current++;
    } else {
      consecutiveUpdatesRef.current = 0;
      lastCollapsedPathsRef.current = collapsedPathsString;
    }
    
    // After several consecutive identical updates, block completely for a longer period
    if (consecutiveUpdatesRef.current > 3) {
      console.log('Blocking identical consecutive updates to break render loop');
      return true;
    }
    
    // Only allow updates every 2000ms (2 seconds) - more aggressive throttling
    const shouldThrottle = (now - lastUpdateTimeRef.current) < 2000;
    
    // After 5 rapid updates, force an extra long throttle
    if (updateCountRef.current > 5 && (now - lastUpdateTimeRef.current) < 4000) {
      console.log('Excessive updates detected, applying extended throttling');
      return true;
    }
    
    // Reset the counter periodically
    if ((now - lastUpdateTimeRef.current) > 5000) {
      updateCountRef.current = 0;
      consecutiveUpdatesRef.current = 0;
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
