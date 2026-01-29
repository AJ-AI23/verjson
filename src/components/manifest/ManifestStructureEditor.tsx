import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Box, FileText, BookOpen } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SortablePropertyList, SortableItem, reorderArrayItems } from '@/components/schema/SortablePropertyList';
import { useStructureSearch } from '@/hooks/useStructureSearch';
import { StructureSearchBar } from '@/components/schema/StructureSearchBar';
import { ManifestDocument, TOCEntry, ManifestEmbed } from '@/types/manifest';
import { CollapsedState } from '@/lib/diagram/types';
import { ConsistencyIssue } from '@/types/consistency';
import { TOCEntryEditor } from './TOCEntryEditor';
import { EditableValue } from './EditableValue';
import { AddPageButton } from './AddPageButton';

interface ManifestStructureEditorProps {
  schema: ManifestDocument;
  onSchemaChange: (schema: ManifestDocument) => void;
  consistencyIssues?: ConsistencyIssue[];
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  selectedNodePath?: string | null;
}

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

  // Handle add embed - creates embed entry and returns embed ID
  const handleAddEmbed = useCallback((documentId: string, documentName?: string): string => {
    const embedId = `embed-${Date.now()}`;
    const newEmbed: ManifestEmbed = {
      id: embedId,
      type: 'markdown',
      documentId,
    };
    
    const newSchema = {
      ...schema,
      data: {
        ...schema.data,
        embeds: [...(schema.data.embeds || []), newEmbed],
      },
    };
    onSchemaChange(newSchema);
    
    return embedId;
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
                        onAddEmbed={handleAddEmbed}
                        expandedPaths={expandedTocPaths}
                        onToggleExpand={handleToggleTocExpand}
                      />
                    </SortableItem>
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
