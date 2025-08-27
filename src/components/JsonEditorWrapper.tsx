
import React from 'react';
import { JsonEditorComponent } from './JsonEditorComponent';
import { CollapsedState } from '@/lib/diagram/types';

interface JsonEditorWrapperProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth: number;
  documentId?: string;
}

export const JsonEditorWrapper: React.FC<JsonEditorWrapperProps> = ({
  value,
  onChange,
  error,
  collapsedPaths,
  onToggleCollapse,
  maxDepth,
  documentId
}) => {
  return (
    <JsonEditorComponent
      value={value}
      onChange={onChange}
      error={error}
      collapsedPaths={collapsedPaths}
      onToggleCollapse={onToggleCollapse}
      maxDepth={maxDepth}
      documentId={documentId}
    />
  );
};
