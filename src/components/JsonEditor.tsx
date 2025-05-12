
import React from 'react';
import { CollapsedState } from '@/lib/diagram/types';
import { JsonEditorWrapper } from './JsonEditorWrapper';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const JsonEditor = ({ 
  value, 
  onChange, 
  error, 
  collapsedPaths = {},
  onToggleCollapse 
}: JsonEditorProps) => {
  return (
    <JsonEditorWrapper
      value={value}
      onChange={onChange}
      error={error}
      collapsedPaths={collapsedPaths}
      onToggleCollapse={onToggleCollapse}
    />
  );
};
