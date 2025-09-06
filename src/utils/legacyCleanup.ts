/**
 * Utility to clean up legacy localStorage entries from the old editor history system
 * This runs once to remove old cached data that is no longer needed with Yjs
 */

export const cleanupLegacyEditorHistory = () => {
  try {
    // Find and remove all old editor-history-* keys
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('editor-history-')) {
        keysToRemove.push(key);
      }
    }
    
    // Remove the found keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    if (keysToRemove.length > 0) {
      console.log(`Cleaned up ${keysToRemove.length} legacy editor history entries`);
    }
  } catch (error) {
    console.warn('Failed to cleanup legacy editor history:', error);
  }
};

// Run cleanup on module load (once per session)
let hasRunCleanup = false;
export const runLegacyCleanupOnce = () => {
  if (!hasRunCleanup) {
    cleanupLegacyEditorHistory();
    hasRunCleanup = true;
  }
};