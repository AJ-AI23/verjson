
# Plan: TOC Entry Ref Persistence and Modular Content Renderers

## Overview
This plan addresses two requirements:
1. **TOC Entry Reference Persistence**: Ensure the TOC entry's `ref` field is set when embedding/linking so the preview can locate and render the content
2. **Modular Content Renderers**: Create reusable renderer components that can display markdown, diagram, and other VerjSON document types within the manifest preview

## Current State Analysis

### What's Already Working
- Embeds are correctly stored in `data.embeds` with full content copied from the source document
- TOC entries have a `ref` field that should point to `embed://{embedId}` or `document://{documentId}`
- The `ManifestContentPane` already checks for `embed://` and `document://` references

### What's Missing
1. When linking (not embedding), the `ref` is set to `document://{documentId}` but no content is fetched at render time
2. The `ManifestContentPane` doesn't actually render the embedded content - it just shows a placeholder
3. No reusable renderer modules exist for the different document types

---

## Implementation

### Phase 1: Verify TOC Entry Reference Setting

The current implementation already sets the `ref` correctly in `TOCEntryEditor.tsx`:
- For embeds: `onUpdate(path, { ref: `embed://${embedId}` })`
- For links: `onUpdate(path, { ref: reference })` where reference is `document://{documentId}`

**Verification Task**: Confirm this is working by checking the JSON output after embedding/linking.

---

### Phase 2: Create Modular Content Renderers

Create a new `src/components/renderers/` directory with standalone, read-only renderers:

#### 2.1 Markdown Content Renderer
**File**: `src/components/renderers/MarkdownContentRenderer.tsx`

Extract the preview rendering logic from `MarkdownEditor.tsx` into a reusable component:
- Accepts a `MarkdownDocument` as input
- Renders all pages with proper theming
- Handles embed resolution for images
- Supports both `markdown` and `extended-markdown` types

```text
Props:
  - document: MarkdownDocument
  - theme?: 'light' | 'dark' (optional override)
  - className?: string
```

#### 2.2 Diagram Content Renderer  
**File**: `src/components/renderers/DiagramContentRenderer.tsx`

Wrap the existing `SequenceDiagramRenderer` in a simpler read-only facade:
- Accepts a `DiagramDocument` as input
- Sets `readOnly={true}` by default
- Handles sequence and flowchart types

```text
Props:
  - document: DiagramDocument
  - theme?: 'light' | 'dark' (optional override)
  - className?: string
```

#### 2.3 Universal Document Renderer
**File**: `src/components/renderers/DocumentContentRenderer.tsx`

A dispatcher component that detects document type and routes to the appropriate renderer:

```text
Props:
  - content: any (the document object)
  - className?: string
  
Logic:
  if content.type === 'markdown' || 'extended-markdown' -> MarkdownContentRenderer
  if content.type === 'sequence' || 'flowchart' -> DiagramContentRenderer
  else -> JSON preview or error message
```

#### 2.4 Index Export
**File**: `src/components/renderers/index.ts`

Export all renderers for easy imports.

---

### Phase 3: Update ManifestEmbed Type

Update `src/types/manifest.ts` to support multiple document types:

```typescript
export interface ManifestEmbed {
  id: string;
  type: 'markdown' | 'diagram' | 'json-schema' | 'openapi';
  content?: any;  // The embedded document content
  documentId?: string;  // Reference to source (for refresh purposes)
}
```

---

### Phase 4: Update ManifestContentPane

**File**: `src/components/manifest/ManifestContentPane.tsx`

Enhance to render actual content using the new modular renderers:

1. **For embed references** (`embed://{id}`):
   - Look up the embed in `data.embeds`
   - Use `DocumentContentRenderer` to display the stored `content`

2. **For document references** (`document://{id}`):
   - Create a `useManifestDocumentResolver` hook to fetch linked documents on-demand
   - Display loading state while fetching
   - Cache resolved documents to avoid refetching
   - Render with `DocumentContentRenderer`

```text
Updated component structure:

ManifestContentPane
├── Header (page title, description)
├── Content Area
│   ├── If embed:// → DocumentContentRenderer(embed.content)
│   ├── If document:// → DocumentContentRenderer(resolvedDocument)
│   └── If no ref → "No content linked" placeholder
└── Navigation Footer (prev/next)
```

---

### Phase 5: Create Document Resolver Hook

**File**: `src/hooks/useManifestDocumentResolver.ts`

A specialized hook for resolving `document://` references in the manifest viewer:

```typescript
interface UseManifestDocumentResolverResult {
  resolveDocument: (documentId: string) => Promise<any>;
  getDocument: (documentId: string) => any | null;
  isLoading: (documentId: string) => boolean;
  error: (documentId: string) => string | null;
}
```

This reuses patterns from the existing `useDocumentRefResolver` hook but is optimized for manifest page navigation.

---

### Phase 6: Update Structure Editor Embed Type Detection

**File**: `src/components/manifest/ManifestStructureEditor.tsx`

When creating embeds, detect the document type from the fetched content and set the `type` field appropriately:

```typescript
const handleAddEmbed = async (documentId: string, documentName?: string) => {
  // ... fetch document content ...
  
  // Detect embedded document type
  let embedType: 'markdown' | 'diagram' | 'json-schema' | 'openapi' = 'markdown';
  if (documentContent.verjson) {
    if (documentContent.type === 'markdown' || documentContent.type === 'extended-markdown') {
      embedType = 'markdown';
    } else if (documentContent.type === 'sequence' || documentContent.type === 'flowchart') {
      embedType = 'diagram';
    }
  } else if (documentContent.openapi || documentContent.swagger) {
    embedType = 'openapi';
  }
  
  const newEmbed = {
    id: embedId,
    type: embedType,
    documentId,
    content: documentContent,
  };
  // ...
};
```

---

## File Changes Summary

| File | Change Type |
|------|------------|
| `src/components/renderers/MarkdownContentRenderer.tsx` | Create |
| `src/components/renderers/DiagramContentRenderer.tsx` | Create |
| `src/components/renderers/DocumentContentRenderer.tsx` | Create |
| `src/components/renderers/index.ts` | Create |
| `src/hooks/useManifestDocumentResolver.ts` | Create |
| `src/types/manifest.ts` | Modify |
| `src/components/manifest/ManifestContentPane.tsx` | Modify |
| `src/components/manifest/ManifestStructureEditor.tsx` | Modify |

---

## Technical Considerations

### Renderer Extraction Strategy
- The `MarkdownContentRenderer` extracts ~200 lines of theme-aware component definitions and ReactMarkdown configuration from `MarkdownEditor.tsx`
- The original `MarkdownEditor` will be refactored to use `MarkdownContentRenderer` internally for its preview pane
- This ensures no code duplication and consistent rendering

### Performance
- Embedded content is pre-loaded (stored in manifest), so embed rendering is immediate
- Linked documents require on-demand fetching with loading states
- Document cache prevents redundant network requests during page navigation

### Nested Manifests
- A manifest can embed another manifest
- The renderer should detect this and render the embedded manifest's TOC inline or show a simplified view to prevent infinite nesting
