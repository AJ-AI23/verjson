import React, { useState, useMemo } from 'react';
import { Box, Loader2, AlertCircle, FolderPlus, GitBranch, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useDocuments } from '@/hooks/useDocuments';
import { useVersioning } from '@/hooks/useVersioning';
import { extractComponents, splitOpenAPISpec } from '@/lib/openApiSplitUtils';
import { parseJsonSchema } from '@/lib/schemaUtils';
import { ComponentInspectionTab } from '@/components/openapi/ComponentInspectionTab';

interface OpenAPISplitDialogProps {
  schema: string;
  documentName?: string;
  selectedDocument?: any;
  disabled?: boolean;
  setSchema?: (schema: string) => void;
}

interface ComponentInfo {
  name: string;
  schema: any;
  description?: string;
  isTopLevel: boolean;
}

export const OpenAPISplitDialog: React.FC<OpenAPISplitDialogProps> = ({
  schema,
  documentName,
  selectedDocument,
  disabled = false,
  setSchema
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  const [useExistingWorkspace, setUseExistingWorkspace] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [activeTab, setActiveTab] = useState('inspection');

  const { workspaces, createWorkspace } = useWorkspaces();
  const { createDocument, updateDocument } = useDocuments();
  const { handleVersionBump } = useVersioning({
    schema,
    savedSchema: schema,
    documentId: selectedDocument?.id,
    setSchema: () => {},
    setSavedSchema: () => {}
  });

  // Parse schema and extract components
  const parsedSchema = useMemo(() => {
    try {
      return parseJsonSchema(schema);
    } catch (err) {
      console.error('Failed to parse schema:', err);
      return null;
    }
  }, [schema]);

  // Extract available components from the OpenAPI schema
  const availableComponents = useMemo(() => {
    if (!parsedSchema) return [];
    try {
      return extractComponents(parsedSchema);
    } catch (err) {
      console.error('Failed to extract components:', err);
      return [];
    }
  }, [parsedSchema]);

  // Get all schemas for reference resolution
  const allSchemas = useMemo(() => {
    if (!parsedSchema?.components?.schemas) return {};
    return parsedSchema.components.schemas;
  }, [parsedSchema]);

  const handleComponentToggle = (componentName: string, checked: boolean) => {
    setSelectedComponents(prev => {
      if (checked) {
        return [...prev, componentName];
      } else {
        return prev.filter(name => name !== componentName);
      }
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedComponents(availableComponents.map(c => c.name));
    } else {
      setSelectedComponents([]);
    }
  };

  const handleSelectAllTopLevel = (checked: boolean) => {
    if (checked) {
      setSelectedComponents(availableComponents.filter(c => c.isTopLevel).map(c => c.name));
    } else {
      setSelectedComponents([]);
    }
  };

  const handleSplit = async () => {
    if (!selectedDocument) {
      toast.error('No document selected');
      return;
    }

    if (selectedComponents.length === 0) {
      toast.error('Please select at least one component to split');
      return;
    }

    if (!useExistingWorkspace && !workspaceName.trim()) {
      toast.error('Please enter a workspace name');
      return;
    }

    if (useExistingWorkspace && !selectedWorkspaceId) {
      toast.error('Please select a workspace');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create or get target workspace
      let targetWorkspaceId = selectedWorkspaceId;
      if (!useExistingWorkspace) {
        const workspace = await createWorkspace({
          name: workspaceName.trim(),
          description: `Component schemas split from ${documentName || 'OpenAPI specification'}`
        });
        if (!workspace) {
          throw new Error('Failed to create workspace');
        }
        targetWorkspaceId = workspace.id;
        
        window.dispatchEvent(new CustomEvent('workspaceUpdated', { 
          detail: { type: 'workspace_created', source: 'component_split' } 
        }));
      }

      // Step 2: Parse the original schema
      if (!parsedSchema) {
        throw new Error('Invalid OpenAPI schema');
      }

      // Step 3: Split the OpenAPI specification
      const splitResult = await splitOpenAPISpec(
        parsedSchema,
        selectedComponents,
        targetWorkspaceId,
        selectedDocument.id,
        createDocument
      );

      // Step 4: Update the schema state and let versioning handle the document update
      const newSchemaString = JSON.stringify(splitResult.updatedSchema, null, 2);
      
      if (setSchema) {
        setSchema(newSchemaString);
      }
      
      await handleVersionBump(
        { major: 0, minor: 1, patch: 0 },
        'minor',
        `Split components to separate documents: ${selectedComponents.join(', ')}`
      );

      toast.success(`Successfully split ${selectedComponents.length} components into ${splitResult.createdDocuments.length} documents`);
      setIsOpen(false);
      
      // Reset form
      setSelectedComponents([]);
      setWorkspaceName('');
      setUseExistingWorkspace(false);
      setSelectedWorkspaceId('');

    } catch (err) {
      console.error('Failed to split OpenAPI spec:', err);
      setError(err instanceof Error ? err.message : 'Failed to split OpenAPI specification');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setError(null);
      setSelectedComponents([]);
      setWorkspaceName('');
      setUseExistingWorkspace(false);
      setSelectedWorkspaceId('');
      setActiveTab('inspection');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || availableComponents.length === 0}
          className="gap-2 h-8"
        >
          <Box className="h-4 w-4" />
          <span>Components</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className="h-5 w-5 text-primary" />
            Components
            {documentName && (
              <Badge variant="outline" className="text-xs">
                {documentName}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Inspect and manage OpenAPI schema components
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="inspection" className="gap-2">
              <Search className="h-4 w-4" />
              Inspection
            </TabsTrigger>
            <TabsTrigger value="split" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Split
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inspection" className="flex-1 overflow-auto mt-4">
            <ComponentInspectionTab 
              components={availableComponents}
              allSchemas={allSchemas}
            />
          </TabsContent>

          <TabsContent value="split" className="flex-1 overflow-auto mt-4 space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Target Workspace Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderPlus className="h-4 w-4" />
                  Target Workspace
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="use-existing"
                    checked={useExistingWorkspace}
                    onCheckedChange={(checked) => setUseExistingWorkspace(checked === true)}
                  />
                  <Label htmlFor="use-existing">Use existing workspace</Label>
                </div>

                {useExistingWorkspace ? (
                  <div>
                    <Label htmlFor="workspace-select">Select Workspace</Label>
                    <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a workspace..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces.map(workspace => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name}
                            {workspace.description && (
                              <span className="text-muted-foreground ml-2">
                                — {workspace.description}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="workspace-name">New Workspace Name</Label>
                    <Input
                      id="workspace-name"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Enter workspace name..."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Components Selection */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Select Components ({selectedComponents.length} selected / {availableComponents.length} total)
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedComponents.length === availableComponents.length}
                        onCheckedChange={handleSelectAll}
                      />
                      <Label htmlFor="select-all" className="text-sm">Select All</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all-top-level"
                        checked={selectedComponents.length === availableComponents.filter(c => c.isTopLevel).length && availableComponents.filter(c => c.isTopLevel).length > 0}
                        onCheckedChange={handleSelectAllTopLevel}
                      />
                      <Label htmlFor="select-all-top-level" className="text-sm">Select All Top-Level</Label>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {availableComponents.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No components found in the OpenAPI specification</p>
                    <p className="text-sm">Make sure your schema contains a "components.schemas" section</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-auto">
                    {availableComponents.map((component) => (
                      <div key={component.name} className="flex items-start space-x-2 p-3 border rounded-lg">
                        <Checkbox
                          id={component.name}
                          checked={selectedComponents.includes(component.name)}
                          onCheckedChange={(checked) => handleComponentToggle(component.name, checked as boolean)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Label 
                              htmlFor={component.name} 
                              className="font-medium cursor-pointer"
                            >
                              {component.name}
                            </Label>
                            {component.isTopLevel && (
                              <Badge variant="secondary" className="text-xs">
                                Top Level
                              </Badge>
                            )}
                          </div>
                          {component.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {component.description}
                            </p>
                          )}
                          {!component.isTopLevel && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Not directly referenced from paths
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preview Section */}
            {selectedComponents.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">{selectedComponents.length}</span> component{selectedComponents.length !== 1 ? 's' : ''} will be extracted:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedComponents.map(name => (
                        <Badge key={name} variant="secondary" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                    </div>
                    <Separator className="my-2" />
                    <p className="text-muted-foreground">
                      Each component will be created as a separate JSON schema document.
                      The original OpenAPI spec will be updated with $ref links pointing to the new documents.
                      A new version will be automatically created with these changes.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Split Action */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button 
                onClick={handleSplit} 
                disabled={isLoading || selectedComponents.length === 0}
                className="gap-2"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Split Components
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};