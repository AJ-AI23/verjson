import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentVersionComparison, MergeConflict, formatJsonPath } from "@/lib/importVersionUtils";
import { applyImportPatches } from "@/lib/importVersionUtils";
import { AlertTriangle, CheckCircle, FileText, GitMerge } from "lucide-react";

interface ImportVersionConflictPreviewProps {
  currentSchema: any;
  importSchema: any;
  comparison: DocumentVersionComparison;
  sourceDocumentName: string;
}

export const ImportVersionConflictPreview: React.FC<ImportVersionConflictPreviewProps> = ({
  currentSchema,
  importSchema,
  comparison,
  sourceDocumentName
}) => {
  const [selectedTab, setSelectedTab] = useState<string>("summary");

  const getSeverityColor = (severity: MergeConflict['severity']) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: MergeConflict['severity']) => {
    switch (severity) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  // Extract version information with fallback logic
  const getCurrentVersion = (schema: any) => {
    // Try OpenAPI format first
    if (schema?.info?.version) return schema.info.version;
    // Try JSON Schema format
    if (schema?.version) return schema.version;
    // Try extracting from $schema or other common fields
    if (schema?.$id?.includes('v')) {
      const match = schema.$id.match(/v(\d+\.?\d*\.?\d*)/);
      if (match) return match[1];
    }
    return 'Unknown';
  };

  const getCurrentTitle = (schema: any) => {
    // Try OpenAPI format first
    if (schema?.info?.title) return schema.info.title;
    // Try JSON Schema format
    if (schema?.title) return schema.title;
    // Try extracting from $id
    if (schema?.$id) {
      const parts = schema.$id.split('/');
      return parts[parts.length - 1] || 'Untitled';
    }
    return 'Untitled';
  };

  const getPropertiesCount = (schema: any) => {
    // Try different property locations
    if (schema?.properties) return Object.keys(schema.properties).length;
    if (schema?.components?.schemas) return Object.keys(schema.components.schemas).length;
    if (schema?.definitions) return Object.keys(schema.definitions).length;
    if (schema?.paths) return Object.keys(schema.paths).length;
    return 0;
  };

  const formatJsonValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    return JSON.stringify(value, null, 2);
  };

  // Generate merged schema preview
  const mergedSchema = React.useMemo(() => {
    try {
      return applyImportPatches(currentSchema, comparison.patches, comparison.mergedSchema, importSchema);
    } catch (error) {
      console.error('Error generating merged schema:', error);
      return null;
    }
  }, [currentSchema, comparison.patches, comparison.mergedSchema, importSchema]);

  return (
    <div className="space-y-4">
      {/* Summary Alert */}
      <Alert className={comparison.hasBreakingChanges ? "border-destructive" : "border-green-500"}>
        <GitMerge className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-1">
            Import Summary: {comparison.patches.length} changes detected
          </div>
          <div className="text-sm">
            Recommended version bump: <Badge variant="outline">{comparison.recommendedVersionTier}</Badge>
            {comparison.hasBreakingChanges && (
              <Badge variant="destructive" className="ml-2">Breaking Changes</Badge>
            )}
            {comparison.conflictCount > 0 && (
              <Badge variant="secondary" className="ml-2">{comparison.conflictCount} conflicts</Badge>
            )}
          </div>
        </AlertDescription>
      </Alert>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="conflicts">
            Conflicts ({comparison.conflictCount})
          </TabsTrigger>
          <TabsTrigger value="changes">Changes ({comparison.patches.length})</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Current Document
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div><strong>Title:</strong> {getCurrentTitle(currentSchema)}</div>
                  <div><strong>Version:</strong> {getCurrentVersion(currentSchema)}</div>
                  <div><strong>Properties:</strong> {getPropertiesCount(currentSchema)}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Import Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div><strong>Document:</strong> {sourceDocumentName}</div>
                  <div><strong>Title:</strong> {getCurrentTitle(importSchema)}</div>
                  <div><strong>Version:</strong> {getCurrentVersion(importSchema)}</div>
                  <div><strong>Properties:</strong> {getPropertiesCount(importSchema)}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Change Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {comparison.patches.filter(p => p.op === 'add').length}
                  </div>
                  <div className="text-muted-foreground">Additions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {comparison.patches.filter(p => p.op === 'replace').length}
                  </div>
                  <div className="text-muted-foreground">Modifications</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {comparison.patches.filter(p => p.op === 'remove').length}
                  </div>
                  <div className="text-muted-foreground">Removals</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-3">
          <div className="max-h-96 overflow-auto">
            {comparison.mergeConflicts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>No conflicts detected. Import can proceed safely.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comparison.mergeConflicts.map((conflict, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {getSeverityIcon(conflict.severity)}
                        <code className="font-mono text-xs bg-muted px-1 rounded">
                          {conflict.path}
                        </code>
                        <Badge variant={getSeverityColor(conflict.severity)} className="ml-auto">
                          {conflict.severity}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-3">{conflict.description}</p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <div className="font-medium mb-1">Current Value:</div>
                          <pre className="bg-muted p-2 rounded overflow-auto max-h-20">
                            {formatJsonValue(conflict.currentValue)}
                          </pre>
                        </div>
                        <div>
                          <div className="font-medium mb-1">Import Value:</div>
                          <pre className="bg-muted p-2 rounded overflow-auto max-h-20">
                            {formatJsonValue(conflict.importValue)}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="changes" className="space-y-2">
          <div className="max-h-96 overflow-auto space-y-2">
            {comparison.patches.map((patch, index) => (
              <Card key={index} className="text-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      variant={patch.op === 'add' ? 'default' : patch.op === 'replace' ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {patch.op.toUpperCase()}
                    </Badge>
                    <code className="font-mono text-xs bg-muted px-1 rounded">
                      {formatJsonPath(patch.path)}
                    </code>
                  </div>
                  {patch.op !== 'remove' && 'value' in patch && (
                    <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-16">
                      {formatJsonValue(patch.value)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Merged Schema Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {mergedSchema ? (
                <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-96">
                  {JSON.stringify(mergedSchema, null, 2)}
                </pre>
              ) : (
                <div className="text-center py-8 text-destructive">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  <p>Error generating merged schema preview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};