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
import { Settings, Crown, Edit3, Eye } from 'lucide-react';
import { DocumentPermission } from '@/hooks/useDocumentPermissions';
import { WorkspacePermission } from '@/hooks/useWorkspacePermissions';

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Change Access Level
          </DialogTitle>
          <DialogDescription>
            Update the access level for {permission.user_name || permission.user_email}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              {getRoleIcon(permission.role)}
              <div className="flex flex-col">
                <span className="font-medium">
                  {permission.user_name || permission.user_email}
                </span>
                {permission.user_name && (
                  <span className="text-xs text-muted-foreground">
                    {permission.user_email}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Access Level</Label>
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
                      <span className="text-xs text-muted-foreground">Can view and edit the document</span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="viewer">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <div className="flex flex-col items-start">
                      <span>Viewer</span>
                      <span className="text-xs text-muted-foreground">Can only view the document</span>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
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