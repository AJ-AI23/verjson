
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';

export interface UseJsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth: number;
}

export interface FoldingDebugInfo {
  lastOperation: string;
  path: string;
  timestamp: number;
  isCollapsed?: boolean;
  previousState?: boolean;
}

export interface EditorEventHandlers {
  onExpand: (event: any) => void;
  onChange: () => void;
}

export interface JsonEditorResult {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  initializeEditor: (container: HTMLDivElement) => JSONEditor | null;
  destroyEditor: () => void;
  expandAll: () => void;
  collapseAll: () => void;
  expandFirstLevel: () => void;
  foldingDebug: FoldingDebugInfo | null;
  collapsedPaths?: CollapsedState;
  pathExceedsMaxDepth?: (path: string) => boolean;
}
