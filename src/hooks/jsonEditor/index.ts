
import { useJsonEditor } from './useJsonEditorCore';
import { JsonEditorResult, UseJsonEditorProps } from './types';

// Debug-enabled wrapper around useJsonEditor
function useDebugJsonEditor(props: UseJsonEditorProps): JsonEditorResult {
  console.log('useJsonEditor called with props:', {
    value: props.value?.substring(0, 20) + '...',
    hasCollapsedPaths: !!props.collapsedPaths,
    hasToggleCallback: !!props.onToggleCollapse
  });
  
  // Call the actual hook
  return useJsonEditor(props);
}

// Export with debugging wrapper
export { useDebugJsonEditor as useJsonEditor };
export * from './types';
