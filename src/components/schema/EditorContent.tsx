
import React from 'react';
import { SplitPane } from '@/components/SplitPane';
import { JsonEditor } from '@/components/JsonEditor';
import { SchemaDiagram } from '@/components/diagram/SchemaDiagram';
import { VersionControls } from '@/components/VersionControls';
import { CollapsedState } from '@/lib/diagram/types';
import { Version, VersionTier } from '@/lib/versionUtils';

interface EditorContentProps {
  schema: string;
  parsedSchema: any;
  error: string | null;
  isModified: boolean;
  currentVersion: Version;
  collapsedPaths: CollapsedState;
  groupProperties: boolean;
  maxDepth: number;
  onEditorChange: (value: string) => void;
  onVersionBump: (newVersion: Version, tier: VersionTier, description: string) => void;
  onToggleCollapse: (path: string, isCollapsed: boolean) => void;
}

export const EditorContent: React.FC<EditorContentProps> = ({
  schema,
  parsedSchema,
  error,
  isModified,
  currentVersion,
  collapsedPaths,
  groupProperties,
  maxDepth,
  onEditorChange,
  onVersionBump,
  onToggleCollapse,
}) => {
  return (
    <SplitPane>
      <div className="flex flex-col h-full">
        <JsonEditor 
          value={schema} 
          onChange={onEditorChange} 
          error={error}
          collapsedPaths={collapsedPaths}
          onToggleCollapse={onToggleCollapse}
        />
        <VersionControls 
          version={currentVersion} 
          onVersionBump={onVersionBump}
          isModified={isModified}
        />
      </div>
      <SchemaDiagram 
        schema={parsedSchema}
        error={error !== null}
        groupProperties={groupProperties}
        collapsedPaths={collapsedPaths}
        maxDepth={maxDepth}
      />
    </SplitPane>
  );
};
