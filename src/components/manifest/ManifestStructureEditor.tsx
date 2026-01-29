import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Box, FileText, Plus, Trash2, Pencil, Check, X, BookOpen, Link2, Library, List, Hash } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SortablePropertyList, SortableItem, reorderArrayItems } from '@/components/schema/SortablePropertyList';
import { useStructureSearch } from '@/hooks/useStructureSearch';
import { StructureSearchBar } from '@/components/schema/StructureSearchBar';
import { ManifestDocument, TOCEntry } from '@/types/manifest';
import { CollapsedState } from '@/lib/diagram/types';
import { ConsistencyIssue } from '@/types/consistency';

interface ManifestStructureEditorProps {
  schema: ManifestDocument;
  onSchemaChange: (schema: ManifestDocument) => void;
  consistencyIssues?: ConsistencyIssue[];
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  selectedNodePath?: string | null;
}

// Editable value for primitive types
const EditableValue: React.FC<{
  value: any;
  onValueChange: (newValue: any) => void;
}> = ({ value, onValueChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState(String(value));

  const handleSubmit = () => {
    let parsedValue: any = editedValue;
    if (typeof value === 'number') {
      const num = parseFloat(editedValue);
      if (!isNaN(num)) parsedValue = num;
    } else if (typeof value === 'boolean') {
      parsedValue = editedValue.toLowerCase() === 'true';
    }
    onValueChange(parsedValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedValue(String(value));
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editedValue}
          onChange={(e) => setEditedValue(e.target.value)}
          className="h-6 w-40 text-xs px-1"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleSubmit}>
          <Check className="h-3 w-3 text-green-500" />
        </Button>
        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleCancel}>
          <X className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <span 
      className="text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:underline group inline-flex items-center gap-1 max-w-[200px] truncate"
      onClick={() => setIsEditing(true)}
      title={typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
    >
      <span className="truncate">
        {typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
      </span>
      <Pencil className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-50" />
    </span>
  );
};

// Icon picker for TOC entries
const getIconComponent = (iconName: string | undefined) => {
  switch (iconName) {
    case 'BookOpen': return <BookOpen className="h-4 w-4 text-primary" />;
    case 'FileText': return <FileText className="h-4 w-4 text-blue-500" />;
    case 'Library': return <Library className="h-4 w-4 text-purple-500" />;
    case 'List': return <List className="h-4 w-4 text-green-500" />;
    case 'Hash': return <Hash className="h-4 w-4 text-orange-500" />;
    case 'Link2': return <Link2 className="h-4 w-4 text-cyan-500" />;
    default: return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
};

// Add page button
const AddPageButton: React.FC<{
  onAdd: (entry: TOCEntry) => void;
}> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const handleAdd = () => {
    if (!title.trim()) return;
    const id = title.trim().toLowerCase().replace(/\s+/g, '-');
    onAdd({
      id,
      title: title.trim(),
      description: '',
    });
    setTitle('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-3 w-3" />
          Add Page
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="end">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Page Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Getting Started"
              className="h-8 text-sm mt-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
          </div>
          <Button onClick={handleAdd} size="sm" className="w-full">
            Create Page
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// TOC Entry editor component
interface TOCEntryEditorProps {
  entry: TOCEntry;
  path: number[];
  depth: number;
  onUpdate: (path: number[], updates: Partial<TOCEntry>) => void;
  onDelete: (path: number[]) => void;
  onAddChild: (path: number[], child: TOCEntry) => void;
  onReorder: (path: number[], oldIndex: number, newIndex: number) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (pathKey: string) => void;
}

const TOCEntryEditor: React.FC<TOCEntryEditorProps> = ({
  entry,
  path,
  depth,
  onUpdate,
  onDelete,
  onAddChild,
  onReorder,
  expandedPaths,
  onToggleExpand,
}) => {
  const pathKey = path.join('.');
  const isExpanded = expandedPaths.has(pathKey);
  const hasChildren = entry.children && entry.children.length > 0;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(entry.title);

  const handleTitleSubmit = () => {
    if (editedTitle.trim() !== entry.title) {
      onUpdate(path, { title: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setEditedTitle(entry.title);
    setIsEditingTitle(false);
  };

  return (
    <div className="border rounded-lg overflow-hidden mb-2">
      <div 
        className={cn(
          "flex items-center gap-2 p-2 bg-muted/30 hover:bg-muted/50 transition-colors group",
          isExpanded && hasChildren && "border-b"
        )}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={() => onToggleExpand(pathKey)}
          className="p-0.5 hover:bg-muted rounded"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>

        {/* Icon */}
        {getIconComponent(entry.icon)}

        {/* Title */}
        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <div className="flex items-center gap-1">
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="h-6 text-xs px-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') handleTitleCancel();
                }}
              />
              <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleTitleSubmit}>
                <Check className="h-3 w-3 text-green-500" />
              </Button>
              <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleTitleCancel}>
                <X className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ) : (
            <span 
              className="text-sm font-medium cursor-pointer hover:underline"
              onClick={() => setIsEditingTitle(true)}
            >
              {entry.title}
            </span>
          )}
        </div>

        {/* ID badge */}
        <Badge variant="outline" className="text-xs shrink-0">
          {entry.id}
        </Badge>

        {/* Reference indicator */}
        {entry.ref && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Link2 className="h-2.5 w-2.5" />
            {entry.ref.startsWith('document://') ? 'Doc' : 'Embed'}
          </Badge>
        )}

        {/* Add child button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            const id = `${entry.id}-child-${Date.now()}`;
            onAddChild(path, {
              id,
              title: 'New Page',
              description: '',
            });
            if (!isExpanded) {
              onToggleExpand(pathKey);
            }
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(path);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="p-2 pl-6 bg-background">
          <SortablePropertyList
            items={entry.children!.map((_, i) => String(i))}
            onReorder={(oldIndex, newIndex) => onReorder(path, oldIndex, newIndex)}
          >
            {entry.children!.map((child, index) => (
              <SortableItem key={child.id} id={String(index)}>
                <TOCEntryEditor
                  entry={child}
                  path={[...path, index]}
                  depth={depth + 1}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                  onReorder={onReorder}
                  expandedPaths={expandedPaths}
                  onToggleExpand={onToggleExpand}
                />
              </SortableItem>
            ))}
          </SortablePropertyList>
        </div>
      )}
    </div>
  );
};

export const ManifestStructureEditor: React.FC<ManifestStructureEditorProps> = ({
  schema,
  onSchemaChange,
  consistencyIssues = [],
  collapsedPaths = {},
  onToggleCollapse,
  selectedNodePath,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'structure' | 'pages'>('structure');
  const [expandedTocPaths, setExpandedTocPaths] = useState<Set<string>>(new Set());

  // Search functionality
  const {
    searchQuery,
    setSearchQuery,
    matches,
    currentMatchIndex,
    goToNextMatch,
    goToPrevMatch,
    clearSearch,
    searchInputRef,
  } = useStructureSearch({
    schema,
    containerRef,
  });

  // Toggle TOC entry expansion
  const handleToggleTocExpand = useCallback((pathKey: string) => {
    setExpandedTocPaths(prev => {
      const next = new Set(prev);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  }, []);

  // Document section fields
  const documentFields = useMemo(() => {
    const fields: { key: string; value: any; path: string[] }[] = [];
    
    if (schema.verjson !== undefined) {
      fields.push({ key: 'verjson', value: schema.verjson, path: ['verjson'] });
    }
    if (schema.type !== undefined) {
      fields.push({ key: 'type', value: schema.type, path: ['type'] });
    }
    if (schema.selectedTheme !== undefined) {
      fields.push({ key: 'selectedTheme', value: schema.selectedTheme, path: ['selectedTheme'] });
    }
    
    return fields;
  }, [schema]);

  // Info section fields
  const infoFields = useMemo(() => {
    const fields: { key: string; value: any; path: string[] }[] = [];
    
    if (schema.info) {
      const infoKeys = ['version', 'title', 'description', 'author', 'created', 'modified'];
      for (const key of infoKeys) {
        if ((schema.info as any)[key] !== undefined) {
          fields.push({ key, value: (schema.info as any)[key], path: ['info', key] });
        }
      }
    }
    
    return fields;
  }, [schema]);

  // Handle property change
  const handlePropertyChange = useCallback((path: string[], value: any) => {
    const newSchema = { ...schema };
    let current: any = newSchema;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  // Handle TOC entry update
  const handleTocUpdate = useCallback((path: number[], updates: Partial<TOCEntry>) => {
    const newSchema = { ...schema, data: { ...schema.data, toc: [...schema.data.toc] } };
    
    let current: TOCEntry[] = newSchema.data.toc;
    for (let i = 0; i < path.length - 1; i++) {
      const entry = current[path[i]];
      entry.children = [...(entry.children || [])];
      current = entry.children;
    }
    
    const lastIndex = path[path.length - 1];
    current[lastIndex] = { ...current[lastIndex], ...updates };
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  // Handle TOC entry delete
  const handleTocDelete = useCallback((path: number[]) => {
    const newSchema = { ...schema, data: { ...schema.data, toc: [...schema.data.toc] } };
    
    let current: TOCEntry[] = newSchema.data.toc;
    for (let i = 0; i < path.length - 1; i++) {
      const entry = current[path[i]];
      entry.children = [...(entry.children || [])];
      current = entry.children;
    }
    
    current.splice(path[path.length - 1], 1);
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  // Handle add child to TOC entry
  const handleTocAddChild = useCallback((path: number[], child: TOCEntry) => {
    const newSchema = { ...schema, data: { ...schema.data, toc: [...schema.data.toc] } };
    
    let current: TOCEntry[] = newSchema.data.toc;
    for (let i = 0; i < path.length; i++) {
      const entry = current[path[i]];
      if (i === path.length - 1) {
        entry.children = [...(entry.children || []), child];
      } else {
        entry.children = [...(entry.children || [])];
        current = entry.children;
      }
    }
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  // Handle TOC reorder
  const handleTocReorder = useCallback((path: number[], oldIndex: number, newIndex: number) => {
    const newSchema = { ...schema, data: { ...schema.data, toc: [...schema.data.toc] } };
    
    let current: TOCEntry[] = newSchema.data.toc;
    for (let i = 0; i < path.length; i++) {
      const entry = current[path[i]];
      entry.children = [...(entry.children || [])];
      current = entry.children;
    }
    
    const reordered = reorderArrayItems(current, oldIndex, newIndex);
    
    // Apply the reordered array back
    if (path.length === 0) {
      newSchema.data.toc = reordered;
    } else {
      let parent: any = newSchema.data;
      for (let i = 0; i < path.length; i++) {
        if (i === 0) {
          parent = parent.toc[path[i]];
        } else {
          parent = parent.children![path[i]];
        }
      }
      parent.children = reordered;
    }
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  // Handle add root page
  const handleAddRootPage = useCallback((entry: TOCEntry) => {
    const newSchema = {
      ...schema,
      data: {
        ...schema.data,
        toc: [...schema.data.toc, entry],
      },
    };
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  if (!schema || typeof schema !== 'object') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Invalid manifest</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col" tabIndex={-1}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'structure' | 'pages')}
        className="h-full flex flex-col"
      >
        <div className="flex items-center gap-1 border-b bg-muted/30">
          <TabsList className="justify-start rounded-none bg-transparent">
            <TabsTrigger value="structure" className="data-[state=active]:bg-muted">
              Structure
            </TabsTrigger>
            <TabsTrigger value="pages" className="data-[state=active]:bg-muted">
              Pages
            </TabsTrigger>
          </TabsList>
          <StructureSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            matchCount={matches.length}
            currentMatchIndex={currentMatchIndex}
            onNextMatch={goToNextMatch}
            onPrevMatch={goToPrevMatch}
            onClear={clearSearch}
            inputRef={searchInputRef}
            className="ml-auto"
          />
        </div>

        <TabsContent value="structure" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 p-4">
              {/* Document section */}
              {documentFields.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 border-b">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Document</span>
                  </div>
                  <div className="p-3 bg-background space-y-2">
                    {documentFields.map(({ key, value, path }) => (
                      <div key={key} className="flex items-center gap-2 text-sm" data-search-path={path.join('.')}>
                        <span className="font-medium text-muted-foreground w-28">{key}:</span>
                        <EditableValue 
                          value={value} 
                          onValueChange={(v) => handlePropertyChange(path, v)} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info section */}
              {infoFields.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 border-b">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold text-sm">Info</span>
                  </div>
                  <div className="p-3 bg-background space-y-2">
                    {infoFields.map(({ key, value, path }) => (
                      <div key={key} className="flex items-center gap-2 text-sm" data-search-path={path.join('.')}>
                        <span className="font-medium text-muted-foreground w-28">{key}:</span>
                        <EditableValue 
                          value={value} 
                          onValueChange={(v) => handlePropertyChange(path, v)} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data section summary */}
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 p-3 bg-muted/30 border-b">
                  <Box className="h-4 w-4 text-amber-500" />
                  <span className="font-semibold text-sm">Data</span>
                </div>
                <div className="p-3 bg-background space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-muted-foreground w-28">TOC entries:</span>
                    <Badge variant="secondary">{schema.data.toc.length}</Badge>
                  </div>
                  {schema.data.index && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-muted-foreground w-28">Index entries:</span>
                      <Badge variant="secondary">{schema.data.index.length}</Badge>
                    </div>
                  )}
                  {schema.data.embeds && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-muted-foreground w-28">Embeds:</span>
                      <Badge variant="secondary">{schema.data.embeds.length}</Badge>
                    </div>
                  )}
                  {schema.data.defaultPage && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-muted-foreground w-28">Default page:</span>
                      <EditableValue 
                        value={schema.data.defaultPage} 
                        onValueChange={(v) => handlePropertyChange(['data', 'defaultPage'], v)} 
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="pages" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 p-4">
              {/* Add new page button */}
              <div className="flex justify-end gap-2">
                <AddPageButton onAdd={handleAddRootPage} />
              </div>

              {schema.data.toc.length > 0 ? (
                <SortablePropertyList
                  items={schema.data.toc.map((_, i) => String(i))}
                  onReorder={(oldIndex, newIndex) => handleTocReorder([], oldIndex, newIndex)}
                >
                  {schema.data.toc.map((entry, index) => (
                    <SortableItem key={entry.id} id={String(index)}>
                      <TOCEntryEditor
                        entry={entry}
                        path={[index]}
                        depth={0}
                        onUpdate={handleTocUpdate}
                        onDelete={handleTocDelete}
                        onAddChild={handleTocAddChild}
                        onReorder={handleTocReorder}
                        expandedPaths={expandedTocPaths}
                        onToggleExpand={handleToggleTocExpand}
                      />
                    </SortableItem>
                  ))}
                </SortablePropertyList>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No pages found</p>
                  <p className="text-sm text-muted-foreground/70">
                    Click "Add Page" to create your first page
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
