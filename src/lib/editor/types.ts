
import { editor } from 'monaco-editor';
import { CollapsedState } from '@/lib/diagram/types';

// Line to path mapping
export interface LineToPathMap {
  [lineNumber: number]: string;
}

// Folded region details
export interface FoldedRegionDetail {
  lineNumber: number;
  content: string;
  path: string | null;
  range: { 
    startLine: number; 
    endLine: number; 
  };
}

// Folding range with collapse state
export interface FoldingRangeWithState {
  startLineNumber: number;
  endLineNumber: number;
  isCollapsed: boolean;
}

// Analysis of folded regions
export interface FoldedRegionsAnalysis {
  foldedRanges: Array<{
    start: number;
    end: number; 
    content: string; 
    path: string | null;
    foldedContent: string[];
  }>;
  modelStructure: any;
  decorations: {
    count: number;
    foldedCount: number;
    foldingDetails: {
      enabled: boolean;
      showControls: string;
      decorationDetails: any[];
    };
  };
}

// Folding change detection result
export interface FoldingChanges {
  folded: Array<{
    path: string | null;
    range: {
      startLineNumber: number;
      endLineNumber: number;
    };
  }>;
  unfolded: Array<{
    path: string | null;
    range: {
      startLineNumber: number;
      endLineNumber: number;
    };
  }>;
}
