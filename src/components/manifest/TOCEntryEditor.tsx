import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Pencil, Check, X, Link2, FileCode, BookOpen, FileText, Library, List, Hash } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SortablePropertyList, SortableItem, reorderArrayItems } from '@/components/schema/SortablePropertyList';
import { TOCEntry } from '@/types/manifest';
import { DocumentReferenceDialog, ReferenceMode } from './DocumentReferenceDialog';

// Icon mapping for TOC entries
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

interface TOCEntryEditorProps {
  entry: TOCEntry;
  path: number[];
  depth: number;
  onUpdate: (path: number[], updates: Partial<TOCEntry>) => void;
  onDelete: (path: number[]) => void;
  onAddChild: (path: number[], child: TOCEntry) => void;
  onReorder: (path: number[], oldIndex: number, newIndex: number) => void;
  onAddEmbed: (documentId: string, documentName?: string) => Promise<string | null>; // Returns embed ID or null on failure
  expandedPaths: Set<string>;
  onToggleExpand: (pathKey: string) => void;
}

export const TOCEntryEditor: React.FC<TOCEntryEditorProps> = ({
  entry,
  path,
  depth,
  onUpdate,
  onDelete,
  onAddChild,
  onReorder,
  onAddEmbed,
  expandedPaths,
  onToggleExpand,
}) => {
  const pathKey = path.join('.');
  const isExpanded = expandedPaths.has(pathKey);
  const hasChildren = entry.children && entry.children.length > 0;
  const childrenPathKey = `${pathKey}.children`;
  const isChildrenExpanded = expandedPaths.has(childrenPathKey);
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(entry.title);
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>('link');
  const [isEmbedding, setIsEmbedding] = useState(false);

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

  const handleAddNewChild = () => {
    const id = `${entry.id}-child-${Date.now()}`;
    onAddChild(path, {
      id,
      title: 'New Page',
      description: '',
    });
    // Expand children section if not already expanded
    if (!isChildrenExpanded) {
      onToggleExpand(childrenPathKey);
    }
  };

  const handleReferenceSelect = async (reference: string, documentName?: string) => {
    // For embeds, we need to create an embed entry and reference it
    if (referenceMode === 'embed' && reference.startsWith('embed://')) {
      // Extract document ID from embed://documentId format
      const documentId = reference.replace('embed://', '');
      setIsEmbedding(true);
      try {
        // Create embed entry (fetches content) and get the embed ID
        const embedId = await onAddEmbed(documentId, documentName);
        if (embedId) {
          // Update the TOC entry to reference the embed
          onUpdate(path, { ref: `embed://${embedId}` });
        }
      } finally {
        setIsEmbedding(false);
      }
    } else {
      // For links, just use the reference directly
      onUpdate(path, { ref: reference });
    }
  };

  const openReferenceDialog = (mode: ReferenceMode) => {
    setReferenceMode(mode);
    setReferenceDialogOpen(true);
  };

  return (
    <>
      <div className="border rounded-lg overflow-hidden mb-2">
        {/* Page header */}
        <div 
          className={cn(
            "flex items-center gap-2 p-2 bg-muted/30 hover:bg-muted/50 transition-colors group cursor-pointer",
            isExpanded && "border-b"
          )}
          onClick={() => onToggleExpand(pathKey)}
        >
          {/* Expand/collapse toggle */}
          <div className="p-0.5">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Icon */}
          {getIconComponent(entry.icon)}

          {/* Title */}
          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
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
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
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
              {entry.ref.startsWith('document://') ? 'Link' : 'Embed'}
            </Badge>
          )}

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

        {/* Expanded content */}
        {isExpanded && (
          <div className="p-3 bg-background space-y-3">
            {/* Children property */}
            <div className="border rounded-md overflow-hidden">
              <div 
                className="flex items-center gap-2 p-2 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => onToggleExpand(childrenPathKey)}
              >
                <div className="p-0.5">
                  {isChildrenExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <span className="text-xs font-medium text-muted-foreground">children</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  {entry.children?.length || 0}
                </Badge>
              </div>
              
              {isChildrenExpanded && (
                <div className="p-2 bg-muted/5 border-t">
                  {hasChildren ? (
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
                            onAddEmbed={onAddEmbed}
                            expandedPaths={expandedPaths}
                            onToggleExpand={onToggleExpand}
                          />
                        </SortableItem>
                      ))}
                    </SortablePropertyList>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No child pages
                    </p>
                  )}
                  
                  {/* Add child button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 gap-1 text-xs h-7 border border-dashed"
                    onClick={handleAddNewChild}
                  >
                    <Plus className="h-3 w-3" />
                    Add Child Page
                  </Button>
                </div>
              )}
            </div>

            {/* Embed and Link buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs"
                onClick={() => openReferenceDialog('embed')}
              >
                <FileCode className="h-3.5 w-3.5" />
                Embed
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs"
                onClick={() => openReferenceDialog('link')}
              >
                <Link2 className="h-3.5 w-3.5" />
                Link
              </Button>
            </div>

            {/* Current reference display */}
            {entry.ref && (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                <span className="text-xs text-muted-foreground">Reference:</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded flex-1 truncate">
                  {entry.ref}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-destructive"
                  onClick={() => onUpdate(path, { ref: undefined })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <DocumentReferenceDialog
        open={referenceDialogOpen}
        onOpenChange={setReferenceDialogOpen}
        mode={referenceMode}
        onSelect={handleReferenceSelect}
      />
    </>
  );
};
