import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { parseJsonSchema, validateJsonSchema, extractSchemaComponents, SchemaType } from '@/lib/schemaUtils';
import { CollapsedState } from '@/lib/diagram/types';
import { useVersioning } from '@/hooks/useVersioning';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';
import { addNotationToSchema, getPropertyPathFromNodeId } from '@/lib/diagram/schemaNotationUtils';
import { useDebug } from '@/contexts/DebugContext';

export const useEditorState = (defaultSchema: string, documentId?: string) => {
  const { debugToast } = useDebug();
  const [schema, setSchema] = useState(defaultSchema);
  const [savedSchema, setSavedSchema] = useState(defaultSchema);
  const [parsedSchema, setParsedSchema] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [schemaType, setSchemaType] = useState<SchemaType>('json-schema');
  
  // Get current maxDepth from context
  const { settings } = useEditorSettings();
  const { maxDepth } = settings;
  
  // Set default collapsed state - root expanded so structure editor shows sections
  const [collapsedPaths, setCollapsedPaths] = useState<CollapsedState>({ root: false });
  
  // Track which notation panels should be expanded based on JSON editor
  const [expandedNotationPaths, setExpandedNotationPaths] = useState<Set<string>>(new Set());
  
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
    
    debugToast(`Cleaned up collapsed paths for maxDepth ${maxDepth}`, cleaned);
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
    handleToggleSelection,
    handleMarkAsReleased,
    handleDeleteVersion,
    toggleVersionHistory,
    clearVersionState,
    handleImportVersion,
    suggestedVersion
  } = useVersioning({
    schema,
    savedSchema,
    setSavedSchema,
    setSchema,
    documentId
  });
  
  // Debug collapsedPaths when it changes
  useEffect(() => {
    debugToast('Editor: collapsedPaths updated', collapsedPaths);
    debugToast('Root collapsed', collapsedPaths.root === true);
    debugToast('Collapsed paths count', Object.keys(collapsedPaths).length);
  }, [collapsedPaths, debugToast]);
  
  // Function to handle toggling collapsed state of a path
  const handleToggleCollapse = useCallback((path: string, isCollapsed: boolean) => {
    debugToast(`Editor: Toggle collapse event for ${path}, isCollapsed: ${isCollapsed}`);
    
    // Check if this is a $notations path expansion/collapse
    if (path.includes('.$notations') && !path.includes('.$notations.')) {
      // This is expanding/collapsing a $notations array itself
      const basePath = path.replace('.$notations', '');
      const actualNodePath = basePath === 'root' ? 'root' : basePath;
      
      debugToast(`Notation path ${path} ${isCollapsed ? 'collapsed' : 'expanded'} for node ${actualNodePath}`);
      
      setExpandedNotationPaths(prev => {
        const newSet = new Set(prev);
        if (isCollapsed) {
          newSet.delete(actualNodePath);
        } else {
          newSet.add(actualNodePath);
        }
        debugToast('Updated expanded notation paths', Array.from(newSet));
        return newSet;
      });
    }
    
    setCollapsedPaths(prev => {
      const updated = { ...prev };
      
      // Set the current path's state
      updated[path] = isCollapsed;
      
      // If expanding, also expand all parent paths in the chain
      // e.g., expanding "root.components.schemas.Code" should also expand
      // "root", "root.components", and "root.components.schemas"
      if (!isCollapsed) {
        const segments = path.split('.');
        let parentPath = '';
        for (let i = 0; i < segments.length - 1; i++) {
          parentPath = parentPath ? `${parentPath}.${segments[i]}` : segments[i];
          if (updated[parentPath] !== false) {
            debugToast(`Expanding parent path: ${parentPath}`);
            updated[parentPath] = false;
          }
        }
      }
      
      // If collapsing an ancestor, clear all descendant collapsed states
      // since they should inherit the collapsed state from their ancestor
      if (isCollapsed) {
        const pathPrefix = path + '.';
        Object.keys(updated).forEach(existingPath => {
          if (existingPath.startsWith(pathPrefix)) {
            debugToast(`Clearing descendant path state: ${existingPath}`);
            delete updated[existingPath];
          }
        });
        
        // When collapsing a component under root.components.X.*, also collapse
        // the segment (root.components.X) but only if no other components in 
        // that segment are still expanded
        const componentsMatch = path.match(/^(root\.components\.[^.]+)\./);
        if (componentsMatch) {
          const segmentPath = componentsMatch[1];
          const segmentPrefix = segmentPath + '.';
          
          // Check if any sibling component is still expanded (false = expanded)
          const hasExpandedSibling = Object.entries(updated).some(([p, collapsed]) => {
            // Must be a direct child of the segment, not the path we just collapsed
            return p !== path && 
                   p.startsWith(segmentPrefix) && 
                   collapsed === false;
          });
          
          if (!hasExpandedSibling) {
            debugToast(`Collapsing component segment: ${segmentPath}`);
            updated[segmentPath] = true;
          }
        }
      }
      
      debugToast('Updated collapsedPaths', updated);
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
      debugToast('Validating schema text', schemaText?.substring(0, 50) + '...');
      
      // Parse and validate the schema based on the selected type
      const parsed = validateJsonSchema(schemaText, type);
      debugToast('Schema validation successful');
      
      // Extract the relevant schema components for visualization
      const schemaForDiagram = extractSchemaComponents(parsed, type);
      debugToast('Schema components extracted', schemaForDiagram?.type);
      
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
    debugToast('Editor: schema or schemaType changed, validating schema');
    validateSchema(schema, schemaType);
  }, [schema, schemaType, validateSchema, debugToast]);

  // Debug log whenever parsedSchema changes
  useEffect(() => {
    debugToast('Parsed schema updated', parsedSchema ? 
      { type: parsedSchema.type, hasProperties: !!parsedSchema.properties } : 'null');
  }, [parsedSchema, debugToast]);

  const handleEditorChange = (value: string) => {
    console.log('📝 EDITOR CHANGE from user input:', {
      preview: value.substring(0, 100) + '...',
      length: value.length
    });
    debugToast('Editor content changed');
    setSchema(value);
  };

  const handleSchemaTypeChange = (value: SchemaType) => {
    debugToast('Schema type changed to', value);
    setSchemaType(value);
    // Reset collapsed paths when changing schema type
    setCollapsedPaths({ root: false });
  };

  const handleAddNotation = useCallback((nodeId: string, user: string, message: string) => {
    try {
      console.log('📝 EDITOR CHANGE from adding notation to:', nodeId);
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

  // Clear all editor state when document is deleted
  const clearEditorState = useCallback(() => {
    console.log('📝 EDITOR CHANGE from clearEditorState - resetting to default');
    debugToast('🧹 Editor: Clearing all editor and version state');
    setSchema(defaultSchema);
    setSavedSchema(defaultSchema);
    setParsedSchema(null);
    setError(null);
    setSchemaType('json-schema');
    setCollapsedPaths({ root: false });
    setExpandedNotationPaths(new Set());
    clearVersionState(); // Also clear version history state
  }, [defaultSchema, clearVersionState, debugToast]);

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
    isModified,
    currentVersion,
    handleVersionBump,
    patches,
    isVersionHistoryOpen,
    toggleVersionHistory,
    handleToggleSelection,
    handleMarkAsReleased,
    handleDeleteVersion,
    handleAddNotation,
    expandedNotationPaths,
    clearEditorState,
    handleImportVersion,
    suggestedVersion
  };
};
