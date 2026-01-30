import React from 'react';
import { TOCEntry, ManifestTheme, defaultManifestTheme } from '@/types/manifest';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManifestBreadcrumbProps {
  path: TOCEntry[];
  onSelectEntry: (entryId: string) => void;
  theme?: ManifestTheme;
}

export const ManifestBreadcrumb: React.FC<ManifestBreadcrumbProps> = ({
  path,
  onSelectEntry,
  theme = defaultManifestTheme,
}) => {
  if (path.length === 0) {
    return null;
  }

  return (
    <nav 
      className="flex items-center gap-1 px-4 py-2 border-b text-sm"
      style={{ backgroundColor: theme.content.background, color: theme.content.text }}
    >
      <button
        className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
        onClick={() => path.length > 0 && onSelectEntry(path[0].id)}
      >
        <Home className="h-3.5 w-3.5" />
      </button>

      {path.map((entry, index) => (
        <React.Fragment key={entry.id}>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          <button
            className={cn(
              "hover:opacity-100 transition-opacity truncate max-w-[200px]",
              index === path.length - 1
                ? "font-medium"
                : "opacity-60"
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