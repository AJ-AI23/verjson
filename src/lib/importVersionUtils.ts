import { compare, Operation } from 'fast-json-patch';

export interface DocumentVersionComparison {
  patches: Operation[];
  conflictCount: number;
  recommendedVersionTier: 'major' | 'minor' | 'patch';
  hasBreakingChanges: boolean;
  mergeConflicts: MergeConflict[];
}

export interface MergeConflict {
  path: string;
  conflictType: 'property_removed' | 'property_added' | 'type_changed' | 'value_changed';
  currentValue: any;
  importValue: any;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

/**
 * Compare two document schemas and return detailed comparison results
 */
export function compareDocumentVersions(
  currentSchema: any,
  importSchema: any
): DocumentVersionComparison {
  const patches = compare(currentSchema, importSchema);
  const mergeConflicts = generateMergeConflicts(patches, currentSchema, importSchema);
  const hasBreakingChanges = detectBreakingChanges(patches);
  const recommendedVersionTier = calculateImportVersionTier(patches, hasBreakingChanges);

  return {
    patches,
    conflictCount: mergeConflicts.length,
    recommendedVersionTier,
    hasBreakingChanges,
    mergeConflicts,
  };
}

/**
 * Detect if changes constitute breaking changes
 */
export function detectBreakingChanges(patches: Operation[]): boolean {
  return patches.some(patch => {
    const path = patch.path;
    
    // Major breaking changes
    if (patch.op === 'remove') {
      // Removing properties, endpoints, or schema definitions
      if (path.includes('/properties/') || 
          path.includes('/paths/') || 
          path.includes('/definitions/') ||
          path.includes('/components/schemas/')) {
        return true;
      }
    }
    
    if (patch.op === 'replace') {
      // Type changes are breaking
      if (path.endsWith('/type')) {
        return true;
      }
      
      // Required field changes
      if (path.includes('/required')) {
        return true;
      }
      
      // Enum value removals (when the array gets smaller)
      if (path.includes('/enum') && Array.isArray(patch.value)) {
        return true;
      }
    }
    
    return false;
  });
}

/**
 * Generate detailed merge conflicts from patches
 */
export function generateMergeConflicts(
  patches: Operation[],
  currentSchema: any,
  importSchema: any
): MergeConflict[] {
  const conflicts: MergeConflict[] = [];
  
  patches.forEach(patch => {
    const path = patch.path;
    let conflictType: MergeConflict['conflictType'];
    let severity: MergeConflict['severity'] = 'low';
    let description = '';
    
    switch (patch.op) {
      case 'remove':
        conflictType = 'property_removed';
        severity = path.includes('/properties/') || path.includes('/paths/') ? 'high' : 'medium';
        description = `Property at "${path}" will be removed`;
        break;
        
      case 'add':
        conflictType = 'property_added';
        severity = 'low';
        description = `New property at "${path}" will be added`;
        break;
        
      case 'replace':
        if (path.endsWith('/type')) {
          conflictType = 'type_changed';
          severity = 'high';
          description = `Type at "${path}" will change from "${getCurrentValue(currentSchema, path)}" to "${patch.value}"`;
        } else {
          conflictType = 'value_changed';
          severity = 'medium';
          description = `Value at "${path}" will change`;
        }
        break;
        
      default:
        return; // Skip other operations
    }
    
    conflicts.push({
      path,
      conflictType,
      currentValue: getCurrentValue(currentSchema, path),
      importValue: patch.op === 'remove' ? null : patch.value,
      description,
      severity,
    });
  });
  
  return conflicts;
}

/**
 * Calculate recommended version tier based on changes
 */
export function calculateImportVersionTier(
  patches: Operation[],
  hasBreakingChanges: boolean
): 'major' | 'minor' | 'patch' {
  if (hasBreakingChanges) {
    return 'major';
  }
  
  const hasNewFeatures = patches.some(patch => 
    patch.op === 'add' && (
      patch.path.includes('/properties/') ||
      patch.path.includes('/paths/') ||
      patch.path.includes('/definitions/')
    )
  );
  
  if (hasNewFeatures) {
    return 'minor';
  }
  
  return 'patch';
}

/**
 * Helper function to get current value at a JSON path
 */
function getCurrentValue(obj: any, path: string): any {
  const pathParts = path.split('/').filter(part => part !== '');
  let current = obj;
  
  for (const part of pathParts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }
  
  return current;
}

/**
 * Apply import patches to create merged schema
 */
export function applyImportPatches(currentSchema: any, patches: Operation[]): any {
  // Create a deep copy to avoid mutating the original
  const mergedSchema = JSON.parse(JSON.stringify(currentSchema));
  
  // Apply patches using fast-json-patch
  try {
    const { applyPatch } = require('fast-json-patch');
    const result = applyPatch(mergedSchema, patches, false, false);
    return result.newDocument;
  } catch (error) {
    console.error('Error applying import patches:', error);
    throw new Error('Failed to apply import patches to schema');
  }
}