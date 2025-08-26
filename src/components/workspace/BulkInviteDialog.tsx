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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Mail, FileText } from 'lucide-react';
import { Document } from '@/types/workspace';

interface BulkInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (email: string, documentIds: string[], role: 'editor' | 'viewer') => Promise<boolean>;
  documents: Document[];
}

export function BulkInviteDialog({
  open,
  onOpenChange,
  onInvite,
  documents,
}: BulkInviteDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  const handleDocumentToggle = (documentId: string, checked: boolean) => {
    if (checked) {
      setSelectedDocuments(prev => [...prev, documentId]);
    } else {
      setSelectedDocuments(prev => prev.filter(id => id !== documentId));
    }
  };

  const handleSelectAll = () => {
    if (selectedDocuments.length === documents.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(documents.map(d => d.id));
    }
  };

  const handleInvite = async () => {
    if (!email.trim() || selectedDocuments.length === 0) return;

    setIsInviting(true);
    const success = await onInvite(email, selectedDocuments, role);
    
    if (success) {
      setEmail('');
      setRole('editor');
      setSelectedDocuments([]);
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
            <Users className="h-5 w-5" />
            Bulk Document Invitation
          </DialogTitle>
          <DialogDescription>
            Invite someone to collaborate on multiple documents at once.
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
                    <span className="text-xs text-muted-foreground">Can view and edit documents</span>
                  </div>
                </SelectItem>
                <SelectItem value="viewer">
                  <div className="flex flex-col items-start">
                    <span>Viewer</span>
                    <span className="text-xs text-muted-foreground">Can only view documents</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Documents</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="h-auto p-1 text-xs"
              >
                {selectedDocuments.length === documents.length ? 'Unselect All' : 'Select All'}
              </Button>
            </div>
            
            <ScrollArea className="h-40 border rounded-md p-2">
              <div className="space-y-2">
                {documents.map((document) => (
                  <div key={document.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={document.id}
                      checked={selectedDocuments.includes(document.id)}
                      onCheckedChange={(checked: boolean) => 
                        handleDocumentToggle(document.id, checked)
                      }
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <label
                        htmlFor={document.id}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {document.name}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            {selectedDocuments.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedDocuments.length} document(s) selected
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isInviting}>
            Cancel
          </Button>
          <Button 
            onClick={handleInvite} 
            disabled={!email.trim() || selectedDocuments.length === 0 || isInviting}
          >
            {isInviting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}