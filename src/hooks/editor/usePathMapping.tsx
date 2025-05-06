
import { useRef, useCallback } from 'react';
import { generateLineToPathMap } from '@/lib/editor';

/**
 * Hook for handling JSON path mapping in the editor
 */
export const usePathMapping = () => {
  // Reference to store the line-to-path mapping
  const pathMapRef = useRef<{[lineNumber: number]: string}>({});

  // Update the path map when the editor content changes
  const refreshPathMap = useCallback((editorRef: React.MutableRefObject<any>) => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        console.log("Refreshing line-to-path mapping");
        pathMapRef.current = generateLineToPathMap(model);
      }
    }
  }, []);

  return {
    pathMapRef,
    refreshPathMap
  };
};
