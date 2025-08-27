import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Download, Languages, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { extractStringValues, createTranslationIndex, downloadJsonFile, TranslationEntry } from '@/lib/translationUtils';

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
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            QA Translation Manager
            {documentName && (
              <Badge variant="secondary" className="ml-2">
                {documentName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Summary Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Translation Summary
                </span>
                <Badge variant="outline">
                  {translationData.totalStrings} strings found
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleCopyIndex}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy Index
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleDownloadIndex}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Index
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for different views */}
          <Tabs defaultValue="grouped" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="grouped">Grouped View</TabsTrigger>
              <TabsTrigger value="flat">Flat Index</TabsTrigger>
            </TabsList>
            
            <TabsContent value="grouped" className="mt-4">
              <ScrollArea className="h-[400px] w-full">
                <div className="space-y-4">
                  {Object.entries(groupedEntries).map(([group, entries]) => (
                    <Card key={group}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>{group}</span>
                          <Badge variant="secondary">{entries.length} strings</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {entries.map((entry, index) => (
                            <div key={index} className="flex items-start justify-between p-2 bg-muted/30 rounded text-sm">
                              <div className="min-w-0 flex-1">
                                <div className="font-mono text-xs text-muted-foreground mb-1">
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
            
            <TabsContent value="flat" className="mt-4">
              <ScrollArea className="h-[400px] w-full">
                <div className="space-y-2">
                  {translationData.entries.map((entry, index) => (
                    <div key={index} className="flex items-start justify-between p-3 border rounded text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs text-muted-foreground mb-1">
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
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};