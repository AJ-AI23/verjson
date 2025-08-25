
import React from 'react';
import { JsonEditorPoc } from './JsonEditorPoc';
import { CollapsedState } from '@/lib/diagram/types';

interface JsonEditorWrapperProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth: number;
}

export const JsonEditorWrapper: React.FC<JsonEditorWrapperProps> = ({
  value,
  onChange,
  error,
  collapsedPaths,
  onToggleCollapse,
  maxDepth
}) => {
  return (
    <JsonEditorPoc
      value={value}
      onChange={onChange}
      error={error}
      collapsedPaths={collapsedPaths}
      onToggleCollapse={onToggleCollapse}
      maxDepth={maxDepth}
    />
  );
};
