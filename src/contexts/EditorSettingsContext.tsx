import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useDebug } from '@/contexts/DebugContext';

interface EditorSettings {
  maxDepth: number;
  groupProperties: boolean;
}

interface EditorSettingsContextType {
  settings: EditorSettings;
  updateMaxDepth: (depth: number) => void;
  updateGroupProperties: (groupProperties: boolean) => void;
}

const EditorSettingsContext = createContext<EditorSettingsContextType | undefined>(undefined);

interface EditorSettingsProviderProps {
  children: ReactNode;
}

export const EditorSettingsProvider: React.FC<EditorSettingsProviderProps> = ({ children }) => {
  const { debugToast } = useDebug();
  const [settings, setSettings] = useState<EditorSettings>({
    maxDepth: 1,
    groupProperties: false
  });

  const updateMaxDepth = (depth: number) => {
    debugToast('[DEBUG] EditorSettingsContext updating maxDepth to', depth);
    setSettings(prev => ({ ...prev, maxDepth: depth }));
  };

  const updateGroupProperties = (groupProperties: boolean) => {
    setSettings(prev => ({ ...prev, groupProperties }));
  };

  const value = {
    settings,
    updateMaxDepth,
    updateGroupProperties
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