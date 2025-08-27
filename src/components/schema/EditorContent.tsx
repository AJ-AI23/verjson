
import React from 'react';
import { SplitPane } from '@/components/SplitPane';
import { JsonEditorWrapper } from '@/components/JsonEditorWrapper';
import { SchemaDiagram } from '@/components/diagram/SchemaDiagram';
import { VersionControls } from '@/components/VersionControls';
import { CollapsedState } from '@/lib/diagram/types';
import { DocumentVersionComparison } from '@/lib/importVersionUtils';
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
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  expandedNotationPaths?: Set<string>;
  documentId?: string;
  patches?: any[];
  onImportVersion?: (importedSchema: any, comparison: DocumentVersionComparison, sourceDocumentName: string) => void;
  currentFileType?: string;
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
  onAddNotation,
  expandedNotationPaths,
  documentId,
  patches,
  onImportVersion,
  currentFileType,
}) => {
  return (
    <SplitPane>
      <div className="flex flex-col h-full">
        <JsonEditorWrapper
          value={schema} 
          onChange={onEditorChange} 
          error={error}
          collapsedPaths={collapsedPaths}
          onToggleCollapse={onToggleCollapse}
          maxDepth={maxDepth}
          documentId={documentId}
        />
        <VersionControls 
          version={currentVersion} 
          onVersionBump={onVersionBump}
          isModified={isModified}
          schema={schema}
          patches={patches}
          onImportVersion={onImportVersion}
          documentId={documentId}
          currentFileType={currentFileType}
        />
      </div>
      <SchemaDiagram 
        schema={parsedSchema}
        error={error !== null}
        groupProperties={groupProperties}
        collapsedPaths={collapsedPaths}
        maxDepth={maxDepth}
        onAddNotation={onAddNotation}
        expandedNotationPaths={expandedNotationPaths}
      />
    </SplitPane>
  );
};
