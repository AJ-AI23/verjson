// @refresh reset
import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import 'jsoneditor/dist/jsoneditor.css';
import { CollapsedState } from '@/lib/diagram/types';
import { useJsonEditor } from '@/hooks/useJsonEditor';
import { useYjsDocument } from '@/hooks/useYjsDocument';
import { useYjsUndo } from '@/hooks/useYjsUndo';
import { useCollaboration } from '@/hooks/useCollaboration';
import { EditorHistoryControls } from '@/components/editor/EditorHistoryControls';
import { CollaborationIndicator } from '@/components/CollaborationIndicator';
import { OpenApiStructureEditor } from '@/components/openapi/OpenApiStructureEditor';
import { SchemaStructureEditor } from '@/components/schema/SchemaStructureEditor';
import { Button } from '@/components/ui/button';
import { Settings, Users, Code2, FileJson2, PanelLeftClose, PanelLeft, LayoutList, AlertTriangle } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { runLegacyCleanupOnce } from '@/utils/legacyCleanup';
import { checkSchemaConsistency } from '@/lib/translationUtils';
import { useConsistencyConfig } from '@/hooks/useConsistencyConfig';
import { Badge } from '@/components/ui/badge';

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

  // Track first external->Yjs sync per document to avoid creating noisy history entries
  const didInitialExternalSyncRef = useRef<{ documentId: string; done: boolean } | null>(null);
  
  // Track the current editor mode
  const [editorMode, setEditorMode] = useState<'tree' | 'code'>('tree');
  
  // Track view mode: JSON editor or Structure editor
  const [viewMode, setViewMode] = useState<'json' | 'structure'>('structure');
  
  // Parse schema for structure editor
  const parsedSchema = useMemo(() => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }, [value]);
  
  // Check schema type
  const isOpenApi = useMemo(() => {
    return parsedSchema?.openapi || parsedSchema?.swagger;
  }, [parsedSchema]);
  
  const isDiagram = useMemo(() => {
    // Check for new verjson format first
    if (parsedSchema?.verjson !== undefined && (parsedSchema?.type === 'sequence' || parsedSchema?.type === 'flowchart')) {
      return true;
    }
    // Legacy flat diagram format
    return parsedSchema?.nodes !== undefined || parsedSchema?.lifelines !== undefined;
  }, [parsedSchema]);
  
  const isMarkdown = useMemo(() => {
    return parsedSchema?.verjson !== undefined && parsedSchema?.type === 'markdown';
  }, [parsedSchema]);
  
  const isJsonSchema = useMemo(() => {
    return parsedSchema?.type || parsedSchema?.properties || parsedSchema?.$schema;
  }, [parsedSchema]);
  
  // Structure view is available for all supported schema types
  const supportsStructureView = isOpenApi || isDiagram || isJsonSchema || isMarkdown;
  
  // Consistency checking
  const { config: consistencyConfig } = useConsistencyConfig();
  const [showConsistencyIndicators, setShowConsistencyIndicators] = useState(() => {
    const saved = localStorage.getItem('show-consistency-indicators');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  // Persist consistency indicator preference
  useEffect(() => {
    localStorage.setItem('show-consistency-indicators', JSON.stringify(showConsistencyIndicators));
  }, [showConsistencyIndicators]);
  
  // Run consistency checks on the schema
  const consistencyIssues = useMemo(() => {
    if (!parsedSchema || !showConsistencyIndicators) return [];
    try {
      return checkSchemaConsistency(parsedSchema, consistencyConfig);
    } catch (error) {
      console.error('Consistency check failed:', error);
      return [];
    }
  }, [parsedSchema, consistencyConfig, showConsistencyIndicators]);
  
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

  // Initialize Yjs document (always-on local doc, optional collaboration provider)
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
    documentId: documentId ?? null,
    collaborationEnabled,
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

  // IMPORTANT: Some edits (like Markdown raw editor changes) update the `value` prop
  // without going through `handleChange`, so they never reach Yjs and won't be undoable.
  // This effect mirrors external value changes into Yjs so UndoManager captures them.
  useEffect(() => {
    if (!documentId || !yjsDoc) return;
    if (isUpdatingFromYjs.current) return;

    // Reset per-document guard
    if (didInitialExternalSyncRef.current?.documentId !== documentId) {
      didInitialExternalSyncRef.current = { documentId, done: false };
    }

    // Only push valid JSON into Yjs (consistent with useYjsDocument observer behavior)
    try {
      JSON.parse(value);
    } catch {
      return;
    }

    const current = getTextContent();

    // 1) One-time silent sync so Yjs starts from the current authoritative value
    // without polluting the undo history.
    if (!didInitialExternalSyncRef.current?.done) {
      if (current !== value) {
        const text = yjsDoc.getText('content');

        // Use a non-null origin so UndoManager (which tracks null origin by default)
        // does NOT record this initial alignment as an undo step.
        yjsDoc.transact(() => {
          text.delete(0, text.length);
          text.insert(0, value);
        }, 'external-sync');
      }

      didInitialExternalSyncRef.current = { documentId, done: true };
      return;
    }

    // 2) After initial alignment, mirror external value changes into Yjs so they become undoable.
    if (current !== value) {
      updateContent(value);
    }
  }, [documentId, getTextContent, updateContent, value, yjsDoc]);

  // Get collaboration info
  const { activeUsers: dbActiveUsers } = useCollaboration({ documentId });
  
  // Route ALL edits through Yjs (even in single-user mode) so UndoManager always works.
  const handleChange = useCallback((newValue: string) => {
    console.log('[YJS] Handle change:', {
      collaborationEnabled,
      isUpdatingFromYjs: isUpdatingFromYjs.current,
      isUndoRedo: isUndoRedoOperation(),
      hasYjsDoc: !!yjsDoc,
      documentId
    });

    if (yjsDoc) {
      // Avoid re-recording the same content (common with delayed JSONEditor change events
      // after programmatic updates like undo/redo or remote sync).
      const stableSortKeys = (v: any): any => {
        if (Array.isArray(v)) return v.map(stableSortKeys);
        if (v && typeof v === 'object' && v.constructor === Object) {
          const out: Record<string, any> = {};
          for (const k of Object.keys(v).sort()) out[k] = stableSortKeys(v[k]);
          return out;
        }
        return v;
      };

      const normalizeForCompare = (s: string): string | null => {
        try {
          return JSON.stringify(stableSortKeys(JSON.parse(s)));
        } catch {
          return null;
        }
      };

      const current = getTextContent();
      if (newValue === current) return;

      const nextNorm = normalizeForCompare(newValue);
      const currentNorm = normalizeForCompare(current);
      if (nextNorm !== null && currentNorm !== null && nextNorm === currentNorm) return;

      updateContent(newValue);
      return;
    }

    // Fallback (should be rare): keep the app responsive even if Yjs isn't available.
    onChange(newValue);
  }, [collaborationEnabled, documentId, getTextContent, isUndoRedoOperation, onChange, updateContent, yjsDoc]);



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
            {viewMode === 'json' && (
              <>
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
                  className="p-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors"
                  title={editorMode === 'tree' ? 'Switch to Code Mode' : 'Switch to Tree Mode'}
                >
                  {editorMode === 'tree' ? (
                    <Code2 className="h-4 w-4" />
                  ) : (
                    <FileJson2 className="h-4 w-4" />
                  )}
                </button>
              </>
            )}
            {supportsStructureView && viewMode === 'structure' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowConsistencyIndicators(!showConsistencyIndicators)}
                      className={`p-1.5 rounded transition-colors flex items-center gap-1 ${
                        showConsistencyIndicators 
                          ? 'bg-amber-500/20 text-amber-600 hover:bg-amber-500/30' 
                          : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                      }`}
                      title={showConsistencyIndicators ? 'Hide Consistency Indicators' : 'Show Consistency Indicators'}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {consistencyIssues.length > 0 && showConsistencyIndicators && (
                        <Badge variant="outline" className="h-4 px-1 py-0 text-[10px] bg-amber-500/10 text-amber-600 border-0">
                          {consistencyIssues.length}
                        </Badge>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {showConsistencyIndicators 
                      ? `Hide consistency indicators (${consistencyIssues.length} issues)` 
                      : 'Show consistency indicators'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {supportsStructureView && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode(viewMode === 'json' ? 'structure' : 'json')}
                      className={`p-1.5 rounded transition-colors ${
                        viewMode === 'structure' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                      }`}
                      title={viewMode === 'json' ? 'Switch to Structure View' : 'Switch to JSON View'}
                    >
                      <LayoutList className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {viewMode === 'json' ? 'Switch to Structure View' : 'Switch to JSON View'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {onToggleDiagram && (
              <button
                onClick={onToggleDiagram}
                className="p-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors"
                title={showDiagram ? 'Hide Diagram' : 'Show Diagram'}
              >
                {showDiagram ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeft className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Structure Editor */}
      {viewMode === 'structure' && parsedSchema && (
        <div className="flex-1 overflow-hidden">
          {isOpenApi ? (
            <OpenApiStructureEditor
              schema={parsedSchema}
              onSchemaChange={(newSchema) => {
                handleChange(JSON.stringify(newSchema, null, 2));
              }}
              consistencyIssues={showConsistencyIndicators ? consistencyIssues : []}
            />
          ) : (
            <SchemaStructureEditor
              schema={parsedSchema}
              schemaType={isDiagram ? 'diagram' : isMarkdown ? 'markdown' : 'json-schema'}
              onSchemaChange={(newSchema) => {
                handleChange(JSON.stringify(newSchema, null, 2));
              }}
              consistencyIssues={showConsistencyIndicators ? consistencyIssues : []}
            />
          )}
        </div>
      )}
      
      {/* The container for the JSONEditor instance */}
      <div 
        className={`flex-1 editor-container ${viewMode === 'structure' ? 'hidden' : ''}`} 
        ref={containerRef}
      />
      
      {/* Error display */}
      {error && (
        <div className="p-2 bg-destructive/10 border-t border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}
      
    </div>
  );
};
