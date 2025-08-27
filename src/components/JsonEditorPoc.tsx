
import React, { useRef, useEffect, useCallback, useState } from 'react';
import 'jsoneditor/dist/jsoneditor.css';
import { CollapsedState } from '@/lib/diagram/types';
import { useJsonEditor } from '@/hooks/useJsonEditor';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import { EditorHistoryControls } from '@/components/editor/EditorHistoryControls';
import { VersionMismatchRibbon } from '@/components/editor/VersionMismatchRibbon';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';
import { getEffectiveDocumentContentForEditor } from '@/lib/documentUtils';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent, 
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  
  // Track if we're currently restoring from history to avoid circular updates
  const isRestoringFromHistory = useRef<boolean>(false);
  
  // Editor settings and version mismatch state
  const { settings } = useEditorSettings();
  const [showVersionMismatch, setShowVersionMismatch] = useState(false);
  const [baseContentForVersion, setBaseContentForVersion] = useState<any>(null);
  
  // Cache configuration state
  const [showCacheConfig, setShowCacheConfig] = useState(false);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [serverSyncEnabled, setServerSyncEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState(30);
  const [maxHistorySize, setMaxHistorySize] = useState(50);
  
  // Get base content for version comparison (only once per document)
  useEffect(() => {
    const getBaseContent = async () => {
      if (documentId && !baseContentForVersion) {
        try {
          // Parse the current value to get base content structure
          const parsedValue = JSON.parse(value);
          setBaseContentForVersion(parsedValue);
        } catch (error) {
          console.error('Error parsing current value for version comparison:', error);
          setBaseContentForVersion(null);
        }
      }
    };
    
    getBaseContent();
  }, [documentId]); // Only depend on documentId, not value

  // Initialize editor history
  const {
    addToHistory,
    undo,
    redo,
    clearHistory,
    startFresh,
    canUndo,
    canRedo,
    currentIndex,
    totalEntries,
    isInitialized
  } = useEditorHistory({
    documentId,
    initialContent: value,
    baseContent: baseContentForVersion,
    // 🎛️ Cache Strategy Configuration - Now controlled by UI
    enableServerSync: cacheEnabled && serverSyncEnabled,
    syncIntervalMs: syncInterval * 1000,
    maxHistorySize: maxHistorySize,
    debounceMs: 1000,
    disabled: !cacheEnabled, // Completely disable history when caching is off
    onContentChange: (content) => {
      // When restoring from history, don't trigger addToHistory again
      isRestoringFromHistory.current = true;
      onChange(content);
      // Reset flag after a small delay to allow the editor to update
      setTimeout(() => {
        isRestoringFromHistory.current = false;
      }, 100);
    },
    onVersionMismatch: (hasConflict) => {
      if (hasConflict && settings.showVersionMismatchWarning) {
        setShowVersionMismatch(true);
      }
    }
  });
  
  // Wrap onChange to add to history
  const handleChange = useCallback((newValue: string) => {
    onChange(newValue);
    // Only add to history if we're not restoring from history and history is initialized
    if (!isRestoringFromHistory.current && isInitialized) {
      addToHistory(newValue);
    }
  }, [onChange, addToHistory, isInitialized]);
  
  // Wrap onToggleCollapse to prevent initial setup events but allow bulk operations
  const handleToggleCollapse = useCallback((path: string, isCollapsed: boolean) => {
    // Always allow the callback for better bulk operation support
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
    
    // Initialize the editor
    initializeEditor(containerRef.current);
    
    // Mark as mounted after a small delay to let initial setup complete
    setTimeout(() => {
      isMountedRef.current = true;
    }, 500);
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      destroyEditor();
    };
  }, []);

  // Handle version mismatch ribbon actions
  const handleDismissVersionMismatch = useCallback(() => {
    setShowVersionMismatch(false);
  }, []);

  const handleStartFresh = useCallback(async () => {
    setShowVersionMismatch(false);
    await startFresh();
  }, [startFresh]);

  const handleKeepEdits = useCallback(() => {
    setShowVersionMismatch(false);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <VersionMismatchRibbon
        isVisible={showVersionMismatch}
        onDismiss={handleDismissVersionMismatch}
        onStartFresh={handleStartFresh}
        onKeepEdits={handleKeepEdits}
        documentId={documentId}
      />
      <div className="p-2 border-b bg-muted/30 flex justify-between items-center">
        <h2 className="font-semibold text-foreground">JSON Editor</h2>
        <div className="flex items-center gap-3">
          <Dialog open={showCacheConfig} onOpenChange={setShowCacheConfig}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="p-2">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Editor Cache Configuration</DialogTitle>
                <DialogDescription>
                  Configure how the editor saves and syncs your edit history.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Cache Enabled Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="cache-enabled">Enable Editor Caching</Label>
                    <p className="text-sm text-muted-foreground">
                      Store edit history for undo/redo functionality
                    </p>
                  </div>
                  <Switch
                    id="cache-enabled"
                    checked={cacheEnabled}
                    onCheckedChange={setCacheEnabled}
                  />
                </div>

                {/* Server Sync Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="server-sync">Server Synchronization</Label>
                    <p className="text-sm text-muted-foreground">
                      Sync history across devices and sessions
                    </p>
                  </div>
                  <Switch
                    id="server-sync"
                    checked={serverSyncEnabled}
                    onCheckedChange={setServerSyncEnabled}
                    disabled={!cacheEnabled}
                  />
                </div>

                {/* Sync Interval */}
                <div className="space-y-3">
                  <Label htmlFor="sync-interval">Sync Interval</Label>
                  <Select 
                    value={syncInterval.toString()} 
                    onValueChange={(value) => setSyncInterval(Number(value))}
                    disabled={!cacheEnabled || !serverSyncEnabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sync interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Every 5 seconds (Real-time)</SelectItem>
                      <SelectItem value="15">Every 15 seconds</SelectItem>
                      <SelectItem value="30">Every 30 seconds (Default)</SelectItem>
                      <SelectItem value="60">Every minute</SelectItem>
                      <SelectItem value="120">Every 2 minutes (Battery saving)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* History Size */}
                <div className="space-y-3">
                  <Label htmlFor="history-size">Max History Entries</Label>
                  <Select 
                    value={maxHistorySize.toString()} 
                    onValueChange={(value) => setMaxHistorySize(Number(value))}
                    disabled={!cacheEnabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select history size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20 entries (Low memory)</SelectItem>
                      <SelectItem value="30">30 entries</SelectItem>
                      <SelectItem value="50">50 entries (Default)</SelectItem>
                      <SelectItem value="100">100 entries</SelectItem>
                      <SelectItem value="200">200 entries (High memory)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Current Strategy Display */}
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Current Strategy:</p>
                  <p className="text-sm text-muted-foreground">
                    {!cacheEnabled 
                      ? "❌ Caching Disabled - No history saved"
                      : serverSyncEnabled 
                        ? `🔄 Server-Side with Local Cache (${syncInterval}s sync)`
                        : "💾 Local-Only Mode"
                    }
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <EditorHistoryControls
            canUndo={cacheEnabled && canUndo}
            canRedo={cacheEnabled && canRedo}
            onUndo={undo}
            onRedo={redo}
            onClearHistory={clearHistory}
            currentIndex={cacheEnabled ? currentIndex : 0}
            totalEntries={cacheEnabled ? totalEntries : 0}
            disabled={!cacheEnabled}
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
