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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileText, Archive } from 'lucide-react';
import { Document } from '@/types/workspace';
import JSZip from 'jszip';

interface BulkExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: Document[];
  onExport: (selectedDocuments: Document[]) => Promise<void>;
}

export function BulkExportDialog({
  open,
  onOpenChange,
  documents,
  onExport,
}: BulkExportDialogProps) {
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const handleDocumentToggle = (documentId: string) => {
    const newSelection = new Set(selectedDocumentIds);
    if (newSelection.has(documentId)) {
      newSelection.delete(documentId);
    } else {
      newSelection.add(documentId);
    }
    setSelectedDocumentIds(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedDocumentIds.size === documents.length) {
      setSelectedDocumentIds(new Set());
    } else {
      setSelectedDocumentIds(new Set(documents.map(doc => doc.id)));
    }
  };

  const handleExport = async () => {
    const selectedDocuments = documents.filter(doc => selectedDocumentIds.has(doc.id));
    setIsExporting(true);
    await onExport(selectedDocuments);
    setIsExporting(false);
    setSelectedDocumentIds(new Set());
    onOpenChange(false);
  };

  const selectedCount = selectedDocumentIds.size;
  const allSelected = selectedCount === documents.length;
  const someSelected = selectedCount > 0 && selectedCount < documents.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Export Documents as ZIP
          </DialogTitle>
          <DialogDescription>
            Select the documents you want to export. They will be packaged into a single ZIP file.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                className={someSelected ? "data-[state=checked]:bg-primary data-[state=checked]:border-primary" : ""}
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Select all documents ({documents.length})
              </label>
            </div>
            {selectedCount > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedCount} selected
              </span>
            )}
          </div>

          <ScrollArea className="h-64 border rounded-md p-2">
            <div className="space-y-2">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent"
                >
                  <Checkbox
                    id={document.id}
                    checked={selectedDocumentIds.has(document.id)}
                    onCheckedChange={() => handleDocumentToggle(document.id)}
                  />
                  <label
                    htmlFor={document.id}
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {document.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {document.file_type}
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={selectedCount === 0 || isExporting}
          >
            {isExporting ? 'Creating ZIP...' : `Export ${selectedCount > 0 ? `${selectedCount} ` : ''}Document${selectedCount !== 1 ? 's' : ''} as ZIP`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}