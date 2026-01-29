import React from 'react';
import { TOCEntry, ManifestEmbed } from '@/types/manifest';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManifestContentPaneProps {
  entry: TOCEntry | null;
  embeds?: ManifestEmbed[];
  workspaceId?: string;
  onPrevious?: () => void;
  onNext?: () => void;
}

export const ManifestContentPane: React.FC<ManifestContentPaneProps> = ({
  entry,
  embeds,
  workspaceId,
  onPrevious,
  onNext,
}) => {
  if (!entry) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a page from the navigation to view content</p>
        </div>
      </div>
    );
  }

  // Determine content source
  const hasRef = !!entry.ref;
  const isDocumentRef = entry.ref?.startsWith('document://');
  const isEmbedRef = entry.ref?.startsWith('embed://');

  // Find embed content if it's an embed reference
  const embedContent = isEmbedRef && embeds
    ? embeds.find(e => `embed://${e.id}` === entry.ref)
    : null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Page title */}
          <h1 className="text-2xl font-bold mb-4">{entry.title}</h1>

          {/* Description */}
          {entry.description && (
            <p className="text-muted-foreground mb-6">{entry.description}</p>
          )}

          {/* Content area */}
          <div className="prose dark:prose-invert max-w-none">
            {!hasRef && !entry.children?.length && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No content linked to this page.</p>
                <p className="text-sm">
                  Add a <code className="text-xs bg-muted px-1 py-0.5 rounded">ref</code> to link 
                  a document or embed.
                </p>
              </div>
            )}

            {isDocumentRef && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ExternalLink className="h-4 w-4" />
                  <span className="text-sm">
                    References external document: <code className="text-xs">{entry.ref}</code>
                  </span>
                </div>
                <p className="text-sm mt-2">
                  Document content will be resolved and displayed here when the resolver is connected.
                </p>
              </div>
            )}

            {isEmbedRef && !embedContent && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">
                    Embed not found: <code className="text-xs">{entry.ref}</code>
                  </span>
                </div>
              </div>
            )}

            {embedContent && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">Embedded Content</span>
                </div>
                <p className="text-sm">
                  {embedContent.documentId 
                    ? `Linked to document: ${embedContent.documentId}`
                    : 'Inline markdown content'
                  }
                </p>
              </div>
            )}

            {/* Show children as links */}
            {entry.children && entry.children.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-3">In this section</h2>
                <ul className="space-y-2">
                  {entry.children.map((child) => (
                    <li key={child.id} className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{child.title}</span>
                      {child.description && (
                        <span className="text-sm text-muted-foreground">
                          — {child.description}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Navigation footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrevious}
          disabled={!onPrevious}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={!onNext}
          className="gap-1"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
