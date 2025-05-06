import React, { useState, useEffect, useCallback } from 'react';
import { SplitPane } from '@/components/SplitPane';
import { JsonEditor } from '@/components/JsonEditor';
import { SchemaDiagram } from '@/components/diagram/SchemaDiagram';
import { toast } from 'sonner';
import { defaultSchema } from '@/lib/defaultSchema';
import { defaultOasSchema } from '@/lib/defaultOasSchema';
import { 
  parseJsonSchema, 
  validateJsonSchema, 
  extractSchemaComponents, 
  SchemaType 
} from '@/lib/schemaUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VersionControls } from '@/components/VersionControls';
import { VersionHistory } from '@/components/VersionHistory';
import { SchemaActions } from '@/components/SchemaActions';
import { FileJson, FileCode, BoxSelect, Rows3, Save } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatVersion } from '@/lib/versionUtils';
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

  // Debounced schema validation to avoid excessive processing
  const validateSchema = useCallback((schemaText: string, type: SchemaType) => {
    try {
      // Parse and validate the schema based on the selected type
      const parsed = validateJsonSchema(schemaText, type);
      // Extract the relevant schema components for visualization
      const schemaForDiagram = extractSchemaComponents(parsed, type);
      setParsedSchema(schemaForDiagram);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      toast.error('Invalid Schema', {
        description: (err as Error).message,
      });
    }
  }, []);

  useEffect(() => {
    validateSchema(schema, schemaType);
  }, [schema, schemaType, validateSchema]);

  const handleEditorChange = (value: string) => {
    setSchema(value);
  };

  const handleSchemaTypeChange = (value: SchemaType) => {
    setSchemaType(value);
    // Update the schema content with the default for the selected type
    if (value === 'json-schema') {
      setSchema(defaultSchema);
      setSavedSchema(defaultSchema);
    } else if (value === 'oas-3.1') {
      setSchema(defaultOasSchema);
      setSavedSchema(defaultOasSchema);
    }
    // Reset collapsed paths when changing schema type
    setCollapsedPaths({});
    toast.success(`Switched to ${value === 'json-schema' ? 'JSON Schema' : 'OpenAPI 3.1'} mode`);
  };

  const handleGroupPropertiesChange = (checked: boolean) => {
    setGroupProperties(checked);
    toast.success(`${checked ? 'Grouped' : 'Expanded'} properties view`);
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
  
  // Function to handle toggling collapsed state of a path
  const handleToggleCollapse = (path: string) => {
    setCollapsedPaths(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  return (
    <div className="json-schema-editor">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Select value={schemaType} onValueChange={(value) => handleSchemaTypeChange(value as SchemaType)}>
          <SelectTrigger className="w-[200px]">
            <div className="flex items-center gap-2">
              {schemaType === 'json-schema' ? (
                <FileJson className="h-4 w-4" />
              ) : (
                <FileCode className="h-4 w-4" />
              )}
              <SelectValue placeholder="Select schema type" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json-schema">JSON Schema</SelectItem>
            <SelectItem value="oas-3.1">OpenAPI 3.1</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">
          {schemaType === 'json-schema' 
            ? 'Standard JSON Schema format'
            : 'OpenAPI 3.1 specification format with JSON Schema components'}
        </span>
        
        {/* Add Import/Export actions */}
        <SchemaActions 
          currentSchema={schema} 
          schemaType={schemaType}
          onImport={handleImportSchema}
        />
        
        <div className="flex items-center space-x-2 ml-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => toggleVersionHistory(true)}
            className="gap-1"
          >
            <Save className="h-4 w-4" />
            <span>History</span>
          </Button>
          
          <Switch 
            id="group-properties" 
            checked={groupProperties}
            onCheckedChange={handleGroupPropertiesChange}
          />
          <Label htmlFor="group-properties" className="flex items-center gap-2 cursor-pointer">
            {groupProperties ? <BoxSelect className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
            <span>Group Properties</span>
          </Label>
        </div>
      </div>
      <SplitPane>
        <div className="flex flex-col h-full">
          <JsonEditor 
            value={schema} 
            onChange={handleEditorChange} 
            error={error}
            collapsedPaths={collapsedPaths}
          />
          <VersionControls 
            version={currentVersion} 
            onVersionBump={handleVersionBump}
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
