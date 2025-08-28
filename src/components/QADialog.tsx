import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Copy, Download, Languages, FileText, CheckCircle, AlertTriangle, XCircle, Search, Upload, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { extractStringValues, createTranslationIndex, downloadJsonFile, TranslationEntry, detectSchemaType, SchemaType, checkSchemaConsistency, ConsistencyIssue } from '@/lib/translationUtils';
import { validateSyntax, ValidationResult } from '@/lib/schemaUtils';
import { CrowdinExportDialog } from '@/components/CrowdinExportDialog';
import { CrowdinImportDialog } from '@/components/CrowdinImportDialog';
import { ConsistencyConfigDialog } from '@/components/ConsistencyConfigDialog';
import { useConsistencyConfig } from '@/hooks/useConsistencyConfig';
import { useWorkspaces } from '@/hooks/useWorkspaces';

interface QADialogProps {
  schema: string;
  documentName?: string;
  disabled?: boolean;
  selectedDocument?: any;
}

export const QADialog: React.FC<QADialogProps> = ({ 
  schema, 
  documentName = 'schema',
  disabled = false,
  selectedDocument
}) => {
  const [open, setOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [groupingStrategy, setGroupingStrategy] = useState<'property' | 'value'>('property');
  const [filterValue, setFilterValue] = useState('');
  const [crowdinDialogOpen, setCrowdinDialogOpen] = useState(false);
  const [crowdinImportDialogOpen, setCrowdinImportDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  
  const { workspaces } = useWorkspaces();
  const selectedWorkspace = workspaces?.[0]; // Use the first workspace for now
  const { config: consistencyConfig } = useConsistencyConfig();

  const translationData = useMemo(() => {
    try {
      const parsedSchema = JSON.parse(schema);
      const schemaType = detectSchemaType(parsedSchema);
      const entries = extractStringValues(parsedSchema);
      const index = createTranslationIndex(entries);
      const consistencyIssues = checkSchemaConsistency(parsedSchema, consistencyConfig);
      
      return {
        entries,
        index,
        totalStrings: entries.length,
        schemaType,
        consistencyIssues
      };
    } catch (error) {
      console.error('Failed to parse schema for translations:', error);
      return {
        entries: [],
        index: {},
        totalStrings: 0,
        schemaType: 'unknown' as SchemaType,
        consistencyIssues: []
      };
    }
  }, [schema, consistencyConfig]);

  const handleCopyIndex = async () => {
    try {
      const jsonStr = JSON.stringify(translationData.index, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      toast.success('Translation index copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy translation index');
    }
  };

  const handleDownloadIndex = () => {
    try {
      const filename = `${documentName}-translations.json`;
      downloadJsonFile(translationData.index, filename);
      toast.success('Translation index downloaded');
    } catch (error) {
      toast.error('Failed to download translation index');
    }
  };

  const getSchemaTypeDisplay = (type: SchemaType) => {
    switch (type) {
      case 'openapi':
        return { label: 'OpenAPI Specification', color: 'bg-blue-100 text-blue-800' };
      case 'json-schema':
        return { label: 'JSON Schema', color: 'bg-green-100 text-green-800' };
      default:
        return { label: 'Unknown Schema', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const schemaTypeInfo = getSchemaTypeDisplay(translationData.schemaType);

  const groupedEntries = useMemo(() => {
    const groups: Record<string, TranslationEntry[]> = {};
    
    // First, group the entries based on strategy
    translationData.entries.forEach(entry => {
      let groupKey: string;
      
      switch (groupingStrategy) {
        case 'property':
          // Group by the last property name in the path
          groupKey = entry.path.length > 0 ? entry.path[entry.path.length - 1] : 'root';
          break;
        case 'value':
        default:
          // Group by the entire value (no truncation)
          groupKey = entry.value;
          break;
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(entry);
    });
    
    // Then, filter the groups based on the filter value
    if (filterValue.trim()) {
      const filteredGroups: Record<string, TranslationEntry[]> = {};
      const lowerFilter = filterValue.toLowerCase();
      
      Object.entries(groups).forEach(([groupKey, entries]) => {
        if (groupingStrategy === 'property') {
          // For property grouping, check if any entry in the group matches the filter
          const hasMatch = entries.some(entry => {
            const fullPath = entry.path.join('.');
            const lastProperty = entry.path.length > 0 ? entry.path[entry.path.length - 1] : 'root';
            return fullPath.toLowerCase().includes(lowerFilter) || 
                   lastProperty.toLowerCase().includes(lowerFilter);
          });
          
          if (hasMatch) {
            // Only include entries that match the filter
            filteredGroups[groupKey] = entries.filter(entry => {
              const fullPath = entry.path.join('.');
              const lastProperty = entry.path.length > 0 ? entry.path[entry.path.length - 1] : 'root';
              return fullPath.toLowerCase().includes(lowerFilter) || 
                     lastProperty.toLowerCase().includes(lowerFilter);
            });
          }
        } else {
          // For value grouping, filter by the value itself
          if (groupKey.toLowerCase().includes(lowerFilter)) {
            filteredGroups[groupKey] = entries;
          }
        }
      });
      
      return filteredGroups;
    }
    
    return groups;
  }, [translationData.entries, groupingStrategy, filterValue]);

  // Get filter placeholder text based on strategy
  const getFilterPlaceholder = () => {
    switch (groupingStrategy) {
      case 'property':
        return 'Filter by property path (e.g., 200, responses, description)...';
      case 'value':
      default:
        return 'Filter by property value content...';
    }
  };

  // Reset filter when grouping strategy changes
  const handleGroupingChange = (value: 'property' | 'value') => {
    setGroupingStrategy(value);
    setFilterValue(''); // Clear filter when switching strategies
  };
  const availableProperties = useMemo(() => {
    const props = new Set<string>();
    translationData.entries.forEach(entry => {
      if (entry.path.length > 0) {
        props.add(entry.path[entry.path.length - 1]);
      }
    });
    return Array.from(props).sort();
  }, [translationData.entries]);

  const handleValidateSchema = async () => {
    setIsValidating(true);
    try {
      const result = await validateSyntax(schema);
      setValidationResult(result);
    } catch (error) {
      console.error('Validation failed:', error);
      setValidationResult({
        isValid: false,
        errors: [{
          path: 'root',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        }],
        warnings: []
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 h-8"
          disabled={disabled}
        >
          <Languages className="h-4 w-4" />
          <span>QA</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            QA Translation Manager
            {documentName && (
              <Badge variant="secondary" className="ml-2 max-w-[200px] truncate">
                {documentName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 p-6 pt-2 overflow-hidden">
          <div className="space-y-4 h-full flex flex-col max-h-full">
            {/* Summary Card */}
            <Card className="shrink-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">Translation Summary</span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">
                      {translationData.totalStrings} strings found
                    </Badge>
                    <Badge className={schemaTypeInfo.color}>
                      {schemaTypeInfo.label}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mb-3 text-xs text-muted-foreground">
                  {translationData.schemaType === 'openapi' && 
                    'Excludes OpenAPI keywords, HTTP methods, status codes, URLs, and technical identifiers.'
                  }
                  {translationData.schemaType === 'json-schema' && 
                    'Excludes JSON Schema keywords, $-prefixed properties, enum values, and technical identifiers.'
                  }
                  {translationData.schemaType === 'unknown' && 
                    'Basic filtering applied - excludes $-prefixed properties and common technical patterns.'
                  }
                </div>
                 <div className="flex gap-2 flex-wrap">
                   <Button 
                     size="sm" 
                     onClick={handleCopyIndex}
                     className="gap-2"
                   >
                     <Copy className="h-4 w-4" />
                     <span className="hidden sm:inline">Copy Index</span>
                     <span className="sm:hidden">Copy</span>
                   </Button>
                   <Button 
                     size="sm" 
                     variant="outline" 
                     onClick={handleDownloadIndex}
                     className="gap-2"
                   >
                     <Download className="h-4 w-4" />
                     <span className="hidden sm:inline">Download Index</span>
                     <span className="sm:hidden">Download</span>
                   </Button>
                     <Button 
                       size="sm" 
                       variant="outline" 
                       onClick={() => setCrowdinDialogOpen(true)}
                       className="gap-2"
                       disabled={!selectedWorkspace}
                     >
                       <Upload className="h-4 w-4" />
                       <span className="hidden sm:inline">Crowdin Export</span>
                       <span className="sm:hidden">Export</span>
                     </Button>
                     
                     {/* Crowdin Import Button - Show only if document has Crowdin file ID */}
                     {selectedDocument?.crowdin_file_id && (
                       <Button 
                         size="sm" 
                         variant="outline" 
                         onClick={() => setCrowdinImportDialogOpen(true)}
                         className="gap-2"
                         disabled={!selectedWorkspace}
                       >
                         <Download className="h-4 w-4" />
                         <span className="hidden sm:inline">Crowdin Import</span>
                         <span className="sm:hidden">Import</span>
                       </Button>
                     )}
                 </div>
              </CardContent>
            </Card>

            {/* Tabs for different views */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <Tabs defaultValue="grouped" className="h-full flex flex-col">
                <div className="overflow-x-auto shrink-0">
                  <TabsList className="inline-flex w-auto min-w-full">
                    <TabsTrigger value="grouped" className="flex-shrink-0">Grouped View</TabsTrigger>
                    <TabsTrigger value="flat" className="flex-shrink-0">Flat Index</TabsTrigger>
                    <TabsTrigger value="syntax" className="flex-shrink-0">Syntax</TabsTrigger>
                    <TabsTrigger value="consistency" className="flex-shrink-0 relative">
                      Consistency
                      {translationData.consistencyIssues.length > 0 && (
                        <Badge className="ml-1 text-xs px-1 py-0 h-4 bg-orange-500">
                          {translationData.consistencyIssues.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>
              
                <TabsContent value="grouped" className="flex-1 min-h-0 mt-4 data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="mb-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">Group by:</span>
                      <Select value={groupingStrategy} onValueChange={handleGroupingChange}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="property">Property Names</SelectItem>
                          <SelectItem value="value">Property Values</SelectItem>
                        </SelectContent>
                      </Select>
                      {groupingStrategy === 'property' && availableProperties.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {availableProperties.length} unique properties
                        </Badge>
                      )}
                      {groupingStrategy === 'value' && (
                        <Badge variant="outline" className="text-xs">
                          {Object.keys(groupedEntries).length} unique values
                        </Badge>
                      )}
                    </div>
                    
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={getFilterPlaceholder()}
                        value={filterValue}
                        onChange={(e) => setFilterValue(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    {filterValue && Object.keys(groupedEntries).length === 0 && (
                      <div className="text-sm text-muted-foreground">
                        No matches found for "{filterValue}"
                      </div>
                    )}
                  </div>
                  <ScrollArea className="flex-1 min-h-0 w-full">
                    <div className="space-y-4">
                      {Object.entries(groupedEntries)
                        .sort(([, a], [, b]) => b.length - a.length) // Sort by group size, largest first
                        .map(([group, entries]) => (
                        <Card key={group}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                  {groupingStrategy === 'value' && group.length > 60 
                                    ? `${group.substring(0, 60)}...` 
                                    : group}
                                </div>
                                {groupingStrategy === 'property' && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Property: {group}
                                  </div>
                                )}
                                {groupingStrategy === 'value' && entries.length > 1 && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Same value found in {entries.length} places
                                  </div>
                                )}
                              </div>
                              <Badge variant="secondary" className="shrink-0">{entries.length} strings</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              {entries.map((entry, index) => (
                                <div key={index} className="p-2 bg-muted/30 rounded text-sm">
                                  <div className="min-w-0">
                                    <div className="font-mono text-xs text-muted-foreground mb-1 break-all">
                                      {entry.key}
                                    </div>
                                    <div className="text-foreground break-words">
                                      "{entry.value}"
                                    </div>
                                    {groupingStrategy !== 'property' && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Path: {entry.path.join(' → ')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
              </ScrollArea>
                </TabsContent>
              
                <TabsContent value="flat" className="flex-1 min-h-0 mt-4 data-[state=active]:flex data-[state=active]:flex-col">
                  <ScrollArea className="flex-1 min-h-0 w-full">
                <div className="space-y-2">
                  {translationData.entries.map((entry, index) => (
                    <div key={index} className="p-3 border rounded text-sm">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-muted-foreground mb-1 break-all">
                          {entry.key}
                        </div>
                        <div className="text-foreground break-words">
                          "{entry.value}"
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
                </TabsContent>
              
                <TabsContent value="syntax" className="flex-1 min-h-0 mt-4 data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="space-y-4 flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between shrink-0">
                    <h3 className="text-sm font-medium truncate">Schema Validation</h3>
                    <Button 
                      size="sm" 
                      onClick={handleValidateSchema}
                      disabled={isValidating}
                      className="gap-2 shrink-0"
                    >
                      {isValidating ? (
                        <>Validating...</>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Validate
                        </>
                      )}
                    </Button>
                  </div>
                  
                    {validationResult && (
                      <div className="flex-1 min-h-0">
                        <ScrollArea className="h-full w-full">
                    <div className="space-y-4">
                      {/* Validation Summary */}
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            {validationResult.isValid ? (
                              <>
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                <span className="text-green-700 font-medium">Valid Schema</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-5 w-5 text-red-500" />
                                <span className="text-red-700 font-medium">Invalid Schema</span>
                              </>
                            )}
                            <Badge variant="outline" className="ml-auto">
                              {validationResult.errors.length} errors, {validationResult.warnings.length} warnings
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* Errors */}
                      {validationResult.errors.length > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                              <XCircle className="h-4 w-4" />
                              Errors ({validationResult.errors.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              {validationResult.errors.map((error, index) => (
                                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                                  <div className="font-mono text-xs text-red-600 mb-1">
                                    {error.path}
                                  </div>
                                  <div className="text-red-800">
                                    {error.message}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* Warnings */}
                      {validationResult.warnings.length > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                              <AlertTriangle className="h-4 w-4" />
                              Warnings ({validationResult.warnings.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              {validationResult.warnings.map((warning, index) => (
                                <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded text-sm">
                                  <div className="font-mono text-xs text-orange-600 mb-1">
                                    {warning.path}
                                  </div>
                                  <div className="text-orange-800 mb-1">
                                    {warning.message}
                                  </div>
                                  {warning.suggestion && (
                                    <div className="text-orange-700 text-xs italic">
                                      Suggestion: {warning.suggestion}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {validationResult.errors.length === 0 && validationResult.warnings.length === 0 && (
                        <Card>
                          <CardContent className="pt-4">
                            <div className="text-center py-8">
                              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                              <h3 className="text-lg font-medium text-green-700 mb-2">Perfect Schema!</h3>
                              <p className="text-green-600">Your schema follows all best practices and specifications.</p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                        </div>
                        </ScrollArea>
                      </div>
                    )}
                  
                    {!validationResult && (
                      <div className="flex-1 min-h-0 flex items-center justify-center">
                        <Card className="w-full max-w-md">
                          <CardContent className="pt-4">
                            <div className="text-center py-8">
                              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                              <h3 className="text-lg font-medium text-muted-foreground mb-2">Ready to Validate</h3>
                              <p className="text-muted-foreground text-sm">Click the Validate button to check your schema for syntax errors and best practices.</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="consistency" className="flex-1 min-h-0 mt-4 data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Consistency Checks</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfigDialogOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Configure Rules
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 min-h-0 w-full">
                    <div className="space-y-4">
                      {translationData.consistencyIssues.length === 0 ? (
                        <Card>
                          <CardContent className="pt-4">
                            <div className="text-center py-8">
                              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                              <h3 className="text-lg font-medium text-green-700 mb-2">No Consistency Issues Found</h3>
                              <p className="text-green-600">All example values are properly consistent with their enum definitions.</p>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <>
                          {/* Summary Card */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                                <AlertTriangle className="h-4 w-4" />
                                Schema Consistency Issues ({translationData.consistencyIssues.length})
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <p className="text-sm text-muted-foreground mb-3">
                                The following issues were found in your schema that may affect API consistency 
                                and maintainability. Addressing these will improve schema quality.
                              </p>
                            </CardContent>
                          </Card>

                          {/* Issues List */}
                          {translationData.consistencyIssues.map((issue, index) => (
                            <Card key={index}>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center justify-between">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                                    <span className="truncate">
                                      {issue.type === 'missing-enum' ? 'Missing Enum Definition' : 'Parameter Naming Issue'}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="shrink-0">
                                    {issue.type}
                                  </Badge>
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="space-y-3">
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">
                                      Path:
                                    </div>
                                    <div className="font-mono text-sm bg-muted/30 p-2 rounded break-all">
                                      {issue.path}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">
                                      {issue.type === 'missing-enum' ? 'Example Value:' : 'Current Name:'}
                                    </div>
                                    <div className="text-sm bg-orange-50 border border-orange-200 p-2 rounded">
                                      "{issue.value}"
                                    </div>
                                  </div>
                                  
                                  {issue.type === 'missing-enum' && issue.suggestedEnum && (
                                    <div>
                                      <div className="text-xs font-medium text-muted-foreground mb-1">
                                        Suggested Enum:
                                      </div>
                                      <div className="text-sm bg-green-50 border border-green-200 p-2 rounded font-mono">
                                        "enum": [{issue.suggestedEnum.map(val => `"${val}"`).join(', ')}]
                                      </div>
                                    </div>
                                  )}
                                  
                                  {issue.type === 'parameter-naming' && issue.suggestedName && (
                                    <div>
                                      <div className="text-xs font-medium text-muted-foreground mb-1">
                                        Suggested Name (kebab-case):
                                      </div>
                                      <div className="text-sm bg-green-50 border border-green-200 p-2 rounded font-mono">
                                        "{issue.suggestedName}"
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">
                                      Recommendation:
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {issue.message}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
           </div>
         </div>
       </DialogContent>
       
       {/* Crowdin Export Dialog */}
        {selectedWorkspace && selectedDocument && (
          <>
            <CrowdinExportDialog
              open={crowdinDialogOpen}
              onOpenChange={setCrowdinDialogOpen}
              translationData={translationData.index}
              documentName={documentName}
              workspaceId={selectedWorkspace.id}
              documentId={selectedDocument.id}
              onDocumentUpdated={() => {
                // Force a small delay to ensure database has been updated
                setTimeout(() => {
                  window.location.reload();
                }, 500);
              }}
            />
            
            {/* Crowdin Import Dialog */}
            {selectedDocument?.crowdin_file_id && (
              <CrowdinImportDialog
                open={crowdinImportDialogOpen}
                onOpenChange={setCrowdinImportDialogOpen}
                document={selectedDocument}
                onImportConfirm={(importedSchema: any, comparison: any, sourceDocumentName: string) => {
                  // Handle the import confirmation if needed
                  console.log('Import confirmed:', { importedSchema, comparison, sourceDocumentName });
                }}
              />
            )}
          </>
         )}

         {/* Consistency Configuration Dialog */}
         <ConsistencyConfigDialog
           open={configDialogOpen}
           onOpenChange={setConfigDialogOpen}
         />
      </Dialog>
   );
 };