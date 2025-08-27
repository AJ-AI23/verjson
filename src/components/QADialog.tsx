import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Download, Languages, FileText, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { extractStringValues, createTranslationIndex, downloadJsonFile, TranslationEntry } from '@/lib/translationUtils';
import { validateSyntax, ValidationResult } from '@/lib/schemaUtils';

interface QADialogProps {
  schema: string;
  documentName?: string;
  disabled?: boolean;
}

export const QADialog: React.FC<QADialogProps> = ({ 
  schema, 
  documentName = 'schema',
  disabled = false 
}) => {
  const [open, setOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const translationData = useMemo(() => {
    try {
      const parsedSchema = JSON.parse(schema);
      const entries = extractStringValues(parsedSchema);
      const index = createTranslationIndex(entries);
      
      return {
        entries,
        index,
        totalStrings: entries.length
      };
    } catch (error) {
      console.error('Failed to parse schema for translations:', error);
      return {
        entries: [],
        index: {},
        totalStrings: 0
      };
    }
  }, [schema]);

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

  const groupedEntries = useMemo(() => {
    const groups: Record<string, TranslationEntry[]> = {};
    
    translationData.entries.forEach(entry => {
      const topLevel = entry.path[0] || 'root';
      if (!groups[topLevel]) {
        groups[topLevel] = [];
      }
      groups[topLevel].push(entry);
    });
    
    return groups;
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
      <DialogContent className="max-w-4xl max-h-[80vh] p-0 flex flex-col">
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
        
        <div className="flex-1 min-h-0 p-6 pt-2">
          <div className="space-y-4 h-full flex flex-col">
            {/* Summary Card */}
            <Card className="shrink-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">Translation Summary</span>
                  </span>
                  <Badge variant="outline" className="shrink-0">
                    {translationData.totalStrings} strings found
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
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
                </div>
              </CardContent>
            </Card>

            {/* Tabs for different views */}
            <Tabs defaultValue="grouped" className="flex-1 min-h-0 flex flex-col">
              <div className="overflow-x-auto shrink-0">
                <TabsList className="inline-flex w-auto min-w-full">
                  <TabsTrigger value="grouped" className="flex-shrink-0">Grouped View</TabsTrigger>
                  <TabsTrigger value="flat" className="flex-shrink-0">Flat Index</TabsTrigger>
                  <TabsTrigger value="syntax" className="flex-shrink-0">Syntax</TabsTrigger>
                </TabsList>
              </div>
            
              <TabsContent value="grouped" className="flex-1 min-h-0 mt-4">
                <ScrollArea className="h-full w-full">
                <div className="space-y-4">
                  {Object.entries(groupedEntries).map(([group, entries]) => (
                    <Card key={group}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span className="truncate min-w-0">{group}</span>
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
            
              <TabsContent value="flat" className="flex-1 min-h-0 mt-4">
                <ScrollArea className="h-full w-full">
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
            
              <TabsContent value="syntax" className="flex-1 min-h-0 mt-4">
                <div className="space-y-4 h-full flex flex-col">
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
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};