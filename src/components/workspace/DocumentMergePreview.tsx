import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DocumentMergeResult, MergeConflict } from "@/lib/documentMergeEngine";
import { Document } from "@/types/workspace";
import { AlertTriangle, CheckCircle, FileText, GitMerge, Layers } from "lucide-react";

interface DocumentMergePreviewProps {
  documents: Document[];
  mergeResult: DocumentMergeResult;
  resultName: string;
}

export const DocumentMergePreview: React.FC<DocumentMergePreviewProps> = ({
  documents,
  mergeResult,
  resultName
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

  const formatJsonValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    return JSON.stringify(value, null, 2);
  };

  const getDocumentInfo = (doc: Document) => {
    const schema = doc.content;
    const title = schema?.info?.title || schema?.title || doc.name;
    const version = schema?.info?.version || schema?.version || 'Unknown';
    const propertiesCount = schema?.properties ? Object.keys(schema.properties).length :
                          schema?.components?.schemas ? Object.keys(schema.components.schemas).length :
                          schema?.paths ? Object.keys(schema.paths).length : 0;
    return { title, version, propertiesCount };
  };

  const getMergedInfo = () => {
    const schema = mergeResult.mergedSchema;
    const title = schema?.info?.title || schema?.title || resultName;
    const version = schema?.info?.version || schema?.version || '1.0.0';
    const propertiesCount = schema?.properties ? Object.keys(schema.properties).length :
                          schema?.components?.schemas ? Object.keys(schema.components.schemas).length :
                          schema?.paths ? Object.keys(schema.paths).length : 0;
    return { title, version, propertiesCount };
  };

  if (!mergeResult.isCompatible) {
    return (
      <Alert className="border-destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-1">Documents Cannot Be Merged</div>
          <div className="text-sm">
            {mergeResult.conflicts[0]?.description || 'Documents are not compatible for merging.'}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const mergedInfo = getMergedInfo();

  return (
    <div className="space-y-4">
      {/* Summary Alert */}
      <Alert className={mergeResult.conflicts.length > 0 ? "border-orange-500" : "border-green-500"}>
        <GitMerge className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-1">
            Merge Analysis: {documents.length} documents → 1 merged document
          </div>
          <div className="text-sm flex items-center gap-2 flex-wrap">
            <Badge variant="outline">
              {mergeResult.summary.addedProperties} properties
            </Badge>
            <Badge variant="outline">
              {mergeResult.summary.mergedComponents} components
            </Badge>
            {mergeResult.conflicts.length > 0 && (
              <Badge variant="secondary">
                {mergeResult.conflicts.length} conflicts
              </Badge>
            )}
          </div>
        </AlertDescription>
      </Alert>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="conflicts">
            Conflicts ({mergeResult.conflicts.length})
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {/* Result Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Merged Document: {resultName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-medium">Title</div>
                  <div className="text-muted-foreground">{mergedInfo.title}</div>
                </div>
                <div>
                  <div className="font-medium">Version</div>
                  <div className="text-muted-foreground">{mergedInfo.version}</div>
                </div>
                <div>
                  <div className="font-medium">Properties/Paths</div>
                  <div className="text-muted-foreground">{mergedInfo.propertiesCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Merge Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Merge Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {mergeResult.summary.addedProperties}
                  </div>
                  <div className="text-muted-foreground">Properties Added</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {mergeResult.summary.mergedComponents}
                  </div>
                  <div className="text-muted-foreground">Components Merged</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${mergeResult.conflicts.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {mergeResult.conflicts.length}
                  </div>
                  <div className="text-muted-foreground">Conflicts</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          {mergeResult.warnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-orange-600">Warnings</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {mergeResult.warnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-3">
          {mergeResult.conflicts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>No conflicts detected. Merge can proceed safely.</p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {mergeResult.conflicts.map((conflict, index) => (
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
                      
                      <div className="space-y-2">
                        <div className="text-xs font-medium">Conflicting Documents:</div>
                        <div className="flex gap-1 flex-wrap">
                          {conflict.documents.map((docName, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {docName}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {conflict.values.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-medium mb-2">Conflicting Values:</div>
                          <div className="grid gap-2">
                            {conflict.values.map((value, i) => (
                              <div key={i}>
                                <div className="text-xs text-muted-foreground mb-1">
                                  From: {conflict.documents[i] || 'Unknown'}
                                </div>
                                <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-20">
                                  {formatJsonValue(value)}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {conflict.suggestedResolution && (
                        <div className="mt-3">
                          <div className="text-xs font-medium mb-1">Suggested Resolution:</div>
                          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                            {conflict.suggestedResolution}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-3">
          <div className="grid gap-3">
            {documents.map((doc, index) => {
              const info = getDocumentInfo(doc);
              return (
                <Card key={doc.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {doc.name}
                      <Badge variant="outline" className="ml-auto text-xs">
                        {doc.file_type}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <div className="font-medium">Title</div>
                        <div className="text-muted-foreground">{info.title}</div>
                      </div>
                      <div>
                        <div className="font-medium">Version</div>
                        <div className="text-muted-foreground">{info.version}</div>
                      </div>
                      <div>
                        <div className="font-medium">Properties</div>
                        <div className="text-muted-foreground">{info.propertiesCount}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Merged Schema Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <pre className="bg-muted p-4 rounded text-xs">
                  {JSON.stringify(mergeResult.mergedSchema, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};