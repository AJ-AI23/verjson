import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DocumentMergeResult, MergeConflict, DocumentMergeEngine } from "@/lib/documentMergeEngine";
import { Document } from "@/types/workspace";
import { AlertTriangle, CheckCircle, FileText, GitMerge, Layers, ChevronDown, ChevronRight } from "lucide-react";

interface DocumentMergePreviewProps {
  documents: Document[];
  mergeResult: DocumentMergeResult;
  resultName: string;
  onConflictResolve?: (updatedResult: DocumentMergeResult) => void;
}

export const DocumentMergePreview: React.FC<DocumentMergePreviewProps> = ({
  documents,
  mergeResult: initialMergeResult,
  resultName,
  onConflictResolve
}) => {
  const [selectedTab, setSelectedTab] = useState<string>("summary");
  const [mergeResult, setMergeResult] = useState<DocumentMergeResult>(initialMergeResult);
  const [expandedConflicts, setExpandedConflicts] = useState<Set<number>>(new Set());
  const [defaultMergePolicy, setDefaultMergePolicy] = useState<'current' | 'incoming' | null>(null);

  // Update internal state when prop changes
  useEffect(() => {
    setMergeResult(initialMergeResult);
  }, [initialMergeResult]);

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

  const handleConflictResolve = (conflictIndex: number, resolution: 'current' | 'incoming' | 'custom', customValue?: any) => {
    const updatedConflicts = [...mergeResult.conflicts];
    updatedConflicts[conflictIndex] = {
      ...updatedConflicts[conflictIndex],
      resolution,
      customValue
    };

    const resolvedCount = updatedConflicts.filter(c => c.resolution !== 'unresolved').length;
    const unresolvedCount = updatedConflicts.filter(c => c.resolution === 'unresolved').length;

    const updatedResult = {
      ...mergeResult,
      conflicts: updatedConflicts,
      summary: {
        ...mergeResult.summary,
        resolvedConflicts: resolvedCount,
        unresolvedConflicts: unresolvedCount
      }
    };

    // Generate updated merged schema with conflict resolutions
    if (resolvedCount > 0) {
      const resolvedSchema = DocumentMergeEngine.applyConflictResolutions(
        mergeResult.mergedSchema,
        updatedConflicts
      );
      updatedResult.mergedSchema = resolvedSchema;
    }

    setMergeResult(updatedResult);
    onConflictResolve?.(updatedResult);
  };

  const toggleConflictExpansion = (index: number) => {
    const newExpanded = new Set(expandedConflicts);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedConflicts(newExpanded);
  };

  const handleDefaultMergePolicyChange = (policy: 'current' | 'incoming' | null) => {
    setDefaultMergePolicy(policy);
    
    if (policy) {
      // Apply the policy to all unresolved conflicts
      const updatedConflicts = mergeResult.conflicts.map(conflict => 
        conflict.resolution === 'unresolved' ? { ...conflict, resolution: policy } : conflict
      );
      
      const resolvedCount = updatedConflicts.filter(c => c.resolution !== 'unresolved').length;
      const unresolvedCount = updatedConflicts.filter(c => c.resolution === 'unresolved').length;

      const updatedResult = {
        ...mergeResult,
        conflicts: updatedConflicts,
        summary: {
          ...mergeResult.summary,
          resolvedConflicts: resolvedCount,
          unresolvedConflicts: unresolvedCount
        }
      };

      // Generate updated merged schema with conflict resolutions
      if (resolvedCount > 0) {
        const resolvedSchema = DocumentMergeEngine.applyConflictResolutions(
          mergeResult.mergedSchema,
          updatedConflicts
        );
        updatedResult.mergedSchema = resolvedSchema;
      }

      setMergeResult(updatedResult);
      onConflictResolve?.(updatedResult);
    }
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="steps">
            Steps ({mergeResult.mergeSteps.length})
          </TabsTrigger>
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
                  <div className={`text-2xl font-bold ${mergeResult.summary.resolvedConflicts > 0 ? 'text-green-600' : 'text-blue-600'}`}>
                    {mergeResult.summary.resolvedConflicts}
                  </div>
                  <div className="text-muted-foreground">Resolved</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${mergeResult.summary.unresolvedConflicts > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {mergeResult.summary.unresolvedConflicts}
                  </div>
                  <div className="text-muted-foreground">Unresolved</div>
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

        <TabsContent value="steps" className="space-y-3">
          {mergeResult.mergeSteps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <GitMerge className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p>No sequential merge steps tracked.</p>
              <p className="text-xs mt-1">Using bulk merge approach</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mergeResult.mergeSteps.map((step, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Step {step.stepNumber}
                      </Badge>
                      <span>Merge {step.fromDocument}</span>
                      {step.conflicts > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {step.conflicts} conflicts
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <div className="font-medium">Changes Applied</div>
                        <div className="text-muted-foreground">{step.patches.length} patches</div>
                      </div>
                      <div>
                        <div className="font-medium">Additions</div>
                        <div className="text-muted-foreground">
                          {step.patches.filter(p => p.op === 'add').length}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Modifications</div>
                        <div className="text-muted-foreground">
                          {step.patches.filter(p => p.op === 'replace').length}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-3">
          {mergeResult.conflicts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>No conflicts detected. Merge can proceed safely.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Default Merge Policy Controls */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-blue-600" />
                    Default Merge Policy
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-3">
                    Choose a default resolution for all unresolved conflicts:
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={defaultMergePolicy === 'current' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleDefaultMergePolicyChange(defaultMergePolicy === 'current' ? null : 'current')}
                    >
                      Always Keep Current
                    </Button>
                    <Button
                      variant={defaultMergePolicy === 'incoming' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleDefaultMergePolicyChange(defaultMergePolicy === 'incoming' ? null : 'incoming')}
                    >
                      Always Use Incoming
                    </Button>
                    {defaultMergePolicy && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDefaultMergePolicyChange(null)}
                      >
                        Clear Policy
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                {mergeResult.conflicts.map((conflict, index) => {
                  const isExpanded = expandedConflicts.has(index);
                  const isResolved = conflict.resolution !== 'unresolved';
                  
                  return (
                    <Card key={index} className={isResolved ? 'border-green-200' : ''}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleConflictExpansion(index)}
                            className="h-auto p-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          {getSeverityIcon(conflict.severity)}
                          <code className="font-mono text-xs bg-muted px-1 rounded">
                            {conflict.path}
                          </code>
                          <Badge variant={getSeverityColor(conflict.severity)}>
                            {conflict.severity}
                          </Badge>
                          {isResolved && (
                            <Badge variant="default" className="ml-auto bg-green-600">
                              {conflict.resolution?.toUpperCase()}
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      
                      {isExpanded && (
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground mb-4">{conflict.description}</p>
                          
                          <div className="space-y-4">
                            <div className="text-xs font-medium">Conflicting Documents:</div>
                            <div className="flex gap-1 flex-wrap mb-4">
                              {conflict.documents.map((docName, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {docName}
                                </Badge>
                              ))}
                            </div>

                            <div className="space-y-4">
                              <div className="text-sm font-medium">Choose Resolution:</div>
                              
                              {/* Current Value Option */}
                              <div className="space-y-2">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`conflict-${index}`}
                                    checked={conflict.resolution === 'current'}
                                    onChange={() => handleConflictResolve(index, 'current')}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-sm font-medium">Keep Current ({conflict.documents[0]})</span>
                                </label>
                                <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-20">
                                  {formatJsonValue(conflict.currentValue)}
                                </pre>
                              </div>

                              {/* Incoming Value Option */}
                              <div className="space-y-2">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`conflict-${index}`}
                                    checked={conflict.resolution === 'incoming'}
                                    onChange={() => handleConflictResolve(index, 'incoming')}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-sm font-medium">Use Incoming ({conflict.documents[1]})</span>
                                </label>
                                <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-20">
                                  {formatJsonValue(conflict.incomingValue)}
                                </pre>
                              </div>

                              {/* Custom Value Option */}
                              <div className="space-y-2">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`conflict-${index}`}
                                    checked={conflict.resolution === 'custom'}
                                    onChange={() => handleConflictResolve(index, 'custom', conflict.customValue || '')}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-sm font-medium">Custom Value</span>
                                </label>
                                {conflict.resolution === 'custom' && (
                                  <textarea
                                    value={conflict.customValue || ''}
                                    onChange={(e) => {
                                      try {
                                        const parsedValue = JSON.parse(e.target.value);
                                        handleConflictResolve(index, 'custom', parsedValue);
                                      } catch {
                                        handleConflictResolve(index, 'custom', e.target.value);
                                      }
                                    }}
                                    placeholder="Enter custom JSON value..."
                                    className="w-full h-20 p-2 text-xs border rounded bg-muted resize-none"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
                  </div>
                </ScrollArea>
              </div>
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
                <pre className="bg-muted p-4 rounded text-xs whitespace-pre-wrap break-words">
                  {(() => {
                    try {
                      // Limit the depth of the preview to avoid UI freezing
                      const limitedSchema = JSON.parse(JSON.stringify(mergeResult.mergedSchema, (key, value) => {
                        if (typeof value === 'object' && value !== null) {
                          // Skip problematic nested objects
                          if (value._type === 'MaxDepthReached') {
                            return '[Complex nested object - view in editor]';
                          }
                          // Limit array length in preview
                          if (Array.isArray(value) && value.length > 5) {
                            return [...value.slice(0, 5), `... and ${value.length - 5} more items`];
                          }
                        }
                        return value;
                      }));
                      return JSON.stringify(limitedSchema, null, 2);
                    } catch (error) {
                      return 'Error rendering preview - schema is too complex. The merge will still work correctly.';
                    }
                  })()}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};