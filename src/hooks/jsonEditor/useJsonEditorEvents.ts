import { useCallback, useRef } from 'react';
import { CollapsedState } from '@/lib/diagram/types';
import { EditorEventHandlers } from './types';
import { useBulkExpandCollapse } from './useBulkExpandCollapse';

interface UseJsonEditorEventsProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths: CollapsedState;
  maxDepth: number;
  rootSchema?: any;
  editorRef: React.MutableRefObject<any>;
}

export const useJsonEditorEvents = ({
  onToggleCollapse,
  collapsedPaths,
  maxDepth,
  rootSchema,
  editorRef
}: UseJsonEditorEventsProps) => {
  const collapsedPathsRef = useRef<CollapsedState>(collapsedPaths);
  const { bulkExpand } = useBulkExpandCollapse({
    onToggleCollapse,
    maxDepth,
    rootSchema,
    editorRef
  });

  // Keep the ref updated with the latest collapsed paths
  collapsedPathsRef.current = collapsedPaths;

  const createEditorEventHandlers = useCallback((): EditorEventHandlers => {
    const onExpand = (event: any) => {
      // Handle both old and new callback signatures
      let pathArray: string[];
      let isExpand: boolean;
      
      if (event && typeof event === 'object' && 'path' in event) {
        // New signature { path, isExpand, recursive }
        pathArray = Array.isArray(event.path) ? event.path : [];
        isExpand = event.isExpand || false;
      } else {
        // Old signature (node)
        const node = event;
        pathArray = Array.isArray(node.path) ? node.path : [];
        isExpand = node.expanded || false;
      }
      
      // Convert path array to string format
      const pathString = pathArray.length === 0 ? 'root' : pathArray.join('.');
      
      // Normalize path (ensure it starts with 'root')
      const normalizedPath = pathString === 'root' || pathString.startsWith('root.') ? pathString : `root.${pathString}`;
      
      const currentlyCollapsed = collapsedPathsRef.current[normalizedPath] === true;
      const newCollapsedState = !isExpand;
      
      // Trigger the onToggleCollapse callback
      if (onToggleCollapse) {
        onToggleCollapse(normalizedPath, newCollapsedState);
        
        // Trigger bulk expand for newly expanded nodes
        if (!newCollapsedState && rootSchema) {
          bulkExpand(normalizedPath);
        }
      }
    };

    return {
      onExpand,
      onChange: () => {}, // Empty handler as we handle changes elsewhere
    };
  }, [onToggleCollapse, bulkExpand, rootSchema]);

  return {
    createEditorEventHandlers,
    collapsedPathsRef
  };
};
