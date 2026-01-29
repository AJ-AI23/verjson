import React, { useState, useCallback, useMemo } from 'react';
import { ManifestDocument, TOCEntry } from '@/types/manifest';
import { ManifestNavigation } from './ManifestNavigation';
import { ManifestBreadcrumb } from './ManifestBreadcrumb';
import { ManifestSearch } from './ManifestSearch';
import { ManifestContentPane } from './ManifestContentPane';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManifestEditorProps {
  document: ManifestDocument;
  onDocumentChange: (doc: ManifestDocument) => void;
  readOnly?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  workspaceId?: string;
}

// Helper to find a TOC entry by ID
const findTocEntry = (entries: TOCEntry[], id: string): TOCEntry | null => {
  for (const entry of entries) {
    if (entry.id === id) return entry;
    if (entry.children) {
      const found = findTocEntry(entry.children, id);
      if (found) return found;
    }
  }
  return null;
};

// Helper to build breadcrumb path
const buildBreadcrumbPath = (entries: TOCEntry[], targetId: string, path: TOCEntry[] = []): TOCEntry[] | null => {
  for (const entry of entries) {
    const newPath = [...path, entry];
    if (entry.id === targetId) return newPath;
    if (entry.children) {
      const found = buildBreadcrumbPath(entry.children, targetId, newPath);
      if (found) return found;
    }
  }
  return null;
};

// Helper to get flattened TOC for prev/next navigation
const flattenToc = (entries: TOCEntry[]): TOCEntry[] => {
  const result: TOCEntry[] = [];
  for (const entry of entries) {
    result.push(entry);
    if (entry.children) {
      result.push(...flattenToc(entry.children));
    }
  }
  return result;
};

export const ManifestEditor: React.FC<ManifestEditorProps> = ({
  document,
  onDocumentChange,
  readOnly = false,
  isFullscreen = false,
  onToggleFullscreen,
  workspaceId,
}) => {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(
    document.data.defaultPage || document.data.toc[0]?.id || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const selectedEntry = useMemo(() => {
    if (!selectedEntryId) return null;
    return findTocEntry(document.data.toc, selectedEntryId);
  }, [document.data.toc, selectedEntryId]);

  const breadcrumbPath = useMemo(() => {
    if (!selectedEntryId) return [];
    return buildBreadcrumbPath(document.data.toc, selectedEntryId) || [];
  }, [document.data.toc, selectedEntryId]);

  const flattenedToc = useMemo(() => flattenToc(document.data.toc), [document.data.toc]);

  const currentIndex = useMemo(() => {
    if (!selectedEntryId) return -1;
    return flattenedToc.findIndex(e => e.id === selectedEntryId);
  }, [flattenedToc, selectedEntryId]);

  const handleSelectEntry = useCallback((entryId: string) => {
    setSelectedEntryId(entryId);
  }, []);

  const handleToggleCollapse = useCallback((entryId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedEntryId(flattenedToc[currentIndex - 1].id);
    }
  }, [currentIndex, flattenedToc]);

  const handleNext = useCallback(() => {
    if (currentIndex < flattenedToc.length - 1) {
      setSelectedEntryId(flattenedToc[currentIndex + 1].id);
    }
  }, [currentIndex, flattenedToc]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  return (
    <div className={cn(
      "flex flex-col h-full bg-background",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Header with search and fullscreen toggle */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
        <ManifestSearch
          toc={document.data.toc}
          index={document.data.index}
          searchQuery={searchQuery}
          onSearch={handleSearch}
          onSelectEntry={handleSelectEntry}
        />
        {onToggleFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFullscreen}
            className="h-8 w-8"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Navigation sidebar */}
        <ManifestNavigation
          toc={document.data.toc}
          selectedEntryId={selectedEntryId}
          collapsedSections={collapsedSections}
          onSelectEntry={handleSelectEntry}
          onToggleCollapse={handleToggleCollapse}
        />

        {/* Content pane */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Breadcrumb */}
          <ManifestBreadcrumb
            path={breadcrumbPath}
            onSelectEntry={handleSelectEntry}
          />

          {/* Content */}
          <ManifestContentPane
            entry={selectedEntry}
            embeds={document.data.embeds}
            workspaceId={workspaceId}
            onPrevious={currentIndex > 0 ? handlePrevious : undefined}
            onNext={currentIndex < flattenedToc.length - 1 ? handleNext : undefined}
          />
        </div>
      </div>
    </div>
  );
};
