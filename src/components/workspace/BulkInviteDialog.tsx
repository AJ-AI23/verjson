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
import { Separator } from '@/components/ui/separator';
import { Users, Mail, FileText, Edit3, Eye } from 'lucide-react';
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Document Invitation
          </DialogTitle>
          <DialogDescription>
            Invite someone to collaborate on multiple documents at once.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Invitation Details</h3>
            <div className="space-y-4">
              <div>
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
              
              <div>
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
                          <span className="text-xs text-muted-foreground">Can view and edit documents</span>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="viewer">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        <div className="flex flex-col items-start">
                          <span>Viewer</span>
                          <span className="text-xs text-muted-foreground">Can only view documents</span>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Document Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Select Documents</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedDocuments.length === documents.length ? 'Unselect All' : 'Select All'}
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Choose which documents to grant access to. The collaborator will receive access to all selected documents.
              </Label>
              
              <ScrollArea className="h-48 border rounded-md p-3">
                <div className="space-y-3">
                  {documents.map((document) => (
                    <div key={document.id} className="flex items-start space-x-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
                      <Checkbox
                        id={document.id}
                        checked={selectedDocuments.includes(document.id)}
                        onCheckedChange={(checked: boolean) => 
                          handleDocumentToggle(document.id, checked)
                        }
                        className="mt-1"
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <label
                          htmlFor={document.id}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium text-sm truncate">{document.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {document.file_type} • {new Date(document.created_at).toLocaleDateString()}
                          </div>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              {selectedDocuments.length > 0 && (
                <div className="text-sm text-muted-foreground bg-accent/20 p-2 rounded-md">
                  <strong>{selectedDocuments.length}</strong> document{selectedDocuments.length !== 1 ? 's' : ''} selected for invitation
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isInviting}>
            Cancel
          </Button>
          <Button 
            onClick={handleInvite} 
            disabled={!email.trim() || selectedDocuments.length === 0 || isInviting}
          >
            {isInviting ? 'Sending Invitation...' : 'Send Invitation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}