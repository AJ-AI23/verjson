
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

/**
 * Safely set content in a JSON Editor
 * This handles the various ways content can be set to avoid DOM errors
 */
export function safelySetEditorContent(editor: any, content: any) {
  if (!editor) return;
  
  try {
    // First try to set as parsed JSON
    editor.set(content);
  } catch (e) {
    console.error('Failed to set editor content as object:', e);
    
    // If that fails, try setting as string
    try {
      const contentStr = typeof content === 'string' 
        ? content 
        : JSON.stringify(content, null, 2);
        
      editor.setText(contentStr);
    } catch (textErr) {
      console.error('Failed to set editor content as text:', textErr);
      
      // Last resort - set empty object
      try {
        editor.set({});
      } catch (finalErr) {
        console.error('All content setting methods failed:', finalErr);
      }
    }
  }
}
