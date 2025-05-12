
import { CollapsedState } from '@/lib/diagram/types';

/**
 * Helper function to update collapsed paths state
 */
export function updateCollapsedState(
  path: string,
  isCollapsed: boolean,
  currentCollapsedPaths: CollapsedState
): CollapsedState {
  return {
    ...currentCollapsedPaths,
    [path]: isCollapsed
  };
}

/**
 * Toggle collapsed state for a path
 */
export function toggleCollapsedState(
  path: string,
  currentCollapsedPaths: CollapsedState
): { path: string; previousState: boolean; newState: boolean } {
  // Get current state with default to true (collapsed)
  const currentState = currentCollapsedPaths[path] !== undefined 
    ? currentCollapsedPaths[path] 
    : true;
  
  // Toggle state
  const newState = !currentState;
  
  return {
    path,
    previousState: currentState,
    newState
  };
}
