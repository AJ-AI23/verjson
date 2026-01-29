import React from 'react';
import { MarkdownContentRenderer } from './MarkdownContentRenderer';
import { DiagramContentRenderer } from './DiagramContentRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, FileCode, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentContentRendererProps {
  content: any;
  theme?: 'light' | 'dark';
  className?: string;
}

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

  // JSON Schema documents
  if (isVerjson && documentType === 'json-schema') {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-muted-foreground", className)}>
        <FileCode className="h-8 w-8 mb-2 opacity-50" />
        <p className="font-medium">JSON Schema</p>
        <p className="text-sm text-center mt-1 max-w-xs">
          JSON Schema documents are not rendered in preview mode. Open the document in the editor for full functionality.
        </p>
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
