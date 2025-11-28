
import React, { useRef, useEffect, useCallback, useState } from 'react';
import 'jsoneditor/dist/jsoneditor.css';
import { CollapsedState } from '@/lib/diagram/types';
import { useJsonEditor } from '@/hooks/useJsonEditor';
import { useYjsDocument } from '@/hooks/useYjsDocument';
import { useYjsUndo } from '@/hooks/useYjsUndo';
import { useCollaboration } from '@/hooks/useCollaboration';
import { EditorHistoryControls } from '@/components/editor/EditorHistoryControls';
import { CollaborationIndicator } from '@/components/CollaborationIndicator';
import { Button } from '@/components/ui/button';
import { Settings, Users, Code, List, LayoutPanelLeft, LayoutPanelTop } from 'lucide-react';
import {
  Dialog,
  DialogContent, 
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { runLegacyCleanupOnce } from '@/utils/legacyCleanup';

interface JsonEditorPocProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth: number;
  documentId?: string;
  showDiagram?: boolean;
  onToggleDiagram?: () => void;
}

export const JsonEditorPoc: React.FC<JsonEditorPocProps> = ({
  value,
  onChange,
  error,
  collapsedPaths = {},
  onToggleCollapse,
  maxDepth,
  documentId,
  showDiagram = true,
  onToggleDiagram
}) => {
  // Create a ref to the editor container DOM element
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track if the component has been mounted
  const isMountedRef = useRef<boolean>(false);
  
  // Track if we're updating from Yjs to avoid circular updates
  const isUpdatingFromYjs = useRef<boolean>(false);
  
  // Track the current editor mode
  const [editorMode, setEditorMode] = useState<'tree' | 'code'>('tree');
  
  // Clean up legacy editor history on component mount
  useEffect(() => {
    runLegacyCleanupOnce();
  }, []);
  
  // Collaboration state with per-document localStorage persistence
  const [showCollaborationInfo, setShowCollaborationInfo] = useState(false);
  const [collaborationEnabled, setCollaborationEnabled] = useState(() => {
    if (!documentId) return false;
    const saved = localStorage.getItem(`collaboration-enabled-${documentId}`);
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Reset collaboration setting when document changes
  useEffect(() => {
    if (documentId) {
      const saved = localStorage.getItem(`collaboration-enabled-${documentId}`);
      setCollaborationEnabled(saved !== null ? JSON.parse(saved) : false);
    }
  }, [documentId]);

  // Persist collaboration setting per document
  useEffect(() => {
    if (documentId) {
      localStorage.setItem(`collaboration-enabled-${documentId}`, JSON.stringify(collaborationEnabled));
    }
  }, [collaborationEnabled, documentId]);

  // Stable refs for Yjs callbacks to prevent recreating hooks
  const onContentChangeRef = useRef<((content: string) => void) | undefined>();
  onContentChangeRef.current = useCallback((content: string) => {
    if (!isUpdatingFromYjs.current) {
      isUpdatingFromYjs.current = true;
      onChange(content);
      setTimeout(() => {
        isUpdatingFromYjs.current = false;
      }, 100);
    }
  }, [onChange]);

  // Initialize Yjs collaborative document
  const {
    yjsDoc,
    provider,
    isConnected,
    isLoading: yjsLoading,
    error: yjsError,
    activeUsers: yjsActiveUsers,
    getTextContent,
    updateContent
  } = useYjsDocument({
    documentId: collaborationEnabled ? documentId : null,
    initialContent: value,
    onContentChange: onContentChangeRef.current
  });

  // Initialize Yjs undo manager
  const {
    canUndo,
    canRedo,
    undo,
    redo,
    clearHistory,
    historySize,
    currentIndex,
    isUndoRedoOperation
  } = useYjsUndo({ yjsDoc });

  // Get collaboration info
  const { activeUsers: dbActiveUsers } = useCollaboration({ documentId });
  
  // Wrap onChange to update Yjs document 
  const handleChange = useCallback((newValue: string) => {
    console.log('[YJS] Handle change:', { 
      collaborationEnabled, 
      isUpdatingFromYjs: isUpdatingFromYjs.current, 
      isUndoRedo: isUndoRedoOperation(),
      hasYjsDoc: !!yjsDoc,
      documentId 
    });
    
    // Don't update Yjs if this change is from an undo/redo operation
    if (collaborationEnabled && !isUpdatingFromYjs.current && !isUndoRedoOperation() && yjsDoc) {
      console.log('[YJS] Updating YJS document with new content');
      updateContent(newValue);
    } else if (!collaborationEnabled) {
      // Regular onChange when collaboration is disabled
      onChange(newValue);
    }
  }, [collaborationEnabled, updateContent, yjsDoc, onChange, isUndoRedoOperation, documentId]);

  // Wrap onToggleCollapse 
  const handleToggleCollapse = useCallback((path: string, isCollapsed: boolean) => {
    if (onToggleCollapse) {
      onToggleCollapse(path, isCollapsed);
    }
  }, [onToggleCollapse]);
  
  // Use the custom hook for editor functionality
  const {
    editorRef,
    initializeEditor,
    destroyEditor,
    expandAll,
    collapseAll,
    pathExceedsMaxDepth
  } = useJsonEditor({
    value,
    onChange: handleChange,
    collapsedPaths,
    onToggleCollapse: handleToggleCollapse,
    maxDepth
  });
  
  // Handle mode toggle
  const handleModeToggle = useCallback(() => {
    if (editorRef.current) {
      const newMode = editorMode === 'tree' ? 'code' : 'tree';
      try {
        editorRef.current.setMode(newMode);
        setEditorMode(newMode);
      } catch (err) {
        console.error('Error switching editor mode:', err);
        toast.error(`Failed to switch to ${newMode} mode`);
      }
    }
  }, [editorRef, editorMode]);

  // Initialize the editor once the component mounts
  useEffect(() => {
    if (!containerRef.current) return;
    
    initializeEditor(containerRef.current);
    
    setTimeout(() => {
      isMountedRef.current = true;
    }, 500);
    
    return () => {
      isMountedRef.current = false;
      destroyEditor();
    };
  }, []);

  // Update editor content when Yjs content changes or document switches
  useEffect(() => {
    if (collaborationEnabled && yjsDoc && documentId) {
      const content = getTextContent();
      console.log('[YJS] Document content sync:', { documentId, hasContent: !!content, contentLength: content?.length || 0 });
      
      if (content && content !== value) {
        console.log('[YJS] Updating editor with YJS content');
        // Set flag to prevent recursive updates
        isUpdatingFromYjs.current = true;
        try {
          // Validate JSON before updating to avoid invalid intermediate states
          JSON.parse(content);
          onChange(content);
        } catch (e) {
          // If content is not valid JSON, don't update the editor yet
          // This can happen during partial sync operations
          console.log('Waiting for complete Yjs sync, content not yet valid JSON');
        } finally {
          // Reset flag after a short delay
          setTimeout(() => {
            isUpdatingFromYjs.current = false;
          }, 100);
        }
      } else if (content && content === value) {
        console.log('[YJS] Editor and YJS content already in sync');
      }
    }
  }, [collaborationEnabled, yjsDoc, documentId, getTextContent, value, onChange]);

  // Show toast notifications for collaboration (only when enabled)
  const previousYjsErrorRef = useRef<string | null>(null);
  const hasShownConnectedToastRef = useRef<boolean>(false);
  
  useEffect(() => {
    if (collaborationEnabled && yjsError && yjsError !== previousYjsErrorRef.current) {
      previousYjsErrorRef.current = yjsError;
      toast.error('Collaboration Error', {
        description: yjsError
      });
    }
  }, [collaborationEnabled, yjsError]);

  useEffect(() => {
    if (collaborationEnabled && isConnected && !hasShownConnectedToastRef.current) {
      hasShownConnectedToastRef.current = true;
      toast.success('Connected to collaboration server');
    } else if (!isConnected || !collaborationEnabled) {
      hasShownConnectedToastRef.current = false;
    }
  }, [collaborationEnabled, isConnected]);

  // Combine active users from Yjs and database into unified format (only when collaboration enabled)
  const unifiedActiveUsers = collaborationEnabled ? [
    ...(yjsActiveUsers || []).map(user => ({
      id: user.id,
      user_id: user.id,
      user_name: user.name,
      user_avatar: user.avatar,
      last_seen: new Date().toISOString()
    })),
    ...(dbActiveUsers || [])
  ] : [];
  
  const uniqueActiveUsers = unifiedActiveUsers.filter((user, index, self) => 
    index === self.findIndex(u => u.user_id === user.user_id)
  );

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-muted/30 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Dialog open={showCollaborationInfo} onOpenChange={setShowCollaborationInfo}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="p-2">
                <Users className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Collaborative Editing</DialogTitle>
                <DialogDescription>
                  Real-time collaboration powered by Yjs (Experimental)
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Collaboration Toggle */}
                <div className="flex items-center justify-between p-3 bg-background border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="collaboration-enabled" className="text-sm font-medium">
                      Enable Real-time Collaboration
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Connect with other users to edit documents together
                    </p>
                  </div>
                  <Switch
                    id="collaboration-enabled"
                    checked={collaborationEnabled}
                    onCheckedChange={(checked) => {
                      setCollaborationEnabled(checked);
                      if (checked) {
                        toast.success('Collaboration enabled');
                      } else {
                        toast.info('Collaboration disabled - working in single-user mode');
                      }
                    }}
                  />
                </div>

                {collaborationEnabled && (
                  <>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">Connection Status:</p>
                      <div className="flex items-center gap-2">
                        {yjsLoading ? (
                          <>
                            <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
                            <span className="text-sm">Connecting...</span>
                          </>
                        ) : isConnected ? (
                          <>
                            <div className="h-2 w-2 bg-green-500 rounded-full" />
                            <span className="text-sm">Connected</span>
                          </>
                        ) : (
                          <>
                            <div className="h-2 w-2 bg-red-500 rounded-full" />
                            <span className="text-sm">Disconnected</span>
                          </>
                        )}
                      </div>
                    </div>

                    {uniqueActiveUsers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Active Collaborators:</p>
                        <div className="space-y-1">
                          {uniqueActiveUsers.map((user) => (
                            <div key={user.user_id} className="flex items-center gap-2 text-sm">
                              <div className="h-2 w-2 bg-green-500 rounded-full" />
                              <span>{user.user_name || 'Anonymous'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Changes are automatically synchronized in real-time. 
                        Undo/redo operations are per-user and won't affect other collaborators' work.
                      </p>
                    </div>
                  </>
                )}

                {!collaborationEnabled && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Collaboration is currently disabled. You're working in single-user mode 
                      with local undo/redo history.
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          <EditorHistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onClearHistory={clearHistory}
            currentIndex={currentIndex}
            totalEntries={historySize}
            disabled={false}
          />
          
          <CollaborationIndicator
            activeUsers={collaborationEnabled ? uniqueActiveUsers : []}
            isConnected={collaborationEnabled && isConnected}
            isLoading={collaborationEnabled && yjsLoading}
            className="ml-2"
          />
          
          <div className="w-px h-4 bg-border" />
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs px-2 py-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-2 py-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors"
            >
              Collapse All
            </button>
            <button
              onClick={handleModeToggle}
              className="text-xs px-2 py-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors flex items-center gap-1"
              title={editorMode === 'tree' ? 'Switch to Code Mode' : 'Switch to Tree Mode'}
            >
              {editorMode === 'tree' ? (
                <>
                  <Code className="h-3 w-3" />
                  Code
                </>
              ) : (
                <>
                  <List className="h-3 w-3" />
                  Tree
                </>
              )}
            </button>
            {onToggleDiagram && (
              <button
                onClick={onToggleDiagram}
                className="text-xs px-2 py-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors flex items-center gap-1"
                title={showDiagram ? 'Hide Diagram' : 'Show Diagram'}
              >
                {showDiagram ? (
                  <>
                    <LayoutPanelTop className="h-3 w-3" />
                    Hide Diagram
                  </>
                ) : (
                  <>
                    <LayoutPanelLeft className="h-3 w-3" />
                    Show Diagram
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* The container for the JSONEditor instance */}
      <div className="flex-1 editor-container" ref={containerRef}></div>
      
      {/* Error display */}
      {error && (
        <div className="p-2 bg-destructive/10 border-t border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}
      
    </div>
  );
};
