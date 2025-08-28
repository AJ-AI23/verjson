import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CrowdinProject {
  id: number;
  name: string;
  identifier: string;
  description?: string;
}

interface CrowdinExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  translationData: Record<string, string>;
  documentName: string;
  workspaceId: string;
}

export const CrowdinExportDialog: React.FC<CrowdinExportDialogProps> = ({
  open,
  onOpenChange,
  translationData,
  documentName,
  workspaceId,
}) => {
  const [apiToken, setApiToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [projects, setProjects] = useState<CrowdinProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [filename, setFilename] = useState(`${documentName}-translations.json`);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string>('');
  const [exportSuccess, setExportSuccess] = useState(false);
  const [hasExistingToken, setHasExistingToken] = useState(false);

  // Check for existing API token when dialog opens
  useEffect(() => {
    if (open && workspaceId) {
      checkExistingToken();
    }
  }, [open, workspaceId]);

  // Update filename when document name changes
  useEffect(() => {
    setFilename(`${documentName}-translations.json`);
  }, [documentName]);

  const checkExistingToken = async () => {
    try {
      setIsLoadingProjects(true);
      setError('');

      const { data, error } = await supabase.functions.invoke('crowdin-integration', {
        body: { action: 'listProjects', workspaceId },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Check existing token response:', { data, error });

      if (error) {
        console.error('Error checking existing token:', error);
        setHasExistingToken(false);
        setShowTokenInput(true);
        return;
      }

      if (data.error) {
        if (data.error === 'No API token configured') {
          setHasExistingToken(false);
          setShowTokenInput(true);
        } else {
          setError(data.error);
          setHasExistingToken(false);
          setShowTokenInput(true);
        }
        return;
      }

      // Token exists and works
      setHasExistingToken(true);
      setProjects(data.projects || []);
      setShowTokenInput(false);
    } catch (err) {
      console.error('Error checking token:', err);
      setError('Failed to check existing API token');
      setHasExistingToken(false);
      setShowTokenInput(true);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleSaveToken = async () => {
    if (!apiToken.trim()) {
      setError('Please enter a valid API token');
      return;
    }

    try {
      setIsLoadingProjects(true);
      setError('');

      console.log('Calling crowdin-integration with:', { 
        action: 'saveToken',
        apiToken: !!apiToken.trim(),
        workspaceId 
      });

      const { data, error } = await supabase.functions.invoke('crowdin-integration', {
        body: { 
          action: 'saveToken',
          apiToken: apiToken.trim(),
          workspaceId 
        },
        headers: {
          'Content-Type': 'application/json',
        },
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

  const loadProjects = async () => {
    try {
      setIsLoadingProjects(true);
      setError('');

      const { data, error } = await supabase.functions.invoke('crowdin-integration', {
        body: { action: 'listProjects', workspaceId },
        headers: {
          'Content-Type': 'application/json',
        },
      });

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

      const { data, error } = await supabase.functions.invoke('crowdin-integration', {
        body: {
          action: 'export',
          projectId: selectedProjectId,
          filename: filename.trim(),
          translationData,
          workspaceId,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error || data.error) {
        setError(data?.error || 'Failed to export to Crowdin');
        return;
      }

      setExportSuccess(true);
      toast.success(`Successfully exported to Crowdin: ${data.fileName}`);
    } catch (err) {
      console.error('Error exporting:', err);
      setError('Failed to export to Crowdin');
    } finally {
      setIsExporting(false);
    }
  };

  const handleUseNewToken = () => {
    setApiToken('');
    setShowTokenInput(true);
    setProjects([]);
    setSelectedProjectId('');
    setError('');
  };

  const resetDialog = () => {
    setApiToken('');
    setShowTokenInput(false);
    setProjects([]);
    setSelectedProjectId('');
    setError('');
    setExportSuccess(false);
    setHasExistingToken(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      resetDialog();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Export to Crowdin
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="api-token">API Token</Label>
                        <Input
                          id="api-token"
                          type="password"
                          placeholder="Enter your Crowdin API token"
                          value={apiToken}
                          onChange={(e) => setApiToken(e.target.value)}
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
                      <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
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

                    <div className="space-y-2">
                      <Label htmlFor="filename">Filename</Label>
                      <Input
                        id="filename"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        placeholder="translation-file.json"
                      />
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        This will upload {Object.keys(translationData).length} translation strings
                        as a JSON file to your Crowdin project.
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
  );
};