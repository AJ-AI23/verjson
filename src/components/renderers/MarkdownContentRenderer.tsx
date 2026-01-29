import React, { useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { MarkdownDocument, MarkdownEmbed } from '@/types/markdown';
import { MarkdownStyleTheme, defaultMarkdownLightTheme, defaultMarkdownDarkTheme } from '@/types/markdownStyles';
import { linesToMarkdown } from '@/lib/markdownUtils';
import { getMarkdownPlugins } from '@/lib/markdown/markdownPluginPresets';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MarkdownContentRendererProps {
  document: MarkdownDocument;
  theme?: 'light' | 'dark';
  className?: string;
  singlePageIndex?: number; // Optionally render only a specific page
}

/**
 * A read-only renderer for markdown documents.
 * Extracts the preview rendering logic from MarkdownEditor for reuse in manifest viewer.
 */
export const MarkdownContentRenderer: React.FC<MarkdownContentRendererProps> = ({
  document,
  theme,
  className,
  singlePageIndex,
}) => {
  // Get the current theme styles
  const currentTheme: MarkdownStyleTheme = useMemo(() => {
    const selectedTheme = theme || document.selectedTheme || 'light';
    if (document.styles?.themes?.[selectedTheme]) {
      return document.styles.themes[selectedTheme]!;
    }
    return selectedTheme === 'dark' ? defaultMarkdownDarkTheme : defaultMarkdownLightTheme;
  }, [document.styles, document.selectedTheme, theme]);

  // Resolve embed references to data URIs
  const resolveEmbedSrc = useCallback((src: string): string => {
    if (!src?.startsWith('embed://')) return src;
    
    const embedId = src.replace('embed://', '');
    const embed = document.data.embeds?.find(e => e.id === embedId);
    
    if (embed?.data) {
      const trimmed = String(embed.data).trim();
      if (trimmed.startsWith('data:')) return trimmed;
      const base64 = trimmed.replace(/\\s/g, '');
      const mimeType = embed.mimeType || 'image/png';
      if (base64) return `data:${mimeType};base64,${base64}`;
    }
    
    return src;
  }, [document.data.embeds]);

  // Keep custom protocols intact
  const urlTransform = useCallback((url: string) => {
    const u = String(url || '').trim();
    const lower = u.toLowerCase();
    if (lower.startsWith('embed://')) return u;
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return '';
    return u;
  }, []);

  // Get plugins based on document type
  const markdownPlugins = useMemo(() => {
    return getMarkdownPlugins(document.type as 'markdown' | 'extended-markdown');
  }, [document.type]);

  // Memoize components with theming
  const markdownComponents = useMemo(() => ({
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 style={{ 
        fontSize: currentTheme.elements.h1.fontSize,
        fontWeight: currentTheme.elements.h1.fontWeight as any,
        color: currentTheme.elements.h1.color,
        margin: currentTheme.elements.h1.margin,
        fontFamily: currentTheme.fonts.headingFont,
      }}>{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 style={{ 
        fontSize: currentTheme.elements.h2.fontSize,
        fontWeight: currentTheme.elements.h2.fontWeight as any,
        color: currentTheme.elements.h2.color,
        margin: currentTheme.elements.h2.margin,
        fontFamily: currentTheme.fonts.headingFont,
      }}>{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 style={{ 
        fontSize: currentTheme.elements.h3.fontSize,
        fontWeight: currentTheme.elements.h3.fontWeight as any,
        color: currentTheme.elements.h3.color,
        margin: currentTheme.elements.h3.margin,
        fontFamily: currentTheme.fonts.headingFont,
      }}>{children}</h3>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 style={{ 
        fontSize: currentTheme.elements.h4.fontSize,
        fontWeight: currentTheme.elements.h4.fontWeight as any,
        color: currentTheme.elements.h4.color,
        margin: currentTheme.elements.h4.margin,
        fontFamily: currentTheme.fonts.headingFont,
      }}>{children}</h4>
    ),
    h5: ({ children }: { children?: React.ReactNode }) => (
      <h5 style={{ 
        fontSize: currentTheme.elements.h5.fontSize,
        fontWeight: currentTheme.elements.h5.fontWeight as any,
        color: currentTheme.elements.h5.color,
        margin: currentTheme.elements.h5.margin,
        fontFamily: currentTheme.fonts.headingFont,
      }}>{children}</h5>
    ),
    h6: ({ children }: { children?: React.ReactNode }) => (
      <h6 style={{ 
        fontSize: currentTheme.elements.h6.fontSize,
        fontWeight: currentTheme.elements.h6.fontWeight as any,
        color: currentTheme.elements.h6.color,
        margin: currentTheme.elements.h6.margin,
        fontFamily: currentTheme.fonts.headingFont,
      }}>{children}</h6>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p style={{ 
        fontSize: currentTheme.elements.paragraph.fontSize,
        lineHeight: currentTheme.elements.paragraph.lineHeight,
        color: currentTheme.elements.paragraph.color || currentTheme.colors.text,
        margin: currentTheme.elements.paragraph.margin,
        fontFamily: currentTheme.fonts.bodyFont,
      }}>{children}</p>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong style={{ fontWeight: currentTheme.elements.bold.fontWeight as any }}>{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em style={{ fontStyle: currentTheme.elements.italic.fontStyle as any }}>{children}</em>
    ),
    mark: ({ children }: { children?: React.ReactNode }) => (
      <mark style={{ 
        backgroundColor: '#fef08a',
        color: 'inherit',
        padding: '0.125rem 0.25rem',
        borderRadius: '0.125rem',
      }}>{children}</mark>
    ),
    sub: ({ children }: { children?: React.ReactNode }) => (
      <sub style={{ fontSize: '0.75em', verticalAlign: 'sub' }}>{children}</sub>
    ),
    sup: ({ children }: { children?: React.ReactNode }) => (
      <sup style={{ fontSize: '0.75em', verticalAlign: 'super' }}>{children}</sup>
    ),
    del: ({ children }: { children?: React.ReactNode }) => (
      <del style={{ textDecoration: 'line-through', opacity: 0.7 }}>{children}</del>
    ),
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
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
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
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
    blockquote: ({ children }: { children?: React.ReactNode }) => (
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
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', margin: '0.5rem 0' }}>{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol style={{ listStyleType: 'decimal', paddingLeft: '1.5rem', margin: '0.5rem 0' }}>{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li style={{ margin: currentTheme.elements.listItem.margin }}>{children}</li>
    ),
    hr: () => (
      <hr style={{ borderColor: currentTheme.colors.hrColor, margin: currentTheme.elements.hr.margin }} />
    ),
    table: ({ children }: { children?: React.ReactNode }) => (
      <table style={{ borderCollapse: 'collapse', width: '100%', margin: '1rem 0' }}>{children}</table>
    ),
    thead: ({ children }: { children?: React.ReactNode }) => (
      <thead style={{ backgroundColor: currentTheme.colors.tableHeaderBackground }}>{children}</thead>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th style={{
        border: `1px solid ${currentTheme.colors.tableBorder}`,
        padding: currentTheme.elements.tableHeader.padding,
        fontWeight: currentTheme.elements.tableHeader.fontWeight as any,
        textAlign: 'left',
      }}>{children}</th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td style={{
        border: `1px solid ${currentTheme.colors.tableBorder}`,
        padding: currentTheme.elements.tableCell.padding,
      }}>{children}</td>
    ),
    img: ({ src, alt }: { src?: string; alt?: string }) => {
      const resolvedSrc = resolveEmbedSrc(src || '');
      return (
        <img 
          src={resolvedSrc} 
          alt={alt} 
          style={{ 
            maxWidth: '100%', 
            height: 'auto',
            margin: currentTheme.elements.image.margin,
          }} 
        />
      );
    },
    input: ({ type, checked, disabled }: { type?: string; checked?: boolean; disabled?: boolean }) => {
      if (type === 'checkbox') {
        return (
          <input 
            type="checkbox" 
            checked={checked} 
            disabled
            style={{ 
              marginRight: '0.5rem',
              accentColor: currentTheme.colors.link,
            }} 
          />
        );
      }
      return null;
    },
  }), [currentTheme, resolveEmbedSrc]);

  // Get pages to render
  const pagesToRender = useMemo(() => {
    if (singlePageIndex !== undefined && document.data.pages[singlePageIndex]) {
      return [document.data.pages[singlePageIndex]];
    }
    return document.data.pages;
  }, [document.data.pages, singlePageIndex]);

  // Convert pages to markdown content
  const pagesContent = useMemo(() => {
    return pagesToRender.map(page => ({
      id: page.id,
      title: page.title,
      content: page.lines ? linesToMarkdown(page.lines) : '',
    }));
  }, [pagesToRender]);

  return (
    <div 
      className={cn("markdown-content-renderer", className)}
      style={{
        backgroundColor: currentTheme.colors.background,
        color: currentTheme.colors.text,
        fontFamily: currentTheme.fonts.bodyFont,
        fontSize: currentTheme.fonts.baseFontSize,
      }}
    >
      {pagesContent.map((page, index) => (
        <div key={page.id} className={cn(index > 0 && "mt-8 pt-8 border-t")}>
          <ReactMarkdown
            remarkPlugins={markdownPlugins.remarkPlugins}
            rehypePlugins={markdownPlugins.rehypePlugins}
            urlTransform={urlTransform}
            components={markdownComponents as any}
          >
            {page.content}
          </ReactMarkdown>
        </div>
      ))}
    </div>
  );
};
