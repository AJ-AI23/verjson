import React, { useState, useMemo } from 'react';
import { TOCEntry, IndexEntry } from '@/types/manifest';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FileText, Tag } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ManifestSearchProps {
  toc: TOCEntry[];
  index?: IndexEntry[];
  searchQuery: string;
  onSearch: (query: string) => void;
  onSelectEntry: (entryId: string) => void;
}

interface SearchResult {
  type: 'toc' | 'keyword';
  entry: TOCEntry;
  keyword?: string;
  matchedText: string;
}

// Flatten TOC for searching
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

// Find entry by ID
const findEntryById = (entries: TOCEntry[], id: string): TOCEntry | null => {
  for (const entry of entries) {
    if (entry.id === id) return entry;
    if (entry.children) {
      const found = findEntryById(entry.children, id);
      if (found) return found;
    }
  }
  return null;
};

export const ManifestSearch: React.FC<ManifestSearchProps> = ({
  toc,
  index,
  searchQuery,
  onSearch,
  onSelectEntry,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const flatToc = useMemo(() => flattenToc(toc), [toc]);

  const searchResults = useMemo((): SearchResult[] => {
    if (!localQuery.trim()) return [];

    const query = localQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search in TOC entries
    for (const entry of flatToc) {
      if (
        entry.title.toLowerCase().includes(query) ||
        entry.description?.toLowerCase().includes(query) ||
        entry.keywords?.some(k => k.toLowerCase().includes(query))
      ) {
        results.push({
          type: 'toc',
          entry,
          matchedText: entry.title,
        });
      }
    }

    // Search in keyword index
    if (index) {
      for (const indexEntry of index) {
        if (indexEntry.keyword.toLowerCase().includes(query)) {
          for (const ref of indexEntry.entries) {
            const tocEntry = findEntryById(toc, ref.tocId);
            if (tocEntry && !results.some(r => r.entry.id === tocEntry.id)) {
              results.push({
                type: 'keyword',
                entry: tocEntry,
                keyword: indexEntry.keyword,
                matchedText: ref.context || tocEntry.title,
              });
            }
          }
        }
      }
    }

    return results.slice(0, 20); // Limit results
  }, [localQuery, flatToc, index, toc]);

  const handleSelect = (result: SearchResult) => {
    onSelectEntry(result.entry.id);
    setIsOpen(false);
    setLocalQuery('');
    onSearch('');
  };

  return (
    <Popover open={isOpen && searchResults.length > 0} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documentation..."
            value={localQuery}
            onChange={(e) => {
              setLocalQuery(e.target.value);
              onSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-9 h-8"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea className="max-h-[300px]">
          <div className="p-2 space-y-1">
            {searchResults.map((result, idx) => (
              <button
                key={`${result.entry.id}-${idx}`}
                className={cn(
                  "w-full flex items-start gap-2 p-2 text-left rounded-md",
                  "hover:bg-accent hover:text-accent-foreground transition-colors"
                )}
                onClick={() => handleSelect(result)}
              >
                {result.type === 'keyword' ? (
                  <Tag className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {result.entry.title}
                  </div>
                  {result.entry.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {result.entry.description}
                    </div>
                  )}
                  {result.keyword && (
                    <div className="text-xs text-primary">
                      Keyword: {result.keyword}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
