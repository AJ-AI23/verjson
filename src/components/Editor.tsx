
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
  const [collapsedPaths, setCollapsedPaths] = useState<CollapsedState>({});
  const [maxDepth, setMaxDepth] = useState(3); // Default max depth for initial rendering
  
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
  
  // Function to handle toggling collapsed state of a path
  const handleToggleCollapse = useCallback((path: string, isCollapsed: boolean) => {
    console.log(`Toggle collapse event received: ${path}, isCollapsed: ${isCollapsed}`);
    setCollapsedPaths(prev => ({
      ...prev,
      [path]: isCollapsed
    }));
    
    // Show a short-lived toast notification - now correctly displaying the message based on isCollapsed
    if (isCollapsed) {
      toast.info(`Collapsed: ${path}`, {
        description: "Section folded",
        duration: 1500
      });
    } else {
      toast.info(`Expanded: ${path}`, {
        description: "Section unfolded",
        duration: 1500
      });
    }
  }, []);

  // Update maxDepth when changed in diagram
  const handleMaxDepthChange = useCallback((newDepth: number) => {
    setMaxDepth(newDepth);
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
    setSchema(value);
  };

  const handleSchemaTypeChange = (value: SchemaType) => {
    setSchemaType(value);
    // Reset collapsed paths when changing schema type
    setCollapsedPaths({});
  };

  const handleImportSchema = (importedSchema: string, detectedType?: SchemaType) => {
    if (detectedType && detectedType !== schemaType) {
      // Update schema type if detected
      setSchemaType(detectedType);
    }
    
    setSchema(importedSchema);
    setSavedSchema(importedSchema);
    // Reset collapsed paths when importing a new schema
    setCollapsedPaths({});
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
        onMaxDepthChange={handleMaxDepthChange}
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
