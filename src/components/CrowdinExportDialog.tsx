import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Upload, CheckCircle, AlertCircle, ExternalLink, ChevronDown, Files, File } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { previewExportFiles, splitTranslationDataByApiPaths, generateSplitFilenames, type ExportPreviewFile } from '@/lib/translationUtils';
import { CrowdinExportPreviewDialog } from '@/components/CrowdinExportPreviewDialog';

interface CrowdinProject {
  id: number;
  name: string;
  identifier: string;
  description?: string;
}

interface CrowdinBranch {
  id: number;
  name: string;
  title: string;
  createdAt: string;
}

interface CrowdinFolder {
  id: number;
  name: string;
  path: string;
  createdAt: string;
}

interface CrowdinExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  translationData: Record<string, string>;
  documentName: string;
  workspaceId: string;
  documentId?: string;
  onDocumentUpdated?: () => void; // Add callback for when document is updated
}

export const CrowdinExportDialog: React.FC<CrowdinExportDialogProps> = ({
  open,
  onOpenChange,
  translationData,
  documentName,
  workspaceId,
  documentId,
  onDocumentUpdated,
}) => {
  const [apiToken, setApiToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [projects, setProjects] = useState<CrowdinProject[]>([]);
  const [branches, setBranches] = useState<CrowdinBranch[]>([]);
  const [folders, setFolders] = useState<CrowdinFolder[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [filename, setFilename] = useState(`${documentName}-translations.json`);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string>('');
  const [exportSuccess, setExportSuccess] = useState(false);
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [splitByApiPaths, setSplitByApiPaths] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<ExportPreviewFile[]>([]);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<any[]>([]);

  // Check for existing API token when dialog opens
  useEffect(() => {
    if (open && workspaceId) {
      console.log('🔍 Dialog opened, checking for existing token for workspace:', workspaceId);
      checkExistingToken();
    }
  }, [open, workspaceId]);

  // Update filename when document name changes
  useEffect(() => {
    setFilename(`${documentName}-translations.json`);
  }, [documentName]);

  // Update preview when filename, split option, or translation data changes
  useEffect(() => {
    if (translationData && Object.keys(translationData).length > 0) {
      const preview = previewExportFiles(translationData, filename, splitByApiPaths);
      setPreviewFiles(preview);
    }
  }, [filename, splitByApiPaths, translationData]);

  const checkExistingToken = async () => {
    try {
      console.log('🔍 Checking for existing token for workspace:', workspaceId);
      setError('');

      // Use edge function to check for existing token
      const { data, error: tokenError } = await supabase.functions.invoke('crowdin-integration', {
        body: { 
          action: 'validateCrowdinToken', 
          workspaceId 
        }
      });

      console.log('🔍 Edge function response:', { data, tokenError });

      if (tokenError) {
        console.error('❌ Error checking token:', tokenError);
        setHasExistingToken(false);
        setShowTokenInput(true);
        return;
      }

      if (data?.hasToken) {
        console.log('✅ Found existing token for workspace');
        setHasExistingToken(true);
        setShowTokenInput(false);
        // Now try to load projects using the edge function
        console.log('🔍 Loading projects...');
        await loadProjects();
      } else {
        console.log('🔍 No existing token found');
        setHasExistingToken(false);
        setShowTokenInput(true);
      }
    } catch (err) {
      console.error('❌ Error checking token:', err);
      setError('Failed to check existing API token');
      setHasExistingToken(false);
      setShowTokenInput(true);
    }
  };

  const handleSaveToken = async () => {
    if (!apiToken.trim()) {
      setError('Please enter a valid API token');
      return;
    }

    // Clear any previous errors
    setError('');
    
    console.log('API Token being sent:', apiToken.substring(0, 10) + '...');

    if (apiToken.includes('error') || apiToken.includes('Error')) {
      setError('Please enter a valid Crowdin API token, not an error message');
      return;
    }

    try {
      setIsLoadingProjects(true);
      setError('');

      const requestPayload = { 
        action: 'storeCrowdinToken',
        apiToken: apiToken.trim(),
        workspaceId 
      };

      console.log('Calling crowdin-integration with:', requestPayload);
      console.log('Request payload JSON:', JSON.stringify(requestPayload));

      const { data, error } = await supabase.functions.invoke('crowdin-integration', {
        body: requestPayload
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        setError(`Edge function error: ${error.message}`);
        return;
      }

      if (data?.error) {
        console.error('API error:', data.error);
        setError(data.error);
        return;
      }

      // Token saved successfully, now load projects
      await loadProjects();
      
      setShowTokenInput(false);
      setHasExistingToken(true);
      toast.success('Crowdin API token saved successfully');
    } catch (err) {
      console.error('Error saving token:', err);
      setError('Failed to save API token');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const loadBranches = async (projectId: string) => {
    try {
      setIsLoadingBranches(true);
      setError('');

      const requestBody = { action: 'fetchCrowdinBranches', projectId: parseInt(projectId), workspaceId };
      console.log('🔍 Loading branches for project:', projectId);

      const { data, error } = await supabase.functions.invoke('crowdin-integration', {
        body: requestBody
      });

      if (error || data.error) {
        console.error('Error loading branches:', error || data.error);
        setError(data?.error || 'Failed to load branches');
        return;
      }

      setBranches(data.branches || []);
      console.log('✅ Loaded branches:', data.branches?.length || 0);
    } catch (err) {
      console.error('Error loading branches:', err);
      setError('Failed to load branches');
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const loadFolders = async (projectId: string, branchId?: string) => {
    try {
      setIsLoadingFolders(true);
      setError('');

      const requestBody = { 
        action: 'fetchCrowdinFolders', 
        projectId: parseInt(projectId), 
        workspaceId,
        ...(branchId && { branchId: parseInt(branchId) })
      };
      console.log('🔍 Loading folders for project:', projectId, 'branch:', branchId || 'main');

      const { data, error } = await supabase.functions.invoke('crowdin-integration', {
        body: requestBody
      });

      if (error || data.error) {
        console.error('Error loading folders:', error || data.error);
        setError(data?.error || 'Failed to load folders');
        return;
      }

      setFolders(data.folders || []);
      console.log('✅ Loaded folders:', data.folders?.length || 0);
    } catch (err) {
      console.error('Error loading folders:', err);
      setError('Failed to load folders');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedBranchId('__main__'); // Default to main branch
    setSelectedFolderId('__root__'); // Default to root folder
    setBranches([]);
    setFolders([]);
    
    if (projectId) {
      // Load branches for the selected project
      await loadBranches(projectId);
      // Load root folders (no branch selected)
      await loadFolders(projectId);
    }
  };

  const handleBranchChange = async (branchId: string) => {
    setSelectedBranchId(branchId);
    setSelectedFolderId('__root__'); // Reset to root folder when branch changes
    setFolders([]);
    
    if (selectedProjectId) {
      // Load folders for the selected branch (use undefined for main branch)
      const actualBranchId = branchId === '__main__' ? undefined : branchId;
      await loadFolders(selectedProjectId, actualBranchId);
    }
  };

  const loadProjects = async () => {
    try {
      setIsLoadingProjects(true);
      setError('');

      console.log('🔍 Loading projects for workspace:', workspaceId);
      
      const requestBody = { action: 'fetchCrowdinProjects', workspaceId };
      console.log('📤 Sending request body:', JSON.stringify(requestBody));

      const { data, error } = await supabase.functions.invoke('crowdin-integration', {
        body: requestBody
      });

      console.log('📥 Response received:', { data, error });

      if (error || data.error) {
        setError(data?.error || 'Failed to load projects');
        return;
      }

      setProjects(data.projects || []);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleExport = async () => {
    if (!selectedProjectId || !filename.trim()) {
      setError('Please select a project and enter a filename');
      return;
    }

    try {
      setIsExporting(true);
      setError('');

      // First, check file existence to show preview
      await checkFileExistenceAndShowPreview();
      
    } catch (err) {
      console.error('Error checking files:', err);
      setError('Failed to check file existence');
      setIsExporting(false);
    }
  };

  const checkFileExistenceAndShowPreview = async () => {
    try {
      // Get list of existing files
      const { data: filesData, error: filesError } = await supabase.functions.invoke('crowdin-integration', {
        body: {
          action: 'fetchCrowdinFiles',
          projectId: selectedProjectId,
          workspaceId,
          ...(selectedBranchId && selectedBranchId !== '__main__' && { branchId: selectedBranchId }),
          ...(selectedFolderId && selectedFolderId !== '__root__' && { directoryId: selectedFolderId }),
        }
      });

      if (filesError || filesData.error) {
        console.error('Error fetching files:', filesError || filesData.error);
        // If we can't fetch files, proceed with export anyway
        await performExport();
        return;
      }

      const existingFiles = filesData.files || [];
      const existingFileNames = new Set(existingFiles.map((f: any) => f.name));

      // Determine which files will be created/updated
      let filesToExport: string[] = [];
      if (splitByApiPaths) {
        const splitData = splitTranslationDataByApiPaths(translationData);
        const filenames = generateSplitFilenames(filename.trim(), Object.keys(splitData));
        filesToExport = Object.values(filenames);
      } else {
        filesToExport = [filename.trim()];
      }

      const fileStatuses = filesToExport.map(fname => {
        const exists = existingFileNames.has(fname);
        return {
          filename: fname,
          exists,
          action: exists ? 'update' : 'create',
          existingFileId: exists ? existingFiles.find((f: any) => f.name === fname)?.id : undefined
        };
      });

      setFileStatuses(fileStatuses);
      setShowExportPreview(true);
      setIsExporting(false);

    } catch (err) {
      console.error('Error checking file existence:', err);
      // If file check fails, proceed with export
      await performExport();
    }
  };

  const performExport = async () => {
    try {
      setIsExporting(true);
      setError('');

      // Prepare export data
      let exportData;
      if (splitByApiPaths) {
        const splitData = splitTranslationDataByApiPaths(translationData);
        const filenames = generateSplitFilenames(filename.trim(), Object.keys(splitData));
        
        exportData = {
          splitFiles: Object.entries(splitData).map(([path, data]) => ({
            filename: filenames[path],
            data
          }))
        };
      } else {
        exportData = {
          filename: filename.trim(),
          data: translationData
        };
      }

      const { data, error } = await supabase.functions.invoke('crowdin-integration', {
        body: {
          action: 'exportDocumentToCrowdin',
          projectId: selectedProjectId,
          translationData: exportData,
          splitByApiPaths,
          workspaceId,
          documentId, // Pass documentId to edge function
          ...(selectedBranchId && selectedBranchId !== '__main__' && { branchId: selectedBranchId }),
          ...(selectedFolderId && selectedFolderId !== '__root__' && { folderId: selectedFolderId }),
        }
      });

      if (error || data.error) {
        setError(data?.error || 'Failed to export to Crowdin');
        return;
      }

      // Check if database update was successful (handled by edge function now)
      if (data.databaseUpdate && data.databaseUpdate.error) {
        console.warn('Database update failed:', data.databaseUpdate.error);
        // Don't fail the export, but could show a warning
      } else if (data.databaseUpdate && data.databaseUpdate.success) {
        console.log('✅ Database updated successfully by edge function');
        // Notify parent that document was updated
        if (onDocumentUpdated) {
          onDocumentUpdated();
        }
      }

      setExportSuccess(true);
      setShowExportPreview(false);
      
      if (splitByApiPaths) {
        toast.success(`Successfully exported ${previewFiles.length} files to Crowdin`);
      } else {
        toast.success(`Successfully exported to Crowdin: ${data.fileName}`);
      }
    } catch (err) {
      console.error('Error exporting:', err);
      setError('Failed to export to Crowdin');
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmExport = () => {
    setShowExportPreview(false);
    performExport();
  };

  const handleCancelExport = () => {
    setShowExportPreview(false);
    setIsExporting(false);
  };

  const handleUseNewToken = () => {
    setApiToken('');
    setShowTokenInput(true);
    setProjects([]);
    setBranches([]);
    setFolders([]);
    setSelectedProjectId('');
    setSelectedBranchId('__main__');
    setSelectedFolderId('__root__');
    setError('');
  };

  const resetDialog = () => {
    setApiToken('');
    setShowTokenInput(false);
    setProjects([]);
    setBranches([]);
    setFolders([]);
    setSelectedProjectId('');
    setSelectedBranchId('__main__');
    setSelectedFolderId('__root__');
    setError('');
    setExportSuccess(false);
    setHasExistingToken(false);
    setSplitByApiPaths(false);
    setPreviewFiles([]);
    setShowExportPreview(false);
    setFileStatuses([]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    console.log('🔍 Dialog open state changing to:', newOpen);
    onOpenChange(newOpen);
    if (!newOpen) {
      console.log('🔍 Dialog closing, resetting state');
      resetDialog();
    }
  };

  return (
    <>
      <CrowdinExportPreviewDialog
        open={showExportPreview}
        onOpenChange={setShowExportPreview}
        fileStatuses={fileStatuses}
        onConfirmExport={handleConfirmExport}
        onCancel={handleCancelExport}
        projectName={projects.find(p => p.id.toString() === selectedProjectId)?.name || 'Unknown Project'}
        branchName={selectedBranchId !== '__main__' ? branches.find(b => b.id.toString() === selectedBranchId)?.name : undefined}
        folderName={selectedFolderId !== '__root__' ? folders.find(f => f.id.toString() === selectedFolderId)?.name : undefined}
      />
      
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Export to Crowdin
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1 min-h-0 pr-2">
          {exportSuccess ? (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="flex items-center gap-3 pt-6">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Export Successful!</p>
                  <p className="text-sm text-green-700">
                    Your translation file has been uploaded to Crowdin.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* API Token Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Crowdin API Token</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   {hasExistingToken && !showTokenInput ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-muted-foreground">
                            Using saved API token
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleUseNewToken}
                        >
                          Use Different Token
                        </Button>
                      </div>
                      {projects.length === 0 && !isLoadingProjects && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadProjects}
                          className="w-full"
                        >
                          {isLoadingProjects ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Loading Projects...
                            </>
                          ) : (
                            'Retry Loading Projects'
                          )}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="api-token">API Token</Label>
                        <Input
                          id="api-token"
                          type="password"
                          placeholder="Enter your Crowdin API token"
                          value={apiToken}
                          onChange={(e) => {
                            setApiToken(e.target.value);
                            setError(''); // Clear error when user types
                          }}
                        />
                      </div>
                      <Button
                        onClick={handleSaveToken}
                        disabled={isLoadingProjects || !apiToken.trim()}
                        className="w-full"
                      >
                        {isLoadingProjects ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Validating Token...
                          </>
                        ) : (
                          'Save Token & Load Projects'
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Projects Section */}
              {projects.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Select Project</CardTitle>
                  </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Crowdin Project</Label>
                        <Select value={selectedProjectId} onValueChange={handleProjectChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.map((project) => (
                              <SelectItem key={project.id} value={project.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <span>{project.name}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {project.identifier}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Branch Selection (optional) */}
                      {selectedProjectId && (
                        <div className="space-y-2">
                          <Label>Branch (Optional)</Label>
                          <Select value={selectedBranchId} onValueChange={handleBranchChange}>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoadingBranches ? "Loading branches..." : branches.length === 0 ? "No branches (use main)" : "Select a branch"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__main__">
                                <div className="flex items-center gap-2">
                                  <span>Main Branch</span>
                                  <Badge variant="outline" className="text-xs">
                                    default
                                  </Badge>
                                </div>
                              </SelectItem>
                              {branches.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id.toString()}>
                                  <div className="flex items-center gap-2">
                                    <span>{branch.name}</span>
                                    {branch.title && (
                                      <Badge variant="secondary" className="text-xs">
                                        {branch.title}
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isLoadingBranches && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading branches...
                            </div>
                          )}
                        </div>
                      )}

                      {/* Folder Selection (optional) */}
                      {selectedProjectId && (
                        <div className="space-y-2">
                          <Label>Folder (Optional)</Label>
                          <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoadingFolders ? "Loading folders..." : folders.length === 0 ? "Root folder" : "Select a folder"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__root__">
                                <div className="flex items-center gap-2">
                                  <span>Root Folder</span>
                                  <Badge variant="outline" className="text-xs">
                                    /
                                  </Badge>
                                </div>
                              </SelectItem>
                              {folders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id.toString()}>
                                  <div className="flex items-center gap-2">
                                    <span>{folder.name}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {folder.path}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isLoadingFolders && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading folders...
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="filename">Filename</Label>
                        <Input
                          id="filename"
                          value={filename}
                          onChange={(e) => setFilename(e.target.value)}
                          placeholder="translation-file.json"
                        />
                      </div>

                      {/* Split by API Paths Option */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="split-by-paths"
                            checked={splitByApiPaths}
                            onCheckedChange={(checked) => setSplitByApiPaths(checked === true)}
                          />
                          <Label htmlFor="split-by-paths" className="text-sm font-medium">
                            Split by API paths
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Create separate files for each API base path (e.g., /v1/parcels, /v1/carriers)
                        </p>
                      </div>

                      {/* Export Preview */}
                      {previewFiles.length > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              {splitByApiPaths ? <Files className="h-4 w-4" /> : <File className="h-4 w-4" />}
                              Export Preview ({previewFiles.length} file{previewFiles.length !== 1 ? 's' : ''})
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              {previewFiles.map((file, index) => (
                                <Collapsible key={index}>
                                  <CollapsibleTrigger className="flex w-full items-center justify-between p-2 rounded-md border hover:bg-accent">
                                    <div className="flex items-center gap-2 text-left">
                                      <File className="h-3 w-3 flex-shrink-0" />
                                      <div>
                                        <div className="text-sm font-medium">{file.filename}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {file.entryCount} strings
                                          {file.path !== 'single' && file.path !== 'general' && (
                                            <span className="ml-1">• {file.path}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <ChevronDown className="h-3 w-3" />
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="px-2 pb-2">
                                    <div className="text-xs text-muted-foreground">
                                      Sample keys: {file.sampleKeys.join(', ')}
                                      {file.sampleKeys.length < file.entryCount && '...'}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {splitByApiPaths ? (
                            <>
                              This will upload {previewFiles.length} files with a total of {Object.keys(translationData).length} translation strings
                              to your Crowdin project
                            </>
                          ) : (
                            <>
                              This will upload {Object.keys(translationData).length} translation strings
                              as a JSON file to your Crowdin project
                            </>
                          )}
                          {selectedBranchId && selectedBranchId !== '__main__' ? ` in branch "${branches.find(b => b.id.toString() === selectedBranchId)?.name || 'selected branch'}"` : ''}
                          {selectedFolderId && selectedFolderId !== '__root__' ? ` in folder "${folders.find(f => f.id.toString() === selectedFolderId)?.path || 'selected folder'}"` : ' in the root folder'}.
                        </AlertDescription>
                      </Alert>

                      <Button
                        onClick={handleExport}
                        disabled={isExporting || !selectedProjectId || !filename.trim()}
                        className="w-full"
                      >
                        {isExporting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Export to Crowdin
                          </>
                        )}
                      </Button>
                    </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Help Link */}
          <div className="text-center">
            <a
              href="https://developer.crowdin.com/api/v2/#section/Authentication"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              How to get your Crowdin API token
            </a>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
};