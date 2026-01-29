import React from 'react';
import { TOCEntry } from '@/types/manifest';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManifestBreadcrumbProps {
  path: TOCEntry[];
  onSelectEntry: (entryId: string) => void;
}

export const ManifestBreadcrumb: React.FC<ManifestBreadcrumbProps> = ({
  path,
  onSelectEntry,
}) => {
  if (path.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 px-4 py-2 border-b bg-muted/20 text-sm">
      <button
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => path.length > 0 && onSelectEntry(path[0].id)}
      >
        <Home className="h-3.5 w-3.5" />
      </button>

      {path.map((entry, index) => (
        <React.Fragment key={entry.id}>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <button
            className={cn(
              "hover:text-foreground transition-colors truncate max-w-[200px]",
              index === path.length - 1
                ? "text-foreground font-medium"
                : "text-muted-foreground"
            )}
            onClick={() => onSelectEntry(entry.id)}
          >
            {entry.title}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};
