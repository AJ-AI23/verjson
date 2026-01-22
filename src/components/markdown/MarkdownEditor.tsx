import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Plus,
  Sun,
  Moon
} from 'lucide-react';
import { MarkdownDocument, MarkdownPage } from '@/types/markdown';
import { MarkdownStyleTheme, defaultMarkdownLightTheme, defaultMarkdownDarkTheme } from '@/types/markdownStyles';
import { 
  linesToMarkdown, 
  markdownToLines, 
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
  
  // Get the current theme styles
  const currentTheme: MarkdownStyleTheme = useMemo(() => {
    const selectedTheme = document.selectedTheme || 'light';
    if (document.styles?.themes?.[selectedTheme]) {
      return document.styles.themes[selectedTheme]!;
    }
    return selectedTheme === 'dark' ? defaultMarkdownDarkTheme : defaultMarkdownLightTheme;
  }, [document.styles, document.selectedTheme]);
  
  // Convert hierarchical lines to markdown string for preview (with hard breaks)
  const markdownContentForPreview = useMemo(() => {
    if (!activePage?.lines) return '';
    return linesToMarkdown(activePage.lines);
  }, [activePage?.lines]);
  
  // Convert hierarchical lines to raw markdown (without hard break modifications) for editing
  const markdownContentForEdit = useMemo(() => {
    if (!activePage?.lines) return '';
    // Get flattened lines without the trailing space treatment
    const sortedKeys = Object.keys(activePage.lines).sort((a, b) => {
      const partsA = a.split('.').map(Number);
      const partsB = b.split('.').map(Number);
      const maxLength = Math.max(partsA.length, partsB.length);
      for (let i = 0; i < maxLength; i++) {
        const numA = partsA[i] ?? -1;
        const numB = partsB[i] ?? -1;
        if (numA !== numB) return numA - numB;
      }
      return 0;
    });
    return sortedKeys.map(key => activePage.lines[key]).join('\n');
  }, [activePage?.lines]);
  
  // Track the last value we set in the textarea to detect external changes
  const lastSetValueRef = useRef<string>(markdownContentForEdit);
  const textareaValueRef = useRef<string>(markdownContentForEdit);
  
  // Sync textarea value with markdownContentForEdit only when there's an external change
  useEffect(() => {
    if (textareaRef.current) {
      // Only update if the new content differs from what we last set
      // This means an external source changed the document (not user typing)
      if (markdownContentForEdit !== lastSetValueRef.current) {
        textareaRef.current.value = markdownContentForEdit;
        lastSetValueRef.current = markdownContentForEdit;
        textareaValueRef.current = markdownContentForEdit;
      }
    }
  }, [markdownContentForEdit]);
  
  // Update refs when page changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = markdownContentForEdit;
      lastSetValueRef.current = markdownContentForEdit;
      textareaValueRef.current = markdownContentForEdit;
    }
  }, [activePageIndex]);
  
  // Handle markdown text changes
  const handleTextChange = useCallback((newText: string) => {
    if (readOnly) return;
    
    // Update our tracking refs
    lastSetValueRef.current = newText;
    textareaValueRef.current = newText;
    
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
    const currentValue = textarea.value;
    const selectedText = currentValue.substring(start, end);
    
    const newText = 
      currentValue.substring(0, start) + 
      prefix + selectedText + suffix + 
      currentValue.substring(end);
    
    // Update textarea value directly
    textarea.value = newText;
    handleTextChange(newText);
    
    // Restore cursor position
    const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
  }, [handleTextChange, readOnly]);
  
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
          {toolbarActions.map((action) => (
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
        defaultValue={markdownContentForEdit}
        onChange={(e) => {
          handleTextChange(e.target.value);
        }}
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

  // Generate CSS styles from theme
  const previewStyles = useMemo(() => {
    const t = currentTheme;
    return {
      '--md-bg': t.colors.background,
      '--md-text': t.colors.text,
      '--md-link': t.colors.link,
      '--md-link-hover': t.colors.linkHover,
      '--md-code-bg': t.colors.codeBackground,
      '--md-code-text': t.colors.codeText,
      '--md-blockquote-border': t.colors.blockquoteBorder,
      '--md-blockquote-bg': t.colors.blockquoteBackground,
      '--md-table-border': t.colors.tableBorder,
      '--md-table-header-bg': t.colors.tableHeaderBackground,
      '--md-hr': t.colors.hrColor,
      '--md-font-body': t.fonts.bodyFont,
      '--md-font-heading': t.fonts.headingFont,
      '--md-font-code': t.fonts.codeFont,
      '--md-font-size': t.fonts.baseFontSize,
    } as React.CSSProperties;
  }, [currentTheme]);
  
  const PreviewPane = (
    <ScrollArea className="h-full" style={{ backgroundColor: currentTheme.colors.background }}>
      <div 
        className="p-4 markdown-preview"
        style={{ ...previewStyles, backgroundColor: currentTheme.colors.background, color: currentTheme.colors.text, minHeight: '100%' }}
      >
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 style={{ 
                fontSize: currentTheme.elements.h1.fontSize,
                fontWeight: currentTheme.elements.h1.fontWeight as any,
                color: currentTheme.elements.h1.color,
                margin: currentTheme.elements.h1.margin,
                fontFamily: currentTheme.fonts.headingFont,
              }}>{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 style={{ 
                fontSize: currentTheme.elements.h2.fontSize,
                fontWeight: currentTheme.elements.h2.fontWeight as any,
                color: currentTheme.elements.h2.color,
                margin: currentTheme.elements.h2.margin,
                fontFamily: currentTheme.fonts.headingFont,
              }}>{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 style={{ 
                fontSize: currentTheme.elements.h3.fontSize,
                fontWeight: currentTheme.elements.h3.fontWeight as any,
                color: currentTheme.elements.h3.color,
                margin: currentTheme.elements.h3.margin,
                fontFamily: currentTheme.fonts.headingFont,
              }}>{children}</h3>
            ),
            h4: ({ children }) => (
              <h4 style={{ 
                fontSize: currentTheme.elements.h4.fontSize,
                fontWeight: currentTheme.elements.h4.fontWeight as any,
                color: currentTheme.elements.h4.color,
                margin: currentTheme.elements.h4.margin,
                fontFamily: currentTheme.fonts.headingFont,
              }}>{children}</h4>
            ),
            h5: ({ children }) => (
              <h5 style={{ 
                fontSize: currentTheme.elements.h5.fontSize,
                fontWeight: currentTheme.elements.h5.fontWeight as any,
                color: currentTheme.elements.h5.color,
                margin: currentTheme.elements.h5.margin,
                fontFamily: currentTheme.fonts.headingFont,
              }}>{children}</h5>
            ),
            h6: ({ children }) => (
              <h6 style={{ 
                fontSize: currentTheme.elements.h6.fontSize,
                fontWeight: currentTheme.elements.h6.fontWeight as any,
                color: currentTheme.elements.h6.color,
                margin: currentTheme.elements.h6.margin,
                fontFamily: currentTheme.fonts.headingFont,
              }}>{children}</h6>
            ),
            p: ({ children }) => (
              <p style={{ 
                fontSize: currentTheme.elements.paragraph.fontSize,
                lineHeight: currentTheme.elements.paragraph.lineHeight,
                color: currentTheme.elements.paragraph.color || currentTheme.colors.text,
                margin: currentTheme.elements.paragraph.margin,
                fontFamily: currentTheme.fonts.bodyFont,
              }}>{children}</p>
            ),
            strong: ({ children }) => (
              <strong style={{ fontWeight: currentTheme.elements.bold.fontWeight as any }}>{children}</strong>
            ),
            em: ({ children }) => (
              <em style={{ fontStyle: currentTheme.elements.italic.fontStyle as any }}>{children}</em>
            ),
            a: ({ href, children }) => (
              <a 
                href={href} 
                style={{ 
                  color: currentTheme.colors.link,
                  textDecoration: currentTheme.elements.link.textDecoration,
                }}
                target="_blank"
                rel="noopener noreferrer"
              >{children}</a>
            ),
            code: ({ className, children }) => {
              const isBlock = className?.includes('language-');
              if (isBlock) {
                return (
                  <pre style={{
                    backgroundColor: currentTheme.elements.codeBlock.backgroundColor || currentTheme.colors.codeBackground,
                    color: currentTheme.elements.codeBlock.color || currentTheme.colors.codeText,
                    padding: currentTheme.elements.codeBlock.padding,
                    fontFamily: currentTheme.fonts.codeFont,
                    fontSize: currentTheme.elements.codeBlock.fontSize,
                    borderRadius: '0.375rem',
                    overflowX: 'auto',
                  }}>
                    <code>{children}</code>
                  </pre>
                );
              }
              return (
                <code style={{
                  backgroundColor: currentTheme.elements.code.backgroundColor || currentTheme.colors.codeBackground,
                  color: currentTheme.colors.codeText,
                  padding: currentTheme.elements.code.padding,
                  fontFamily: currentTheme.fonts.codeFont,
                  fontSize: currentTheme.elements.code.fontSize,
                  borderRadius: '0.25rem',
                }}>{children}</code>
              );
            },
            blockquote: ({ children }) => (
              <blockquote style={{
                borderLeftColor: currentTheme.elements.blockquote.borderColor || currentTheme.colors.blockquoteBorder,
                borderLeftWidth: currentTheme.elements.blockquote.borderWidth,
                borderLeftStyle: 'solid',
                backgroundColor: currentTheme.elements.blockquote.backgroundColor || currentTheme.colors.blockquoteBackground,
                padding: currentTheme.elements.blockquote.padding,
                fontStyle: currentTheme.elements.blockquote.fontStyle as any,
                margin: '1rem 0',
              }}>{children}</blockquote>
            ),
            ul: ({ children }) => (
              <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', margin: '0.5rem 0' }}>{children}</ul>
            ),
            ol: ({ children }) => (
              <ol style={{ listStyleType: 'decimal', paddingLeft: '1.5rem', margin: '0.5rem 0' }}>{children}</ol>
            ),
            li: ({ children }) => (
              <li style={{ margin: currentTheme.elements.listItem.margin }}>{children}</li>
            ),
            hr: () => (
              <hr style={{ 
                borderColor: currentTheme.colors.hrColor,
                margin: currentTheme.elements.hr.margin,
              }} />
            ),
            table: ({ children }) => (
              <table style={{
                borderCollapse: 'collapse',
                width: '100%',
                margin: '1rem 0',
              }}>{children}</table>
            ),
            thead: ({ children }) => (
              <thead style={{
                backgroundColor: currentTheme.colors.tableHeaderBackground,
              }}>{children}</thead>
            ),
            th: ({ children }) => (
              <th style={{
                border: `1px solid ${currentTheme.colors.tableBorder}`,
                padding: currentTheme.elements.tableHeader.padding,
                fontWeight: currentTheme.elements.tableHeader.fontWeight as any,
                textAlign: 'left',
              }}>{children}</th>
            ),
            td: ({ children }) => (
              <td style={{
                border: `1px solid ${currentTheme.colors.tableBorder}`,
                padding: currentTheme.elements.tableCell.padding,
              }}>{children}</td>
            ),
            img: ({ src, alt }) => (
              <img 
                src={src} 
                alt={alt} 
                style={{ 
                  maxWidth: '100%', 
                  height: 'auto',
                  margin: currentTheme.elements.image.margin,
                }} 
              />
            ),
          }}
        >
          {markdownContentForPreview}
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
            variant="ghost"
            size="sm"
            onClick={() => {
              const newTheme = document.selectedTheme === 'dark' ? 'light' : 'dark';
              onDocumentChange({
                ...document,
                selectedTheme: newTheme,
              });
            }}
            className="h-8 w-8 p-0"
            title={`Switch to ${document.selectedTheme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {document.selectedTheme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
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
