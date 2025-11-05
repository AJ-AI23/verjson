import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, Link, X, Download, AlertCircle, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { UrlAuthDialog } from './UrlAuthDialog';
import { supabase } from '@/integrations/supabase/client';

interface FileToImport {
  id: string;
  name: string;
  content: any;
  fileType: 'json-schema' | 'openapi';
  source: 'file' | 'url';
  size: number;
  valid: boolean;
  error?: string;
  url?: string; // Store the URL for URL imports
  authMethod?: 'basic' | 'bearer'; // Store the auth method for URL imports
  credentials?: string; // Store the encrypted credentials for URL imports
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (files: FileToImport[]) => Promise<void>;
}

export function ImportDialog({
  open,
  onOpenChange,
  onImport,
}: ImportDialogProps) {
  const [filesToImport, setFilesToImport] = useState<FileToImport[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string>('');
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState<string>('');

  const detectFileType = (content: any): 'json-schema' | 'openapi' => {
    if (content.openapi || content.swagger) return 'openapi';
    return 'json-schema';
  };

  const validateJsonContent = (content: any, filename: string): { valid: boolean; error?: string } => {
    try {
      if (!content || typeof content !== 'object') {
        return { valid: false, error: 'Invalid JSON structure' };
      }
      
      if (content.openapi || content.swagger) {
        if (!content.info || !content.paths) {
          return { valid: false, error: 'Invalid OpenAPI structure - missing info or paths' };
        }
      } else if (content.type || content.properties || content.$schema) {
        // Basic JSON Schema validation
        return { valid: true };
      } else {
        return { valid: false, error: 'Unknown file format - not a valid OpenAPI or JSON Schema' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid JSON content' };
    }
  };

  const processFile = async (file: File): Promise<FileToImport | null> => {
    try {
      const text = await file.text();
      const content = JSON.parse(text);
      const fileType = detectFileType(content);
      const validation = validateJsonContent(content, file.name);
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name.replace(/\.(json|yaml|yml)$/, ''),
        content,
        fileType,
        source: 'file',
        size: file.size,
        valid: validation.valid,
        error: validation.error,
      };
    } catch (error) {
      return {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name.replace(/\.(json|yaml|yml)$/, ''),
        content: null,
        fileType: 'json-schema',
        source: 'file',
        size: file.size,
        valid: false,
        error: 'Invalid JSON format',
      };
    }
  };

  const processZipFile = async (file: File): Promise<FileToImport[]> => {
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      const files: FileToImport[] = [];
      
      for (const filename of Object.keys(zipContent.files)) {
        const zipFile = zipContent.files[filename];
        if (!zipFile.dir && filename.match(/\.(json|yaml|yml)$/i)) {
          try {
            const text = await zipFile.async('text');
            const content = JSON.parse(text);
            const fileType = detectFileType(content);
            const validation = validateJsonContent(content, filename);
            
            files.push({
              id: Math.random().toString(36).substr(2, 9),
              name: filename.replace(/\.(json|yaml|yml)$/, ''),
              content,
              fileType,
              source: 'file',
              size: text.length,
              valid: validation.valid,
              error: validation.error,
            });
          } catch (error) {
            files.push({
              id: Math.random().toString(36).substr(2, 9),
              name: filename.replace(/\.(json|yaml|yml)$/, ''),
              content: null,
              fileType: 'json-schema',
              source: 'file',
              size: 0,
              valid: false,
              error: 'Invalid JSON in ZIP file',
            });
          }
        }
      }
      
      return files;
    } catch (error) {
      toast.error('Failed to process ZIP file');
      return [];
    }
  };

  const handleFiles = useCallback(async (files: FileList) => {
    const newFiles: FileToImport[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (file.name.toLowerCase().endsWith('.zip')) {
        const zipFiles = await processZipFile(file);
        newFiles.push(...zipFiles);
      } else if (file.name.match(/\.(json|yaml|yml)$/i)) {
        const processedFile = await processFile(file);
        if (processedFile) {
          newFiles.push(processedFile);
        }
      } else {
        toast.error(`Unsupported file type: ${file.name}`);
      }
    }
    
    setFilesToImport(prev => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFiles(files);
    }
    // Reset input value
    e.target.value = '';
  }, [handleFiles]);

  const handleUrlImport = async (authMethod?: 'basic' | 'bearer', credentials?: string) => {
    if (!urlInput.trim()) return;
    
    setIsLoadingUrl(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in to import from URL');
        return;
      }

      const { data, error } = await supabase.functions.invoke('fetch-authenticated-url', {
        body: {
          action: 'fetch',
          url: urlInput,
          authMethod,
          credentials,
          documentId: pendingDocumentId
        }
      });

      // Check if authentication is required (error with requiresAuth flag)
      if (error) {
        // Try to parse the error message as JSON to check for requiresAuth
        try {
          const errorData = typeof error === 'object' && 'message' in error 
            ? JSON.parse(error.message) 
            : error;
          
          if (errorData.requiresAuth) {
            setPendingUrl(urlInput);
            setAuthDialogOpen(true);
            setIsLoadingUrl(false);
            return;
          }
        } catch (e) {
          // If parsing fails, just throw the original error
        }
        throw error;
      }

      // Check if data contains an error
      if (data.error) {
        if (data.requiresAuth) {
          setPendingUrl(urlInput);
          setAuthDialogOpen(true);
          setIsLoadingUrl(false);
          return;
        }
        throw new Error(data.error);
      }

      const content = JSON.parse(data.content);
      const fileType = detectFileType(content);
      const filename = urlInput.split('/').pop() || 'imported-file';
      const validation = validateJsonContent(content, filename);
      
      const newFile: FileToImport = {
        id: Math.random().toString(36).substr(2, 9),
        name: filename.replace(/\.(json|yaml|yml)$/, ''),
        content,
        fileType,
        source: 'url',
        size: data.content.length,
        valid: validation.valid,
        error: validation.error,
        url: urlInput,
        authMethod: authMethod,
        credentials: credentials,
      };
      
      setFilesToImport(prev => [...prev, newFile]);
      setUrlInput('');
      setPendingUrl('');
      setPendingDocumentId(null);
      toast.success('File loaded from URL');
    } catch (error) {
      toast.error(`Failed to load from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleAuthenticate = async (authMethod: 'basic' | 'bearer', credentials: string) => {
    setAuthDialogOpen(false);
    setUrlInput(pendingUrl);
    await handleUrlImport(authMethod, credentials);
  };

  const removeFile = (id: string) => {
    setFilesToImport(prev => prev.filter(file => file.id !== id));
  };

  const renameFile = (id: string, newName: string) => {
    if (!newName.trim()) return; // Don't allow empty names
    setFilesToImport(prev => 
      prev.map(file => file.id === id ? { ...file, name: newName.trim() } : file)
    );
    console.log('[ImportDialog] File renamed:', { id, newName: newName.trim() });
  };

  const handleImport = async () => {
    const validFiles = filesToImport.filter(file => file.valid);
    if (validFiles.length === 0) {
      toast.error('No valid files to import');
      return;
    }
    
    console.log('[ImportDialog] Importing files:', validFiles.map(f => ({ id: f.id, name: f.name })));
    
    setIsImporting(true);
    try {
      await onImport(validFiles);
      setFilesToImport([]);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to import files');
    } finally {
      setIsImporting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const validFiles = filesToImport.filter(file => file.valid);
  const invalidFiles = filesToImport.filter(file => !file.valid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Documents
          </DialogTitle>
          <DialogDescription>
            Import JSON Schema or OpenAPI documents from files, ZIP archives, or URLs
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="files" className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="files">Files & ZIP</TabsTrigger>
            <TabsTrigger value="url">From URL</TabsTrigger>
          </TabsList>
          
          <TabsContent value="files" className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                Drag & drop files here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Supports JSON, YAML, and ZIP files
              </p>
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  Browse Files
                  <input
                    type="file"
                    multiple
                    accept=".json,.yaml,.yml,.zip"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="url" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url-input">URL</Label>
              <div className="flex gap-2">
                <Input
                  id="url-input"
                  placeholder="https://example.com/schema.json"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUrlImport()}
                />
                <Button
                  onClick={() => handleUrlImport()}
                  disabled={!urlInput.trim() || isLoadingUrl}
                >
                  {isLoadingUrl ? 'Loading...' : 'Load'}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {filesToImport.length > 0 && (
          <div className="space-y-4 flex-shrink-0">
            <Label className="text-base font-medium">Files to Import ({filesToImport.length})</Label>
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <div className="p-4 space-y-3">
                {validFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        {editingFileId === file.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingFileName}
                              onChange={(e) => setEditingFileName(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  renameFile(file.id, editingFileName);
                                  setEditingFileId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingFileId(null);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                renameFile(file.id, editingFileName);
                                setEditingFileId(null);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium truncate">
                              {file.name}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingFileId(file.id);
                                setEditingFileName(file.name);
                              }}
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {file.fileType}
                          </Badge>
                          <span>{formatFileSize(file.size)}</span>
                          <span>({file.source})</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(file.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                
                {invalidFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        {editingFileId === file.id ? (
                          <div className="flex items-center gap-2 mb-1">
                            <Input
                              value={editingFileName}
                              onChange={(e) => setEditingFileName(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  renameFile(file.id, editingFileName);
                                  setEditingFileId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingFileId(null);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                renameFile(file.id, editingFileName);
                                setEditingFileId(null);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium truncate">
                              {file.name}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingFileId(file.id);
                                setEditingFileName(file.name);
                              }}
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <div className="text-xs text-red-600">
                          {file.error}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(file.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={validFiles.length === 0 || isImporting}
          >
            {isImporting ? 'Importing...' : `Import ${validFiles.length} Document${validFiles.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>

      <UrlAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        onAuthenticate={handleAuthenticate}
        url={pendingUrl}
      />
    </Dialog>
  );
}