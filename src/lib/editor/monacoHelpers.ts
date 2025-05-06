
import { FoldingRangeWithState, FoldedRegionsAnalysis } from './types';
import { generateLineToPathMap, findPathForFoldingRange } from './pathMapping';
import { editor as monacoEditor } from 'monaco-editor';

// Define a type for the editor that includes our custom methods
interface ExtendedEditor extends monacoEditor.IStandaloneCodeEditor {
  // Add getHiddenAreas as an optional method to handle Monaco editor's internal APIs
  getHiddenAreas?: () => { startLineNumber: number; endLineNumber: number }[];
}

/**
 * Get current folding ranges from the editor
 * @param editor Monaco editor instance
 * @returns Array of folding ranges
 */
export function getCurrentFoldingRanges(editor: ExtendedEditor): FoldingRangeWithState[] {
  if (!editor || !editor.getModel()) return [];
  
  // Try to access folding regions through Monaco's API
  try {
    // First method: try to access folding controller directly
    if ((editor as any)._privateApiMethod?.foldingController) {
      const foldingController = (editor as any)._privateApiMethod.foldingController;
      if (foldingController._foldingModel) {
        // Get regions from folding model
        return foldingController._foldingModel.regions.map((region: any) => ({
          startLineNumber: region.startLineNumber,
          endLineNumber: region.endLineNumber,
          isCollapsed: region.isCollapsed
        }));
      }
    }
    
    // Try alternative method to access folding controller
    if ((editor as any)._actions?.["editor.foldAll"]?.run) {
      // If we can access the fold action, we might be able to access the internal state
      const foldingControllerInternal = 
        // @ts-ignore - Accessing private Monaco API
        (editor as any)._codeEditorService?._getEditorClone?.(editor)?.foldingController ||
        // @ts-ignore - Alternative path
        (editor as any).getFoldingController?.();
      
      if (foldingControllerInternal?._foldingModel?.regions) {
        return foldingControllerInternal._foldingModel.regions.map((region: any) => ({
          startLineNumber: region.startLineNumber,
          endLineNumber: region.endLineNumber,
          isCollapsed: region.isCollapsed
        }));
      }
    }
    
    // Second method: try to get from hidden areas - this is the most reliable
    // Since this is based on what's actually displayed rather than internal state
    const hiddenRanges = editor.getHiddenAreas ? editor.getHiddenAreas() : [];
    if (hiddenRanges.length > 0) {
      return hiddenRanges.map(range => ({
        startLineNumber: range.startLineNumber,
        endLineNumber: range.endLineNumber,
        isCollapsed: true // If it's in hidden areas, it's collapsed
      }));
    }
    
    // Third method: Check folded decorations in the model
    const model = editor.getModel();
    if (model) {
      const decorations = model.getAllDecorations().filter(
        d => d.options.isWholeLine && d.options.inlineClassName === 'folded'
      );
      
      return decorations.map(d => ({
        startLineNumber: d.range.startLineNumber,
        endLineNumber: d.range.endLineNumber,
        isCollapsed: true
      }));
    }
  } catch (e) {
    console.error('Error getting folding ranges:', e);
  }
  
  return [];
}

/**
 * Analyze the editor's model to find all folded regions
 * @param editor The Monaco editor instance
 * @returns Object with info about folded ranges and model structure
 */
export function analyzeFoldedRegions(editor: ExtendedEditor): FoldedRegionsAnalysis {
  const model = editor.getModel();
  if (!model) {
    return {
      foldedRanges: [],
      modelStructure: null,
      decorations: {
        count: 0,
        foldedCount: 0,
        foldingDetails: {
          enabled: false,
          showControls: 'none',
          decorationDetails: []
        }
      }
    };
  }
  
  // Generate path map for the entire document
  const pathMap = generateLineToPathMap(model);
  
  // Get all decorations and filter for folded regions
  const decorations = model.getAllDecorations();
  const foldedDecorations = decorations.filter(
    d => d.options.isWholeLine && d.options.inlineClassName === 'folded'
  );
  
  // Get hidden areas directly - this is what's actually visually folded
  // This approach is more reliable as it's based on what's displayed
  const hiddenAreas = editor.getHiddenAreas ? editor.getHiddenAreas() : [];
  
  // Extract fold ranges and their paths
  const foldedRanges = hiddenAreas.map(range => {
    const startLine = range.startLineNumber;
    const endLine = range.endLineNumber;
    
    // Get a preview of the folded content (up to 10 lines)
    const foldedContentPreview: string[] = [];
    for (let i = startLine; i <= Math.min(endLine, startLine + 10); i++) {
      foldedContentPreview.push(model.getLineContent(i));
    }
    if (endLine > startLine + 10) {
      foldedContentPreview.push(`... and ${endLine - startLine - 10} more lines`);
    }
    
    return {
      start: startLine,
      end: endLine,
      content: model.getLineContent(startLine),
      path: findPathForFoldingRange(range, pathMap),
      foldedContent: foldedContentPreview
    };
  });
  
  // Get current folding ranges
  const currentFoldingRanges = getCurrentFoldingRanges(editor);
  
  console.log('Current folding ranges:', currentFoldingRanges);
  console.log('Hidden areas (actual folded content):', hiddenAreas);
  console.log('Path map:', pathMap);
  console.log('Folded ranges with paths:', foldedRanges);
  
  // Collect decoration details for deeper inspection
  const decorationDetails = foldedDecorations.map(d => ({
    id: d.id,
    range: `${d.range.startLineNumber}:${d.range.startColumn} - ${d.range.endLineNumber}:${d.range.endColumn}`,
    options: {
      ...d.options,
      // Ensure we don't include any circular references
      hoverMessage: d.options.hoverMessage ? 'present' : 'none',
      glyphMarginHoverMessage: d.options.glyphMarginHoverMessage ? 'present' : 'none'
    }
  }));
  
  // Get basic model structure information
  const modelStructure = {
    lineCount: model.getLineCount(),
    valueLength: model.getValueLength(),
    modelId: model.id,
    language: model.getLanguageId(),
    tabSize: model.getOptions().tabSize
  };
  
  // Get editor folding options
  const editorOptions = editor.getOptions();
  const foldingEnabled = editorOptions.get('folding');
  const showFoldingControls = editorOptions.get('showFoldingControls');
  
  return {
    foldedRanges,
    modelStructure,
    decorations: {
      count: decorations.length,
      foldedCount: foldedDecorations.length,
      foldingDetails: {
        enabled: foldingEnabled,
        showControls: showFoldingControls,
        decorationDetails
      }
    }
  };
}
