import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useDebug } from '@/contexts/DebugContext';

interface EditorSettings {
  maxDepth: number;
  groupProperties: boolean;
  undoRedoStrategy: 'local-with-notifications' | 'server-based';
  showVersionMismatchWarning: boolean;
  maxIndividualProperties: number;
  maxIndividualArrayItems: number;
  truncateAncestralBoxes: boolean;
  sequenceDiagramHeight: number;
}

interface EditorSettingsContextType {
  settings: EditorSettings;
  updateMaxDepth: (depth: number) => void;
  updateGroupProperties: (groupProperties: boolean) => void;
  updateUndoRedoStrategy: (strategy: 'local-with-notifications' | 'server-based') => void;
  updateShowVersionMismatchWarning: (show: boolean) => void;
  updateMaxIndividualProperties: (maxIndividualProperties: number) => void;
  updateMaxIndividualArrayItems: (maxIndividualArrayItems: number) => void;
  updateTruncateAncestralBoxes: (truncate: boolean) => void;
  updateSequenceDiagramHeight: (height: number) => void;
}

const EditorSettingsContext = createContext<EditorSettingsContextType | undefined>(undefined);

interface EditorSettingsProviderProps {
  children: ReactNode;
}

export const EditorSettingsProvider: React.FC<EditorSettingsProviderProps> = ({ children }) => {
  const { debugToast } = useDebug();
  const [settings, setSettings] = useState<EditorSettings>({
    maxDepth: 1,
    groupProperties: false,
    undoRedoStrategy: 'local-with-notifications',
    showVersionMismatchWarning: true,
    maxIndividualProperties: 5,
    maxIndividualArrayItems: 4,
    truncateAncestralBoxes: false,
    sequenceDiagramHeight: 2000
  });

  const updateMaxDepth = (depth: number) => {
    debugToast('[DEBUG] EditorSettingsContext updating maxDepth to', depth);
    setSettings(prev => ({ ...prev, maxDepth: depth }));
  };

  const updateGroupProperties = (groupProperties: boolean) => {
    setSettings(prev => ({ ...prev, groupProperties }));
  };

  const updateUndoRedoStrategy = (strategy: 'local-with-notifications' | 'server-based') => {
    setSettings(prev => ({ ...prev, undoRedoStrategy: strategy }));
  };

  const updateShowVersionMismatchWarning = (show: boolean) => {
    setSettings(prev => ({ ...prev, showVersionMismatchWarning: show }));
  };

  const updateMaxIndividualProperties = (maxIndividualProperties: number) => {
    setSettings(prev => ({ ...prev, maxIndividualProperties }));
  };

  const updateMaxIndividualArrayItems = (maxIndividualArrayItems: number) => {
    setSettings(prev => ({ ...prev, maxIndividualArrayItems }));
  };

  const updateTruncateAncestralBoxes = (truncate: boolean) => {
    setSettings(prev => ({ ...prev, truncateAncestralBoxes: truncate }));
  };

  const updateSequenceDiagramHeight = (height: number) => {
    setSettings(prev => ({ ...prev, sequenceDiagramHeight: height }));
  };

  const value = {
    settings,
    updateMaxDepth,
    updateGroupProperties,
    updateUndoRedoStrategy,
    updateShowVersionMismatchWarning,
    updateMaxIndividualProperties,
    updateMaxIndividualArrayItems,
    updateTruncateAncestralBoxes,
    updateSequenceDiagramHeight
  };

  return (
    <EditorSettingsContext.Provider value={value}>
      {children}
    </EditorSettingsContext.Provider>
  );
};

export const useEditorSettings = () => {
  const context = useContext(EditorSettingsContext);
  if (context === undefined) {
    throw new Error('useEditorSettings must be used within an EditorSettingsProvider');
  }
  return context;
};