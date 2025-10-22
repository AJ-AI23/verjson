import { compare, Operation, applyPatch } from 'fast-json-patch';

export interface DocumentVersionComparison {
  patches: Operation[];
  conflictCount: number;
  recommendedVersionTier: 'major' | 'minor' | 'patch';
  hasBreakingChanges: boolean;
  mergeConflicts: MergeConflict[];
  mergedSchema?: any; // For partial imports
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
  console.log('🔍 compareDocumentVersions called:');
  console.log('Current Schema:', JSON.stringify(currentSchema, null, 2));
  console.log('Import Schema:', JSON.stringify(importSchema, null, 2));
  
  const patches = compare(currentSchema, importSchema);
  console.log('Generated patches:', patches);
  
  const mergeConflicts = generateMergeConflicts(patches, currentSchema, importSchema);
  const hasBreakingChanges = detectBreakingChanges(patches);
  const recommendedVersionTier = calculateImportVersionTier(patches, hasBreakingChanges);

  const result = {
    patches,
    conflictCount: mergeConflicts.length,
    recommendedVersionTier,
    hasBreakingChanges,
    mergeConflicts,
  };
  
  console.log('Comparison result:', result);
  return result;
}

/**
 * Compare document schemas for partial imports (like Crowdin translations)
 * Only considers properties that exist in the import schema, ignoring missing properties
 */
export function compareDocumentVersionsPartial(
  currentSchema: any,
  importSchema: any
): DocumentVersionComparison {
  console.log('🔍 compareDocumentVersionsPartial called for Crowdin import:');
  console.log('Current Schema keys:', Object.keys(currentSchema || {}));
  console.log('Import Schema keys:', Object.keys(importSchema || {}));
  
  // Create a merged schema that preserves existing properties and updates only imported ones
  const mergedSchema = createPartialMerge(currentSchema, importSchema);
  
  // Compare current with the merged result to see actual changes
  const patches = compare(currentSchema, mergedSchema);
  console.log('Generated patches for partial import:', patches);
  
  // Filter out "remove" operations since we're doing a partial import
  const filteredPatches = patches.filter(patch => patch.op !== 'remove');
  
  const mergeConflicts = generateMergeConflicts(filteredPatches, currentSchema, mergedSchema);
  const hasBreakingChanges = detectBreakingChanges(filteredPatches);
  const recommendedVersionTier = calculateImportVersionTier(filteredPatches, hasBreakingChanges);

  const result = {
    patches: filteredPatches,
    conflictCount: mergeConflicts.length,
    recommendedVersionTier,
    hasBreakingChanges,
    mergeConflicts,
    mergedSchema, // Include the merged result for import
  };
  
  console.log('Partial comparison result:', result);
  return result;
}

/**
 * Convert objects with consecutive numeric keys to arrays
 */
function convertNumericObjectsToArrays(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(convertNumericObjectsToArrays);
  }
  
  if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj);
    
    // Check if all keys are numeric and consecutive starting from 0
    const numericKeys = keys.filter(key => /^\d+$/.test(key)).map(Number).sort((a, b) => a - b);
    const isConsecutiveArray = numericKeys.length === keys.length && 
                               numericKeys.length > 0 && 
                               numericKeys[0] === 0 && 
                               numericKeys.every((num, idx) => num === idx);
    
    if (isConsecutiveArray) {
      // Convert to array
      const array = [];
      for (let i = 0; i < numericKeys.length; i++) {
        array[i] = convertNumericObjectsToArrays(obj[i.toString()]);
      }
      return array;
    } else {
      // Recursively process object properties
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = convertNumericObjectsToArrays(value);
      }
      return result;
    }
  }
  
  return obj;
}

/**
 * Convert path-based properties (like "/root.title") to nested JSON structure
 */
function pathsToNestedObject(pathData: any): any {
  const result: any = {};
  
  for (const [key, value] of Object.entries(pathData)) {
    // Handle both "/path" and "path" formats
    let cleanPath = key.startsWith('/') ? key.slice(1) : key;
    
    // Remove "root." prefix if it exists - root refers to the document root
    if (cleanPath.startsWith('root.')) {
      cleanPath = cleanPath.slice(5); // Remove "root."
    }
    
    const pathParts = cleanPath.split('.');
    
    let current = result;
    
    // Navigate/create the nested structure
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Set the final value
    const lastPart = pathParts[pathParts.length - 1];
    current[lastPart] = value;
  }
  
  // Convert objects with numeric keys to arrays
  return convertNumericObjectsToArrays(result);
}

/**
 * Create a merged schema that preserves existing structure and updates only imported properties
 */
function createPartialMerge(currentSchema: any, importSchema: any): any {
  if (!currentSchema || typeof currentSchema !== 'object') {
    return importSchema;
  }
  
  if (!importSchema || typeof importSchema !== 'object') {
    return currentSchema;
  }
  
  // Check if import schema looks like path-based data (Crowdin format)
  const importKeys = Object.keys(importSchema);
  const hasPathLikeKeys = importKeys.some(key => key.includes('/') || key.includes('.'));
  
  let processedImportSchema = importSchema;
  if (hasPathLikeKeys) {
    console.log('🔍 Detected path-based properties, converting to nested structure');
    processedImportSchema = pathsToNestedObject(importSchema);
    console.log('✅ Converted to nested:', processedImportSchema);
  }
  
  const merged = { ...currentSchema };
  
  // Recursively merge imported properties
  for (const [key, value] of Object.entries(processedImportSchema)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // If both are objects, recursively merge
      if (merged[key] && typeof merged[key] === 'object' && !Array.isArray(merged[key])) {
        merged[key] = createPartialMerge(merged[key], value);
      } else {
        // Replace with imported object
        merged[key] = value;
      }
    } else {
      // Replace primitive values directly
      merged[key] = value;
    }
  }
  
  return merged;
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
    
    // Skip root-level changes that would show the entire document
    if (path === '' || path === '/' || path === '/root') {
      return;
    }
    
    let conflictType: MergeConflict['conflictType'];
    let severity: MergeConflict['severity'] = 'low';
    let description = '';
    
    switch (patch.op) {
      case 'remove':
        conflictType = 'property_removed';
        severity = path.includes('/properties/') || path.includes('/paths/') ? 'high' : 'medium';
        description = `Property at "${formatJsonPath(path)}" will be removed`;
        break;
        
      case 'add':
        conflictType = 'property_added';
        severity = 'low';
        description = `New property at "${formatJsonPath(path)}" will be added`;
        break;
        
      case 'replace':
        if (path.endsWith('/type')) {
          conflictType = 'type_changed';
          severity = 'high';
          description = `Type at "${formatJsonPath(path)}" will change from "${getCurrentValue(currentSchema, path)}" to "${patch.value}"`;
        } else {
          // Check if the value types are changing (e.g., array to object)
          const currentValue = getCurrentValue(currentSchema, path);
          const newValue = patch.value;
          const currentType = Array.isArray(currentValue) ? 'array' : typeof currentValue;
          const newType = Array.isArray(newValue) ? 'array' : typeof newValue;
          
          if (currentType !== newType) {
            conflictType = 'type_changed';
            severity = 'high';
            description = `Value at "${formatJsonPath(path)}" will change type from ${currentType} to ${newType}`;
          } else {
            conflictType = 'value_changed';
            severity = 'medium';
            description = `Value at "${formatJsonPath(path)}" will change`;
          }
        }
        break;
        
      default:
        return; // Skip other operations
    }
    
    conflicts.push({
      path: formatJsonPath(path),
      conflictType,
      currentValue: getCurrentValue(currentSchema, path),
      importValue: patch.op === 'remove' ? null : getImportValueAtPath(importSchema, path),
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
 * Convert JSON Pointer path to readable dot notation
 */
export function formatJsonPath(path: string): string {
  if (!path || path === '/') return 'root';
  
  // Remove leading slash and split by '/'
  const parts = path.slice(1).split('/');
  
  // Convert URL-encoded characters back to readable format
  const decodedParts = parts.map((part, index) => {
    // Handle common URL encodings
    let decoded = part
      .replace(/~1/g, '/')
      .replace(/~0/g, '~')
      .replace(/%20/g, ' ')
      .replace(/%2F/g, '/')
      .replace(/%2E/g, '.');
    
    return decoded;
  });
  
  // For root-level properties, just return the property name prefixed with 'root.'
  if (decodedParts.length === 1) {
    return `root.${decodedParts[0]}`;
  }
  
  // For nested properties, build the full path
  return `root.${decodedParts.join('.')}`;
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
    // Handle URL-encoded path parts
    const decodedPart = part
      .replace(/~1/g, '/')
      .replace(/~0/g, '~');
    current = current[decodedPart];
  }
  
  return current;
}

/**
 * Get the relevant import value for a specific path
 */
export function getImportValueAtPath(importSchema: any, path: string): any {
  return getCurrentValue(importSchema, path);
}

/**
 * Apply import patches to create merged schema with intelligent array handling
 * For partial imports, use the merged schema result directly
 */
export function applyImportPatches(currentSchema: any, patches: Operation[], mergedSchema?: any, importSchema?: any): any {
  if (mergedSchema) {
    // If we have a merged schema from partial comparison, use it directly
    return mergedSchema;
  }
  
  // Apply patches with special array handling
  const targetSchema = JSON.parse(JSON.stringify(currentSchema));
  
  try {
    // Group patches by their root path to detect array operations
    const arrayPatches = detectArrayPatches(patches, currentSchema, importSchema || targetSchema);
    
    // Apply array patches first using smart merge logic
    arrayPatches.forEach(arrayPatch => {
      applySmartArrayMerge(targetSchema, arrayPatch);
    });
    
    // Apply remaining non-array patches
    const nonArrayPatches = patches.filter(patch => 
      !arrayPatches.some(ap => patch.path.startsWith(ap.path))
    );
    
    if (nonArrayPatches.length > 0) {
      const result = applyPatch(targetSchema, nonArrayPatches, false, false);
      return result.newDocument;
    }
    
    return targetSchema;
  } catch (error) {
    console.error('Error applying import patches:', error);
    throw new Error('Failed to apply import patches to schema');
  }
}

/**
 * Detect patches that are operating on arrays and should be merged intelligently
 */
function detectArrayPatches(patches: Operation[], currentSchema: any, importSchema: any): Array<{path: string, currentValue: any[], importValue: any[]}> {
  const arrayPaths = new Set<string>();
  const arrayPatches: Array<{path: string, currentValue: any[], importValue: any[]}> = [];
  
  // Find patches that are operating on array indices
  patches.forEach(patch => {
    const pathParts = patch.path.split('/').filter(p => p);
    
    // Check if this is an array index operation (path ends with a number)
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        // This is an array index operation
        const arrayPath = '/' + pathParts.slice(0, -1).join('/');
        arrayPaths.add(arrayPath);
      }
    }
  });
  
  // For each detected array path, get the current and import values
  arrayPaths.forEach(arrayPath => {
    const currentValue = getCurrentValue(currentSchema, arrayPath);
    const importValue = getCurrentValue(importSchema, arrayPath);
    
    if (Array.isArray(currentValue) && Array.isArray(importValue)) {
      arrayPatches.push({
        path: arrayPath,
        currentValue,
        importValue
      });
    }
  });
  
  console.log('🔍 Detected array patches:', arrayPatches);
  return arrayPatches;
}

/**
 * Apply smart array merge logic to combine arrays
 */
function applySmartArrayMerge(targetSchema: any, arrayPatch: {path: string, currentValue: any[], importValue: any[]}): void {
  console.log('🔄 Applying smart array merge for path:', arrayPatch.path);
  
  // Merge arrays by combining unique items
  const mergedArray = [...arrayPatch.currentValue];
  
  arrayPatch.importValue.forEach(importItem => {
    const exists = arrayPatch.currentValue.some(currentItem => 
      areArrayItemsEqual(currentItem, importItem)
    );
    
    if (!exists) {
      mergedArray.push(importItem);
      console.log('➕ Added unique array item:', importItem);
    } else {
      console.log('⏭️ Skipped duplicate array item:', importItem);
    }
  });
  
  // Set the merged array in the target schema
  setValueAtJsonPath(targetSchema, arrayPatch.path, mergedArray);
  console.log('✅ Array merge completed for', arrayPatch.path, ':', mergedArray);
}

/**
 * Compare array items for equality
 */
function areArrayItemsEqual(item1: any, item2: any): boolean {
  if (item1 === item2) return true;
  if (item1 == null || item2 == null) return item1 == item2;
  
  if (typeof item1 === 'object' && typeof item2 === 'object') {
    try {
      return JSON.stringify(item1) === JSON.stringify(item2);
    } catch (error) {
      return false;
    }
  }
  
  return String(item1) === String(item2);
}

/**
 * Set value at JSON path
 */
function setValueAtJsonPath(obj: any, path: string, value: any): void {
  if (!path || path === '/') return;
  
  const pathParts = path.slice(1).split('/'); // Remove leading slash and split
  let current = obj;
  
  // Navigate to parent
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!current[part]) {
      current[part] = {};
    }
    current = current[part];
  }
  
  // Set final value
  const finalPart = pathParts[pathParts.length - 1];
  current[finalPart] = value;
}