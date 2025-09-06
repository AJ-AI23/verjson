
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
import { Settings, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent, 
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface JsonEditorPocProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth: number;
  documentId?: string;
}

export const JsonEditorPoc: React.FC<JsonEditorPocProps> = ({
  value,
  onChange,
  error,
  collapsedPaths = {},
  onToggleCollapse,
  maxDepth,
  documentId
}) => {
  // Create a ref to the editor container DOM element
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track if the component has been mounted
  const isMountedRef = useRef<boolean>(false);
  
  // Track if we're updating from Yjs to avoid circular updates
  const isUpdatingFromYjs = useRef<boolean>(false);
  
  // Collaboration state
  const [showCollaborationInfo, setShowCollaborationInfo] = useState(false);

  // Temporarily disable Yjs to prevent infinite loops
  const ENABLE_YJS = false;

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

  // Initialize Yjs collaborative document (disabled for now)
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
    documentId: ENABLE_YJS ? documentId : null,
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
    historySize
  } = useYjsUndo({ yjsDoc });

  // Get collaboration info
  const { activeUsers: dbActiveUsers } = useCollaboration({ documentId });
  
  // Wrap onChange to update Yjs document (fallback to regular onChange when Yjs disabled)
  const handleChange = useCallback((newValue: string) => {
    if (ENABLE_YJS && !isUpdatingFromYjs.current && yjsDoc) {
      updateContent(newValue);
    } else {
      // Regular onChange when Yjs is disabled
      onChange(newValue);
    }
  }, [updateContent, yjsDoc, onChange]);

  // Wrap onToggleCollapse 
  const handleToggleCollapse = useCallback((path: string, isCollapsed: boolean) => {
    if (onToggleCollapse) {
      onToggleCollapse(path, isCollapsed);
    }
  }, [onToggleCollapse]);
  
  // Use the custom hook for editor functionality
  const {
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

  // Update editor content when Yjs content changes (with guards)
  useEffect(() => {
    if (yjsDoc && !isUpdatingFromYjs.current) {
      const content = getTextContent();
      if (content && content !== value) {
        onChange(content);
      }
    }
  }, [yjsDoc]); // Remove getTextContent, value, onChange from dependencies

  // Show toast notifications for collaboration (only once per error/connection)
  const previousYjsErrorRef = useRef<string | null>(null);
  const hasShownConnectedToastRef = useRef<boolean>(false);
  
  useEffect(() => {
    if (yjsError && yjsError !== previousYjsErrorRef.current) {
      previousYjsErrorRef.current = yjsError;
      toast.error('Collaboration Error', {
        description: yjsError
      });
    }
  }, [yjsError]);

  useEffect(() => {
    if (isConnected && !hasShownConnectedToastRef.current) {
      hasShownConnectedToastRef.current = true;
      toast.success('Connected to collaboration server');
    } else if (!isConnected) {
      hasShownConnectedToastRef.current = false;
    }
  }, [isConnected]);

  // Combine active users from Yjs and database into unified format
  const unifiedActiveUsers = [
    ...(yjsActiveUsers || []).map(user => ({
      id: user.id,
      user_id: user.id,
      user_name: user.name,
      user_avatar: user.avatar,
      last_seen: new Date().toISOString()
    })),
    ...(dbActiveUsers || [])
  ];
  
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
                  Real-time collaboration powered by Yjs
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
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
              </div>
            </DialogContent>
          </Dialog>
          
          <EditorHistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onClearHistory={clearHistory}
            currentIndex={0} // Yjs doesn't expose current index
            totalEntries={historySize}
            disabled={false}
          />
          
          <CollaborationIndicator
            activeUsers={uniqueActiveUsers}
            isConnected={isConnected}
            isLoading={yjsLoading}
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
