import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Search, FileText, BookOpen, Settings, HelpCircle, Plug } from 'lucide-react';
import { DocumentationViewer } from './DocumentationViewer';

interface DocumentationItem {
  id: string;
  title: string;
  category: string;
  path: string;
  description?: string;
}

const documentationItems: DocumentationItem[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    category: 'Basics',
    path: '/docs/getting-started.md',
    description: 'Learn the basics of using the schema editor'
  },
  {
    id: 'schema-editor',
    title: 'Schema Editor Guide',
    category: 'Features',
    path: '/docs/schema-editor.md',
    description: 'Complete guide to the JSON schema editor'
  },
  {
    id: 'diagram-view',
    title: 'Diagram Visualization',
    category: 'Features',
    path: '/docs/diagram-view.md',
    description: 'Understanding the schema diagram view'
  },
  {
    id: 'collaboration',
    title: 'Collaboration Features',
    category: 'Workspace',
    path: '/docs/collaboration.md',
    description: 'Working with teams and sharing documents'
  },
  {
    id: 'confluence-integration',
    title: 'Confluence Plugin',
    category: 'Integrations',
    path: '/docs/confluence-integration.md',
    description: 'Embed schema documents in Confluence pages'
  }
];

interface DocumentationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DocumentationDialog: React.FC<DocumentationDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocumentationItem | null>(null);
  const [filteredDocs, setFilteredDocs] = useState<DocumentationItem[]>(documentationItems);

  useEffect(() => {
    const filtered = documentationItems.filter(
      (doc) =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredDocs(filtered);
  }, [searchQuery]);

  const categories = Array.from(new Set(filteredDocs.map((doc) => doc.category)));

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Basics':
        return <BookOpen className="h-4 w-4" />;
      case 'Features':
        return <FileText className="h-4 w-4" />;
      case 'Workspace':
        return <Settings className="h-4 w-4" />;
      case 'Advanced':
        return <HelpCircle className="h-4 w-4" />;
      case 'Integrations':
        return <Plug className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[80vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Documentation
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-80 border-r bg-muted/30 flex flex-col">
            <div className="p-4 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 pt-0">
                {categories.map((category) => (
                  <div key={category} className="mb-6">
                    <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-foreground/80">
                      {getCategoryIcon(category)}
                      {category}
                    </div>
                    <div className="space-y-1 ml-6">
                      {filteredDocs
                        .filter((doc) => doc.category === category)
                        .map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => setSelectedDoc(doc)}
                            className={`w-full text-left p-3 rounded-md transition-colors hover:bg-accent/50 ${
                              selectedDoc?.id === doc.id
                                ? 'bg-accent text-accent-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <div className="font-medium text-sm">{doc.title}</div>
                            {doc.description && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {doc.description}
                              </div>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedDoc ? (
              <DocumentationViewer docPath={selectedDoc.path} title={selectedDoc.title} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Welcome to Documentation</p>
                  <p className="text-sm">Select a topic from the sidebar to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};