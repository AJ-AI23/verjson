

# Refactor: Move Commit Version to Versions Dialog and Add Document Information Dialog

## Overview

This plan restructures the version management UI by:
1. Moving the "Current Version" panel (renamed to "Commit Version") from the editor bottom into the Versions dialog
2. Renaming "History" dialog to "Versions"
3. Creating a new "Document Information" dialog accessible via a document icon in the header
4. Moving existing document information from the Versions dialog into the new Document Information dialog

## Current Architecture

```text
+------------------------------------------+
| EditorToolbar (header)                   |
|  [DocumentConfigDialog] Doc Name [...]   |
|  [History button]                        |
+------------------------------------------+
| EditorContent                            |
|  +------------------------------------+  |
|  | JsonEditorWrapper                  |  |
|  +------------------------------------+  |
|  | VersionControls (Current Version)  |  | <-- Move this
|  +------------------------------------+  |
+------------------------------------------+

History Dialog (EditorVersionDialog):
+------------------------------------------+
| Version History                          |
+------------------------------------------+
| Document Information Panel (green)       | <-- Move to new dialog
+------------------------------------------+
| Compare Versions Button                  |
+------------------------------------------+
| Version History Table                    |
+------------------------------------------+
```

## Target Architecture

```text
+------------------------------------------+
| EditorToolbar (header)                   |
|  [DocInfoBtn][DocConfig] Doc Name [...]  | <-- Add document info button
|  [Versions button]                       | <-- Rename from History
+------------------------------------------+
| EditorContent                            |
|  +------------------------------------+  |
|  | JsonEditorWrapper                  |  |
|  +------------------------------------+  |
|  | (VersionControls removed)          |  | <-- Removed
|  +------------------------------------+  |
+------------------------------------------+

Versions Dialog (renamed):
+------------------------------------------+
| Versions                                 |
+------------------------------------------+
| Commit Version Panel                     | <-- Moved here (top)
|  [Version inputs] [Description] [Commit] |
+------------------------------------------+
| Compare Versions Button                  |
+------------------------------------------+
| Version History Table                    |
+------------------------------------------+

New Document Information Dialog:
+------------------------------------------+
| Document Information                     |
+------------------------------------------+
| Document ID, File Name, Type, etc.       |
+------------------------------------------+
```

## Implementation Details

### 1. Create New Document Information Dialog

**New file: `src/components/DocumentInformationDialog.tsx`**

A new dialog component that displays document metadata:
- Document ID (with copy button)
- File Name
- File Type (badge)
- Workspace ID
- Created/Updated timestamps
- Content Keys
- User ID

This content is moved from the green "Document Information Panel" in VersionHistory.

### 2. Update EditorToolbar

**File: `src/components/schema/EditorToolbar.tsx`**

Changes:
- Add a document information button (FileText icon) next to the document name
- Opens the new DocumentInformationDialog
- Rename "History" button text to "Versions"

```typescript
// Add new state
const [isDocInfoDialogOpen, setIsDocInfoDialogOpen] = useState(false);

// Add button next to document name
<Button
  variant="ghost"
  size="sm"
  onClick={() => setIsDocInfoDialogOpen(true)}
  title="Document Information"
>
  <FileText className="h-4 w-4" />
</Button>

// Render dialog
<DocumentInformationDialog
  isOpen={isDocInfoDialogOpen}
  onOpenChange={setIsDocInfoDialogOpen}
  document={selectedDocument}
/>
```

### 3. Update EditorVersionDialog

**File: `src/components/editor/EditorVersionDialog.tsx`**

Changes:
- Rename dialog title from "Version History" to "Versions"
- Pass additional props to VersionHistory for the commit functionality
- Add commit-related props interface

```typescript
interface EditorVersionDialogProps {
  // ... existing props
  // New props for commit functionality
  currentVersion: Version;
  isModified: boolean;
  schema?: string;
  patches?: any[];
  onVersionBump: (newVersion: Version, tier: VersionTier, description: string) => void;
  onImportVersion?: (...) => void;
  currentFileType?: string;
  suggestedVersion?: Version | null;
}
```

### 4. Update VersionHistory Component

**File: `src/components/VersionHistory.tsx`**

Changes:
- Remove the "Document Information Panel" (green section, lines 356-401)
- Add new props for commit functionality at the top
- Integrate VersionControls component at the top of the dialog (renamed section header to "Commit Version")
- Keep the version comparison and table functionality

```typescript
interface VersionHistoryProps {
  // ... existing props
  // New props for commit functionality
  currentVersion?: Version;
  isModified?: boolean;
  schema?: string;
  onVersionBump?: (newVersion: Version, tier: VersionTier, description: string) => void;
  suggestedVersion?: Version | null;
}

// In the render:
return (
  <div className="version-history overflow-auto max-h-[400px]">
    {/* Commit Version Section - NEW */}
    {onVersionBump && (
      <div className="mb-4">
        <VersionControls
          version={currentVersion}
          userRole={userRole}
          onVersionBump={onVersionBump}
          isModified={isModified}
          schema={schema}
          patches={patches}
          onImportVersion={onImportVersion}
          documentId={documentId}
          currentFileType={currentFileType}
          suggestedVersion={suggestedVersion}
        />
      </div>
    )}
    
    {/* Compare Versions Button - existing */}
    ...
    
    {/* Version History Table - existing */}
    ...
  </div>
);
```

### 5. Update EditorContent

**File: `src/components/schema/EditorContent.tsx`**

Changes:
- Remove the VersionControls component from the editor pane
- The JsonEditorWrapper now fills the full height without version controls below

```typescript
const editorPane = (
  <div className="flex flex-col h-full">
    <JsonEditorWrapper
      value={schema} 
      onChange={guardedOnEditorChange} 
      // ... other props
    />
    {/* VersionControls REMOVED from here */}
  </div>
);
```

### 6. Update Editor.tsx

**File: `src/components/Editor.tsx`**

Changes:
- Pass additional props to EditorVersionDialog for commit functionality
- These include: currentVersion, isModified, schema, patches, onVersionBump, suggestedVersion

### 7. Update VersionControls Title

**File: `src/components/VersionControls.tsx`**

Changes:
- Rename the section header from "Current Version" to "Commit Version"

```typescript
<h3 className="text-sm font-medium text-slate-700">Commit Version</h3>
```

## Files to Create

| File | Description |
|------|-------------|
| `src/components/DocumentInformationDialog.tsx` | New dialog for document metadata |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/schema/EditorToolbar.tsx` | Add document info button, rename History to Versions |
| `src/components/schema/EditorContent.tsx` | Remove VersionControls from editor pane |
| `src/components/editor/EditorVersionDialog.tsx` | Rename title, pass commit props to VersionHistory |
| `src/components/VersionHistory.tsx` | Remove document info panel, add VersionControls at top |
| `src/components/VersionControls.tsx` | Rename header to "Commit Version" |
| `src/components/Editor.tsx` | Pass additional props to EditorVersionDialog |

## Testing Scenarios

1. Open a document and click the Versions button - verify commit panel appears at top
2. Make changes and commit from within the Versions dialog
3. Click the document info icon - verify document metadata dialog opens
4. Verify all document information displays correctly in new dialog
5. Verify version history table still works correctly
6. Verify version comparison still works

