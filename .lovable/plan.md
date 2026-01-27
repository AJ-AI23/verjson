
# Fix Diagram Render Dialog: Aspect Ratio and Font Error

## Issues Identified

### Issue 1: Font Error
**Error**: `can't access property "trim", font is undefined`

**Root Cause**: The `html-to-image` library attempts to embed web fonts during capture, which can fail when fonts are undefined or not accessible.

**Solution**: Add `skipFonts: true` option to the `toPng`/`toSvg` call, matching the working implementation in `MarkdownRenderDialog.tsx`.

### Issue 2: Aspect Ratio Not Respected
**Current Behavior**: The capture area indicator fills the entire preview space regardless of the specified dimensions.

**Root Cause**: The CSS uses `width: '100%', height: '100%'` combined with `aspectRatio`, but CSS `aspect-ratio` only works when ONE dimension is constrained and the other is auto. With both set to 100%, the aspect ratio is ignored.

**Solution**: Use a proper "fit within container" approach:
- Remove explicit width/height 100%
- Let the container size itself based on aspect ratio
- Use max-width and max-height to constrain within available space
- The container will then properly maintain the target aspect ratio

## Implementation Details

### File: `src/components/diagram/DiagramRenderDialog.tsx`

**Change 1: Add skipFonts to prevent font error (line ~114-129)**
```typescript
const dataUrl = await renderFunction(containerToCapture, {
  quality: captureFormat === 'png' ? 1.0 : undefined,
  canvasWidth: captureWidth,
  canvasHeight: captureHeight,
  pixelRatio: 1,
  backgroundColor: selectedThemeData?.colors?.background,
  cacheBust: true,
  skipFonts: true,  // NEW: Prevent font embedding errors
  filter: (node) => {
    // ... existing filter
  }
});
```

**Change 2: Fix preview container sizing (lines ~272-292)**

Current (broken):
```typescript
style={{ 
  width: '100%',
  height: '100%',
  maxWidth: '100%',
  maxHeight: '100%',
  aspectRatio: `${width} / ${height}`,
  backgroundColor: activeThemeData.colors.background
}}
```

Fixed approach - container that respects aspect ratio within available space:
```typescript
style={{ 
  width: 'auto',
  height: 'auto',
  maxWidth: '100%',
  maxHeight: '100%',
  aspectRatio: `${width} / ${height}`,
  backgroundColor: activeThemeData.colors.background,
  // Use object-fit-like behavior via width/height calculation
  // The aspect-ratio works when we don't force both dimensions
}}
```

However, a more reliable cross-browser approach is to calculate the constrained dimensions programmatically based on the available space. We should:

1. Get the available container dimensions
2. Calculate the maximum size that fits while maintaining aspect ratio
3. Apply those computed dimensions

This ensures the preview container exactly matches the target aspect ratio regardless of the preview area dimensions.

## Visual Result

Before (broken):
```text
+------------------------------------------+
| Preview                                  |
| +--------------------------------------+ |
| |                         1920 × 1080  | | <- Fills entire area
| |                                      | |    regardless of ratio
| +--------------------------------------+ |
+------------------------------------------+
```

After (fixed):
```text
+------------------------------------------+
| Preview                                  |
|    +-----------------------------+       |
|    |                  1920×1080  |       | <- Correct 16:9 aspect
|    |                             |       |    ratio centered
|    +-----------------------------+       |
+------------------------------------------+
```

## Technical Approach for Aspect Ratio

Use a wrapper div with flexbox centering, and let the inner container use `aspect-ratio` with only `max-width` and `max-height` constraints:

```typescript
// Outer wrapper (already exists)
<div className="flex-1 min-h-0 flex items-center justify-center p-2">
  
  // Inner capture container - fixed approach
  <div 
    ref={previewContainerRef}
    className="border shadow-lg relative overflow-hidden"
    style={{ 
      aspectRatio: `${width} / ${height}`,
      maxWidth: '100%',
      maxHeight: '100%',
      // Key: Use min() to ensure we don't exceed container bounds
      width: 'min(100%, calc((100vh - 300px) * ' + (width/height) + '))',
      height: 'auto',
      backgroundColor: activeThemeData.colors.background
    }}
  >
```

A simpler CSS-only approach that works reliably:
- Set width to 100%, height to auto, and let aspect-ratio control height
- If height exceeds container, CSS object-fit-like logic kicks in

The most robust solution is:
```typescript
style={{ 
  maxWidth: '100%',
  maxHeight: '100%',
  aspectRatio: `${width} / ${height}`,
  width: `min(100%, calc(100% * ${Math.min(1, (width/height) / containerAspectRatio)}))`,
  backgroundColor: activeThemeData.colors.background
}}
```

But simpler is often better - we can use:
```typescript
style={{ 
  aspectRatio: `${width} / ${height}`,
  maxWidth: '100%',
  maxHeight: '100%',
  width: '100%',        // Start at full width
  height: 'fit-content', // Let height adjust based on aspect ratio
  backgroundColor: activeThemeData.colors.background
}}
```

After testing, the reliable approach is to remove explicit sizing and rely on aspect-ratio + max constraints within a flexbox centering container.

## Summary of Changes

| Location | Change |
|----------|--------|
| Line ~120 | Add `skipFonts: true` to toPng/toSvg options |
| Lines ~275-282 | Fix container styling to properly respect aspect ratio |

## Testing Scenarios

1. Set 1920x1080 (16:9) - verify preview shows wide rectangle, not filling vertical space
2. Set 1080x1920 (9:16) - verify preview shows tall rectangle
3. Set 1000x1000 (1:1) - verify preview shows square
4. Click Render - verify no font error occurs
5. Verify exported file matches exact specified dimensions
