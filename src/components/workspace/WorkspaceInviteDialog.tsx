import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building, Mail } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface WorkspaceInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (email: string, role: 'editor' | 'viewer', emailNotifications: boolean) => Promise<boolean>;
  workspaceName: string;
}

export function WorkspaceInviteDialog({
  open,
  onOpenChange,
  onInvite,
  workspaceName,
}: WorkspaceInviteDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return;

    setIsInviting(true);
    const success = await onInvite(email, role, emailNotifications);
    
    if (success) {
      setEmail('');
      setRole('editor');
      setEmailNotifications(true);
      onOpenChange(false);
    }
    
    setIsInviting(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isInviting) {
      handleInvite();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Invite to Workspace
          </DialogTitle>
          <DialogDescription>
            Invite someone to collaborate on the entire "{workspaceName}" workspace. 
            They'll have access to all current and future documents in this workspace.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
                disabled={isInviting}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value: 'editor' | 'viewer') => setRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">
                  <div className="flex flex-col items-start">
                    <span>Editor</span>
                    <span className="text-xs text-muted-foreground">Can view and edit all documents</span>
                  </div>
                </SelectItem>
                <SelectItem value="viewer">
                  <div className="flex flex-col items-start">
                    <span>Viewer</span>
                    <span className="text-xs text-muted-foreground">Can only view all documents</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="emailNotifications"
              checked={emailNotifications}
              onCheckedChange={(checked) => setEmailNotifications(checked === true)}
            />
            <Label htmlFor="emailNotifications" className="text-sm">
              Send invitation and future notifications by email for this workspace
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isInviting}>
            Cancel
          </Button>
          <Button 
            onClick={handleInvite} 
            disabled={!email.trim() || isInviting}
          >
            {isInviting ? 'Sending...' : 'Send Workspace Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}