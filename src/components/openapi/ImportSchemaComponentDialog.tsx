import React, { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useDocuments } from '@/hooks/useDocuments';
import { useDocumentContent } from '@/hooks/useDocumentContent';
import { toast } from 'sonner';

interface ImportSchemaComponentDialogProps {
  onImport: (componentName: string, schema: any) => void;
  onImportByReference?: (componentName: string, documentId: string, documentName: string) => void;
  existingComponentNames: string[];
}

export const ImportSchemaComponentDialog: React.FC<ImportSchemaComponentDialogProps> = ({
  onImport,
  onImportByReference,
  existingComponentNames
}) => {
  const [open, setOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [componentName, setComponentName] = useState<string>('');
  const [importMultiple, setImportMultiple] = useState(false);
  const [importByReference, setImportByReference] = useState(false);
  const [selectedSchemas, setSelectedSchemas] = useState<Set<string>>(new Set());

  const { workspaces, loading: workspacesLoading } = useWorkspaces();
  const { documents, loading: documentsLoading } = useDocuments(selectedWorkspaceId);
  const { content: documentData, loading: contentLoading } = useDocumentContent(selectedDocumentId);

  // Filter to only JSON Schema documents
  const jsonSchemaDocuments = useMemo(() => {
    return documents.filter(doc => doc.file_type === 'json-schema');
  }, [documents]);

  // Parse the document content to get the schema
  const parsedSchema = useMemo(() => {
    if (!documentData) return null;
    try {
      // documentData is the full document object, content is the actual schema
      const content = documentData.content;
      if (!content) return null;
      if (typeof content === 'string') {
        return JSON.parse(content);
      }
      return content;
    } catch {
      return null;
    }
  }, [documentData]);

  // Get available schemas from the document (root schema and any definitions)
  const availableSchemas = useMemo(() => {
    if (!parsedSchema) return [];
    
    const schemas: { name: string; schema: any; isRoot: boolean }[] = [];
    
    // Add root schema if it has a title or is a valid schema
    if (parsedSchema.type || parsedSchema.properties || parsedSchema.$ref || parsedSchema.allOf || parsedSchema.anyOf || parsedSchema.oneOf) {
      const rootName = parsedSchema.title || parsedSchema.$id?.split('/').pop()?.replace('.json', '') || 'Root';
      schemas.push({ name: rootName, schema: parsedSchema, isRoot: true });
    }
    
    // Add definitions/$defs if present
    const defs = parsedSchema.$defs || parsedSchema.definitions;
    if (defs && typeof defs === 'object') {
      Object.entries(defs).forEach(([name, schema]) => {
        schemas.push({ name, schema, isRoot: false });
      });
    }
    
    return schemas;
  }, [parsedSchema]);

  // Get selected document name for auto-naming
  const selectedDocument = useMemo(() => {
    return documents.find(d => d.id === selectedDocumentId);
  }, [documents, selectedDocumentId]);

  // Auto-set component name when document is selected
  const handleDocumentSelect = (docId: string) => {
    setSelectedDocumentId(docId);
    setSelectedSchemas(new Set());
    const doc = documents.find(d => d.id === docId);
    if (doc) {
      // Use document name as default component name, convert to PascalCase
      const baseName = doc.name
        .replace(/\.json$/i, '')
        .split(/[-_\s]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
      setComponentName(baseName);
    }
  };

  const handleSchemaToggle = (schemaName: string) => {
    const newSelected = new Set(selectedSchemas);
    if (newSelected.has(schemaName)) {
      newSelected.delete(schemaName);
    } else {
      newSelected.add(schemaName);
    }
    setSelectedSchemas(newSelected);
  };

  const handleImport = () => {
    // Handle "by reference" import (single schema only)
    if (importByReference) {
      if (!componentName.trim()) {
        toast.error('Please enter a component name');
        return;
      }

      if (existingComponentNames.includes(componentName.trim())) {
        toast.error(`Component "${componentName}" already exists`);
        return;
      }

      if (!selectedDocument) {
        toast.error('Please select a document');
        return;
      }

      if (onImportByReference) {
        onImportByReference(componentName.trim(), selectedDocumentId, selectedDocument.name);
        toast.success(`Imported component "${componentName}" by reference`);
        handleClose();
      } else {
        toast.error('Import by reference is not supported');
      }
      return;
    }

    if (importMultiple) {
      // Import multiple selected schemas
      if (selectedSchemas.size === 0) {
        toast.error('Please select at least one schema to import');
        return;
      }

      let importedCount = 0;
      selectedSchemas.forEach(schemaName => {
        const schemaInfo = availableSchemas.find(s => s.name === schemaName);
        if (schemaInfo) {
          const finalName = schemaInfo.isRoot && selectedSchemas.size === 1 ? componentName : schemaName;
          if (existingComponentNames.includes(finalName)) {
            toast.error(`Component "${finalName}" already exists`);
            return;
          }
          // Clean the schema for OpenAPI compatibility
          const cleanedSchema = cleanSchemaForOpenApi(schemaInfo.schema);
          onImport(finalName, cleanedSchema);
          importedCount++;
        }
      });

      if (importedCount > 0) {
        toast.success(`Imported ${importedCount} component(s)`);
        handleClose();
      }
    } else {
      // Import single root schema
      if (!componentName.trim()) {
        toast.error('Please enter a component name');
        return;
      }

      if (existingComponentNames.includes(componentName.trim())) {
        toast.error(`Component "${componentName}" already exists`);
        return;
      }

      if (!parsedSchema) {
        toast.error('Invalid schema document');
        return;
      }

      // Clean the schema for OpenAPI compatibility
      const cleanedSchema = cleanSchemaForOpenApi(parsedSchema);
      onImport(componentName.trim(), cleanedSchema);
      toast.success(`Imported component "${componentName}"`);
      handleClose();
    }
  };

  const cleanSchemaForOpenApi = (schema: any): any => {
    if (!schema || typeof schema !== 'object') return schema;

    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(schema)) {
      // Skip JSON Schema specific properties not in OpenAPI
      if (['$schema', '$id', '$defs', 'definitions'].includes(key)) continue;
      
      // Handle $ref - convert to OpenAPI format if it's a local ref
      if (key === '$ref' && typeof value === 'string') {
        if (value.startsWith('#/$defs/') || value.startsWith('#/definitions/')) {
          const refName = value.split('/').pop();
          cleaned['$ref'] = `#/components/schemas/${refName}`;
        } else {
          cleaned['$ref'] = value;
        }
        continue;
      }
      
      // Recursively clean nested objects and arrays
      if (Array.isArray(value)) {
        cleaned[key] = value.map(item => cleanSchemaForOpenApi(item));
      } else if (typeof value === 'object' && value !== null) {
        cleaned[key] = cleanSchemaForOpenApi(value);
      } else {
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedWorkspaceId('');
    setSelectedDocumentId('');
    setComponentName('');
    setImportMultiple(false);
    setImportByReference(false);
    setSelectedSchemas(new Set());
  };

  const canImport = importByReference
    ? (componentName.trim() && selectedDocumentId)
    : importMultiple 
      ? selectedSchemas.size > 0 
      : (componentName.trim() && parsedSchema);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Download className="h-3 w-3" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Component from JSON Schema</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Workspace Selection */}
          <div className="space-y-2">
            <Label>Workspace</Label>
            <Select 
              value={selectedWorkspaceId} 
              onValueChange={(value) => {
                setSelectedWorkspaceId(value);
                setSelectedDocumentId('');
                setComponentName('');
                setSelectedSchemas(new Set());
              }}
              disabled={workspacesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Document Selection */}
          {selectedWorkspaceId && (
            <div className="space-y-2">
              <Label>JSON Schema Document</Label>
              <Select 
                value={selectedDocumentId} 
                onValueChange={handleDocumentSelect}
                disabled={documentsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    documentsLoading 
                      ? "Loading..." 
                      : jsonSchemaDocuments.length === 0 
                        ? "No JSON Schema documents found" 
                        : "Select a document"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {jsonSchemaDocuments.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Import By Reference */}
          {selectedDocumentId && (
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="importByReference" 
                checked={importByReference}
                onCheckedChange={(checked) => {
                  setImportByReference(checked === true);
                  if (checked) {
                    setImportMultiple(false);
                  }
                }}
              />
              <Label htmlFor="importByReference" className="text-sm font-normal cursor-pointer">
                Import by reference (uses $ref to sideload content)
              </Label>
            </div>
          )}

          {/* Import Options */}
          {selectedDocumentId && !importByReference && availableSchemas.length > 1 && (
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="importMultiple" 
                checked={importMultiple}
                onCheckedChange={(checked) => setImportMultiple(checked === true)}
              />
              <Label htmlFor="importMultiple" className="text-sm font-normal cursor-pointer">
                Import multiple schemas from definitions
              </Label>
            </div>
          )}

          {/* Schema Selection for Multiple Import */}
          {selectedDocumentId && !importByReference && importMultiple && availableSchemas.length > 0 && (
            <div className="space-y-2">
              <Label>Select Schemas to Import</Label>
              <ScrollArea className="h-[150px] border rounded-md p-2">
                <div className="space-y-2">
                  {availableSchemas.map((schemaInfo) => (
                    <div key={schemaInfo.name} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`schema-${schemaInfo.name}`}
                        checked={selectedSchemas.has(schemaInfo.name)}
                        onCheckedChange={() => handleSchemaToggle(schemaInfo.name)}
                      />
                      <Label 
                        htmlFor={`schema-${schemaInfo.name}`} 
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        {schemaInfo.name}
                        {schemaInfo.isRoot && (
                          <span className="text-xs text-muted-foreground">(root)</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Component Name (for single import or by reference) */}
          {selectedDocumentId && (!importMultiple || importByReference) && (
            <div className="space-y-2">
              <Label>Component Name</Label>
              <Input
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                placeholder="MyComponent"
              />
              {existingComponentNames.includes(componentName.trim()) && (
                <p className="text-xs text-destructive">A component with this name already exists</p>
              )}
            </div>
          )}

          {/* Loading indicator */}
          {contentLoading && (
            <p className="text-sm text-muted-foreground">Loading document content...</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!canImport || contentLoading}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
