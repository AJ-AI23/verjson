import React, { useState } from 'react';
import { useApiKeys, ApiKey, CreateApiKeyParams } from '@/hooks/useApiKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Copy, Trash2, Ban, Key, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  read: 'Read-only access to documents and versions',
  write: 'Read and write access to documents and versions',
  admin: 'Full access including delete operations'
};

export function ApiKeysPanel() {
  const { apiKeys, loading, error, createApiKey, revokeApiKey, deleteApiKey } = useApiKeys();
  const { toast } = useToast();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  
  // Create form state
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read']);
  const [expiryOption, setExpiryOption] = useState<string>('never');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for the API key',
        variant: 'destructive'
      });
      return;
    }

    if (selectedScopes.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one scope',
        variant: 'destructive'
      });
      return;
    }

    setIsCreating(true);

    let expiresAt: string | null = null;
    if (expiryOption !== 'never') {
      const now = new Date();
      switch (expiryOption) {
        case '7days':
          now.setDate(now.getDate() + 7);
          break;
        case '30days':
          now.setDate(now.getDate() + 30);
          break;
        case '90days':
          now.setDate(now.getDate() + 90);
          break;
        case '1year':
          now.setFullYear(now.getFullYear() + 1);
          break;
      }
      expiresAt = now.toISOString();
    }

    const params: CreateApiKeyParams = {
      name: newKeyName.trim(),
      scopes: selectedScopes,
      expiresAt
    };

    const result = await createApiKey(params);
    setIsCreating(false);

    if (result.error) {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive'
      });
    } else if (result.apiKey?.key) {
      setNewKey(result.apiKey.key);
      setShowCreateDialog(false);
      setShowNewKeyDialog(true);
      setNewKeyName('');
      setSelectedScopes(['read']);
      setExpiryOption('never');
    }
  };

  const handleCopyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      toast({
        title: 'Copied',
        description: 'API key copied to clipboard'
      });
    }
  };

  const handleRevoke = async (key: ApiKey) => {
    const result = await revokeApiKey(key.id);
    if (result.error) {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'API key revoked successfully'
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedKey) return;
    
    const result = await deleteApiKey(selectedKey.id);
    setShowDeleteDialog(false);
    setSelectedKey(null);
    
    if (result.error) {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'API key deleted successfully'
      });
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev => 
      prev.includes(scope) 
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">API Keys</h3>
          <p className="text-xs text-muted-foreground">
            Manage API keys for programmatic access
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create Key
        </Button>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No API keys yet</p>
          <p className="text-xs">Create an API key to access the API programmatically</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className={`p-3 rounded-lg border ${
                key.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{key.name}</span>
                    {!key.is_active && (
                      <Badge variant="secondary" className="text-xs">Revoked</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      vj_{key.key_prefix}...
                    </code>
                    <div className="flex gap-1 flex-wrap">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Created {format(new Date(key.created_at), 'MMM d, yyyy')}
                    {key.expires_at && (
                      <span className="ml-2">
                        • Expires {format(new Date(key.expires_at), 'MMM d, yyyy')}
                      </span>
                    )}
                    {key.last_used_at && (
                      <span className="ml-2">
                        • Last used {format(new Date(key.last_used_at), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {key.is_active && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRevoke(key)}
                      title="Revoke key"
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedKey(key);
                      setShowDeleteDialog(true);
                    }}
                    title="Delete key"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create API Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for programmatic access to your data.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., CI/CD Pipeline, Local Development"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Access Scope</Label>
              <div className="space-y-2">
                {Object.entries(SCOPE_DESCRIPTIONS).map(([scope, description]) => (
                  <div key={scope} className="flex items-start space-x-2">
                    <Checkbox
                      id={`scope-${scope}`}
                      checked={selectedScopes.includes(scope)}
                      onCheckedChange={() => toggleScope(scope)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label
                        htmlFor={`scope-${scope}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {scope.charAt(0).toUpperCase() + scope.slice(1)}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Expiration</Label>
              <Select value={expiryOption} onValueChange={setExpiryOption}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never expires</SelectItem>
                  <SelectItem value="7days">7 days</SelectItem>
                  <SelectItem value="30days">30 days</SelectItem>
                  <SelectItem value="90days">90 days</SelectItem>
                  <SelectItem value="1year">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !newKeyName.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Key'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Key Created Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Save Your API Key
            </DialogTitle>
            <DialogDescription>
              This is the only time you'll see this key. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded-lg text-sm break-all font-mono">
                {newKey}
              </code>
              <Button size="icon" variant="outline" onClick={handleCopyKey}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Use this key in the <code className="bg-muted px-1 rounded">X-API-Key</code> header 
              or as a Bearer token in the <code className="bg-muted px-1 rounded">Authorization</code> header.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => {
              setShowNewKeyDialog(false);
              setNewKey(null);
            }}>
              I've Saved the Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the API key "{selectedKey?.name}"? 
              This action cannot be undone and any applications using this key will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
