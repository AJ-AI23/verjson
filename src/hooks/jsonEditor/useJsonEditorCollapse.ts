
import { useEffect } from 'react';
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';

interface UseJsonEditorCollapseProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  initialSetupDone: React.MutableRefObject<boolean>;
  collapsedPaths: CollapsedState;
  masterCollapsedPathsRef?: React.MutableRefObject<Record<string, boolean>>;
}

export const useJsonEditorCollapse = ({
  editorRef,
  initialSetupDone,
  collapsedPaths,
  masterCollapsedPathsRef
}: UseJsonEditorCollapseProps) => {
  // Effect to apply collapsedPaths changes to the editor - throttled
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Skip during initial setup
      if (!editorRef.current || !initialSetupDone.current) return;
      
      try {
        const editor = editorRef.current;
        const pathsToUse = masterCollapsedPathsRef?.current || collapsedPaths;
        
        if (editor && editor.node) {
          // Handle individual path collapses
          Object.entries(pathsToUse).forEach(([path, isCollapsed]) => {
            if (path === 'root') {
              // Handle root level collapse/expand
              if (isCollapsed === true && !editor.node.collapsed) {
                editor.collapseAll();
              } else if (isCollapsed === false && editor.node.collapsed) {
                editor.expandAll();
              }
            } else {
              // Handle individual path collapses by finding the node
              const pathParts = path.replace('root.', '').split('.');
              try {
                let currentNode = editor.node;
                
                // Navigate to the target node
                for (const part of pathParts) {
                  if (currentNode && currentNode.childs) {
                    currentNode = currentNode.childs.find((child: any) => child.field === part);
                  }
                  if (!currentNode) break;
                }
                
                // Apply collapse/expand state if node found
                if (currentNode && typeof currentNode.collapse === 'function' && typeof currentNode.expand === 'function') {
                  if (isCollapsed === true && !currentNode.collapsed) {
                    currentNode.collapse();
                  } else if (isCollapsed === false && currentNode.collapsed) {
                    currentNode.expand();
                  }
                }
              } catch (e) {
                // Silently ignore navigation errors for non-existent paths
              }
            }
          });
        }
      } catch (e) {
        console.error('Error applying collapsed paths to editor:', e);
      }
    }, 150); // 150ms throttle
    
    return () => clearTimeout(timeoutId);
  }, [collapsedPaths, editorRef, initialSetupDone, masterCollapsedPathsRef]);
};
