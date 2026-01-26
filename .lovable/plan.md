
# Plan: Unified Expand/Collapse Controls for Schema Diagrams

## Overview

This plan addresses the need to create a more generic, consistent approach to expand/collapse controls across all diagram nodes (JSON Schema and OpenAPI) while ensuring bidirectional synchronization between the diagram, structure editor, and JSON editor.

## Current State Analysis

### Existing Implementation

1. **Expand/Collapse Button**: `NodeExpandCollapseButton` component exists and is used by most node types
2. **State Management**: `handleToggleCollapse` in `useEditorState.ts` manages the central `collapsedPaths` state
3. **Parent Expansion Logic**: When expanding a node, parent paths are automatically expanded
4. **Descendant Cleanup**: When collapsing, descendant states are cleared

### Identified Issues

1. **Inconsistent Path Handling**: Some nodes use `path`, others use `nodePath`, and some derive paths from `id`
2. **BaseNodeContainer Doesn't Include Expand Controls**: Each node type duplicates the expand/collapse button logic
3. **Multi-level Expansion Not Unified**: Nodes representing nested content (like grouped properties) have ad-hoc expansion handling
4. **Structure Editor Sync**: Path normalization between diagram and structure editor can be inconsistent

## Technical Approach

### Phase 1: Standardize Node Path Interface

Create a unified interface for node data that all node types will implement.

**Changes:**
- Define a `BaseNodeData` interface with required `nodePath`, `isCollapsed`, `hasChildren`, and `onToggleCollapse` properties
- Update all node generator functions to consistently set `nodePath` (not mix of `path`/`nodePath`)

**Files to modify:**
- `src/lib/diagram/types.ts` - Add `BaseNodeData` interface
- `src/lib/diagram/nodeGenerator.ts` - Update all node creation functions

### Phase 2: Enhance BaseNodeContainer with Expand Controls

Move the expand/collapse button into `BaseNodeContainer` so all nodes automatically get consistent behavior.

**Changes:**
- Add optional expand/collapse props to `BaseNodeContainerProps`
- Render `NodeExpandCollapseButton` within `BaseNodeContainer` when props are provided
- Add a `headerSlot` or render children pattern for node-specific content

**Files to modify:**
- `src/components/schema-node/BaseNodeContainer.tsx` - Add expand control integration
- `src/components/schema-node/NodeExpandCollapseButton.tsx` - Minor refinements if needed

### Phase 3: Simplify Individual Node Components

Remove duplicated expand/collapse logic from individual nodes since `BaseNodeContainer` now handles it.

**Files to modify (all node types):**
- `src/components/schema-node/SchemaTypeNode.tsx`
- `src/components/schema-node/InfoNode.tsx`
- `src/components/schema-node/EndpointNode.tsx`
- `src/components/schema-node/ComponentsNode.tsx`
- `src/components/schema-node/MethodNode.tsx`
- `src/components/schema-node/ResponseNode.tsx`
- `src/components/schema-node/ContentTypeNode.tsx`
- `src/components/schema-node/RequestBodyNode.tsx`
- `src/components/schema-node/ParametersNode.tsx`
- `src/components/schema-node/MethodTagsNode.tsx`
- `src/components/schema-node/SecurityNode.tsx`

### Phase 4: Handle Multi-Level Expansion

For nodes that represent multiple nested properties (e.g., grouped properties), implement a consistent approach:

**Changes:**
- Add `expandableChildren` property to node data for nodes with internal expansion levels
- Create a helper utility for computing "next level" path when a node can expand further
- Update `handleToggleCollapse` to support depth-aware expansion

**Files to modify:**
- `src/components/editor/useEditorState.ts` - Enhance toggle logic for multi-level nodes
- `src/lib/diagram/layout/expandedPropertiesLayout.ts` - Pass depth info to nodes
- `src/lib/diagram/layout/openApiLayout.ts` - Pass depth info to nodes

### Phase 5: Improve Structure Editor Synchronization

Ensure the structure editor correctly reflects diagram expansion state and vice versa.

**Changes:**
- Normalize path format between diagram (`root.paths.-v1-users`) and structure editor
- Add path mapping utilities for OpenAPI-specific path formats
- Ensure `selectedNodePath` triggers correct expansion in structure editor

**Files to modify:**
- `src/components/schema/SchemaStructureEditor.tsx` - Improve external collapsed state handling
- `src/components/openapi/OpenApiStructureEditor.tsx` - Add same synchronization logic

---

## Detailed Technical Implementation

### New BaseNodeData Interface

```typescript
// In src/lib/diagram/types.ts
export interface BaseNodeData {
  label: string;
  nodePath: string;              // Canonical path for collapse state
  isCollapsed?: boolean;
  hasChildren?: boolean;
  hasCollapsibleContent?: boolean;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}
```

### Enhanced BaseNodeContainer

```typescript
// In src/components/schema-node/BaseNodeContainer.tsx
export interface BaseNodeContainerProps {
  id: string;
  isConnectable: boolean;
  className?: string;
  children: ReactNode;
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
  selected?: boolean;
  // New expand/collapse props
  nodePath?: string;
  isCollapsed?: boolean;
  hasChildren?: boolean;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  showExpandButton?: boolean;
}

export const BaseNodeContainer = memo(({ 
  /* existing props */
  nodePath,
  isCollapsed,
  hasChildren,
  onToggleCollapse,
  showExpandButton = true,
}: BaseNodeContainerProps) => {
  // Render expand button at start of content if applicable
  const expandButton = showExpandButton && hasChildren && onToggleCollapse && nodePath ? (
    <NodeExpandCollapseButton
      isCollapsed={!!isCollapsed}
      hasChildren={hasChildren}
      path={nodePath}
      onToggleCollapse={onToggleCollapse}
      className="flex-shrink-0 mr-1"
    />
  ) : null;
  
  return (
    <div className={cn('relative', className)}>
      {/* Handles */}
      <div className="flex items-start">
        {expandButton}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
      {/* Debug info */}
    </div>
  );
});
```

### Path Normalization Utility

```typescript
// In src/lib/diagram/pathUtils.ts (or new file)
export const normalizeNodePath = (id: string, dataPath?: string): string => {
  // Use dataPath if provided
  if (dataPath) return dataPath;
  
  // Derive from id
  if (id === 'root') return 'root';
  if (id.startsWith('prop-')) return `root.properties.${id.substring(5)}`;
  if (id.startsWith('endpoint-')) return `root.paths.${id.substring(9)}`;
  if (id.startsWith('method-')) {
    const parts = id.substring(7).split('-');
    const method = parts[0];
    const path = parts.slice(1).join('-');
    return `root.paths.${path}.${method}`;
  }
  
  // Fallback: replace dashes with dots
  return id.replace(/-/g, '.');
};

export const pathToStructureEditorPath = (diagramPath: string): string => {
  // Convert diagram path to structure editor format
  // e.g., "root.paths.-v1-users" -> "root.paths./v1/users"
  return diagramPath.replace(/-/g, '/');
};
```

### Updated handleToggleCollapse

The existing logic in `useEditorState.ts` already handles parent expansion and descendant cleanup. We'll add support for explicit depth tracking:

```typescript
// Enhancement in handleToggleCollapse
const handleToggleCollapse = useCallback((path: string, isCollapsed: boolean, expandDepth?: number) => {
  setCollapsedPaths(prev => {
    const updated = { ...prev };
    updated[path] = isCollapsed;
    
    // Existing parent expansion logic
    if (!isCollapsed) {
      const segments = path.split('.');
      let parentPath = '';
      for (let i = 0; i < segments.length - 1; i++) {
        parentPath = parentPath ? `${parentPath}.${segments[i]}` : segments[i];
        if (updated[parentPath] !== false) {
          updated[parentPath] = false;
        }
      }
    }
    
    // Existing descendant cleanup logic
    if (isCollapsed) {
      const pathPrefix = path + '.';
      Object.keys(updated).forEach(existingPath => {
        if (existingPath.startsWith(pathPrefix)) {
          delete updated[existingPath];
        }
      });
    }
    
    return updated;
  });
}, []);
```

---

## Migration Strategy

1. **Phase 1-2**: Core infrastructure changes (types, BaseNodeContainer) - non-breaking
2. **Phase 3**: Migrate nodes one-by-one, ensuring tests pass after each
3. **Phase 4-5**: Enhance sync logic with backward compatibility

## Testing Approach

- Verify each node type still renders correctly
- Test expand/collapse triggers update in structure editor
- Test structure editor expand triggers update in diagram
- Test JSON editor folding syncs with collapsed state
- Verify parent expansion when child is expanded
- Verify descendant cleanup when ancestor is collapsed

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/diagram/types.ts` | Modify | Add `BaseNodeData` interface |
| `src/components/schema-node/BaseNodeContainer.tsx` | Modify | Add expand control props and rendering |
| `src/lib/diagram/nodeGenerator.ts` | Modify | Standardize `nodePath` in all node creators |
| `src/components/schema-node/*.tsx` (11 files) | Modify | Simplify by using BaseNodeContainer expand controls |
| `src/components/schema/SchemaStructureEditor.tsx` | Modify | Improve path sync with diagram |
| `src/components/editor/useEditorState.ts` | Minor | No breaking changes, enhance logging |
