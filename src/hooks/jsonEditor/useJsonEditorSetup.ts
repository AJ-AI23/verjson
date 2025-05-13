
import { useEffect, useRef } from 'react';
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';

interface UseJsonEditorSetupProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths: CollapsedState;
  expandFirstLevel: () => void;
  maxDepth?: number;
}

export const useJsonEditorSetup = ({
  editorRef,
  onToggleCollapse,
  collapsedPaths,
  expandFirstLevel,
  maxDepth = 3 // Default to 3 if not provided
}: UseJsonEditorSetupProps) => {
  // Track collapsedPaths in a ref for debugging
  const collapsedPathsRef = useRef<Record<string, boolean>>(collapsedPaths);
  
  // Initial setup done flag
  const initialSetupDone = useRef<boolean>(false);
  
  // Update the ref when collapsedPaths changes
  useEffect(() => {
    collapsedPathsRef.current = { ...collapsedPaths };
    console.log('collapsedPathsRef updated in useJsonEditorSetup:', collapsedPathsRef.current);
  }, [collapsedPaths]);

  // Helper function to determine if a path exceeds the maximum depth
  const pathExceedsMaxDepth = (path: string): boolean => {
    // Count the number of segments (split by dots, excluding 'root')
    const segments = path.split('.');
    // The first segment is 'root', so we exclude it from the count
    // If the segments are > maxDepth + 1, it exceeds the max depth
    return segments.length > maxDepth + 1;
  };
  
  // Helper function to traverse JSON and set initial collapsed states
  const traverseAndSetCollapsedStates = (json: any, path: string = 'root', depth: number = 1) => {
    if (!json || typeof json !== 'object' || !onToggleCollapse) return;
    
    // Skip if already processed
    if (collapsedPathsRef.current[path] !== undefined) return;
    
    // Determine if this node should be collapsed based on depth
    const shouldCollapse = depth > maxDepth;
    
    // Set collapsed state for this path
    onToggleCollapse(path, shouldCollapse);
    collapsedPathsRef.current[path] = shouldCollapse;
    
    if (Array.isArray(json)) {
      // For arrays, process items if they are objects
      if (json.length > 0 && typeof json[0] === 'object') {
        traverseAndSetCollapsedStates(json[0], `${path}.items`, depth + 1);
      }
    } else {
      // For objects, process each property
      for (const key in json) {
        if (typeof json[key] === 'object' && json[key] !== null) {
          const newPath = `${path}.${key === 'properties' ? key : `properties.${key}`}`;
          traverseAndSetCollapsedStates(json[key], newPath, depth + 1);
        }
      }
    }
  };

  // Effect to handle initial folding state after initialization
  useEffect(() => {
    if (editorRef.current && !initialSetupDone.current) {
      console.log("Running initial folding setup with maxDepth:", maxDepth);
      
      // Wait a moment for the editor to fully initialize
      const timer = setTimeout(() => {
        try {
          if (!editorRef.current) return;
          
          // First, collapse everything to ensure we start from a known state
          if (editorRef.current.collapseAll) {
            console.log("Initially collapsing all nodes");
            editorRef.current.collapseAll();
            
            // Set root as collapsed in our state tracking
            if (onToggleCollapse) {
              onToggleCollapse('root', true);
              collapsedPathsRef.current['root'] = true;
            }
          }
          
          // Get the editor content to traverse it
          try {
            const content = editorRef.current.get();
            if (content && typeof content === 'object') {
              console.log("Traversing JSON to set initial collapsed states");
              
              // Expand the root node first
              if (onToggleCollapse) {
                onToggleCollapse('root', false);
                collapsedPathsRef.current['root'] = false;
                
                // Get the root node and expand it in the editor
                const rootNode = editorRef.current.node;
                if (rootNode && rootNode.expand) {
                  rootNode.expand();
                }
              }
              
              // Now traverse the content and set collapsed states based on depth
              traverseAndSetCollapsedStates(content);
              
              console.log("Initialized collapsed paths based on depth:", collapsedPathsRef.current);
            }
          } catch (e) {
            console.error("Error getting editor content:", e);
          }
          
          initialSetupDone.current = true;
          console.log('Initial folding setup completed');
        } catch (e) {
          console.error('Error during initial folding setup:', e);
          
          // Fallback to basic first level expansion if something went wrong
          expandFirstLevel();
          initialSetupDone.current = true;
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [editorRef.current, onToggleCollapse, expandFirstLevel, maxDepth]);

  return {
    initialSetupDone,
    collapsedPathsRef,
    pathExceedsMaxDepth
  };
};
