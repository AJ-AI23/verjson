/**
 * Markdown Styles Types
 * 
 * Defines styling configuration for VerjSON markdown documents.
 * Supports light/dark themes and styling for all markdown elements.
 */

export interface MarkdownElementStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  fontStyle?: string;
  textDecoration?: string;
  lineHeight?: string;
  borderColor?: string;
  borderWidth?: string;
  padding?: string;
  margin?: string;
}

export interface MarkdownStyleTheme {
  id: string;
  name: string;
  colors: {
    background: string;
    text: string;
    link: string;
    linkHover: string;
    codeBackground: string;
    codeText: string;
    blockquoteBorder: string;
    blockquoteBackground: string;
    tableBorder: string;
    tableHeaderBackground: string;
    hrColor: string;
  };
  elements: {
    h1: MarkdownElementStyle;
    h2: MarkdownElementStyle;
    h3: MarkdownElementStyle;
    h4: MarkdownElementStyle;
    h5: MarkdownElementStyle;
    h6: MarkdownElementStyle;
    paragraph: MarkdownElementStyle;
    bold: MarkdownElementStyle;
    italic: MarkdownElementStyle;
    code: MarkdownElementStyle;
    codeBlock: MarkdownElementStyle;
    blockquote: MarkdownElementStyle;
    listItem: MarkdownElementStyle;
    link: MarkdownElementStyle;
    image: MarkdownElementStyle;
    table: MarkdownElementStyle;
    tableHeader: MarkdownElementStyle;
    tableCell: MarkdownElementStyle;
    hr: MarkdownElementStyle;
  };
  fonts: {
    bodyFont: string;
    headingFont: string;
    codeFont: string;
    baseFontSize: string;
  };
}

export interface MarkdownStyles {
  themes: {
    light: MarkdownStyleTheme;
    dark?: MarkdownStyleTheme;
    [key: string]: MarkdownStyleTheme | undefined;
  };
}

export const defaultMarkdownLightTheme: MarkdownStyleTheme = {
  id: 'light',
  name: 'Light Mode',
  colors: {
    background: '#ffffff',
    text: '#1f2937',
    link: '#2563eb',
    linkHover: '#1d4ed8',
    codeBackground: '#f3f4f6',
    codeText: '#1f2937',
    blockquoteBorder: '#d1d5db',
    blockquoteBackground: '#f9fafb',
    tableBorder: '#e5e7eb',
    tableHeaderBackground: '#f3f4f6',
    hrColor: '#e5e7eb',
  },
  elements: {
    h1: { fontSize: '2.25rem', fontWeight: '700', color: '#111827', margin: '0 0 1rem 0' },
    h2: { fontSize: '1.875rem', fontWeight: '600', color: '#1f2937', margin: '1.5rem 0 0.75rem 0' },
    h3: { fontSize: '1.5rem', fontWeight: '600', color: '#374151', margin: '1.25rem 0 0.5rem 0' },
    h4: { fontSize: '1.25rem', fontWeight: '600', color: '#4b5563', margin: '1rem 0 0.5rem 0' },
    h5: { fontSize: '1.125rem', fontWeight: '600', color: '#4b5563', margin: '1rem 0 0.5rem 0' },
    h6: { fontSize: '1rem', fontWeight: '600', color: '#6b7280', margin: '1rem 0 0.5rem 0' },
    paragraph: { fontSize: '1rem', lineHeight: '1.75', color: '#374151', margin: '0 0 1rem 0' },
    bold: { fontWeight: '700' },
    italic: { fontStyle: 'italic' },
    code: { fontFamily: 'ui-monospace, monospace', fontSize: '0.875rem', padding: '0.125rem 0.25rem', backgroundColor: '#f3f4f6' },
    codeBlock: { fontFamily: 'ui-monospace, monospace', fontSize: '0.875rem', padding: '1rem', backgroundColor: '#1f2937', color: '#f9fafb' },
    blockquote: { borderColor: '#d1d5db', borderWidth: '4px', padding: '0.5rem 1rem', backgroundColor: '#f9fafb', fontStyle: 'italic' },
    listItem: { margin: '0.25rem 0' },
    link: { color: '#2563eb', textDecoration: 'underline' },
    image: { margin: '1rem 0' },
    table: { borderColor: '#e5e7eb' },
    tableHeader: { backgroundColor: '#f3f4f6', fontWeight: '600', padding: '0.5rem' },
    tableCell: { padding: '0.5rem', borderColor: '#e5e7eb' },
    hr: { borderColor: '#e5e7eb', margin: '2rem 0' },
  },
  fonts: {
    bodyFont: 'system-ui, -apple-system, sans-serif',
    headingFont: 'system-ui, -apple-system, sans-serif',
    codeFont: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    baseFontSize: '16px',
  },
};

export const defaultMarkdownDarkTheme: MarkdownStyleTheme = {
  id: 'dark',
  name: 'Dark Mode',
  colors: {
    background: '#111827',
    text: '#e5e7eb',
    link: '#60a5fa',
    linkHover: '#93c5fd',
    codeBackground: '#1f2937',
    codeText: '#e5e7eb',
    blockquoteBorder: '#4b5563',
    blockquoteBackground: '#1f2937',
    tableBorder: '#374151',
    tableHeaderBackground: '#1f2937',
    hrColor: '#374151',
  },
  elements: {
    h1: { fontSize: '2.25rem', fontWeight: '700', color: '#f9fafb', margin: '0 0 1rem 0' },
    h2: { fontSize: '1.875rem', fontWeight: '600', color: '#f3f4f6', margin: '1.5rem 0 0.75rem 0' },
    h3: { fontSize: '1.5rem', fontWeight: '600', color: '#e5e7eb', margin: '1.25rem 0 0.5rem 0' },
    h4: { fontSize: '1.25rem', fontWeight: '600', color: '#d1d5db', margin: '1rem 0 0.5rem 0' },
    h5: { fontSize: '1.125rem', fontWeight: '600', color: '#d1d5db', margin: '1rem 0 0.5rem 0' },
    h6: { fontSize: '1rem', fontWeight: '600', color: '#9ca3af', margin: '1rem 0 0.5rem 0' },
    paragraph: { fontSize: '1rem', lineHeight: '1.75', color: '#d1d5db', margin: '0 0 1rem 0' },
    bold: { fontWeight: '700' },
    italic: { fontStyle: 'italic' },
    code: { fontFamily: 'ui-monospace, monospace', fontSize: '0.875rem', padding: '0.125rem 0.25rem', backgroundColor: '#1f2937' },
    codeBlock: { fontFamily: 'ui-monospace, monospace', fontSize: '0.875rem', padding: '1rem', backgroundColor: '#0f172a', color: '#e5e7eb' },
    blockquote: { borderColor: '#4b5563', borderWidth: '4px', padding: '0.5rem 1rem', backgroundColor: '#1f2937', fontStyle: 'italic' },
    listItem: { margin: '0.25rem 0' },
    link: { color: '#60a5fa', textDecoration: 'underline' },
    image: { margin: '1rem 0' },
    table: { borderColor: '#374151' },
    tableHeader: { backgroundColor: '#1f2937', fontWeight: '600', padding: '0.5rem' },
    tableCell: { padding: '0.5rem', borderColor: '#374151' },
    hr: { borderColor: '#374151', margin: '2rem 0' },
  },
  fonts: {
    bodyFont: 'system-ui, -apple-system, sans-serif',
    headingFont: 'system-ui, -apple-system, sans-serif',
    codeFont: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    baseFontSize: '16px',
  },
};

export const defaultMarkdownStyles: MarkdownStyles = {
  themes: {
    light: defaultMarkdownLightTheme,
    dark: defaultMarkdownDarkTheme,
  },
};
