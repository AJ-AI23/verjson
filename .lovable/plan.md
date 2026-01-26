
# Plan: Unified Expand/Collapse Controls for Schema Diagrams

## Status: Phases 1-3 Complete ✓

## Overview

This plan addresses the need to create a more generic, consistent approach to expand/collapse controls across all diagram nodes (JSON Schema and OpenAPI) while ensuring bidirectional synchronization between the diagram, structure editor, and JSON editor.

## Completed Work

### Phase 1: Standardize Node Path Interface ✓
- Added `BaseNodeData` interface to `src/lib/diagram/types.ts` with `nodePath`, `isCollapsed`, `hasChildren`, `hasCollapsibleContent`, and `onToggleCollapse` properties

### Phase 2: Enhance BaseNodeContainer with Expand Controls ✓
- Updated `BaseNodeContainer` to accept expand/collapse props (`nodePath`, `isCollapsed`, `hasChildren`, `onToggleCollapse`, `showExpandButton`)
- `BaseNodeContainer` now renders `NodeExpandCollapseButton` automatically when expand props are provided
- Debug footer now shows the nodePath for debugging

### Phase 3: Simplify Individual Node Components ✓
All 11 node components updated to use BaseNodeContainer's expand controls:
- `SchemaTypeNode.tsx` - Removed inline expand button, passes props to BaseNodeContainer
- `InfoNode.tsx` - Simplified, uses BaseNodeContainer expand
- `EndpointNode.tsx` - Simplified, uses BaseNodeContainer expand
- `ComponentsNode.tsx` - Simplified, uses BaseNodeContainer expand
- `MethodNode.tsx` - Simplified, uses BaseNodeContainer expand
- `ResponseNode.tsx` - Simplified, uses BaseNodeContainer expand
- `ContentTypeNode.tsx` - Simplified, uses BaseNodeContainer expand
- `ParametersNode.tsx` - Simplified, uses BaseNodeContainer expand
- `SecurityNode.tsx` - Simplified, uses BaseNodeContainer expand
- `RequestBodyNode.tsx` - Simplified, uses BaseNodeContainer expand
- `MethodTagsNode.tsx` - Simplified, uses BaseNodeContainer expand

## Remaining Work

### Phase 4: Handle Multi-Level Expansion (Future)

For nodes that represent multiple nested properties (e.g., grouped properties), implement a consistent approach:

**Changes:**
- Add `expandableChildren` property to node data for nodes with internal expansion levels
- Create a helper utility for computing "next level" path when a node can expand further
- Update `handleToggleCollapse` to support depth-aware expansion

**Files to modify:**
- `src/components/editor/useEditorState.ts` - Enhance toggle logic for multi-level nodes
- `src/lib/diagram/layout/expandedPropertiesLayout.ts` - Pass depth info to nodes
- `src/lib/diagram/layout/openApiLayout.ts` - Pass depth info to nodes

### Phase 5: Improve Structure Editor Synchronization (Future)

Ensure the structure editor correctly reflects diagram expansion state and vice versa.

**Changes:**
- Normalize path format between diagram (`root.paths.-v1-users`) and structure editor
- Add path mapping utilities for OpenAPI-specific path formats
- Ensure `selectedNodePath` triggers correct expansion in structure editor

**Files to modify:**
- `src/components/schema/SchemaStructureEditor.tsx` - Improve external collapsed state handling
- `src/components/openapi/OpenApiStructureEditor.tsx` - Add same synchronization logic

---

## Technical Implementation Details

### BaseNodeData Interface (Implemented)

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

### Enhanced BaseNodeContainer (Implemented)

The BaseNodeContainer now accepts these additional props:
- `nodePath`: Canonical path for collapse state
- `isCollapsed`: Whether the node is collapsed
- `hasChildren`: Whether the node has collapsible children
- `onToggleCollapse`: Callback to toggle collapsed state
- `showExpandButton`: Whether to show the expand button (default true when props provided)

When these props are provided, BaseNodeContainer automatically renders the expand/collapse button as part of its layout, ensuring consistent positioning across all node types.

### handleToggleCollapse (Existing - Works Well)

The existing logic in `useEditorState.ts` handles:
- Parent expansion when expanding a child
- Descendant cleanup when collapsing an ancestor
- Component segment auto-collapse logic

---

## Files Summary

| File | Status | Description |
|------|--------|-------------|
| `src/lib/diagram/types.ts` | ✓ Done | Added `BaseNodeData` interface |
| `src/components/schema-node/BaseNodeContainer.tsx` | ✓ Done | Added expand control props and rendering |
| `src/components/schema-node/SchemaTypeNode.tsx` | ✓ Done | Uses BaseNodeContainer expand |
| `src/components/schema-node/InfoNode.tsx` | ✓ Done | Uses BaseNodeContainer expand |
| `src/components/schema-node/EndpointNode.tsx` | ✓ Done | Uses BaseNodeContainer expand |
| `src/components/schema-node/ComponentsNode.tsx` | ✓ Done | Uses BaseNodeContainer expand |
| `src/components/schema-node/MethodNode.tsx` | ✓ Done | Uses BaseNodeContainer expand |
| `src/components/schema-node/ResponseNode.tsx` | ✓ Done | Uses BaseNodeContainer expand |
| `src/components/schema-node/ContentTypeNode.tsx` | ✓ Done | Uses BaseNodeContainer expand |
| `src/components/schema-node/ParametersNode.tsx` | ✓ Done | Uses BaseNodeContainer expand |
| `src/components/schema-node/SecurityNode.tsx` | ✓ Done | Uses BaseNodeContainer expand |
| `src/components/schema-node/RequestBodyNode.tsx` | ✓ Done | Uses BaseNodeContainer expand |
| `src/components/schema-node/MethodTagsNode.tsx` | ✓ Done | Uses BaseNodeContainer expand |
