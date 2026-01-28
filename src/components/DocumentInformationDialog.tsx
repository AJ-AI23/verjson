
import React from 'react';
import { Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DocumentInformationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  document: {
    id: string;
    name: string;
    file_type: string;
    workspace_id: string;
    created_at: string;
    updated_at: string;
    content?: any;
    user_id: string;
  } | null;
}

export const DocumentInformationDialog: React.FC<DocumentInformationDialogProps> = ({
  isOpen,
  onOpenChange,
  document
}) => {
  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied to clipboard`);
    } catch (err) {
      toast.error(`Failed to copy ${label}`);
    }
  };

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Document Information</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong className="text-muted-foreground text-xs uppercase">Document ID</strong>
            <div className="flex items-center gap-1 mt-1">
              <div className="font-mono text-xs bg-muted p-2 rounded border break-all flex-1">{document.id}</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={() => handleCopy(document.id, 'Document ID')}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div>
            <strong className="text-muted-foreground text-xs uppercase">File Name</strong>
            <div className="font-medium mt-1">{document.name}</div>
          </div>
          <div>
            <strong className="text-muted-foreground text-xs uppercase">File Type</strong>
            <div className="mt-1">
              <Badge variant="outline" className="text-xs">
                {document.file_type}
              </Badge>
            </div>
          </div>
          <div>
            <strong className="text-muted-foreground text-xs uppercase">Workspace ID</strong>
            <div className="flex items-center gap-1 mt-1">
              <div className="font-mono text-xs bg-muted p-1 rounded border break-all flex-1">{document.workspace_id}</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() => handleCopy(document.workspace_id, 'Workspace ID')}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div>
            <strong className="text-muted-foreground text-xs uppercase">Created</strong>
            <div className="text-xs mt-1">{new Date(document.created_at).toLocaleString()}</div>
          </div>
          <div>
            <strong className="text-muted-foreground text-xs uppercase">Last Updated</strong>
            <div className="text-xs mt-1">{new Date(document.updated_at).toLocaleString()}</div>
          </div>
          <div>
            <strong className="text-muted-foreground text-xs uppercase">Content Keys</strong>
            <div className="font-mono text-xs mt-1">
              {document.content ? Object.keys(document.content).join(', ') : 'No content'}
            </div>
          </div>
          <div>
            <strong className="text-muted-foreground text-xs uppercase">User ID</strong>
            <div className="flex items-center gap-1 mt-1">
              <div className="font-mono text-xs bg-muted p-1 rounded border break-all flex-1">{document.user_id}</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() => handleCopy(document.user_id, 'User ID')}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
