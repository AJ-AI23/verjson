import React, { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DocumentConfigDialogProps {
  document: any;
  onDocumentUpdate: (updates: { name?: string; is_public?: boolean }) => void;
  disabled?: boolean;
}

export const DocumentConfigDialog: React.FC<DocumentConfigDialogProps> = ({
  document,
  onDocumentUpdate,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  // Check if current user is the document owner
  const isOwner = user?.id === document?.user_id;

  // Don't render if user is not the owner
  if (!isOwner) {
    return null;
  }

  useEffect(() => {
    if (document) {
      setDocumentName(document.name || '');
      setIsPublic(document.is_public || false);
    }
  }, [document]);

  const handleSave = async () => {
    if (!document) return;

    if (!documentName.trim()) {
      toast.error('Document name cannot be empty');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          name: documentName.trim(),
          is_public: isPublic,
          updated_at: new Date().toISOString(),
        })
        .eq('id', document.id);

      if (error) {
        console.error('Error updating document:', error);
        toast.error('Failed to update document configuration');
        return;
      }

      // Update the document in the parent component
      onDocumentUpdate({
        name: documentName.trim(),
        is_public: isPublic,
      });

      toast.success('Document configuration updated successfully');
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating document:', error);
      toast.error('Failed to update document configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    if (document) {
      setDocumentName(document.name || '');
      setIsPublic(document.is_public || false);
    }
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          disabled={disabled}
          title="Configure document"
        >
          <Settings className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Document Configuration</DialogTitle>
          <DialogDescription>
            Manage your document settings including name and visibility.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="document-name">Document Name</Label>
            <Input
              id="document-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Enter document name"
              maxLength={255}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="public-access">Public Access</Label>
              <div className="text-sm text-muted-foreground">
                Allow access via public URL without authentication
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isPublic ? (
                <Eye className="h-4 w-4 text-muted-foreground" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              <Switch
                id="public-access"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
          </div>
          
          {isPublic && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="font-medium text-foreground mb-1">Public URL</div>
              <div className="text-muted-foreground break-all">
                https://swghcmyqracwifpdfyap.supabase.co/functions/v1/public-document?id={document?.id}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};