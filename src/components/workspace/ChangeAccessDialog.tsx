import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Settings, Crown, Edit3, Eye, Trash2, Folder, FileText } from 'lucide-react';
import { DocumentPermission } from '@/hooks/useDocumentPermissions';
import { WorkspacePermission } from '@/hooks/useWorkspacePermissions';
import { useUserPermissions } from '@/hooks/useUserPermissions';

type Permission = DocumentPermission | WorkspacePermission;

interface ChangeAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateRole: (newRole: 'editor' | 'viewer') => Promise<void>;
  permission: Permission | null;
}

export function ChangeAccessDialog({
  open,
  onOpenChange,
  onUpdateRole,
  permission,
}: ChangeAccessDialogProps) {
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [isUpdating, setIsUpdating] = useState(false);
  const { permissions: userPermissions, loading: permissionsLoading, revokePermission } = useUserPermissions(permission?.user_id);

  // Update role when permission changes, but only allow editor/viewer roles
  React.useEffect(() => {
    if (permission && (permission.role === 'editor' || permission.role === 'viewer')) {
      setRole(permission.role);
    }
  }, [permission]);

  const handleUpdateRole = async () => {
    if (!permission || role === permission.role) return;

    setIsUpdating(true);
    await onUpdateRole(role);
    setIsUpdating(false);
    onOpenChange(false);
  };

  const handleRevokePermission = async (permissionId: string, type: 'workspace' | 'document') => {
    const success = await revokePermission(permissionId, type);
    if (success) {
      // Close dialog if we revoked the current permission
      if (permissionId === permission?.id) {
        onOpenChange(false);
      }
    }
  };

  if (!permission) return null;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4" />;
      case 'editor':
        return <Edit3 className="h-4 w-4" />;
      case 'viewer':
        return <Eye className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'editor':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Manage User Access
          </DialogTitle>
          <DialogDescription>
            Modify access permissions and view all permissions for this user
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Current Permission */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Current Permission</h3>
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                {getRoleIcon(permission.role)}
                <div className="flex flex-col">
                  <span className="font-medium">
                    {permission.username ? `@${permission.username}` : (permission.user_name || permission.user_email || 'Unknown User')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {permission.username && permission.user_name ? permission.user_name : (permission.user_email || 'No email')}
                  </span>
                </div>
              </div>
              <Badge className={getRoleColor(permission.role)}>
                {permission.role}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Change Role</Label>
              <Select value={role} onValueChange={(value: 'editor' | 'viewer') => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">
                    <div className="flex items-center gap-2">
                      <Edit3 className="h-4 w-4" />
                      <div className="flex flex-col items-start">
                        <span>Editor</span>
                        <span className="text-xs text-muted-foreground">Can view and edit</span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <div className="flex flex-col items-start">
                        <span>Viewer</span>
                        <span className="text-xs text-muted-foreground">Can only view</span>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* All User Permissions */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">All Permissions for This User</h3>
            <ScrollArea className="h-[200px] w-full rounded-md border p-4">
              {permissionsLoading ? (
                <p className="text-sm text-muted-foreground">Loading permissions...</p>
              ) : userPermissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No permissions found</p>
              ) : (
                <div className="space-y-2">
                  {userPermissions.map((perm) => (
                    <div key={`${perm.type}-${perm.id}`} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {perm.type === 'workspace' ? (
                          <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">
                            {perm.resource_name}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {perm.type === 'document' ? `in ${perm.workspace_name}` : 'Workspace'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          {perm.role}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleRevokePermission(perm.id, perm.type)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateRole} 
            disabled={role === permission.role || isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Update Access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}