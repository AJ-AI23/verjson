import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Link, 
  Image,
  Eye,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { MarkdownDocument, MarkdownPage } from '@/types/markdown';
import { 
  linesToMarkdown, 
  markdownToLines, 
  getSortedLineKeys,
  insertAfterLine,
  updateLine,
  deleteLine
} from '@/lib/markdownUtils';
import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
  document: MarkdownDocument;
  onDocumentChange: (updatedDocument: MarkdownDocument) => void;
  readOnly?: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  document,
  onDocumentChange,
  readOnly = false
}) => {
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const activePage = document.data.pages[activePageIndex];
  
  // Convert hierarchical lines to markdown string for editing
  const markdownContent = useMemo(() => {
    if (!activePage?.lines) return '';
    return linesToMarkdown(activePage.lines);
  }, [activePage?.lines]);
  
  // Handle markdown text changes
  const handleTextChange = useCallback((newText: string) => {
    if (readOnly) return;
    
    const newLines = markdownToLines(newText);
    const updatedPages = [...document.data.pages];
    updatedPages[activePageIndex] = {
      ...updatedPages[activePageIndex],
      lines: newLines
    };
    
    onDocumentChange({
      ...document,
      info: {
        ...document.info,
        modified: new Date().toISOString()
      },
      data: {
        ...document.data,
        pages: updatedPages
      }
    });
  }, [document, activePageIndex, onDocumentChange, readOnly]);
  
  // Insert formatting at cursor
  const insertFormatting = useCallback((prefix: string, suffix: string = '') => {
    if (!textareaRef.current || readOnly) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = markdownContent.substring(start, end);
    
    const newText = 
      markdownContent.substring(0, start) + 
      prefix + selectedText + suffix + 
      markdownContent.substring(end);
    
    handleTextChange(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [markdownContent, handleTextChange, readOnly]);
  
  // Toolbar actions
  const toolbarActions = useMemo(() => [
    { icon: Bold, label: 'Bold', action: () => insertFormatting('**', '**') },
    { icon: Italic, label: 'Italic', action: () => insertFormatting('*', '*') },
    { icon: Heading1, label: 'Heading 1', action: () => insertFormatting('# ') },
    { icon: Heading2, label: 'Heading 2', action: () => insertFormatting('## ') },
    { icon: Heading3, label: 'Heading 3', action: () => insertFormatting('### ') },
    { icon: List, label: 'Bullet List', action: () => insertFormatting('- ') },
    { icon: ListOrdered, label: 'Numbered List', action: () => insertFormatting('1. ') },
    { icon: Quote, label: 'Quote', action: () => insertFormatting('> ') },
    { icon: Code, label: 'Code', action: () => insertFormatting('`', '`') },
    { icon: Link, label: 'Link', action: () => insertFormatting('[', '](url)') },
    { icon: Image, label: 'Image', action: () => insertFormatting('![alt](', ')') },
  ], [insertFormatting]);
  
  // Add new page
  const addPage = useCallback(() => {
    if (readOnly) return;
    
    const newPageId = `page-${document.data.pages.length + 1}`;
    const newPage: MarkdownPage = {
      id: newPageId,
      title: `Page ${document.data.pages.length + 1}`,
      lines: {
        "1": `# Page ${document.data.pages.length + 1}`,
        "2": "",
        "3": "Start writing here..."
      }
    };
    
    onDocumentChange({
      ...document,
      info: {
        ...document.info,
        modified: new Date().toISOString()
      },
      data: {
        ...document.data,
        pages: [...document.data.pages, newPage]
      }
    });
    
    setActivePageIndex(document.data.pages.length);
  }, [document, onDocumentChange, readOnly]);
  
  // Navigate pages
  const goToPrevPage = () => setActivePageIndex(Math.max(0, activePageIndex - 1));
  const goToNextPage = () => setActivePageIndex(Math.min(document.data.pages.length - 1, activePageIndex + 1));
  
  const EditorPane = (
    <div className="h-full flex flex-col">
      {!readOnly && (
        <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
          {toolbarActions.map((action, index) => (
            <Button
              key={action.label}
              variant="ghost"
              size="sm"
              onClick={action.action}
              title={action.label}
              className="h-8 w-8 p-0"
            >
              <action.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={markdownContent}
        onChange={(e) => handleTextChange(e.target.value)}
        readOnly={readOnly}
        className={cn(
          "flex-1 w-full p-4 font-mono text-sm resize-none",
          "bg-background border-0 focus:outline-none focus:ring-0",
          readOnly && "cursor-default"
        )}
        placeholder="Start writing markdown..."
      />
    </div>
  );
  
  const PreviewPane = (
    <ScrollArea className="h-full">
      <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {markdownContent}
        </ReactMarkdown>
      </div>
    </ScrollArea>
  );
  
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with page navigation and view mode */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevPage}
            disabled={activePageIndex === 0}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[80px] text-center">
            {activePage?.title || `Page ${activePageIndex + 1}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextPage}
            disabled={activePageIndex === document.data.pages.length - 1}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            ({activePageIndex + 1} / {document.data.pages.length})
          </span>
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={addPage}
              className="h-8 w-8 p-0"
              title="Add page"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === 'edit' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('edit')}
            className="h-8 px-2"
          >
            <Edit3 className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant={viewMode === 'split' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('split')}
            className="h-8 px-2"
          >
            Split
          </Button>
          <Button
            variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('preview')}
            className="h-8 px-2"
          >
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
        </div>
      </div>
      
      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'edit' && EditorPane}
        {viewMode === 'preview' && PreviewPane}
        {viewMode === 'split' && (
          <div className="h-full flex">
            <div className="flex-1 border-r overflow-hidden">
              {EditorPane}
            </div>
            <div className="flex-1 overflow-hidden">
              {PreviewPane}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
