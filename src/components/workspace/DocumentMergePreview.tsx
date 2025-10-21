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
import { CheckCircle, AlertTriangle, ArrowUpDown, GitMerge, Layers, ChevronDown, ChevronRight, FileText, Download } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableAccordionItem } from './SortableAccordionItem';
import { SortableConflictItem } from './SortableConflictItem';

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
  
  // Keep track of conflict order within each path
  const [conflictOrders, setConflictOrders] = useState<{ [path: string]: string[] }>(() => {
    const orders: { [path: string]: string[] } = {};
    Object.keys(conflictsByPath).forEach(path => {
      orders[path] = conflictsByPath[path].map((_, index) => `${path}-${index}`);
    });
    return orders;
  });

  // Keep track of step order for draggable steps
  const [stepOrder, setStepOrder] = useState<number[]>(() => 
    mergeResult.mergeSteps.map((_, idx) => idx)
  );

  // Recalculate merge when step order changes
  useEffect(() => {
    if (stepOrder.length === 0 || stepOrder.every((idx, i) => idx === i)) {
      // No reordering or original order, skip recalculation
      return;
    }

    // Derive new document order from step order
    // Original: documents array
    // Steps merge documents[1], documents[2], ... into documents[0]
    // So if stepOrder is [1, 0], we want to swap which document is merged first
    const reorderedDocuments = [documents[0]]; // Always start with first document
    stepOrder.forEach(stepIdx => {
      // Each step index corresponds to documents[stepIdx + 1]
      if (stepIdx + 1 < documents.length) {
        reorderedDocuments.push(documents[stepIdx + 1]);
      }
    });

    console.log('🔄 Recalculating merge with new document order:', reorderedDocuments.map(d => d.name));

    // Re-run merge with new order
    const newMergeResult = DocumentMergeEngine.mergeDocuments(reorderedDocuments, resultName);
    setMergeResult(newMergeResult);
    onConflictResolve?.(newMergeResult);
  }, [stepOrder, documents, resultName, onConflictResolve]);

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

  // Handle drag end for path, conflict, or step reordering
  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const activeIdStr = String(active.id);
      const overIdStr = String(over.id);
      
      // Check if it's a step reordering (numeric string IDs like "0", "1", "2")
      const activeStepIndex = stepOrder.findIndex(idx => String(idx) === activeIdStr);
      const overStepIndex = stepOrder.findIndex(idx => String(idx) === overIdStr);
      
      if (activeStepIndex !== -1 && overStepIndex !== -1) {
        setStepOrder((items) => {
          return arrayMove(items, activeStepIndex, overStepIndex);
        });
      }
      // Check if it's a path reordering
      else if (pathOrder.includes(activeIdStr)) {
        setPathOrder((items) => {
          const oldIndex = items.indexOf(activeIdStr);
          const newIndex = items.indexOf(overIdStr);
          return arrayMove(items, oldIndex, newIndex);
        });
      } 
      // Otherwise it's conflict reordering within a path
      else {
        const pathKey = Object.keys(conflictOrders).find(path => 
          conflictOrders[path].includes(activeIdStr)
        );
        
        if (pathKey) {
          setConflictOrders(prev => {
            const oldOrder = prev[pathKey];
            const oldIndex = oldOrder.indexOf(activeIdStr);
            const newIndex = oldOrder.indexOf(overIdStr);
            
            return {
              ...prev,
              [pathKey]: arrayMove(oldOrder, oldIndex, newIndex)
            };
          });
        }
      }
    }
  }, [pathOrder, conflictOrders, stepOrder]);

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
    console.log(`🔧 Resolving conflict at ${path}[${conflictIndex}] to: ${resolution}`);
    
    const updatedConflicts = mergeResult.conflicts.map((conflict, idx) => {
      // Find the actual conflict at this path and position
      const pathConflicts = conflictsByPath[path] || [];
      const targetConflict = pathConflicts[conflictIndex];
      
      if (targetConflict?.linkedConflictPaths?.length) {
        console.log(`🔗 Target conflict has ${targetConflict.linkedConflictPaths.length} linked children:`, targetConflict.linkedConflictPaths);
      }
      
      // Only update the specific conflict that was changed
      if (conflict === targetConflict) {
        const updated: MergeConflict = { ...conflict, resolution };
        
        // If setting to Smart Merge and this conflict has linked children, auto-toggle them too
        if (resolution === 'additive' && conflict.linkedConflictPaths && conflict.linkedConflictPaths.length > 0) {
          console.log(`🔄 Auto-toggling Smart Merge for ${conflict.linkedConflictPaths.length} linked conflicts`);
        }
        
        return updated;
      }
      
      // If this conflict is a linked child of the target, auto-toggle it to Smart Merge
      if (targetConflict?.linkedConflictPaths?.includes(conflict.path) && resolution === 'additive') {
        console.log(`✅ Auto-toggling linked conflict to Smart Merge: ${conflict.path}`);
        const updated: MergeConflict = { ...conflict, resolution: 'additive' as const };
        return updated;
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

    setMergeResult(updatedResult);
    onConflictResolve?.(updatedResult);
  }, [mergeResult, pathOrder, onConflictResolve, conflictsByPath]);

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

  const handleBulkResolve = useCallback((conflicts: MergeConflict[], resolution: MergeConflict['resolution']) => {
    const updatedConflicts = mergeResult.conflicts.map(conflict => {
      // Check if this conflict should be bulk resolved
      const shouldUpdate = conflicts.some(c => c.path === conflict.path && c.description === conflict.description);
      
      if (shouldUpdate) {
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

    setMergeResult(updatedResult);
    onConflictResolve?.(updatedResult);
  }, [mergeResult, pathOrder, onConflictResolve]);

  const toggleConflictExpansion = (index: number) => {
    const newExpanded = new Set(expandedConflicts);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedConflicts(newExpanded);
  };

  const handleExportConflicts = useCallback(() => {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        documentCount: documents.length,
        documents: documents.map(d => d.name),
        totalConflicts: mergeResult.conflicts.length,
        resolvedConflicts: mergeResult.summary.resolvedConflicts,
        unresolvedConflicts: mergeResult.summary.unresolvedConflicts
      },
      conflicts: mergeResult.conflicts.map(conflict => ({
        path: conflict.path,
        type: conflict.type,
        severity: conflict.severity,
        description: conflict.description,
        documentSource: conflict.documentSource,
        documentDestination: conflict.documentDestination,
        resolution: conflict.resolution,
        currentValue: conflict.currentValue,
        incomingValue: conflict.incomingValue,
        customValue: conflict.customValue,
        suggestedResolution: conflict.suggestedResolution,
        linkedConflictPaths: conflict.linkedConflictPaths
      })),
      pathOrder: pathOrder
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `merge-conflicts-${resultName.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [mergeResult, documents, pathOrder, resultName]);

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
              <div className="text-sm text-muted-foreground mb-3 p-3 bg-muted/50 rounded-lg">
                Drag steps to reorder how documents are merged. This will also reorder conflicts in the Conflicts tab.
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={stepOrder.map(String)} strategy={verticalListSortingStrategy}>
                  <Accordion type="multiple" className="w-full">
                    {stepOrder.map((stepIndex) => {
                      const step = mergeResult.mergeSteps[stepIndex];
                      if (!step) return null;
                      
                      return (
                         <SortableAccordionItem
                          key={stepIndex}
                          id={String(stepIndex)}
                          value={`step-${stepIndex}`}
                          triggerContent={
                            <div className="flex items-center justify-between w-full mr-4">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  Step {stepOrder.indexOf(stepIndex) + 1}
                                </Badge>
                                <span className="text-sm">
                                  <span className="font-medium">{step.fromDocument}</span>
                                  <ArrowUpDown className="inline h-3 w-3 mx-1" />
                                  <span className="font-medium">{step.toDocument}</span>
                                </span>
                              </div>
                              {step.conflicts > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {step.conflicts} conflicts
                                </Badge>
                              )}
                            </div>
                          }
                        >
                          <div className="grid grid-cols-3 gap-4 text-xs pt-2">
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
                        </SortableAccordionItem>
                      );
                    })}
                  </Accordion>
                </SortableContext>
              </DndContext>
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
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Conflict Resolution</span>
                  <Button variant="outline" size="sm" onClick={handleExportConflicts}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Conflicts
                  </Button>
                </CardTitle>
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
                                     {pathConflicts.length > 1 ? (
                                       <Badge
                                         variant={pathConflicts.every(c => c.resolution !== 'unresolved') ? 'default' : 
                                                pathConflicts.some(c => c.resolution !== 'unresolved') ? 'secondary' : 'destructive'}
                                         className="text-xs"
                                       >
                                         {pathConflicts.every(c => c.resolution !== 'unresolved') ? 'All Resolved' :
                                          pathConflicts.some(c => c.resolution !== 'unresolved') ? 'Partially Resolved' : 'Unresolved'}
                                       </Badge>
                                     ) : (
                                       pathConflicts.map((conflict, idx) => (
                                         <Badge
                                           key={idx}
                                           variant={conflict.resolution === 'unresolved' ? 'destructive' : 'default'}
                                           className="text-xs"
                                         >
                                           {conflict.resolution === 'unresolved' ? 'Unresolved' : conflict.resolution}
                                         </Badge>
                                       ))
                                     )}
                                   </div>
                                </div>
                              }
                            >
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                              >
                                <SortableContext items={conflictOrders[path] || []} strategy={verticalListSortingStrategy}>
                                  <div className="space-y-3">
                                    {(conflictOrders[path] || []).map((conflictId) => {
                                      const conflictIndex = parseInt(conflictId.split('-').pop() || '0');
                                      const conflict = pathConflicts[conflictIndex];
                                      if (!conflict) return null;

                                      return (
                                         <SortableConflictItem
                                           key={conflictId}
                                           id={conflictId}
                                           conflict={conflict}
                                           conflictIndex={conflictIndex}
                                           path={path}
                                           onConflictResolve={handleConflictResolution}
                                           onCustomValue={handleCustomValue}
                                           formatJsonValue={formatJsonValue}
                                           getSeverityColor={getSeverityColor}
                                           getSeverityIcon={getSeverityIcon}
                                           allConflicts={mergeResult.conflicts}
                                           onBulkResolve={handleBulkResolve}
                                         />
                                      );
                                    })}
                                  </div>
                                </SortableContext>
                              </DndContext>
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