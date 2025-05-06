
import { editor } from 'monaco-editor';

export const monacoEditorOptions: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontSize: 13,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  wrappingIndent: 'same',
  automaticLayout: true,
  tabSize: 2,
  scrollbar: {
    vertical: 'visible',
    horizontal: 'visible',
  },
  formatOnPaste: true,
  formatOnType: true,
  rulers: [],
  bracketPairColorization: {
    enabled: true,
  },
  guides: {
    bracketPairs: true,
  },
  folding: true,
  showFoldingControls: 'always',
};
