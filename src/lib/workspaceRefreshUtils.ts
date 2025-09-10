// Global workspace refresh handler
let globalWorkspaceRefreshHandler: (() => void) | null = null;

export const registerWorkspaceRefreshHandler = (handler: (() => void) | null) => {
  globalWorkspaceRefreshHandler = handler;
};

export const triggerWorkspaceRefresh = () => {
  if (globalWorkspaceRefreshHandler) {
    globalWorkspaceRefreshHandler();
  }
};

// Global shared documents refresh handler
let globalSharedDocumentsRefreshHandler: (() => void) | null = null;

export const registerSharedDocumentsRefreshHandler = (handler: (() => void) | null) => {
  globalSharedDocumentsRefreshHandler = handler;
};

export const triggerSharedDocumentsRefresh = () => {
  if (globalSharedDocumentsRefreshHandler) {
    globalSharedDocumentsRefreshHandler();
  }
};