import React from 'react';
import { TOCEntry, ManifestTheme, defaultManifestTheme } from '@/types/manifest';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronDown, FileText, Folder, BookOpen, Library, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManifestNavigationProps {
  toc: TOCEntry[];
  selectedEntryId: string | null;
  collapsedSections: Set<string>;
  onSelectEntry: (entryId: string) => void;
  onToggleCollapse: (entryId: string) => void;
  className?: string;
  theme?: ManifestTheme;
}

// Map icon names to components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  FileText,
  Library,
  Folder,
  File,
};

const getIcon = (iconName?: string) => {
  if (!iconName) return FileText;
  return iconMap[iconName] || FileText;
};

const TocItem: React.FC<{
  entry: TOCEntry;
  depth: number;
  selectedEntryId: string | null;
  collapsedSections: Set<string>;
  onSelectEntry: (entryId: string) => void;
  onToggleCollapse: (entryId: string) => void;
  theme: ManifestTheme;
}> = ({ entry, depth, selectedEntryId, collapsedSections, onSelectEntry, onToggleCollapse, theme }) => {
  const hasChildren = entry.children && entry.children.length > 0;
  const isCollapsed = collapsedSections.has(entry.id);
  const isSelected = entry.id === selectedEntryId;
  const Icon = getIcon(entry.icon);

  const itemStyle: React.CSSProperties = {
    color: theme.navigation.text,
    ...(isSelected && { backgroundColor: theme.navigation.activeBackground }),
  };

  return (
    <div>
      <button
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-sm text-left rounded-md transition-colors",
          isSelected && "font-medium"
        )}
        style={{
          paddingLeft: `${8 + depth * 16}px`,
          ...itemStyle,
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = theme.navigation.hoverBackground;
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
        onClick={() => onSelectEntry(entry.id)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(entry.id);
            }}
            className="p-0.5 hover:opacity-70 rounded"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
        {!hasChildren && <span className="w-4" />}
        <Icon className="h-4 w-4 shrink-0 opacity-60" />
        <span className="truncate">{entry.title}</span>
      </button>

      {hasChildren && !isCollapsed && (
        <div>
          {entry.children!.map((child) => (
            <TocItem
              key={child.id}
              entry={child}
              depth={depth + 1}
              selectedEntryId={selectedEntryId}
              collapsedSections={collapsedSections}
              onSelectEntry={onSelectEntry}
              onToggleCollapse={onToggleCollapse}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const ManifestNavigation: React.FC<ManifestNavigationProps> = ({
  toc,
  selectedEntryId,
  collapsedSections,
  onSelectEntry,
  onToggleCollapse,
  className,
  theme = defaultManifestTheme,
}) => {
  return (
    <div 
      className={cn("w-64 border-r flex flex-col shrink-0", className)}
      style={{ backgroundColor: theme.navigation.background, color: theme.navigation.text }}
    >
      <div className="p-2 border-b">
        <h3 className="text-sm font-semibold">Contents</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {toc.map((entry) => (
            <TocItem
              key={entry.id}
              entry={entry}
              depth={0}
              selectedEntryId={selectedEntryId}
              collapsedSections={collapsedSections}
              onSelectEntry={onSelectEntry}
              onToggleCollapse={onToggleCollapse}
              theme={theme}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};