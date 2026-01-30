
# Plan: Manifest Renderer Full-Height Layout and Mobile Responsive View

## Overview
This plan addresses two issues:
1. The manifest renderer does not extend to the bottom of the page correctly
2. Mobile view needs improvement with tabbed navigation for better usability

## Current Issues

### Height Problem
- `Docs.tsx` uses `<main className="flex-1">` which doesn't properly constrain height for flex children
- `ManifestEditor` uses `h-full` but this requires explicit height from parent
- Result: Content doesn't fill the viewport and scrolling behavior is incorrect

### Mobile Problem
- `ManifestNavigation` has fixed `w-64` (256px) width
- On mobile screens, this leaves very little room for content
- No mechanism to show/hide navigation on small screens

---

## Implementation

### Phase 1: Fix Height Layout

#### 1.1 Update Docs.tsx
Ensure the main container properly fills viewport height using flexbox and `min-h-0` to allow nested flex children to scroll correctly.

```text
Changes:
- Keep outer container: min-h-screen, flex, flex-col
- Main element: flex-1, flex, flex-col, min-h-0, overflow-hidden
```

#### 1.2 Update ManifestEditor.tsx
Add `overflow-hidden` to prevent layout overflow issues with the flex container.

---

### Phase 2: Mobile Responsive Design with Tabs

#### 2.1 Add Mobile Detection
Import and use the existing `useIsMobile()` hook in `ManifestEditor`.

#### 2.2 Create Tabbed Mobile Layout
On mobile screens (< 768px), replace the side-by-side layout with a tabbed interface:

```text
Mobile Layout:
+----------------------------------+
|  [Contents] [Page]               |  <- Tab bar
+----------------------------------+
|                                  |
|   Navigation / Content           |  <- Based on active tab
|   (full width)                   |
|                                  |
+----------------------------------+
|  [Previous]        [Next]        |  <- Navigation footer
+----------------------------------+
```

**Tab Behavior:**
- "Contents" tab: Shows the navigation tree (full width)
- "Page" tab: Shows the content pane (full width)
- When user selects an entry in Contents, automatically switch to Page tab

#### 2.3 Desktop Layout (Unchanged)
On desktop screens (>= 768px), keep the existing side-by-side layout with navigation sidebar.

---

### Phase 3: Component Updates

#### 3.1 ManifestEditor.tsx Changes

```typescript
// Add imports
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Inside component
const isMobile = useIsMobile();
const [activeTab, setActiveTab] = useState<'contents' | 'page'>('page');

// Update handleSelectEntry to switch to content tab on mobile
const handleSelectEntry = useCallback((entryId: string) => {
  setSelectedEntryId(entryId);
  if (isMobile) {
    setActiveTab('page'); // Auto-switch to content when selecting
  }
}, [isMobile]);

// Render logic
return (
  <div className="...">
    {/* Search header - unchanged */}
    
    {/* Mobile tabbed view */}
    {isMobile ? (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="contents" className="flex-1">Contents</TabsTrigger>
          <TabsTrigger value="page" className="flex-1">Page</TabsTrigger>
        </TabsList>
        <TabsContent value="contents" className="flex-1 m-0 overflow-hidden">
          <ManifestNavigation ... className="w-full border-r-0" />
        </TabsContent>
        <TabsContent value="page" className="flex-1 m-0 flex flex-col overflow-hidden">
          <ManifestBreadcrumb ... />
          <ManifestContentPane ... />
        </TabsContent>
      </Tabs>
    ) : (
      /* Desktop side-by-side view - existing code */
    )}
  </div>
);
```

#### 3.2 ManifestNavigation.tsx Changes
Make the width responsive by accepting an optional `className` prop and removing the hardcoded `w-64`:

```typescript
interface ManifestNavigationProps {
  // ... existing props
  className?: string;
}

// Change from:
<div className="w-64 border-r bg-sidebar flex flex-col shrink-0">

// To:
<div className={cn("w-64 border-r bg-sidebar flex flex-col shrink-0", className)}>
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/pages/Docs.tsx` | Modify | Fix height constraints with proper flex layout |
| `src/components/manifest/ManifestEditor.tsx` | Modify | Add mobile detection and tabbed view |
| `src/components/manifest/ManifestNavigation.tsx` | Modify | Accept className prop for responsive width |

---

## Technical Considerations

### Why Tabs Instead of Drawer?
- Tabs provide clear navigation between views without overlay complexity
- More intuitive UX for documentation browsing
- Matches common mobile documentation patterns (similar to MDN, React docs)
- No need for gesture handling or swipe-to-close logic

### Auto-Tab Switching
When a user taps an entry in the "Contents" tab, automatically switching to "Page" tab provides seamless navigation without requiring manual tab switching.

### Performance
- Tab content uses conditional rendering
- Navigation tree state is preserved when switching tabs
- No additional network requests from tab switching
