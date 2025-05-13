
// Export all JSON editor hooks for backward compatibility
export * from './jsonEditor';

// Here we'll fix any module resolution issues by re-exporting core functions
import { useJsonEditor } from './jsonEditor';
export { useJsonEditor };
