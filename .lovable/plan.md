

# Align Document Version Numbers and Refresh Version Table After Commit

## Overview

This plan implements several improvements to version number alignment:

1. **Refresh version table after commit** - The Versions dialog table will update after a new commit
2. **Update document internal version** - When committing, increment the version property inside the document content
3. **Handle different document types** - Different version property locations based on file type
4. **Set initial version to 0.0.1** - New documents start at 0.0.1 (not 0.1.0 as currently)
5. **Import version handling** - Use the imported document's version or default to 0.0.1

## Current Behavior

- Initial versions are created as `0.1.0` in the database function
- Document content does not have its internal version property updated when committing
- The Versions dialog does not refresh after committing a new version
- OpenAPI defaults have `info.version: "1.0.0"`
- Diagram defaults have `info.version: "0.1.0"`
- Markdown defaults have `info.version: "1.0.0"`
- JSON Schema has no version property by default

## Version Property Locations by Document Type

| Document Type | Version Location | Example |
|---------------|------------------|---------|
| `json-schema` | `root.version` | `{ "version": "0.0.1", ... }` |
| `openapi` | `root.info.version` | `{ "info": { "version": "0.0.1" } }` |
| `diagram` | `root.info.version` | `{ "info": { "version": "0.0.1" } }` |
| `markdown` | `root.info.version` | `{ "info": { "version": "0.0.1" } }` |

## Implementation Details

### 1. Refresh Version Table After Commit

**Files**: 
- `src/components/VersionHistory.tsx`
- `src/components/VersionControls.tsx`

The `useDocumentVersions` hook already has a real-time subscription that triggers `fetchVersions` when database changes occur. However, the commit flow in `VersionControls` should trigger an explicit refresh to ensure immediate UI update.

**Changes**:
- Add a callback prop `onVersionCreated` to `VersionControls` that the parent (`VersionHistory`) provides
- In `VersionHistory`, pass a callback that triggers `refetch()` from the `useDocumentVersions` hook
- After `onVersionBump` succeeds in `VersionControls`, call `onVersionCreated()`

### 2. Update Document Internal Version When Committing

**Files**:
- `src/hooks/useVersioning.ts`

Before saving a new version, update the schema's internal version property based on the document type. This requires knowing the current file type.

**Changes**:
- Add `fileType` parameter to `useVersioning` hook
- Create utility function `updateDocumentVersion(schema: any, fileType: string, version: Version): any`
- In `handleVersionBump`, call this utility to update the schema before generating the patch

**Utility function logic**:
```typescript
function updateDocumentVersion(schema: any, fileType: string, version: Version): any {
  const versionString = `${version.major}.${version.minor}.${version.patch}`;
  const updatedSchema = { ...schema };
  
  if (fileType === 'json-schema') {
    updatedSchema.version = versionString;
  } else if (fileType === 'openapi' || fileType === 'diagram' || fileType === 'markdown') {
    if (!updatedSchema.info) {
      updatedSchema.info = {};
    }
    updatedSchema.info.version = versionString;
  }
  
  return updatedSchema;
}
```

### 3. Set Initial Version to 0.0.1

**Files**:
- `supabase/migrations/new_migration.sql` - Update the `create_initial_version_safe` function
- `src/lib/defaultSchema.ts` - Add `version: "0.0.1"` to default JSON schema
- `src/lib/defaultOasSchema.ts` - Change `info.version` from `"1.0.0"` to `"0.0.1"`
- `src/lib/defaultDiagramSchema.ts` - Change `info.version` from `"0.1.0"` to `"0.0.1"`
- `src/lib/defaultMarkdownSchema.ts` - Change `info.version` from `"1.0.0"` to `"0.0.1"`

**Database function update**:
```sql
-- Change version from 0.1.0 to 0.0.1
version_major: 0,
version_minor: 0, -- Changed from 1
version_patch: 1,
```

### 4. Handle Import Version

**Files**:
- `src/hooks/useVersioning.ts` - Update `handleImportVersion`
- `src/lib/versionUtils.ts` - Add helper to extract version from document

**Logic**:
- When importing, extract the version from the imported document's content
- If version exists in document, parse it and use it
- If version doesn't exist, default to `0.0.1`
- Use the extracted/default version as the initial version when creating the import

**Helper function**:
```typescript
function extractVersionFromDocument(content: any, fileType: string): Version {
  let versionString: string | undefined;
  
  if (fileType === 'json-schema') {
    versionString = content?.version;
  } else if (fileType === 'openapi' || fileType === 'diagram' || fileType === 'markdown') {
    versionString = content?.info?.version;
  }
  
  if (versionString && typeof versionString === 'string') {
    const parsed = parseVersion(versionString);
    return parsed;
  }
  
  // Default to 0.0.1
  return { major: 0, minor: 0, patch: 1 };
}
```

## Additional Improvements

### 5. Ensure Version Property Exists in New Documents

When creating a new document, ensure the initial content has the version property set:

**Files**:
- `src/components/workspace/ImportDialog.tsx` (or wherever documents are created)

The document creation flow should ensure that:
1. When using default schemas, they already have `version: "0.0.1"` (from updated defaults)
2. When importing external content, the version is either preserved or set to `0.0.1`

### 6. Validate and Sync Versions

Add a check when loading documents to ensure the internal document version matches the latest committed version in the database.

---

## Technical Implementation

### File: `src/lib/versionUtils.ts`

Add new utility functions:

```typescript
// Extract version from document content based on file type
export const extractVersionFromDocument = (content: any, fileType: string): Version => {
  let versionString: string | undefined;
  
  if (fileType === 'json-schema') {
    versionString = content?.version;
  } else {
    // openapi, diagram, markdown all use info.version
    versionString = content?.info?.version;
  }
  
  if (versionString && typeof versionString === 'string') {
    return parseVersion(versionString);
  }
  
  return { major: 0, minor: 0, patch: 1 }; // Default
};

// Update version in document content based on file type
export const updateDocumentVersion = (content: any, fileType: string, version: Version): any => {
  const versionString = formatVersion(version);
  const updated = JSON.parse(JSON.stringify(content)); // Deep clone
  
  if (fileType === 'json-schema') {
    updated.version = versionString;
  } else {
    // openapi, diagram, markdown all use info.version
    if (!updated.info) {
      updated.info = {};
    }
    updated.info.version = versionString;
  }
  
  return updated;
};
```

### File: `src/hooks/useVersioning.ts`

Modify `handleVersionBump` to update the document's internal version:

```typescript
const handleVersionBump = async (
  newVersion: Version, 
  tier: VersionTier, 
  description: string, 
  isReleased: boolean = false, 
  autoVersion: boolean = false
): Promise<string | null> => {
  // ... existing validation code ...
  
  // Parse and update the document's internal version
  let parsedCurrentSchema = JSON.parse(schema);
  
  // Determine the file type from context or add as parameter
  const finalVersionToUse = autoVersion ? /* calculated version */ : newVersion;
  
  // Update the document's internal version property
  parsedCurrentSchema = updateDocumentVersion(
    parsedCurrentSchema, 
    fileType, 
    finalVersionToUse
  );
  
  // Update the editor with the versioned schema
  const updatedSchemaString = JSON.stringify(parsedCurrentSchema, null, 2);
  setSchema(updatedSchemaString);
  
  // Generate patch from database version to updated current schema
  const patch = generatePatch(
    parsedPreviousSchema, 
    parsedCurrentSchema, // Now includes updated version
    newVersion, 
    tier, 
    description,
    isReleased
  );
  
  // ... rest of the function ...
};
```

### File: `src/components/VersionControls.tsx`

Add callback for version creation:

```typescript
interface VersionControlsProps {
  // ... existing props ...
  onVersionCreated?: () => void; // NEW: callback after successful commit
}

const handleBumpVersion = async () => {
  // ... existing code ...
  
  onVersionBump(editableVersion, selectedTier, description, isReleased, autoVersion);
  setDescription('');
  setIsReleased(false);
  
  // Trigger refresh after commit
  onVersionCreated?.(); // NEW
  
  // ... existing toast ...
};
```

### File: `src/components/VersionHistory.tsx`

Pass the refresh callback:

```typescript
<VersionControls
  version={currentVersion}
  // ... existing props ...
  onVersionCreated={() => refetch()} // NEW: refresh after commit
/>
```

### Database Migration

```sql
-- Update the create_initial_version_safe function to use 0.0.1
CREATE OR REPLACE FUNCTION create_initial_version_safe(
  p_document_id UUID, 
  p_user_id UUID, 
  p_content JSONB
) 
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_version_id UUID;
  v_existing_count INTEGER;
BEGIN
  -- Check if initial version already exists
  SELECT COUNT(*) INTO v_existing_count
  FROM document_versions 
  WHERE document_id = p_document_id 
    AND description = 'Initial version';
    
  IF v_existing_count > 0 THEN
    SELECT id INTO v_version_id
    FROM document_versions 
    WHERE document_id = p_document_id 
      AND description = 'Initial version'
    ORDER BY created_at ASC
    LIMIT 1;
    
    RETURN v_version_id;
  END IF;
  
  -- Create initial version with 0.0.1 (changed from 0.1.0)
  INSERT INTO document_versions (
    document_id, 
    user_id, 
    version_major, 
    version_minor, 
    version_patch,
    description, 
    tier, 
    is_released, 
    is_selected,
    full_document
  ) VALUES (
    p_document_id, 
    p_user_id, 
    0,  -- major
    0,  -- minor (changed from 1)
    1,  -- patch
    'Initial version', 
    'patch',  -- tier (changed from 'minor')
    true, 
    true,
    p_content
  ) 
  RETURNING id INTO v_version_id;
  
  RETURN v_version_id;
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_version_id
    FROM document_versions 
    WHERE document_id = p_document_id 
      AND description = 'Initial version'
    ORDER BY created_at ASC
    LIMIT 1;
    
    RETURN v_version_id;
END;
$function$;
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/versionUtils.ts` | Add `extractVersionFromDocument` and `updateDocumentVersion` utilities |
| `src/lib/defaultSchema.ts` | Add `version: "0.0.1"` to default JSON schema |
| `src/lib/defaultOasSchema.ts` | Change `info.version` to `"0.0.1"` |
| `src/lib/defaultDiagramSchema.ts` | Change `info.version` to `"0.0.1"` |
| `src/lib/defaultMarkdownSchema.ts` | Change `info.version` to `"0.0.1"` |
| `src/hooks/useVersioning.ts` | Add fileType parameter, update schema version before commit |
| `src/components/editor/useEditorState.ts` | Pass fileType to useVersioning |
| `src/components/VersionControls.tsx` | Add `onVersionCreated` callback prop |
| `src/components/VersionHistory.tsx` | Pass refetch callback to VersionControls |
| `supabase/migrations/` | New migration to update `create_initial_version_safe` function |

## Testing Scenarios

1. **New document creation**: Verify initial version is 0.0.1
2. **JSON Schema commit**: Verify `version` property in root is updated
3. **OpenAPI commit**: Verify `info.version` is updated
4. **Diagram commit**: Verify `info.version` is updated
5. **Markdown commit**: Verify `info.version` is updated
6. **Version table refresh**: Verify table updates immediately after commit
7. **Import with version**: Verify imported document's version is preserved
8. **Import without version**: Verify default 0.0.1 is used

