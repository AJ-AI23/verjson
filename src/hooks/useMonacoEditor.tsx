
import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Monaco, OnMount } from '@monaco-editor/react';
import { toast } from 'sonner';
import { CollapsedState } from '@/lib/diagram/types';
import { useEditorBasicSetup } from './editor/useEditorBasicSetup';
import { usePathMapping } from './editor/usePathMapping';
import { useFoldingDebug } from './editor/useFoldingDebug';
import { useFoldingEvents } from './editor/useFoldingEvents';
import { useCollapsedPaths } from './editor/useCollapsedPaths';

interface UseMonacoEditorProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths?: CollapsedState;
}

export const useMonacoEditor = ({ onToggleCollapse, collapsedPaths = {} }: UseMonacoEditorProps) => {
  // References for editor and monaco instance
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  
  // Reference for storing collapsed paths
  const prevCollapsedPathsRef = useRef<CollapsedState>(collapsedPaths);
  
  // Import sub-hooks
  const { configureJsonLanguage, handleFormatCode: baseHandleFormatCode } = useEditorBasicSetup();
  const { pathMapRef, refreshPathMap } = usePathMapping();
  const { isDebugMode, setIsDebugMode, inspectFoldedRegions, DebugFoldingButton } = useFoldingDebug();
  const { previousFoldingRangesRef, processFoldingChanges, setupFoldingCommands } = useFoldingEvents(onToggleCollapse);
  const { updateCollapsedPathsRef } = useCollapsedPaths();
  
  // Format the code in the editor
  const handleFormatCode = useCallback(() => {
    baseHandleFormatCode(editorRef);
    
    // After formatting, refresh the path map
    setTimeout(() => refreshPathMap(editorRef), 100);
  }, [baseHandleFormatCode, refreshPathMap]);
  
  // Force a refresh of the folding path mapping
  const forceFoldingRefresh = useCallback(() => {
    if (editorRef.current) {
      const info = inspectFoldedRegions(editorRef.current, pathMapRef);
      return info;
    }
    return null;
  }, [inspectFoldedRegions, pathMapRef]);
  
  // Mount the editor and configure it
  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Configure JSON language features
    configureJsonLanguage(monaco);
    
    // Add command to format JSON
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      handleFormatCode();
    });
    
    // Turn on bracket pair colorization
    editor.updateOptions({
      bracketPairColorization: { enabled: true },
    });
    
    // Generate initial path map
    setTimeout(() => {
      const model = editor.getModel();
      if (model) {
        pathMapRef.current = generateLineToPathMap(model);
        console.log("Initial path map generated:", pathMapRef.current);
      }
    }, 500);

    // Add specific listeners for fold/unfold events
    if (onToggleCollapse) {
      // Listen for decoration changes (which include folding/unfolding)
      const decorationsDisposable = editor.onDidChangeModelDecorations(() => {
        processFoldingChanges(editor, pathMapRef, isDebugMode);
      });
      
      // Listen for content changes to update path map
      const contentChangeDisposable = editor.onDidChangeModelContent(() => {
        // Don't regenerate on every keystroke - use a debounce approach
        if (window.pathMapUpdateTimeout) {
          clearTimeout(window.pathMapUpdateTimeout);
        }
        
        window.pathMapUpdateTimeout = setTimeout(() => {
          refreshPathMap(editorRef);
        }, 1000); // Regenerate path map 1 second after typing stops
      });
      
      // Setup keyboard commands for fold/unfold
      setupFoldingCommands(editor, monaco, inspectFoldedRegions, pathMapRef);
      
      // Add global function for manual inspection
      window.inspectMonacoEditor = () => {
        console.log("=== MANUAL EDITOR INSPECTION ===");
        console.log("Editor reference:", editor);
        console.log("Monaco reference:", monaco);
        const result = inspectFoldedRegions(editor, pathMapRef);
        console.log("Path map:", result.pathMap);
        console.log("=== END MANUAL INSPECTION ===");
        return result;
      };
      
      // Command to toggle debug mode
      editor.addAction({
        id: 'toggle-fold-debug-mode',
        label: 'Toggle Folding Debug Mode',
        run: () => {
          setIsDebugMode(prev => !prev);
          toast.success(`Folding debug mode ${!isDebugMode ? 'enabled' : 'disabled'}`);
        }
      });
      
      // Return a cleanup function to dispose of the event listeners
      return () => {
        decorationsDisposable.dispose();
        contentChangeDisposable.dispose();
        // @ts-ignore - Cleanup global function
        window.inspectMonacoEditor = undefined;
        if (window.pathMapUpdateTimeout) {
          clearTimeout(window.pathMapUpdateTimeout);
        }
      };
    }
  }, [
    configureJsonLanguage, 
    handleFormatCode, 
    processFoldingChanges, 
    setupFoldingCommands, 
    inspectFoldedRegions, 
    onToggleCollapse, 
    refreshPathMap, 
    isDebugMode, 
    pathMapRef
  ]);
  
  // Update collapsedPaths reference when it changes
  useEffect(() => {
    updateCollapsedPathsRef(prevCollapsedPathsRef, collapsedPaths);
  }, [collapsedPaths, updateCollapsedPathsRef]);
  
  // Create a debug button component for the toolbar
  const DebugFoldingButtonWrapper = useCallback(() => {
    return (
      <DebugFoldingButton 
        onClick={() => {
          const result = forceFoldingRefresh();
          toast.info("Folding inspection completed", {
            description: `Found ${result?.foldingRanges?.length || 0} folding ranges and ${Object.keys(result?.pathMap || {}).length} path mappings`
          });
        }}
      />
    );
  }, [DebugFoldingButton, forceFoldingRefresh]);
  
  // Expose debug mode state
  useEffect(() => {
    console.log(`Folding debug mode: ${isDebugMode ? 'enabled' : 'disabled'}`);
  }, [isDebugMode]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (window.pathMapUpdateTimeout) {
        clearTimeout(window.pathMapUpdateTimeout);
      }
    };
  }, []);
  
  // Return the hook's API
  return {
    editorRef,
    monacoRef,
    prevCollapsedPathsRef,
    handleEditorDidMount,
    handleFormatCode,
    inspectFoldedRegions: (editor: any) => inspectFoldedRegions(editor, pathMapRef),
    updateCollapsedPathsRef: (paths: CollapsedState) => updateCollapsedPathsRef(prevCollapsedPathsRef, paths),
    isDebugMode,
    forceFoldingRefresh,
    DebugFoldingButton: DebugFoldingButtonWrapper
  };
};

// Add pathMapUpdateTimeout to window type
declare global {
  interface Window {
    inspectMonacoEditor?: () => any;
    pathMapUpdateTimeout?: ReturnType<typeof setTimeout>;
  }
}
