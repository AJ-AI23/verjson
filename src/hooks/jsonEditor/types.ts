
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';

export interface UseJsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export interface FoldingDebugInfo {
  lastOperation: string;
  path: string;
  timestamp: number;
}

export interface JsonEditorResult {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  initializeEditor: (container: HTMLDivElement) => JSONEditor | null;
  destroyEditor: () => void;
  expandAll: () => void;
  collapseAll: () => void;
  expandFirstLevel: () => void;
  foldingDebug: FoldingDebugInfo | null;
  collapsedPaths?: CollapsedState;  // Added this line to include collapsedPaths in the return type
}
