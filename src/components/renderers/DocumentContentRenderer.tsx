import React from 'react';
import { MarkdownContentRenderer } from './MarkdownContentRenderer';
import { DiagramContentRenderer } from './DiagramContentRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, FileCode, AlertCircle, Braces } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentContentRendererProps {
  content: any;
  theme?: 'light' | 'dark';
  className?: string;
}

/**
 * Detect if content is a JSON Schema (not wrapped in verjson)
 */
const isJsonSchema = (content: any): boolean => {
  if (!content || typeof content !== 'object') return false;
  
  // Check for JSON Schema indicators
  return !!(
    content.$schema ||
    (content.type && content.properties) ||
    (content.type && content.items) ||
    content.definitions ||
    content.$defs ||
    (content.$id && (content.type || content.properties))
  );
};

/**
 * Detect if content is plain text or code (string content)
 */
const isTextContent = (content: any): boolean => {
  return typeof content === 'string';
};

/**
 * Universal document renderer that detects document type and routes
 * to the appropriate specialized renderer.
 */
export const DocumentContentRenderer: React.FC<DocumentContentRendererProps> = ({
  content,
  theme,
  className,
}) => {
  // Handle null/undefined content
  if (!content) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-muted-foreground", className)}>
        <FileText className="h-8 w-8 mb-2 opacity-50" />
        <p>No content available</p>
      </div>
    );
  }

  // Handle plain text/code content - display in code block
  if (isTextContent(content)) {
    return (
      <ScrollArea className={cn("h-full rounded-md border bg-muted/30", className)}>
        <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
          <code>{content}</code>
        </pre>
      </ScrollArea>
    );
  }

  // Detect document type
  const documentType = content?.type;
  const isVerjson = content?.verjson !== undefined;

  // Markdown documents (markdown or extended-markdown)
  if (isVerjson && (documentType === 'markdown' || documentType === 'extended-markdown')) {
    return (
      <MarkdownContentRenderer
        document={content}
        theme={theme}
        className={className}
      />
    );
  }

  // Diagram documents (sequence or flowchart)
  if (isVerjson && (documentType === 'sequence' || documentType === 'flowchart')) {
    return (
      <DiagramContentRenderer
        document={content}
        theme={theme}
        className={className}
      />
    );
  }

  // Manifest documents - show notice about nested manifests
  if (isVerjson && documentType === 'manifest') {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-muted-foreground", className)}>
        <FileCode className="h-8 w-8 mb-2 opacity-50" />
        <p className="font-medium">Nested Manifest</p>
        <p className="text-sm text-center mt-1 max-w-xs">
          This content is another manifest document. Nested manifests are displayed as read-only references.
        </p>
      </div>
    );
  }

  // OpenAPI documents
  if (content?.openapi || content?.swagger) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-muted-foreground", className)}>
        <FileCode className="h-8 w-8 mb-2 opacity-50" />
        <p className="font-medium">OpenAPI Specification</p>
        <p className="text-sm text-center mt-1 max-w-xs">
          OpenAPI documents are not rendered in preview mode. Open the document in the editor for full functionality.
        </p>
      </div>
    );
  }

  // JSON Schema documents (standalone, not verjson-wrapped)
  if (isJsonSchema(content)) {
    return (
      <div className={cn("text-muted-foreground", className)}>
        <div className="flex items-center gap-2 mb-3 text-primary">
          <Braces className="h-4 w-4" />
          <span className="text-sm font-medium">
            {content.title || 'JSON Schema'}
            {content.$schema && (
              <span className="text-xs text-muted-foreground ml-2">
                ({content.$schema.includes('2020-12') ? 'Draft 2020-12' : 
                  content.$schema.includes('draft-07') ? 'Draft-07' : 
                  content.$schema.includes('draft-06') ? 'Draft-06' : 
                  content.$schema.includes('draft-04') ? 'Draft-04' : 'JSON Schema'})
              </span>
            )}
          </span>
        </div>
        {content.description && (
          <p className="text-sm text-muted-foreground mb-3">{content.description}</p>
        )}
        <ScrollArea className="h-[400px] rounded-md border bg-muted/30">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(content, null, 2)}
          </pre>
        </ScrollArea>
      </div>
    );
  }

  // Unknown document type - show JSON preview
  return (
    <div className={cn("text-muted-foreground", className)}>
      <div className="flex items-center gap-2 mb-3 text-amber-600">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Unknown Document Type</span>
      </div>
      <ScrollArea className="h-[300px] rounded-md border bg-muted/30">
        <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
          {JSON.stringify(content, null, 2)}
        </pre>
      </ScrollArea>
    </div>
  );
};
