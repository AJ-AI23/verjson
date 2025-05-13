
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { defaultSchema } from '@/lib/defaultSchema';
import { defaultOasSchema } from '@/lib/defaultOasSchema';
import { 
  parseJsonSchema, 
  validateJsonSchema, 
  extractSchemaComponents, 
  SchemaType 
} from '@/lib/schemaUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditorToolbar } from './schema/EditorToolbar';
import { EditorContent } from './schema/EditorContent';
import { VersionHistory } from '@/components/VersionHistory';
import { useVersioning } from '@/hooks/useVersioning';
import { CollapsedState } from '@/lib/diagram/types';

export const Editor = () => {
  const [schema, setSchema] = useState(defaultSchema);
  const [savedSchema, setSavedSchema] = useState(defaultSchema);
  const [parsedSchema, setParsedSchema] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [schemaType, setSchemaType] = useState<SchemaType>('json-schema');
  const [groupProperties, setGroupProperties] = useState(false);
  
  // Set default collapsed state - initially collapsed
  const [collapsedPaths, setCollapsedPaths] = useState<CollapsedState>({ root: true });
  
  const [maxDepth] = useState(3); // Default max depth for initial rendering
  
  // Use our custom versioning hook
  const {
    patches,
    isVersionHistoryOpen,
    isModified,
    currentVersion,
    handleVersionBump,
    handleRevertToVersion,
    toggleVersionHistory
  } = useVersioning({
    schema,
    savedSchema,
    setSavedSchema,
    setSchema
  });
  
  // Debug collapsedPaths when it changes
  useEffect(() => {
    console.log('Editor: collapsedPaths updated:', collapsedPaths);
    console.log('Root collapsed:', collapsedPaths.root === true);
    console.log('Collapsed paths count:', Object.keys(collapsedPaths).length);
  }, [collapsedPaths]);
  
  // Function to handle toggling collapsed state of a path
  const handleToggleCollapse = useCallback((path: string, isCollapsed: boolean) => {
    console.log(`Editor: Toggle collapse event for ${path}, isCollapsed: ${isCollapsed}`);
    
    setCollapsedPaths(prev => {
      const updated = {
        ...prev,
        [path]: isCollapsed
      };
      console.log('Updated collapsedPaths:', updated);
      return updated;
    });
    
    // Show a short-lived toast notification
    if (isCollapsed) {
      toast.info(`Collapsed: ${path}`, {
        description: "Section folded",
        duration: 1500 // 1.5 seconds
      });
    } else {
      toast.info(`Expanded: ${path}`, {
        description: "Section unfolded",
        duration: 1500 // 1.5 seconds
      });
    }
  }, []);

  // Debounced schema validation to avoid excessive processing
  const validateSchema = useCallback((schemaText: string, type: SchemaType) => {
    try {
      console.log('Validating schema text:', schemaText?.substring(0, 50) + '...');
      
      // Parse and validate the schema based on the selected type
      const parsed = validateJsonSchema(schemaText, type);
      console.log('Schema validation successful');
      
      // Extract the relevant schema components for visualization
      const schemaForDiagram = extractSchemaComponents(parsed, type);
      console.log('Schema components extracted:', schemaForDiagram?.type);
      
      setParsedSchema(schemaForDiagram);
      setError(null);
    } catch (err) {
      console.error('Schema validation error:', err);
      setError((err as Error).message);
      setParsedSchema(null); // Clear parsed schema on error
      toast.error('Invalid Schema', {
        description: (err as Error).message,
      });
    }
  }, []);

  useEffect(() => {
    console.log('Editor: schema or schemaType changed, validating schema');
    validateSchema(schema, schemaType);
  }, [schema, schemaType, validateSchema]);

  // Debug log whenever parsedSchema changes
  useEffect(() => {
    console.log('Parsed schema updated:', parsedSchema ? 
      { type: parsedSchema.type, hasProperties: !!parsedSchema.properties } : 'null');
  }, [parsedSchema]);

  const handleEditorChange = (value: string) => {
    console.log('Editor content changed');
    setSchema(value);
  };

  const handleSchemaTypeChange = (value: SchemaType) => {
    console.log('Schema type changed to:', value);
    setSchemaType(value);
    // Reset collapsed paths when changing schema type
    setCollapsedPaths({ root: true });
  };

  const handleImportSchema = (importedSchema: string, detectedType?: SchemaType) => {
    console.log('Importing new schema');
    if (detectedType && detectedType !== schemaType) {
      // Update schema type if detected
      console.log('Detected schema type:', detectedType);
      setSchemaType(detectedType);
    }
    
    setSchema(importedSchema);
    setSavedSchema(importedSchema);
    // Reset collapsed paths when importing a new schema
    setCollapsedPaths({ root: true });
  };
  
  // Debug button for force expanding root
  const forceExpandRoot = () => {
    console.log('Force expanding root');
    setCollapsedPaths(prev => ({
      ...prev,
      root: false
    }));
    toast.info('Root expanded (forced)');
  };
  
  // Debug button for force collapsing root
  const forceCollapseRoot = () => {
    console.log('Force collapsing root');
    setCollapsedPaths(prev => ({
      ...prev,
      root: true
    }));
    toast.info('Root collapsed (forced)');
  };
  
  return (
    <div className="json-schema-editor">
      <EditorToolbar 
        schema={schema}
        schemaType={schemaType}
        groupProperties={groupProperties}
        onSchemaTypeChange={handleSchemaTypeChange}
        onGroupPropertiesChange={setGroupProperties}
        onImport={handleImportSchema}
        toggleVersionHistory={toggleVersionHistory}
        setSchema={setSchema}
        setSavedSchema={setSavedSchema}
      />
      
      {/* Debug controls */}
      <div className="px-2 py-1 bg-yellow-50 border-b border-yellow-200 flex gap-2 items-center">
        <span className="text-xs text-yellow-700 font-semibold">Debug Controls:</span>
        <button 
          onClick={forceExpandRoot}
          className="text-xs px-2 py-0.5 bg-green-100 hover:bg-green-200 text-green-800 rounded"
        >
          Force Expand Root
        </button>
        <button 
          onClick={forceCollapseRoot}
          className="text-xs px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded"
        >
          Force Collapse Root
        </button>
        <span className="text-xs text-yellow-600 ml-4">
          Root state: {collapsedPaths.root === true ? 'Collapsed' : 'Expanded'}
        </span>
      </div>
      
      <EditorContent 
        schema={schema}
        parsedSchema={parsedSchema}
        error={error}
        isModified={isModified}
        currentVersion={currentVersion}
        collapsedPaths={collapsedPaths}
        groupProperties={groupProperties}
        maxDepth={maxDepth}
        onEditorChange={handleEditorChange}
        onVersionBump={handleVersionBump}
        onToggleCollapse={handleToggleCollapse}
      />
      
      {/* Version History Dialog */}
      <Dialog open={isVersionHistoryOpen} onOpenChange={toggleVersionHistory}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
          </DialogHeader>
          <VersionHistory 
            patches={patches} 
            onRevert={handleRevertToVersion} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
