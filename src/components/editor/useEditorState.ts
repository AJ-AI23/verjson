
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { parseJsonSchema, validateJsonSchema, extractSchemaComponents, SchemaType } from '@/lib/schemaUtils';
import { CollapsedState } from '@/lib/diagram/types';
import { useVersioning } from '@/hooks/useVersioning';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';
import { addNotationToSchema, getPropertyPathFromNodeId } from '@/lib/diagram/schemaNotationUtils';

export const useEditorState = (defaultSchema: string) => {
  const [schema, setSchema] = useState(defaultSchema);
  const [savedSchema, setSavedSchema] = useState(defaultSchema);
  const [parsedSchema, setParsedSchema] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [schemaType, setSchemaType] = useState<SchemaType>('json-schema');
  
  // Get current maxDepth from context
  const { settings } = useEditorSettings();
  const { maxDepth } = settings;
  
  // Set default collapsed state - initially collapsed
  const [collapsedPaths, setCollapsedPaths] = useState<CollapsedState>({ root: true });
  
  // Function to clean up collapsed paths based on maxDepth
  const cleanupCollapsedPaths = useCallback((paths: CollapsedState, maxDepth: number): CollapsedState => {
    const cleaned: CollapsedState = {};
    
    Object.entries(paths).forEach(([path, isCollapsed]) => {
      // Count the depth of the path (number of dots + 1, but root is depth 0)
      const pathDepth = path === 'root' ? 0 : path.split('.').length - 1;
      
      // Keep paths that are within the maxDepth limit
      if (pathDepth <= maxDepth) {
        cleaned[path] = isCollapsed;
      }
    });
    
    console.log(`[DEBUG] Cleaned up collapsed paths for maxDepth ${maxDepth}:`, cleaned);
    return cleaned;
  }, []);

  // Clean up collapsed paths when maxDepth changes
  // Note: We don't actually clean up paths automatically as this would cause 
  // unwanted diagram updates. Instead, we let the editor handle path validation
  // when expand/collapse operations happen.
  // useEffect(() => {
  //   console.log(`[DEBUG] MaxDepth changed to ${maxDepth}, cleaning up collapsed paths`);
  //   setCollapsedPaths(prev => cleanupCollapsedPaths(prev, maxDepth));
  // }, [maxDepth, cleanupCollapsedPaths]);

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
      const updated = { ...prev };
      
      // Set the current path's state
      updated[path] = isCollapsed;
      
      // If collapsing an ancestor, clear all descendant collapsed states
      // since they should inherit the collapsed state from their ancestor
      if (isCollapsed) {
        const pathPrefix = path + '.';
        Object.keys(updated).forEach(existingPath => {
          if (existingPath.startsWith(pathPrefix)) {
            console.log(`Clearing descendant path state: ${existingPath}`);
            delete updated[existingPath];
          }
        });
      }
      
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

  const handleAddNotation = useCallback((nodeId: string, user: string, message: string) => {
    try {
      const path = getPropertyPathFromNodeId(nodeId);
      const currentParsedSchema = parsedSchema || JSON.parse(schema);
      
      const updatedSchema = addNotationToSchema(currentParsedSchema, path, {
        timestamp: new Date().toISOString(),
        user,
        message
      });
      
      const updatedSchemaString = JSON.stringify(updatedSchema, null, 2);
      setSchema(updatedSchemaString);
      
      toast.success('Comment added successfully', {
        description: `Added comment to ${path === 'root' ? 'root schema' : path}`
      });
    } catch (error) {
      console.error('Failed to add notation:', error);
      toast.error('Failed to add comment', {
        description: 'Please try again'
      });
    }
  }, [parsedSchema, schema]);

  return {
    schema,
    setSchema,
    savedSchema,
    setSavedSchema,
    parsedSchema,
    error,
    schemaType,
    collapsedPaths,
    setCollapsedPaths,
    handleToggleCollapse,
    handleEditorChange,
    handleSchemaTypeChange,
    handleImportSchema,
    isModified,
    currentVersion,
    handleVersionBump,
    patches,
    isVersionHistoryOpen,
    toggleVersionHistory,
    handleRevertToVersion,
    handleAddNotation
  };
};
