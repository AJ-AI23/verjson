import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Copy, Download, Languages, FileText, CheckCircle, AlertTriangle, XCircle, Search, Upload, Settings, Filter, FilterX, HelpCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useToast } from '@/hooks/use-toast';
import { extractStringValues, createTranslationIndex, downloadJsonFile, TranslationEntry, detectSchemaType, SchemaType, checkSchemaConsistency, ConsistencyIssue } from '@/lib/translationUtils';
import { validateSyntax, ValidationResult } from '@/lib/schemaUtils';
import { CrowdinExportDialog } from '@/components/CrowdinExportDialog';
import { CrowdinImportDialog } from '@/components/CrowdinImportDialog';
import { ConsistencyConfigDialog } from '@/components/ConsistencyConfigDialog';
import { ConsistencyExportDialog } from '@/components/ConsistencyExportDialog';
import { useConsistencyConfig } from '@/hooks/useConsistencyConfig';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { supabase } from '@/integrations/supabase/client';
import { matchesFilter, validateQuery } from '@/lib/filterQueryParser';

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
  const [filterError, setFilterError] = useState<string | null>(null);
  const [inspectionFilters, setInspectionFilters] = useState({
    methods: new Set<string>(),
    contentTypes: new Set<string>(),
    responseCodes: new Set<string>(),
    tags: new Set<string>(),
    componentTypes: new Set<string>(),
    parameterTypes: new Set<string>(),
  });
  const [inspectionSearchQuery, setInspectionSearchQuery] = useState('');
  const [crowdinDialogOpen, setCrowdinDialogOpen] = useState(false);
  const [crowdinImportDialogOpen, setCrowdinImportDialogOpen] = useState(false);
  const [importAvailable, setImportAvailable] = useState(false);
  const [crowdinIntegration, setCrowdinIntegration] = useState<any>(null);

  // Check if Crowdin import is available based on crowdin_integration_id
  useEffect(() => {
    console.log('🔍 QADialog - Checking Crowdin integration for document:', {
      documentId: selectedDocument?.id,
      crowdinIntegrationId: selectedDocument?.crowdin_integration_id,
      crowdinIntegration: selectedDocument?.crowdin_integration,
      selectedDocument: selectedDocument
    });
    
    const hasIntegration = selectedDocument?.crowdin_integration_id;
    setImportAvailable(!!hasIntegration);
    
    if (hasIntegration) {
      setCrowdinIntegration(selectedDocument.crowdin_integration);
    } else {
      setCrowdinIntegration(null);
    }
    
    console.log('📊 QADialog - Import available set to:', !!hasIntegration);
  }, [selectedDocument?.crowdin_integration_id, selectedDocument?.crowdin_integration]);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [isRunningConsistencyCheck, setIsRunningConsistencyCheck] = useState(false);
  const [consistencyRefreshKey, setConsistencyRefreshKey] = useState(0);
  const [consistencyFilters, setConsistencyFilters] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [generatedIndex, setGeneratedIndex] = useState<Record<string, string> | null>(null);
  
  const { workspaces } = useWorkspaces();
  const selectedWorkspace = workspaces?.[0]; // Use the first workspace for now
  const { config: consistencyConfig } = useConsistencyConfig();
  const { toast: showToast } = useToast();

  // Force refresh when configuration changes
  React.useEffect(() => {
    console.log('Configuration changed, forcing consistency refresh:', consistencyConfig);
    setConsistencyRefreshKey(prev => prev + 1);
  }, [consistencyConfig]);

  const translationData = useMemo(() => {
    console.log('=== QADialog - Recalculating translation data ===');
    console.log('Schema length:', schema.length);
    console.log('Config:', consistencyConfig);
    console.log('Refresh key:', consistencyRefreshKey);
    
    try {
      const parsedSchema = JSON.parse(schema);
      const schemaType = detectSchemaType(parsedSchema);
      const entries = extractStringValues(parsedSchema);
      const index = createTranslationIndex(entries);
      
      console.log('About to call checkSchemaConsistency...');
      const consistencyIssues = checkSchemaConsistency(parsedSchema, consistencyConfig);
      console.log('checkSchemaConsistency returned:', consistencyIssues.length, 'issues');
      
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
  }, [schema, consistencyConfig, consistencyRefreshKey]);

  const handleManualConsistencyCheck = async () => {
    setIsRunningConsistencyCheck(true);
    console.log('=== Manual consistency check triggered ===');
    
    try {
      // Force a refresh by updating the key
      setConsistencyRefreshKey(prev => prev + 1);
      
      setTimeout(() => {
        setIsRunningConsistencyCheck(false);
        const issueCount = translationData.consistencyIssues.length;
        if (issueCount > 0) {
          showToast({
            title: "Consistency Check Complete",
            description: `Found ${issueCount} consistency issue${issueCount === 1 ? '' : 's'}.`,
            variant: "destructive",
          });
        } else {
          showToast({
            title: "Consistency Check Complete",
            description: "No consistency issues found!",
          });
        }
      }, 100);
    } catch (error) {
      console.error('Manual consistency check failed:', error);
      setIsRunningConsistencyCheck(false);
      showToast({
        title: "Consistency Check Failed",
        description: "Failed to run consistency check. Please check your schema format.",
        variant: "destructive",
      });
    }
  };

  // Show toast when consistency violations are detected
  React.useEffect(() => {
    console.log('Consistency check result:', translationData.consistencyIssues.length, 'issues found');
    console.log('Issues:', translationData.consistencyIssues);
    
    // Only show toast if dialog is open and there are issues
    if (open && translationData.consistencyIssues.length > 0) {
      console.log('Showing consistency violations toast');
      showToast({
        title: "Consistency Violations Detected",
        description: `Found ${translationData.consistencyIssues.length} consistency issue${translationData.consistencyIssues.length === 1 ? '' : 's'} in your schema.`,
        variant: "destructive",
      });
    }
  }, [translationData.consistencyIssues.length, open, showToast]);

  // Also show configuration loading info
  React.useEffect(() => {
    console.log('Current consistency config in QADialog:', consistencyConfig);
  }, [consistencyConfig]);

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
    
    // Then, filter the groups based on the filter value using the query parser
    if (filterValue.trim()) {
      try {
        const filteredGroups: Record<string, TranslationEntry[]> = {};
        
        Object.entries(groups).forEach(([groupKey, entries]) => {
          if (groupingStrategy === 'property') {
            // Filter entries whose paths match the query
            const matchingEntries = entries.filter(entry => {
              const fullPath = entry.path.join('.');
              return matchesFilter(filterValue, fullPath);
            });
            
            if (matchingEntries.length > 0) {
              filteredGroups[groupKey] = matchingEntries;
            }
          } else {
            // For value grouping, check the value itself
            if (matchesFilter(filterValue, groupKey)) {
              filteredGroups[groupKey] = entries;
            }
          }
        });
        
        return filteredGroups;
      } catch (error) {
        console.error('Filter error:', error);
        return groups;
      }
    }
    
    return groups;
  }, [translationData.entries, groupingStrategy, filterValue]);

  // Get available issue types for filtering
  const availableIssueTypes = useMemo(() => {
    const types = new Set<string>();
    translationData.consistencyIssues.forEach(issue => {
      types.add(issue.type);
    });
    return Array.from(types).sort();
  }, [translationData.consistencyIssues]);

  // Filter consistency issues based on selected filters
  const filteredConsistencyIssues = useMemo(() => {
    if (consistencyFilters.size === 0) {
      return translationData.consistencyIssues;
    }
    return translationData.consistencyIssues.filter(issue => 
      consistencyFilters.has(issue.type)
    );
  }, [translationData.consistencyIssues, consistencyFilters]);

  // Handle filter toggle
  const toggleFilter = (type: string) => {
    const newFilters = new Set(consistencyFilters);
    if (newFilters.has(type)) {
      newFilters.delete(type);
    } else {
      newFilters.add(type);
    }
    setConsistencyFilters(newFilters);
  };

  // Clear all filters
  const clearFilters = () => {
    setConsistencyFilters(new Set());
  };

  // Get filter placeholder text based on strategy
  const getFilterPlaceholder = () => {
    switch (groupingStrategy) {
      case 'property':
        return 'Filter paths (e.g., *.description AND NOT *.tag*)...';
      case 'value':
      default:
        return 'Filter values (e.g., "error" OR "warning")...';
    }
  };

  // Reset filter when grouping strategy changes
  const handleGroupingChange = (value: 'property' | 'value') => {
    setGroupingStrategy(value);
    setFilterValue(''); // Clear filter when switching strategies
    setFilterError(null); // Clear any filter errors
  };

  // Validate filter query as user types
  useEffect(() => {
    if (filterValue.trim()) {
      const error = validateQuery(filterValue);
      setFilterError(error);
    } else {
      setFilterError(null);
    }
  }, [filterValue]);

  // Quick filter helpers
  const quickFilters = [
    { label: 'AND', insert: ' AND ' },
    { label: 'OR', insert: ' OR ' },
    { label: 'NOT', insert: ' NOT ' },
    { label: '*', insert: '*' },
    { label: '( )', insert: '( )' }
  ];

  const sampleFilters = [
    { label: 'Find descriptions and examples', value: '*.description AND *.example' },
    { label: 'Exclude tags', value: 'NOT *.tag*' },
    { label: 'Find paths or components', value: '"paths.*" OR "components.*"' },
    { label: 'Multiple exclusions', value: 'description AND NOT (deprecated OR internal)' },
    { label: 'Descriptions without examples', value: '*.description AND NOT *.example' }
  ];

  const insertQuickFilter = (text: string) => {
    setFilterValue(prev => prev + text);
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

  // Extract inspection data from schema
  const inspectionData = useMemo(() => {
    try {
      const parsedSchema = JSON.parse(schema);
      const data = {
        methods: new Set<string>(),
        contentTypes: new Set<string>(),
        responseCodes: new Set<string>(),
        tags: new Set<string>(),
        componentTypes: new Set<string>(),
        parameterTypes: new Set<string>(),
        operationIds: [] as Array<{ id: string; method: string; path: string }>,
        paths: [] as string[],
        components: [] as Array<{ type: string; name: string }>,
        securities: new Set<string>(),
      };

      // Extract from paths
      if (parsedSchema.paths) {
        Object.entries(parsedSchema.paths).forEach(([path, pathItem]: [string, any]) => {
          data.paths.push(path);
          
          ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'].forEach(method => {
            if (pathItem[method]) {
              const operation = pathItem[method];
              data.methods.add(method.toUpperCase());
              
              if (operation.operationId) {
                data.operationIds.push({
                  id: operation.operationId,
                  method: method.toUpperCase(),
                  path
                });
              }
              
              if (operation.tags) {
                operation.tags.forEach((tag: string) => data.tags.add(tag));
              }
              
              if (operation.parameters) {
                operation.parameters.forEach((param: any) => {
                  if (param.in) {
                    data.parameterTypes.add(param.in);
                  }
                });
              }
              
              if (operation.requestBody?.content) {
                Object.keys(operation.requestBody.content).forEach(ct => 
                  data.contentTypes.add(ct)
                );
              }
              
              if (operation.responses) {
                Object.entries(operation.responses).forEach(([code, response]: [string, any]) => {
                  data.responseCodes.add(code);
                  if (response.content) {
                    Object.keys(response.content).forEach(ct => 
                      data.contentTypes.add(ct)
                    );
                  }
                });
              }
              
              if (operation.security) {
                operation.security.forEach((secReq: any) => {
                  Object.keys(secReq).forEach(secName => 
                    data.securities.add(secName)
                  );
                });
              }
            }
          });
        });
      }

      // Extract from components
      if (parsedSchema.components) {
        Object.entries(parsedSchema.components).forEach(([type, items]: [string, any]) => {
          data.componentTypes.add(type);
          if (typeof items === 'object' && items !== null) {
            Object.keys(items).forEach(name => {
              data.components.push({ type, name });
            });
          }
        });
      }

      return data;
    } catch (error) {
      console.error('Failed to extract inspection data:', error);
      return {
        methods: new Set<string>(),
        contentTypes: new Set<string>(),
        responseCodes: new Set<string>(),
        tags: new Set<string>(),
        componentTypes: new Set<string>(),
        parameterTypes: new Set<string>(),
        operationIds: [],
        paths: [],
        components: [],
        securities: new Set<string>(),
      };
    }
  }, [schema]);

  // Filter inspection results
  const filteredInspectionResults = useMemo(() => {
    try {
      const parsedSchema = JSON.parse(schema);
      let filteredOperations = [...inspectionData.operationIds];
      
      // Apply operation filters
      if (inspectionFilters.methods.size > 0) {
        filteredOperations = filteredOperations.filter(op => 
          inspectionFilters.methods.has(op.method)
        );
      }

      if (inspectionFilters.tags.size > 0) {
        filteredOperations = filteredOperations.filter(op => {
          const pathItem = parsedSchema.paths?.[op.path];
          const operation = pathItem?.[op.method.toLowerCase()];
          return operation?.tags?.some((tag: string) => inspectionFilters.tags.has(tag));
        });
      }

      if (inspectionFilters.parameterTypes.size > 0) {
        filteredOperations = filteredOperations.filter(op => {
          const pathItem = parsedSchema.paths?.[op.path];
          const operation = pathItem?.[op.method.toLowerCase()];
          return operation?.parameters?.some((param: any) => 
            inspectionFilters.parameterTypes.has(param.in)
          );
        });
      }

      if (inspectionFilters.responseCodes.size > 0) {
        filteredOperations = filteredOperations.filter(op => {
          const pathItem = parsedSchema.paths?.[op.path];
          const operation = pathItem?.[op.method.toLowerCase()];
          return operation?.responses && 
            Object.keys(operation.responses).some(code => 
              inspectionFilters.responseCodes.has(code)
            );
        });
      }

      if (inspectionFilters.contentTypes.size > 0) {
        filteredOperations = filteredOperations.filter(op => {
          const pathItem = parsedSchema.paths?.[op.path];
          const operation = pathItem?.[op.method.toLowerCase()];
          
          const requestContentTypes = operation?.requestBody?.content ? 
            Object.keys(operation.requestBody.content) : [];
          
          const responseContentTypes = operation?.responses ? 
            Object.values(operation.responses).flatMap((resp: any) => 
              resp.content ? Object.keys(resp.content) : []
            ) : [];
          
          const allContentTypes = [...requestContentTypes, ...responseContentTypes];
          return allContentTypes.some(ct => inspectionFilters.contentTypes.has(ct));
        });
      }

      // Apply search query to operations
      if (inspectionSearchQuery.trim()) {
        const query = inspectionSearchQuery.toLowerCase();
        filteredOperations = filteredOperations.filter(op => 
          op.id.toLowerCase().includes(query) || 
          op.path.toLowerCase().includes(query) ||
          op.method.toLowerCase().includes(query)
        );
      }

      // Derive related data from filtered operations
      const hasOperationFilters = inspectionFilters.methods.size > 0 || 
        inspectionFilters.tags.size > 0 ||
        inspectionFilters.contentTypes.size > 0 ||
        inspectionFilters.responseCodes.size > 0 ||
        inspectionFilters.parameterTypes.size > 0;

      let filteredPaths = [...inspectionData.paths];
      let filteredComponents = [...inspectionData.components];
      let filteredSecurities = Array.from(inspectionData.securities);

      // If operation filters are active, only show related paths and components
      if (hasOperationFilters || inspectionSearchQuery.trim()) {
        // Get paths that have filtered operations
        const pathsWithOperations = new Set(filteredOperations.map(op => op.path));
        filteredPaths = inspectionData.paths.filter(p => pathsWithOperations.has(p));

        // Extract referenced components from filtered operations
        const referencedComponents = new Set<string>();
        const referencedSecurities = new Set<string>();
        
        filteredOperations.forEach(op => {
          const pathItem = parsedSchema.paths?.[op.path];
          const operation = pathItem?.[op.method.toLowerCase()];
          
          if (!operation) return;

          // Helper to extract $ref components
          const extractRefs = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            
            if (obj.$ref && typeof obj.$ref === 'string') {
              // Extract component reference like "#/components/schemas/Pet"
              const match = obj.$ref.match(/#\/components\/([^\/]+)\/([^\/]+)/);
              if (match) {
                referencedComponents.add(`${match[1]}:${match[2]}`);
              }
            }
            
            // Recursively check nested objects and arrays
            Object.values(obj).forEach(value => {
              if (typeof value === 'object' && value !== null) {
                extractRefs(value);
              }
            });
          };

          // Extract from parameters
          if (operation.parameters) {
            operation.parameters.forEach((param: any) => extractRefs(param));
          }

          // Extract from request body
          if (operation.requestBody) {
            extractRefs(operation.requestBody);
          }

          // Extract from responses
          if (operation.responses) {
            Object.values(operation.responses).forEach((response: any) => {
              extractRefs(response);
            });
          }

          // Extract security schemes
          if (operation.security) {
            operation.security.forEach((secReq: any) => {
              Object.keys(secReq).forEach(secName => referencedSecurities.add(secName));
            });
          }
        });

        // Filter components to only those referenced
        filteredComponents = inspectionData.components.filter(comp => 
          referencedComponents.has(`${comp.type}:${comp.name}`)
        );

        // Filter securities to only those referenced
        filteredSecurities = Array.from(inspectionData.securities).filter(sec => 
          referencedSecurities.has(sec)
        );
      }

      // Apply component type filter if no operation filters are active
      if (!hasOperationFilters && inspectionFilters.componentTypes.size > 0) {
        filteredComponents = filteredComponents.filter(comp => 
          inspectionFilters.componentTypes.has(comp.type)
        );
      }

      // Apply search query to remaining items if not already filtered by operations
      if (inspectionSearchQuery.trim() && !hasOperationFilters) {
        const query = inspectionSearchQuery.toLowerCase();
        filteredPaths = filteredPaths.filter(p => p.toLowerCase().includes(query));
        filteredComponents = filteredComponents.filter(c => 
          c.name.toLowerCase().includes(query) || c.type.toLowerCase().includes(query)
        );
        filteredSecurities = filteredSecurities.filter(s => s.toLowerCase().includes(query));
      }

      return {
        operationIds: filteredOperations,
        paths: filteredPaths,
        components: filteredComponents,
        securities: filteredSecurities,
      };
    } catch (error) {
      console.error('Failed to filter inspection results:', error);
      return {
        operationIds: [],
        paths: [],
        components: [],
        securities: [],
      };
    }
  }, [inspectionData, inspectionFilters, inspectionSearchQuery, schema]);

  const toggleInspectionFilter = (category: keyof typeof inspectionFilters, value: string) => {
    setInspectionFilters(prev => {
      const newFilters = { ...prev };
      const filterSet = new Set(prev[category]);
      if (filterSet.has(value)) {
        filterSet.delete(value);
      } else {
        filterSet.add(value);
      }
      newFilters[category] = filterSet;
      return newFilters;
    });
  };

  const clearInspectionFilters = () => {
    setInspectionFilters({
      methods: new Set(),
      contentTypes: new Set(),
      responseCodes: new Set(),
      tags: new Set(),
      componentTypes: new Set(),
      parameterTypes: new Set(),
    });
    setInspectionSearchQuery('');
  };

  const hasActiveInspectionFilters = 
    inspectionFilters.methods.size > 0 ||
    inspectionFilters.contentTypes.size > 0 ||
    inspectionFilters.responseCodes.size > 0 ||
    inspectionFilters.tags.size > 0 ||
    inspectionFilters.componentTypes.size > 0 ||
    inspectionFilters.parameterTypes.size > 0 ||
    inspectionSearchQuery.trim() !== '';

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

  const handleExportConsistencyResults = (useFilter: boolean) => {
    try {
      const issuesToExport = useFilter ? filteredConsistencyIssues : translationData.consistencyIssues;
      const exportData = {
        document: documentName,
        timestamp: new Date().toISOString(),
        summary: {
          totalIssues: issuesToExport.length,
          issueTypes: [...new Set(issuesToExport.map(i => i.type))].length,
          schemaType: translationData.schemaType,
          filterApplied: useFilter,
          activeFilters: useFilter ? Array.from(consistencyFilters) : null
        },
        configuration: consistencyConfig,
        issues: issuesToExport.map(issue => ({
          type: issue.type,
          severity: issue.severity,
          message: issue.message,
          path: issue.path,
          currentName: issue.value,
          suggestedName: issue.suggestedName,
          convention: issue.convention,
          parameterType: issue.parameterType,
          suggestion: issue.suggestion,
          suggestedEnum: issue.suggestedEnum,
          rule: issue.rule
        }))
      };

      const filterSuffix = useFilter ? '-filtered' : '';
      const filename = `${documentName}-consistency-results${filterSuffix}.json`;
      downloadJsonFile(exportData, filename);
      toast.success(`Exported ${issuesToExport.length} consistency issue${issuesToExport.length !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export consistency results');
    }
  };

  const handleExportGroupedResults = () => {
    try {
      const exportData = {
        document: documentName,
        timestamp: new Date().toISOString(),
        summary: {
          totalGroups: Object.keys(groupedEntries).length,
          totalStrings: Object.values(groupedEntries).reduce((sum, entries) => sum + entries.length, 0),
          groupingStrategy,
          filterApplied: filterValue.trim() !== '',
          filter: filterValue.trim() || null,
          schemaType: translationData.schemaType
        },
        groups: Object.entries(groupedEntries)
          .sort(([, a], [, b]) => b.length - a.length)
          .map(([groupKey, entries]) => ({
            groupKey,
            count: entries.length,
            entries: entries.map(entry => ({
              key: entry.key,
              value: entry.value,
              path: entry.path
            }))
          }))
      };

      const filename = `${documentName}-grouped-results.json`;
      downloadJsonFile(exportData, filename);
      toast.success('Grouped results exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export grouped results');
    }
  };

  const handleGenerateIndex = () => {
    try {
      const index: Record<string, string> = {};
      
      Object.values(groupedEntries).forEach(entries => {
        entries.forEach(entry => {
          index[entry.key] = entry.value;
        });
      });
      
      setGeneratedIndex(index);
      toast.success(`Generated translation index with ${Object.keys(index).length} entries`);
    } catch (error) {
      console.error('Generate index failed:', error);
      toast.error('Failed to generate translation index');
    }
  };

  const handleDiscardIndex = () => {
    setGeneratedIndex(null);
    toast.success('Translation index discarded');
  };

  const handleCopyGeneratedIndex = async () => {
    if (!generatedIndex) return;
    try {
      const jsonStr = JSON.stringify(generatedIndex, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      toast.success('Translation index copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy translation index');
    }
  };

  const handleDownloadGeneratedIndex = () => {
    if (!generatedIndex) return;
    try {
      const filename = `${documentName}-translations.json`;
      downloadJsonFile(generatedIndex, filename);
      toast.success('Translation index downloaded');
    } catch (error) {
      toast.error('Failed to download translation index');
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
            Quality Assurance
            {documentName && (
              <Badge variant="secondary" className="ml-2 max-w-[200px] truncate">
                {documentName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 p-6 pt-2 overflow-hidden">
          <div className="space-y-4 h-full flex flex-col max-h-full">
            {/* Summary Card - Show only when index is generated */}
            {generatedIndex && (
              <Card className="shrink-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">Translation Summary</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline">
                        {Object.keys(generatedIndex).length} strings in index
                      </Badge>
                      <Badge className={schemaTypeInfo.color}>
                        {schemaTypeInfo.label}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-3 text-xs text-muted-foreground">
                    Translation index generated from filtered and grouped results.
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      size="sm" 
                      onClick={handleCopyGeneratedIndex}
                      className="gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      <span className="hidden sm:inline">Copy Index</span>
                      <span className="sm:hidden">Copy</span>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleDownloadGeneratedIndex}
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
                    
                    {/* Crowdin Import Button - Show if import is available */}
                    {importAvailable && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setCrowdinImportDialogOpen(true)}
                        className="gap-2"
                        disabled={!selectedWorkspace}
                      >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">
                          Crowdin Import
                        </span>
                        <span className="sm:hidden">Import</span>
                      </Button>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={handleDiscardIndex}
                      className="gap-2 ml-auto"
                    >
                      <XCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Discard Index</span>
                      <span className="sm:hidden">Discard</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabs for different views */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <Tabs defaultValue="grouped" className="h-full flex flex-col">
                <div className="overflow-x-auto shrink-0">
                  <TabsList className="inline-flex w-auto min-w-full">
                    <TabsTrigger value="grouped" className="flex-shrink-0">Grouped View</TabsTrigger>
                    <TabsTrigger value="inspection" className="flex-shrink-0">Inspection</TabsTrigger>
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
                      <div className="flex gap-2 ml-auto">
                        <Button 
                          size="sm" 
                          variant="default" 
                          onClick={handleGenerateIndex}
                          className="gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          Generate Index
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={handleExportGroupedResults}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Export Results
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={getFilterPlaceholder()}
                          value={filterValue}
                          onChange={(e) => setFilterValue(e.target.value)}
                          className={`pl-10 pr-10 font-mono ${filterError ? 'border-destructive' : ''}`}
                        />
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                            >
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80" align="end">
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">Filter Syntax</h4>
                              <div className="space-y-1 text-sm">
                                <p><strong>AND</strong> - Combine conditions (both must match)</p>
                                <p><strong>OR</strong> - Either condition matches</p>
                                <p><strong>NOT</strong> or <strong>-</strong> - Exclude patterns</p>
                                <p><strong>*</strong> - Wildcard (matches any characters)</p>
                                <p><strong>" "</strong> - Exact substring match</p>
                                <p><strong>( )</strong> - Group conditions</p>
                              </div>
                              <div className="pt-2 border-t">
                                <p className="text-xs text-muted-foreground">
                                  Example: *.description AND NOT *.tag*
                                </p>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </div>

                      {/* Quick Insert Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Quick insert:</span>
                        {quickFilters.map((filter) => (
                          <Button
                            key={filter.label}
                            variant="outline"
                            size="sm"
                            onClick={() => insertQuickFilter(filter.insert)}
                            className="h-6 px-2 text-xs font-mono"
                          >
                            {filter.label}
                          </Button>
                        ))}
                        <Select value={filterValue} onValueChange={setFilterValue}>
                          <SelectTrigger className="w-auto h-6 px-2 text-xs gap-1 ml-auto">
                            <Sparkles className="h-3 w-3" />
                            <span>Samples</span>
                          </SelectTrigger>
                          <SelectContent>
                            {sampleFilters.map((sample) => (
                              <SelectItem key={sample.value} value={sample.value} className="text-xs">
                                {sample.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Error Message */}
                      {filterError && (
                        <div className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {filterError}
                        </div>
                      )}

                      {/* No Results Message */}
                      {filterValue && !filterError && Object.keys(groupedEntries).length === 0 && (
                        <div className="text-sm text-muted-foreground">
                          No matches found for "{filterValue}"
                        </div>
                      )}
                    </div>
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
              
                <TabsContent value="inspection" className="flex-1 min-h-0 mt-4 data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="flex flex-col gap-4 flex-1 min-h-0">
                    {/* Filter Controls */}
                    <div className="space-y-4 shrink-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">OpenAPI Specification Inspector</h3>
                        {hasActiveInspectionFilters && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearInspectionFilters}
                            className="h-8 gap-2"
                          >
                            <FilterX className="h-4 w-4" />
                            Clear Filters
                          </Button>
                        )}
                      </div>

                      {/* Search Query */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search operations, paths, components..."
                          value={inspectionSearchQuery}
                          onChange={(e) => setInspectionSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>

                      {/* Filters Accordion */}
                      <Accordion type="single" collapsible defaultValue="filters">
                        <AccordionItem value="filters">
                          <AccordionTrigger>
                            <div className="flex items-center gap-2">
                              <Filter className="h-4 w-4" />
                              <span>Filters</span>
                              {hasActiveInspectionFilters && (
                                <Badge variant="secondary" className="ml-2">
                                  {inspectionFilters.methods.size + 
                                   inspectionFilters.tags.size + 
                                   inspectionFilters.contentTypes.size + 
                                   inspectionFilters.responseCodes.size + 
                                   inspectionFilters.componentTypes.size + 
                                   inspectionFilters.parameterTypes.size} active
                                </Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                              {/* HTTP Methods */}
                              {inspectionData.methods.size > 0 && (
                                <Card className="p-3">
                                  <div className="text-xs font-medium mb-2 text-muted-foreground">HTTP Methods</div>
                                  <div className="flex flex-wrap gap-1">
                                    {Array.from(inspectionData.methods).sort().map(method => (
                                      <Badge
                                        key={method}
                                        variant={inspectionFilters.methods.has(method) ? "default" : "outline"}
                                        className="cursor-pointer text-xs"
                                        onClick={() => toggleInspectionFilter('methods', method)}
                                      >
                                        {method}
                                      </Badge>
                                    ))}
                                  </div>
                                </Card>
                              )}

                              {/* Tags */}
                              {inspectionData.tags.size > 0 && (
                                <Card className="p-3">
                                  <div className="text-xs font-medium mb-2 text-muted-foreground">Tags</div>
                                  <div className="flex flex-wrap gap-1">
                                    {Array.from(inspectionData.tags).sort().map(tag => (
                                      <Badge
                                        key={tag}
                                        variant={inspectionFilters.tags.has(tag) ? "default" : "outline"}
                                        className="cursor-pointer text-xs"
                                        onClick={() => toggleInspectionFilter('tags', tag)}
                                      >
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </Card>
                              )}

                              {/* Content Types */}
                              {inspectionData.contentTypes.size > 0 && (
                                <Card className="p-3">
                                  <div className="text-xs font-medium mb-2 text-muted-foreground">Content Types</div>
                                  <div className="flex flex-wrap gap-1">
                                    {Array.from(inspectionData.contentTypes).sort().map(ct => (
                                      <Badge
                                        key={ct}
                                        variant={inspectionFilters.contentTypes.has(ct) ? "default" : "outline"}
                                        className="cursor-pointer text-xs"
                                        onClick={() => toggleInspectionFilter('contentTypes', ct)}
                                      >
                                        {ct}
                                      </Badge>
                                    ))}
                                  </div>
                                </Card>
                              )}

                              {/* Response Codes */}
                              {inspectionData.responseCodes.size > 0 && (
                                <Card className="p-3">
                                  <div className="text-xs font-medium mb-2 text-muted-foreground">Response Codes</div>
                                  <div className="flex flex-wrap gap-1">
                                    {Array.from(inspectionData.responseCodes).sort().map(code => (
                                      <Badge
                                        key={code}
                                        variant={inspectionFilters.responseCodes.has(code) ? "default" : "outline"}
                                        className="cursor-pointer text-xs"
                                        onClick={() => toggleInspectionFilter('responseCodes', code)}
                                      >
                                        {code}
                                      </Badge>
                                    ))}
                                  </div>
                                </Card>
                              )}

                              {/* Component Types */}
                              {inspectionData.componentTypes.size > 0 && (
                                <Card className="p-3">
                                  <div className="text-xs font-medium mb-2 text-muted-foreground">Component Types</div>
                                  <div className="flex flex-wrap gap-1">
                                    {Array.from(inspectionData.componentTypes).sort().map(type => (
                                      <Badge
                                        key={type}
                                        variant={inspectionFilters.componentTypes.has(type) ? "default" : "outline"}
                                        className="cursor-pointer text-xs"
                                        onClick={() => toggleInspectionFilter('componentTypes', type)}
                                      >
                                        {type}
                                      </Badge>
                                    ))}
                                  </div>
                                </Card>
                              )}

                              {/* Parameter Types */}
                              {inspectionData.parameterTypes.size > 0 && (
                                <Card className="p-3">
                                  <div className="text-xs font-medium mb-2 text-muted-foreground">Parameter Types</div>
                                  <div className="flex flex-wrap gap-1">
                                    {Array.from(inspectionData.parameterTypes).sort().map(type => (
                                      <Badge
                                        key={type}
                                        variant={inspectionFilters.parameterTypes.has(type) ? "default" : "outline"}
                                        className="cursor-pointer text-xs"
                                        onClick={() => toggleInspectionFilter('parameterTypes', type)}
                                      >
                                        {type}
                                      </Badge>
                                    ))}
                                  </div>
                                </Card>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>

                    {/* Results */}
                    <ScrollArea className="flex-1 min-h-0 w-full">
                      <div className="space-y-4">
                        {/* Operations */}
                        {filteredInspectionResults.operationIds.length > 0 && (
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">
                                Operations ({filteredInspectionResults.operationIds.length})
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                {filteredInspectionResults.operationIds.map((op, idx) => (
                                  <div key={idx} className="p-2 bg-muted/30 rounded text-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="outline" className="font-mono text-xs">
                                        {op.method}
                                      </Badge>
                                      <span className="font-mono text-xs text-muted-foreground">
                                        {op.path}
                                      </span>
                                    </div>
                                    <div className="font-medium">
                                      {op.id}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Paths */}
                        {filteredInspectionResults.paths.length > 0 && inspectionFilters.methods.size === 0 && (
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">
                                Paths ({filteredInspectionResults.paths.length})
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-1">
                                {filteredInspectionResults.paths.map((path, idx) => (
                                  <div key={idx} className="p-2 bg-muted/30 rounded">
                                    <span className="font-mono text-xs">
                                      {path}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Components */}
                        {filteredInspectionResults.components.length > 0 && (
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">
                                Components ({filteredInspectionResults.components.length})
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                {filteredInspectionResults.components.map((comp, idx) => (
                                  <div key={idx} className="p-2 bg-muted/30 rounded text-sm">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary" className="text-xs">
                                        {comp.type}
                                      </Badge>
                                      <span className="font-medium">
                                        {comp.name}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Securities */}
                        {filteredInspectionResults.securities.length > 0 && (
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">
                                Security Schemes ({filteredInspectionResults.securities.length})
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex flex-wrap gap-1">
                                {filteredInspectionResults.securities.map((sec, idx) => (
                                  <Badge key={idx} variant="outline">
                                    {sec}
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* No Results */}
                        {filteredInspectionResults.operationIds.length === 0 &&
                         filteredInspectionResults.paths.length === 0 &&
                         filteredInspectionResults.components.length === 0 &&
                         filteredInspectionResults.securities.length === 0 && (
                          <Card>
                            <CardContent className="pt-4">
                              <div className="text-center py-8">
                                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                                  No Results Found
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                  Try adjusting your filters or search query.
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
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
                     <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExportDialogOpen(true)}
                          className="flex items-center gap-2"
                          disabled={translationData.consistencyIssues.length === 0}
                        >
                          <Download className="h-4 w-4" />
                          Export Results
                        </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={handleManualConsistencyCheck}
                         disabled={isRunningConsistencyCheck}
                         className="flex items-center gap-2"
                       >
                         {isRunningConsistencyCheck ? (
                           <>Running...</>
                         ) : (
                           <>
                             <CheckCircle className="h-4 w-4" />
                             Run Check
                           </>
                         )}
                       </Button>
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

                          {/* Filter Controls */}
                          {availableIssueTypes.length > 0 && (
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center justify-between">
                                  <span className="flex items-center gap-2">
                                    <Filter className="h-4 w-4" />
                                    Filters
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setShowFilters(!showFilters)}
                                      className="text-xs"
                                    >
                                      {showFilters ? 'Hide' : 'Show'} Filters
                                    </Button>
                                    {consistencyFilters.size > 0 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearFilters}
                                        className="text-xs text-muted-foreground hover:text-foreground"
                                      >
                                        <FilterX className="h-3 w-3 mr-1" />
                                        Clear
                                      </Button>
                                    )}
                                  </div>
                                </CardTitle>
                              </CardHeader>
                              {showFilters && (
                                <CardContent className="pt-0">
                                  <div className="space-y-3">
                                    <div className="text-xs text-muted-foreground">
                                      Filter by issue type ({consistencyFilters.size > 0 ? `${filteredConsistencyIssues.length}/${translationData.consistencyIssues.length}` : `${translationData.consistencyIssues.length}`} issues shown):
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {availableIssueTypes.map(type => {
                                        const count = translationData.consistencyIssues.filter(issue => issue.type === type).length;
                                        const isActive = consistencyFilters.has(type);
                                        return (
                                          <Button
                                            key={type}
                                            variant={isActive ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => toggleFilter(type)}
                                            className="text-xs h-7"
                                          >
                                            {type.replace('-', ' ')}
                                            <Badge 
                                              variant={isActive ? "secondary" : "outline"} 
                                              className="ml-1 text-xs px-1 h-4"
                                            >
                                              {count}
                                            </Badge>
                                          </Button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </CardContent>
                              )}
                            </Card>
                          )}

                          {/* Issues List */}
                          {filteredConsistencyIssues.map((issue, index) => (
                            <Card key={index}>
                              <CardHeader className="pb-3">
                               <CardTitle className="text-sm flex items-center justify-between">
                                   <div className="flex items-center gap-2 min-w-0">
                                     <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                                     <span className="truncate">
                                       {issue.type === 'missing-enum' ? 'Missing Enum Definition' : 
                                        issue.type === 'parameter-naming' ? 
                                          `${issue.parameterType === 'path' ? 'Path' : issue.parameterType === 'query' ? 'Query' : issue.parameterType?.charAt(0).toUpperCase() + issue.parameterType?.slice(1) || 'Query'} Parameter Naming Issue` :
                                        issue.type === 'semantic-rule' ? 
                                          `${issue.rule || 'Semantic Rule Violation'}` :
                                        'Consistency Issue'}
                                     </span>
                                   </div>
                                   <div className="flex items-center gap-2">
                                     {issue.type === 'parameter-naming' && issue.parameterType && (
                                       <Badge variant="secondary" className="text-xs">
                                         {issue.parameterType === 'path' ? 'Path' : 
                                          issue.parameterType === 'query' ? 'Query' : 
                                          issue.parameterType?.charAt(0).toUpperCase() + issue.parameterType?.slice(1)}
                                       </Badge>
                                     )}
                                     <Badge variant="outline" className="shrink-0">
                                       {issue.type}
                                     </Badge>
                                   </div>
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
                                  
                                  {/* Display current value/name or structure */}
                                  {issue.type === 'duplicate-component' || issue.type === 'inline-structure' ? (
                                    issue.details && (
                                      <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-1">
                                          Identified Structure:
                                        </div>
                                        <div className="text-xs bg-muted/50 border p-2 rounded font-mono whitespace-pre overflow-x-auto">
                                          {issue.details.replace(/```\n?/g, '')}
                                        </div>
                                      </div>
                                    )
                                  ) : issue.value ? (
                                    <div>
                                      <div className="text-xs font-medium text-muted-foreground mb-1">
                                        {issue.type === 'missing-enum' ? 'Example Value:' : 'Current Name:'}
                                      </div>
                                      <div className="text-sm bg-orange-50 border border-orange-200 p-2 rounded">
                                        "{issue.value}"
                                      </div>
                                    </div>
                                  ) : null}
                                  
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
                                  
                                  {/* Display suggested name for all naming-related issues */}
                                  {(issue.type === 'parameter-naming' || 
                                    issue.type === 'component-naming' || 
                                    issue.type === 'endpoint-naming' || 
                                    issue.type === 'property-naming') && issue.suggestedName && (
                                     <div>
                                       <div className="text-xs font-medium text-muted-foreground mb-1">
                                         Suggested Name ({issue.convention || 'configured convention'}):
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
               translationData={generatedIndex || translationData.index}
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
            {importAvailable && (
              <CrowdinImportDialog
                open={crowdinImportDialogOpen}
                onOpenChange={setCrowdinImportDialogOpen}
                document={selectedDocument}
                crowdinIntegration={crowdinIntegration}
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

         {/* Consistency Export Dialog */}
         <ConsistencyExportDialog
           open={exportDialogOpen}
           onOpenChange={setExportDialogOpen}
           totalIssues={translationData.consistencyIssues.length}
           filteredIssues={filteredConsistencyIssues.length}
           hasActiveFilters={consistencyFilters.size > 0}
           activeFilterTypes={Array.from(consistencyFilters)}
           onExport={handleExportConsistencyResults}
         />
      </Dialog>
   );
 };