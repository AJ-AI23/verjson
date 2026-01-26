
# Comprehensive Copy/Paste and Duplication Logic for Sequence Diagrams

## Overview

This plan redesigns the sequence diagram clipboard system to handle complex entity relationships correctly. The core principle is: **processes depend on anchors (which belong to nodes), so processes cannot exist independently**.

## Entity Relationship Model

```text
Lifeline
   │
   ├── Anchor ◄──── Node (has exactly 2 anchors)
   │     │
   │     └──────── Process (contains array of anchor IDs)
   │
   └── (other anchors from other nodes)
```

**Key Rules:**
- A Node always has exactly 2 Anchors
- An Anchor can optionally belong to one Process
- A Process MUST have at least 1 Anchor to be valid
- All Anchors in a Process MUST be on the same Lifeline

## Selection Model Changes

### Multi-Selection Support

Currently:
- `selectedNodeIds: string[]` (supports multi)
- `selectedLifelineId: string | null` (single only)
- `selectedProcessId: string | null` (single only)

New unified selection model:
- `selectedNodeIds: string[]`
- `selectedLifelineIds: string[]`
- `selectedProcessIds: string[]`

This enables Ctrl+Click multi-selection for all entity types.

## Clipboard Architecture

### New Clipboard Data Structure

Replace the single-item clipboard with a multi-entity structure:

```typescript
interface DiagramClipboardData {
  nodes: DiagramNode[];
  lifelines: Lifeline[];
  processes: ProcessNode[];
  timestamp: number;
  
  // Metadata for relationship resolution
  anchorProcessMap: Map<string, string>; // anchorId -> processId
}
```

### Copy Operation Logic

When the user copies (Ctrl+C), analyze the selection and determine what to include:

**Step 1: Collect Selected Entities**
- Gather all selected nodes, lifelines, and processes

**Step 2: Validate Process Dependencies**
- For each selected process:
  - Check if ALL anchors in the process are from selected nodes
  - If not, the process CANNOT be copied (show warning toast)
  - Remove invalid processes from clipboard

**Step 3: Auto-Include Dependent Processes**
- For each selected node's anchors:
  - If an anchor belongs to a process AND all anchors of that process are from selected nodes:
    - Auto-include the process in the clipboard

**Step 4: Store Anchor-Process Relationships**
- Create a map of which anchors belong to which processes
- This enables correct reconnection during paste

### Paste Operation Logic

**Step 1: Generate New IDs**
- Create ID mapping: `oldId -> newId` for all entities
- Generate new node IDs, anchor IDs, lifeline IDs, and process IDs

**Step 2: Clone Entities with New IDs**
- Deep clone all nodes with new node and anchor IDs
- Deep clone all lifelines with new IDs
- Deep clone all processes with new IDs

**Step 3: Reconnect Process-Anchor Relationships**

Two scenarios:

**Scenario A: Process IS in clipboard**
- Update the cloned process's `anchorIds` to use new anchor IDs
- Update cloned anchor's `processId` to new process ID

**Scenario B: Process is NOT in clipboard (node copied alone)**
- Find the original process that the original anchor belonged to
- Add the new anchor ID to that existing process's `anchorIds`
- Set the new anchor's `processId` to the existing process ID

**Step 4: Position Offset**
- Offset pasted nodes by +80px vertically
- Append "(copy)" to pasted entity labels/names

**Step 5: Lifeline Order Adjustment**
- Append pasted lifelines to the end of the existing lifeline order

## Toolbar and UI Updates

### Node Toolbar
- Single node selected: Show Edit, Duplicate, Delete
- Multiple nodes selected: Show Duplicate All, Delete All (no Edit)

### Lifeline Toolbar  
- Single lifeline: Show Edit, Duplicate, Delete
- Multiple lifelines: Show Duplicate All, Delete All

### Process Toolbar
- Single process (valid): Show Edit, Delete (no Duplicate unless connected nodes also selected)
- Multiple processes: Only show Delete (with validation warning if any are invalid)
- **Remove the Duplicate button entirely for processes unless their nodes are also selected**

### Copy Prevention for Standalone Processes

When user presses Ctrl+C with only a process selected:
- Check if all nodes containing the process's anchors are also selected
- If not: Show toast "Cannot copy process without its connected nodes"
- Block the copy operation

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+C | Copy selected entities (with relationship analysis) |
| Ctrl+V | Paste with ID regeneration and relationship reconnection |
| Ctrl+D | Duplicate selected (copy + immediate paste) |
| Delete | Delete selected with cascade cleanup |

## Implementation Files

### 1. `src/hooks/useDiagramClipboard.ts` (Major Rewrite)

Replace single-item clipboard with multi-entity clipboard:

- New interface `DiagramClipboardData`
- New function `analyzeSelection()` - determines what can be copied
- New function `copySelection()` - validates and stores entities
- New function `pasteSelection()` - clones with ID mapping and reconnection
- Add relationship tracking for anchor-process connections

### 2. `src/lib/diagram/idGenerator.ts` (Extend)

Add batch ID generation with mapping:

- New function `generateIdMapping()` - creates old->new ID map for all entity types
- Extend existing batch functions to return mappings

### 3. `src/components/diagram/sequence/SequenceDiagramRenderer.tsx` (Updates)

Selection model changes:
- Replace `selectedProcessId: string | null` with `selectedProcessIds: string[]`
- Replace `selectedLifelineId: string | null` with `selectedLifelineIds: string[]`
- Add Ctrl+Click support for lifelines and processes

Keyboard handler updates:
- Update Ctrl+C handler to use new `copySelection()` with validation
- Update Ctrl+V handler to use new `pasteSelection()` with relationship resolution
- Add Ctrl+D shortcut for quick duplicate

Toolbar updates:
- Conditionally show/hide Duplicate button based on selection validity
- Support multi-entity toolbars

### 4. `src/components/diagram/sequence/NodeToolbar.tsx` (Extend)

- Add support for showing when multiple entities of different types are selected
- Dynamic button visibility based on selection composition
- Show count badge for multi-selection

### 5. `src/components/diagram/sequence/NodeToolbarWrapper.tsx` (Minor)

- Update to handle multi-entity positions (calculate centroid or use first selected)

## Edge Cases and Validation

### Edge Case 1: Copying Node Whose Anchor is in Shared Process
- The anchor belongs to a process with other anchors from non-selected nodes
- **Solution**: The new anchor gets added to the existing process

### Edge Case 2: Copying Entire Process Scope
- All nodes whose anchors are in a process are selected
- **Solution**: Clone the process and update all anchor references

### Edge Case 3: Copying Lifeline with Connected Nodes
- If a lifeline is selected, should nodes on it be auto-included?
- **Decision**: No auto-include. User must explicitly select nodes.
- Pasted lifeline will be empty of nodes (user adds them)

### Edge Case 4: Pasting onto Different Lifelines
- Pasted nodes keep their original lifeline references
- If those lifelines don't exist, either:
  - (a) Use first available lifeline, or
  - (b) Auto-create lifelines from clipboard
- **Decision**: (a) Remap to existing lifelines by order

### Edge Case 5: Process Validation on Paste
- After paste, verify each process has valid anchors
- Remove any processes that ended up empty (shouldn't happen with correct logic)

## Technical Details

### ID Mapping Structure

```typescript
interface IdMapping {
  nodes: Map<string, string>;      // oldNodeId -> newNodeId
  anchors: Map<string, string>;    // oldAnchorId -> newAnchorId
  lifelines: Map<string, string>;  // oldLifelineId -> newLifelineId
  processes: Map<string, string>;  // oldProcessId -> newProcessId
}
```

### Relationship Resolution Algorithm

```text
FOR each node in clipboard:
  FOR each anchor in node.anchors:
    IF anchor had a processId in original:
      IF that process is in clipboard:
        // Clone the process, update anchor references
        newAnchor.processId = idMapping.processes.get(originalProcessId)
        clonedProcess.anchorIds.push(newAnchor.id)
      ELSE:
        // Add to existing process
        existingProcess.anchorIds.push(newAnchor.id)
        newAnchor.processId = existingProcess.id
```

## Testing Scenarios

1. Copy single node -> paste creates new node with new anchors, anchors added to same process
2. Copy node + its process -> paste creates both, properly linked
3. Copy multiple nodes sharing a process -> process cloned only once
4. Copy process alone -> blocked with toast message
5. Copy lifeline -> paste creates new lifeline at end
6. Copy multiple nodes from different lifelines -> all copied, lifeline refs preserved
7. Ctrl+D quick duplicate matches Ctrl+C + Ctrl+V behavior

## Summary

This redesign ensures that the sequence diagram's entity relationships are always maintained during copy/paste operations. Processes are treated as dependent entities that cannot exist without their anchor connections, and the system automatically handles the complex relationship mapping required for a consistent user experience.
