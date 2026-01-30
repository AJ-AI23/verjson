import React, { useEffect, useMemo } from 'react';
import { TOCEntry, ManifestEmbed, ManifestTheme, defaultManifestTheme } from '@/types/manifest';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentContentRenderer } from '@/components/renderers';
import { useManifestDocumentResolver } from '@/hooks/useManifestDocumentResolver';

interface ManifestContentPaneProps {
  entry: TOCEntry | null;
  embeds?: ManifestEmbed[];
  workspaceId?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  theme?: ManifestTheme;
}

export const ManifestContentPane: React.FC<ManifestContentPaneProps> = ({
  entry,
  embeds,
  workspaceId,
  onPrevious,
  onNext,
  theme = defaultManifestTheme,
}) => {
  const { resolveDocument, getDocument, isLoading, getError } = useManifestDocumentResolver();

  // Determine content source
  const hasRef = !!entry?.ref;
  const isDocumentRef = entry?.ref?.startsWith('document://');
  const isEmbedRef = entry?.ref?.startsWith('embed://');

  // Extract document ID from document:// reference
  const linkedDocumentId = useMemo(() => {
    if (isDocumentRef && entry?.ref) {
      return entry.ref.replace('document://', '');
    }
    return null;
  }, [isDocumentRef, entry?.ref]);

  // Find embed content if it's an embed reference
  const embedContent = useMemo(() => {
    if (!isEmbedRef || !embeds || !entry?.ref) return null;
    const embedId = entry.ref.replace('embed://', '');
    return embeds.find(e => e.id === embedId) || null;
  }, [isEmbedRef, embeds, entry?.ref]);

  // Resolve linked document on demand
  useEffect(() => {
    if (linkedDocumentId) {
      resolveDocument(linkedDocumentId);
    }
  }, [linkedDocumentId, resolveDocument]);

  // Get resolved document content
  const resolvedDocumentContent = linkedDocumentId ? getDocument(linkedDocumentId) : null;
  const isLoadingDocument = linkedDocumentId ? isLoading(linkedDocumentId) : false;
  const documentError = linkedDocumentId ? getError(linkedDocumentId) : null;

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

  const contentStyle: React.CSSProperties = {
    backgroundColor: theme.content.background,
    color: theme.content.text,
  };

  const linkStyle = { '--link-color': theme.content.linkColor } as React.CSSProperties;

  return (
    <div className="flex-1 flex flex-col min-h-0" style={contentStyle}>
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto" style={linkStyle}>
          {/* Page title */}
          <h1 className="text-2xl font-bold mb-4">{entry.title}</h1>

          {/* Description */}
          {entry.description && (
            <p className="opacity-70 mb-6">{entry.description}</p>
          )}

          {/* Content area */}
          <div className="prose dark:prose-invert max-w-none [&_a]:text-[var(--link-color)]">
            {/* No reference and no children - empty page */}
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

            {/* Document reference - fetch and render */}
            {isDocumentRef && linkedDocumentId && (
              <div className="not-prose">
                {isLoadingDocument && (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                )}

                {documentError && (
                  <div className="border rounded-lg p-4 bg-destructive/10 text-destructive">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Failed to load document</span>
                    </div>
                    <p className="text-sm mt-2">{documentError}</p>
                  </div>
                )}

                {resolvedDocumentContent && !isLoadingDocument && (
                  <DocumentContentRenderer content={resolvedDocumentContent} />
                )}
              </div>
            )}

            {/* Embed reference - render stored content */}
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

            {embedContent && embedContent.content && (
              <div className="not-prose">
                <DocumentContentRenderer content={embedContent.content} />
              </div>
            )}

            {embedContent && !embedContent.content && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">Embedded Content</span>
                </div>
                <p className="text-sm">
                  {embedContent.documentId 
                    ? `Linked to document: ${embedContent.documentId}`
                    : 'No content available'
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
