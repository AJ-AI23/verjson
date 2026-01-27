
# Fix Diagram Render Dialog: Width/Height Respect and Render Area Indicator

## Problem Summary

The Render Diagram dialog has two issues:
1. **Width and height settings are not respected** - The current approach uses `pixelRatio` scaling which doesn't guarantee exact output dimensions
2. **No visual indicator of the rendered area** - Users cannot see what area of the diagram will be captured

## Root Cause Analysis

The current `handleRender` function (lines 97-159 in `DiagramRenderDialog.tsx`):
- Gets the preview container's actual rendered dimensions (`previewRect.width/height`)
- Calculates `pixelRatio = targetWidth / previewRect.width` to try to scale up
- Passes `width: previewRect.width` to `toPng()` which is the **source** size, not target

The `html-to-image` library expects:
- `width, height` - Applied to DOM node **before** rendering (modifies the source)
- `canvasWidth, canvasHeight` - The actual output canvas dimensions (the fix)

## Solution Design

### Part 1: Fix Exact Output Dimensions

Use `canvasWidth` and `canvasHeight` options to explicitly set the output image dimensions. This tells `html-to-image` to render to an off-screen canvas at the exact target size.

```text
Current (broken):
  toPng(container, {
    pixelRatio: targetWidth / containerWidth,  // Unreliable scaling
    width: containerWidth,
    height: containerHeight
  })

Fixed:
  toPng(container, {
    canvasWidth: targetWidth,    // Exact output width
    canvasHeight: targetHeight,  // Exact output height
    pixelRatio: 1               // No additional scaling
  })
```

### Part 2: Visual Render Area Indicator

Add an overlay to the preview that shows the exact proportions of the render area. The overlay will:
1. Display a dashed border frame indicating the "capture zone"
2. Show the target dimensions as a label in the corner
3. Use the aspect ratio to ensure the preview container matches what will be captured

### Part 3: Preview Container Sizing Strategy

Change the preview container from flexible sizing to fixed aspect ratio with the render dimensions clearly indicated:

```text
Current:
  width: 100%
  height: 100%
  aspectRatio: width/height

Improved:
  - Container fills available space with aspect ratio constraint
  - Add an inner "capture frame" overlay with dashed border
  - Display dimension label (e.g., "1920 × 1080")
```

## Implementation Details

### File: `src/components/diagram/DiagramRenderDialog.tsx`

**Changes to Preview Panel:**
1. Add a render frame overlay component inside the preview container
2. Style with dashed border to indicate the capture boundary
3. Add dimension label in corner

**Changes to `handleRender` function:**
1. Replace `pixelRatio` calculation with `canvasWidth`/`canvasHeight`
2. Keep `width`/`height` as the source container dimensions
3. Remove the unreliable scaling calculation

### Code Changes

**Render Frame Overlay** (new JSX inside preview container):
```jsx
{/* Render area indicator */}
<div className="absolute inset-0 pointer-events-none z-10">
  <div className="absolute inset-0 border-2 border-dashed border-primary/50" />
  <div className="absolute top-2 right-2 bg-background/90 px-2 py-1 rounded text-xs font-mono">
    {width} × {height}
  </div>
</div>
```

**Fixed toPng options:**
```typescript
const dataUrl = await renderFunction(containerToCapture, {
  quality: captureFormat === 'png' ? 1.0 : undefined,
  canvasWidth: captureWidth,     // NEW: Exact output dimensions
  canvasHeight: captureHeight,   // NEW: Exact output dimensions
  pixelRatio: 1,                 // Keep at 1, canvas size handles scaling
  backgroundColor: selectedThemeData?.colors?.background,
  cacheBust: true,
  filter: (node) => {
    // Same filter logic...
  }
});
```

## Visual Mockup

```text
+------------------------------------------+
| Preview                    [Fit to View] |
+------------------------------------------+
|                                          |
|   +- - - - - - - - - - - - - - - - - +   |
|   ¦                      1920 × 1080 ¦   |
|   ¦                                  ¦   |
|   ¦     [Diagram Content]            ¦   |
|   ¦                                  ¦   |
|   ¦                                  ¦   |
|   +- - - - - - - - - - - - - - - - - +   |
|                                          |
+------------------------------------------+
```

The dashed border shows exactly what will be captured, and the label confirms the target resolution.

## Technical Considerations

1. **SVG Format**: For SVG output, the `canvasWidth`/`canvasHeight` options may behave differently. The SVG output should set `width` and `height` attributes on the root SVG element. We'll test both formats.

2. **Very Large Dimensions**: For dimensions like 4096×4096, we should warn users that rendering may be slow but still respect the settings.

3. **Aspect Ratio Lock**: The current implementation maintains aspect ratio. We should preserve this behavior - changing width should not automatically change height.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/diagram/DiagramRenderDialog.tsx` | Fix toPng options, add render area indicator overlay |

## Testing Scenarios

1. Set 1920×1080, render PNG - verify output is exactly 1920×1080
2. Set 800×600, render PNG - verify output is exactly 800×600
3. Set 1920×1080, render SVG - verify SVG viewBox/dimensions
4. Visual check that dashed border correctly indicates capture area
5. Mobile layout still works with the overlay
