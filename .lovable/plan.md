
# Manifest Document Type Implementation Plan

## Overview

Introduce a new VerjSON document type called **"manifest"** that serves as an indexed repository/navigation structure for documentation. The manifest acts as a table of contents and navigation system (similar to WinHelp or manpages) that references or embeds other markdown documents, allowing users to create structured, navigable documentation suites.

## Design Principles

1. **Reference-based architecture**: The manifest contains structure and navigation metadata, not the actual content. Content is stored in separate markdown documents and referenced via `document://` or embedded via inline content.
2. **WinHelp/Manpage influences**: Hierarchical navigation, indexed topics, searchable content, and cross-references.
3. **Consistency with VerjSON format**: Follow the existing patterns from diagram and markdown document types.

---

## Technical Specification

### 1. Manifest Document Schema

The manifest follows the VerjSON pattern with these key sections:

```text
+------------------------+
|  verjson: "1.0.0"      |
|  type: "manifest"      |
+------------------------+
|  info:                 |
|    - version           |
|    - title             |
|    - description       |
+------------------------+
|  data:                 |
|    - toc (table of     |
|      contents tree)    |
|    - index (keyword    |
|      index)            |
|    - embeds (inline    |
|      or referenced     |
|      content)          |
+------------------------+
|  styles:               |
|    - navigation theme  |
|    - preview theme     |
+------------------------+
```

### 2. Core Data Structures

**Table of Contents (TOC)**:
- Hierarchical tree of sections and pages
- Each entry can reference external markdown documents via `document://id` or embedded content via `embed://id`
- Supports unlimited nesting depth

**Index**:
- Keyword-based index for search
- Each keyword points to one or more TOC entries or specific sections within documents

**Embeds**:
- Similar to markdown embeds but for documentation pages
- Can embed markdown documents inline (for self-contained exports)
- Can reference external documents (for live collaboration)

---

## Implementation Roadmap

### Phase 1: Type Definitions and Schema

| File | Changes |
|------|---------|
| `src/types/manifest.ts` | New file - TypeScript interfaces for ManifestDocument, TOCEntry, IndexEntry, ManifestEmbed |
| `src/types/workspace.ts` | Add 'manifest' to file_type union |
| `public/api/manifest-schema.v1.json` | New file - JSON Schema for manifest documents |
| `src/lib/schemaUtils.ts` | Update SchemaType union and detectSchemaType() to recognize manifest documents |

### Phase 2: Default Schema and Document Creation

| File | Changes |
|------|---------|
| `src/lib/defaultManifestSchema.ts` | New file - Default manifest document template |
| `src/components/workspace/WorkspacePanel.tsx` | Add 'manifest' option to document type selector |
| `src/components/workspace/ImportDialog.tsx` | Add manifest detection to file type validation |

### Phase 3: Editor Integration

| File | Changes |
|------|---------|
| `src/components/schema/EditorContent.tsx` | Add manifest pane routing (similar to markdown pane) |
| `src/components/manifest/ManifestEditor.tsx` | New file - Main editor component with structure editor and preview |
| `src/components/manifest/ManifestPreview.tsx` | New file - Navigation-style preview renderer |
| `src/components/manifest/ManifestTOCEditor.tsx` | New file - Visual TOC tree editor |
| `src/components/manifest/ManifestIndexEditor.tsx` | New file - Keyword index management |

### Phase 4: Preview Interface

| File | Changes |
|------|---------|
| `src/components/manifest/ManifestViewer.tsx` | New file - WinHelp-style viewer component |
| `src/components/manifest/ManifestNavigation.tsx` | New file - Sidebar navigation tree |
| `src/components/manifest/ManifestSearch.tsx` | New file - Full-text and index search |
| `src/components/manifest/ManifestBreadcrumb.tsx` | New file - Navigation breadcrumb trail |
| `src/hooks/useManifestResolver.ts` | New file - Hook to resolve document:// references in manifests |

---

## Detailed Type Definitions

```typescript
// src/types/manifest.ts

export interface ManifestDocument {
  verjson: string;           // "1.0.0"
  type: 'manifest';
  info: {
    version: string;         // Semantic version
    title: string;
    description?: string;
    author?: string;
    created?: string;
    modified?: string;
  };
  data: ManifestData;
  styles?: ManifestStyles;
  selectedTheme?: string;
}

export interface ManifestData {
  toc: TOCEntry[];           // Hierarchical table of contents
  index?: IndexEntry[];      // Keyword index
  embeds?: ManifestEmbed[];  // Embedded content
  defaultPage?: string;      // ID of default landing page
}

export interface TOCEntry {
  id: string;                // Unique identifier
  title: string;             // Display title
  icon?: string;             // Optional icon name
  ref?: string;              // Reference: "document://uuid" or "embed://id"
  anchor?: string;           // Optional anchor within referenced document
  children?: TOCEntry[];     // Nested entries (folders/sections)
  keywords?: string[];       // Searchable keywords for this entry
  description?: string;      // Short description for search results
}

export interface IndexEntry {
  keyword: string;           // Index keyword
  entries: IndexReference[]; // References to TOC entries or specific anchors
}

export interface IndexReference {
  tocId: string;             // Reference to TOC entry ID
  anchor?: string;           // Optional anchor within the document
  context?: string;          // Context snippet for search preview
}

export interface ManifestEmbed {
  id: string;                // Unique embed identifier
  type: 'markdown';          // Currently only markdown supported
  content?: any;             // Inline MarkdownDocument for embedded content
  documentId?: string;       // Reference to external document for linked content
}

export interface ManifestStyles {
  themes?: Record<string, ManifestTheme>;
}

export interface ManifestTheme {
  navigation: {
    background: string;
    text: string;
    activeBackground: string;
    hoverBackground: string;
  };
  content: {
    background: string;
    text: string;
    linkColor: string;
  };
}
```

---

## Preview Interface Design

The manifest preview renders a WinHelp-inspired interface with:

```text
+--------------------------------------------------+
|  [Search bar...]                    [Theme] [?]  |
+--------------------------------------------------+
|          |                                       |
|  TOC     |  Content Area                         |
|  Tree    |                                       |
|          |  [Breadcrumb: Home > Section > Page]  |
|  [+] Sec1|                                       |
|    - Page|  # Page Title                         |
|    - Page|                                       |
|  [+] Sec2|  Rendered markdown content from       |
|  [-] Sec3|  the referenced document...           |
|    - Page|                                       |
|    - Page|  [Previous] [Next]                    |
|          |                                       |
+--------------------------------------------------+
|  Index: A B C D E F G H I J K L M N O P Q R S T |
+--------------------------------------------------+
```

**Key Features**:
1. **Collapsible TOC tree** - Navigate sections
2. **Search** - Full-text search across all referenced documents + keyword index
3. **Breadcrumb navigation** - Track current location
4. **Previous/Next navigation** - Linear navigation through content
5. **Index tab** - Alphabetical keyword index

---

## Technical Considerations

### Document Reference Resolution
- Reuse existing `useDocumentRefResolver` hook pattern
- Extend to support manifest-specific resolution with TOC context
- Cache resolved documents for performance

### Structure Editor Integration
- The manifest structure editor will show:
  - **TOC** section: Visual tree editor for navigation structure
  - **Index** section: Keyword management interface
  - **Embeds** section: Manage embedded vs referenced content

### Search Implementation
- Index keywords from manifest + full-text from resolved documents
- Use existing search patterns from structure editor

### Collaboration
- Manifest documents support real-time collaboration via existing Yjs integration
- Referenced documents maintain independent collaboration sessions

---

## Files Summary

### New Files to Create (10 files)
1. `src/types/manifest.ts` - TypeScript type definitions
2. `public/api/manifest-schema.v1.json` - JSON Schema for validation
3. `src/lib/defaultManifestSchema.ts` - Default document template
4. `src/components/manifest/ManifestEditor.tsx` - Main editor component
5. `src/components/manifest/ManifestPreview.tsx` - Preview/viewer component
6. `src/components/manifest/ManifestTOCEditor.tsx` - TOC tree editor
7. `src/components/manifest/ManifestNavigation.tsx` - Navigation sidebar
8. `src/components/manifest/ManifestSearch.tsx` - Search component
9. `src/components/manifest/ManifestBreadcrumb.tsx` - Breadcrumb navigation
10. `src/hooks/useManifestResolver.ts` - Document reference resolver

### Files to Modify (6 files)
1. `src/types/workspace.ts` - Add 'manifest' to file_type
2. `src/lib/schemaUtils.ts` - Add manifest detection and validation
3. `src/components/workspace/WorkspacePanel.tsx` - Add manifest creation option
4. `src/components/workspace/ImportDialog.tsx` - Add manifest detection
5. `src/components/schema/EditorContent.tsx` - Route to manifest editor
6. `src/components/schema/SchemaStructureEditor.tsx` - Add manifest structure sections

---

## Database Considerations

No database schema changes required. The `file_type` column in the `documents` table is a plain string, so 'manifest' can be used immediately.

---

## Suggested Implementation Order

1. **Phase 1**: Type definitions and schema (foundational)
2. **Phase 2**: Default schema and document creation (enables creating manifests)
3. **Phase 3**: Basic editor with TOC management (enables editing)
4. **Phase 4**: Preview interface with navigation (enables viewing)
5. **Phase 5**: Search and index features (enhances usability)

This phased approach allows for incremental development and testing, with each phase delivering usable functionality.
