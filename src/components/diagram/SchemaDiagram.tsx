
import React, { memo, useEffect } from 'react';
import '@xyflow/react/dist/style.css';
import { DiagramContainer } from './DiagramContainer';
import { CollapsedState } from '@/lib/diagram/types';

interface SchemaDiagramProps {
  schema: any;
  error: boolean;
  groupProperties?: boolean;
  collapsedPaths?: CollapsedState;
  maxDepth?: number;
}

export const SchemaDiagram: React.FC<SchemaDiagramProps> = memo(({
  schema,
  error,
  groupProperties,
  collapsedPaths,
  maxDepth
}) => {
  // Debug output to help diagnose issues
  useEffect(() => {
    console.log('SchemaDiagram rendering', { 
      hasSchema: !!schema, 
      schemaType: schema?.type,
      error, 
      groupProperties, 
      collapsedPathsCount: collapsedPaths ? Object.keys(collapsedPaths).length : 0,
      rootCollapsed: collapsedPaths?.root === true,
      maxDepth
    });
    
    if (schema) {
      console.log('Schema structure:', {
        type: schema.type,
        title: schema.title,
        properties: schema.properties ? Object.keys(schema.properties) : []
      });
    }
    
    // Debug collapsed paths
    if (collapsedPaths && Object.keys(collapsedPaths).length > 0) {
      console.log('Collapsed paths in SchemaDiagram:');
      Object.entries(collapsedPaths).forEach(([path, isCollapsed]) => {
        if (isCollapsed) {
          console.log(`- Collapsed: ${path}`);
        } else {
          console.log(`- Expanded: ${path}`);
        }
      });
    } else {
      console.log('No collapsed paths in SchemaDiagram');
    }
  }, [schema, error, groupProperties, collapsedPaths, maxDepth]);
  
  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Debug information display */}
      <div className="p-1 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs">
        <div>Diagram Debug - Collapsed Paths: {Object.keys(collapsedPaths || {}).length}</div>
        <div>Root collapsed: {collapsedPaths?.root === true ? 'Yes' : 'No'}</div>
      </div>
      
      <DiagramContainer 
        schema={schema}
        error={error}
        groupProperties={groupProperties}
        collapsedPaths={collapsedPaths}
        maxDepth={maxDepth}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  try {
    // Custom comparison function for memoization
    const schemaEqual = JSON.stringify(prevProps.schema) === JSON.stringify(nextProps.schema);
    const collapsedEqual = JSON.stringify(prevProps.collapsedPaths) === JSON.stringify(nextProps.collapsedPaths);
    const result = (
      schemaEqual &&
      prevProps.error === nextProps.error &&
      prevProps.groupProperties === nextProps.groupProperties &&
      collapsedEqual &&
      prevProps.maxDepth === nextProps.maxDepth
    );
    
    if (!result) {
      console.log('SchemaDiagram props changed, will re-render');
      
      // Log exactly what changed
      if (!schemaEqual) console.log('Schema changed');
      if (!collapsedEqual) {
        console.log('CollapsedPaths changed');
        console.log('Prev:', prevProps.collapsedPaths);
        console.log('Next:', nextProps.collapsedPaths);
      }
      if (prevProps.error !== nextProps.error) console.log('Error state changed');
      if (prevProps.groupProperties !== nextProps.groupProperties) console.log('Group properties changed');
      if (prevProps.maxDepth !== nextProps.maxDepth) console.log('Max depth changed');
    }
    
    return result;
  } catch (error) {
    console.error('Error in SchemaDiagram memo comparison:', error);
    // If there's an error in comparison, force a re-render to be safe
    return false;
  }
});

SchemaDiagram.displayName = 'SchemaDiagram';
