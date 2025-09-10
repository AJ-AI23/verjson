// Global workspace refresh handler
let globalWorkspaceRefreshHandler: (() => Promise<void>) | null = null;

export const registerWorkspaceRefreshHandler = (handler: (() => Promise<void>) | null) => {
  globalWorkspaceRefreshHandler = handler;
};

export const triggerWorkspaceRefresh = async () => {
  if (globalWorkspaceRefreshHandler) {
    await globalWorkspaceRefreshHandler();
  }
};

// Global shared documents refresh handler
let globalSharedDocumentsRefreshHandler: (() => Promise<void>) | null = null;

export const registerSharedDocumentsRefreshHandler = (handler: (() => Promise<void>) | null) => {
  globalSharedDocumentsRefreshHandler = handler;
};

export const triggerSharedDocumentsRefresh = async () => {
  if (globalSharedDocumentsRefreshHandler) {
    await globalSharedDocumentsRefreshHandler();
  }
};

// Sequential refresh to ensure proper timing
export const triggerSequentialRefresh = async () => {
  try {
    // First refresh shared documents
    await triggerSharedDocumentsRefresh();
    // Then refresh workspaces (which includes checking for shared docs)
    await triggerWorkspaceRefresh();
  } catch (error) {
    console.error('[workspaceRefreshUtils] Sequential refresh error:', error);
  }
};