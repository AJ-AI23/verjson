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