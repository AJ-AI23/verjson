import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentMergeEngine, DocumentMergeResult, MergeConflict } from '@/lib/documentMergeEngine';
import { Document } from '@/types/workspace';
import { CheckCircle, AlertTriangle, ArrowUpDown, GitMerge, Layers, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableAccordionItem } from './SortableAccordionItem';

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

  // Update internal state when prop changes
  useEffect(() => {
    setMergeResult(initialMergeResult);
  }, [initialMergeResult]);

  // Group conflicts by path for better organization and add sortable path order
  const conflictsByPath = useMemo(() => {
    const groups: { [path: string]: MergeConflict[] } = {};
    
    mergeResult.conflicts.forEach(conflict => {
      if (!groups[conflict.path]) {
        groups[conflict.path] = [];
      }
      groups[conflict.path].push(conflict);
    });
    
    return groups;
  }, [mergeResult.conflicts]);

  // Keep track of path order for controlled merging (draggable)
  const [pathOrder, setPathOrder] = useState<string[]>(() => Object.keys(conflictsByPath));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Default merge policy handler
  const handleDefaultMergePolicy = useCallback((policy: 'current' | 'incoming' | 'additive') => {
    const updatedConflicts = mergeResult.conflicts.map(conflict => {
      if (conflict.resolution === 'unresolved') {
        return { ...conflict, resolution: policy };
      }
      return conflict;
    });

    // Apply conflict resolutions to generate final merged schema
    const finalMergedSchema = DocumentMergeEngine.applyConflictResolutions(
      mergeResult.mergedSchema,
      updatedConflicts,
      pathOrder
    );

    const updatedResult: DocumentMergeResult = {
      ...mergeResult,
      conflicts: updatedConflicts,
      mergedSchema: finalMergedSchema,
      summary: {
        ...mergeResult.summary,
        resolvedConflicts: updatedConflicts.filter(c => c.resolution !== 'unresolved').length,
        unresolvedConflicts: updatedConflicts.filter(c => c.resolution === 'unresolved').length
      }
    };

    onConflictResolve?.(updatedResult);
  }, [mergeResult, pathOrder, onConflictResolve]);

  // Handle drag end for path reordering
  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setPathOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);

        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Reapply conflict resolutions with new path order
        const finalMergedSchema = DocumentMergeEngine.applyConflictResolutions(
          mergeResult.mergedSchema,
          mergeResult.conflicts,
          newOrder
        );

        const updatedResult: DocumentMergeResult = {
          ...mergeResult,
          mergedSchema: finalMergedSchema
        };

        onConflictResolve?.(updatedResult);
        
        return newOrder;
      });
    }
  }, [mergeResult, onConflictResolve]);

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

  const handleConflictResolution = useCallback((path: string, conflictIndex: number, resolution: MergeConflict['resolution']) => {
    const updatedConflicts = mergeResult.conflicts.map((conflict, idx) => {
      if (conflict.path === path && idx === conflictIndex) {
        return { ...conflict, resolution };
      }
      return conflict;
    });

    const finalMergedSchema = DocumentMergeEngine.applyConflictResolutions(
      mergeResult.mergedSchema,
      updatedConflicts,
      pathOrder
    );

    const updatedResult: DocumentMergeResult = {
      ...mergeResult,
      conflicts: updatedConflicts,
      mergedSchema: finalMergedSchema,
      summary: {
        ...mergeResult.summary,
        resolvedConflicts: updatedConflicts.filter(c => c.resolution !== 'unresolved').length,
        unresolvedConflicts: updatedConflicts.filter(c => c.resolution === 'unresolved').length
      }
    };

    onConflictResolve?.(updatedResult);
  }, [mergeResult, pathOrder, onConflictResolve]);

  const handleCustomValue = useCallback((path: string, conflictIndex: number, customValue: string) => {
    const updatedConflicts = mergeResult.conflicts.map((conflict, idx) => {
      if (conflict.path === path && idx === conflictIndex) {
        return { ...conflict, customValue };
      }
      return conflict;
    });

    const updatedResult: DocumentMergeResult = {
      ...mergeResult,
      conflicts: updatedConflicts
    };

    setMergeResult(updatedResult);
    onConflictResolve?.(updatedResult);
  }, [mergeResult, onConflictResolve]);

  const toggleConflictExpansion = (index: number) => {
    const newExpanded = new Set(expandedConflicts);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedConflicts(newExpanded);
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
            {/* Conflict Resolution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conflict Resolution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Resolve conflicts between documents. Drag paths to reorder resolution sequence. Each conflict can be resolved individually or you can apply a default policy.
                  </div>
                  
                  {/* Default Policy Controls */}
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Apply to all unresolved:</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDefaultMergePolicy('current')}
                    >
                      Always Keep Current
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDefaultMergePolicy('incoming')}
                    >
                      Always Use Incoming
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDefaultMergePolicy('additive')}
                    >
                      Smart Merge (Preserve Non-null)
                    </Button>
                  </div>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={pathOrder} strategy={verticalListSortingStrategy}>
                      <Accordion type="multiple" className="w-full">
                        {pathOrder.map((path) => {
                          const pathConflicts = conflictsByPath[path] || [];
                          if (pathConflicts.length === 0) return null;

                          return (
                            <SortableAccordionItem
                              key={path}
                              id={path}
                              value={path}
                              triggerContent={
                                <div className="flex items-center justify-between w-full mr-4">
                                  <div className="flex items-center gap-2">
                                    <code className="text-sm bg-muted px-2 py-1 rounded">{path}</code>
                                    <Badge variant="outline" className="text-xs">
                                      {pathConflicts.length} conflicts
                                    </Badge>
                                  </div>
                                  <div className="flex gap-1">
                                    {pathConflicts.map((conflict, idx) => (
                                      <Badge
                                        key={idx}
                                        variant={conflict.resolution === 'unresolved' ? 'destructive' : 'default'}
                                        className="text-xs"
                                      >
                                        {conflict.resolution === 'unresolved' ? 'Unresolved' : conflict.resolution}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              }
                            >
                              <div className="space-y-4">
                                {pathConflicts.map((conflict, conflictIndex) => (
                                  <div key={`${conflict.path}-${conflictIndex}`} className="border rounded p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <Badge variant={
                                        conflict.severity === 'high' ? 'destructive' : 
                                        conflict.severity === 'medium' ? 'default' : 'secondary'
                                      }>
                                        {conflict.severity} severity
                                      </Badge>
                                      <Badge variant="outline">{conflict.type}</Badge>
                                    </div>
                                    
                                    <div className="text-sm">
                                      <p className="font-medium">{conflict.description}</p>
                                      {conflict.suggestedResolution && (
                                        <p className="text-muted-foreground mt-1">
                                          Suggestion: {conflict.suggestedResolution}
                                        </p>
                                      )}
                                    </div>

                                    <div className="space-y-2">
                                      <div className="text-sm font-medium">Resolution:</div>
                                      <Select
                                        value={conflict.resolution || 'unresolved'}
                                        onValueChange={(value) => handleConflictResolution(conflict.path, conflictIndex, value as any)}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="unresolved">Unresolved</SelectItem>
                                          <SelectItem value="current">Keep Current Value</SelectItem>
                                          <SelectItem value="incoming">Use Incoming Value</SelectItem>
                                          <SelectItem value="additive">Smart Merge (Prefer Non-null)</SelectItem>
                                          <SelectItem value="custom">Custom Value</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {conflict.resolution === 'custom' && (
                                      <div className="space-y-2">
                                        <div className="text-sm font-medium">Custom Value:</div>
                                        <Input
                                          value={conflict.customValue || ''}
                                          onChange={(e) => handleCustomValue(conflict.path, conflictIndex, e.target.value)}
                                          placeholder="Enter custom value"
                                        />
                                      </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                      <div>
                                        <div className="font-medium text-muted-foreground mb-1">Current Value:</div>
                                        <pre className="bg-muted p-2 rounded overflow-auto max-h-20">
                                          {JSON.stringify(conflict.currentValue, null, 2)}
                                        </pre>
                                      </div>
                                      <div>
                                        <div className="font-medium text-muted-foreground mb-1">Incoming Value:</div>
                                        <pre className="bg-muted p-2 rounded overflow-auto max-h-20">
                                          {JSON.stringify(conflict.incomingValue, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </SortableAccordionItem>
                          );
                        })}
                      </Accordion>
                    </SortableContext>
                  </DndContext>
                </div>
              </CardContent>
            </Card>
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

export default DocumentMergePreview;