/**
 * Utility to clean up legacy localStorage entries from the old editor history system
 * and handle settings migrations
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

/**
 * Clear legacy collaboration settings to ensure new default (disabled) takes effect
 * This is needed because we changed the default from enabled to disabled
 */
export const cleanupLegacyCollaborationSettings = () => {
  try {
    const SETTINGS_VERSION_KEY = 'lovable-settings-version';
    const CURRENT_VERSION = '2';
    
    const currentVersion = localStorage.getItem(SETTINGS_VERSION_KEY);
    
    // Only run migration if this is the first time loading the new version
    if (currentVersion !== CURRENT_VERSION) {
      console.log('Running collaboration settings migration...');
      
      // Find and remove all collaboration-enabled-* keys
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('collaboration-enabled-')) {
          keysToRemove.push(key);
        }
      }
      
      // Remove the found keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      if (keysToRemove.length > 0) {
        console.log(`Reset ${keysToRemove.length} collaboration settings to use new default (disabled)`);
      }
      
      // Update settings version
      localStorage.setItem(SETTINGS_VERSION_KEY, CURRENT_VERSION);
    }
  } catch (error) {
    console.warn('Failed to cleanup legacy collaboration settings:', error);
  }
};

// Run cleanup on module load (once per session)
let hasRunCleanup = false;
export const runLegacyCleanupOnce = () => {
  if (!hasRunCleanup) {
    cleanupLegacyEditorHistory();
    cleanupLegacyCollaborationSettings();
    hasRunCleanup = true;
  }
};