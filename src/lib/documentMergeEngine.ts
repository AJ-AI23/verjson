import { Document } from '@/types/workspace';
import { compareDocumentVersions, applyImportPatches } from '@/lib/importVersionUtils';
import { compare } from 'fast-json-patch';

export interface MergeConflict {
  path: string;
  type: 'type_mismatch' | 'duplicate_key' | 'incompatible_schema' | 'structure_conflict';
  severity: 'high' | 'medium' | 'low';
  description: string;
  documentSource: string;
  documentDestination: string;
  values: any[];
  suggestedResolution?: string;
  resolution?: 'current' | 'incoming' | 'additive' | 'custom' | 'unresolved';
  customValue?: any;
  currentValue?: any;
  incomingValue?: any;
  linkedConflictPaths?: string[]; // Child conflicts that should be auto-resolved when this conflict is resolved
  stepNumber?: number; // Which merge step this conflict came from
}

export interface DocumentMergeResult {
  mergedSchema: any;
  conflicts: MergeConflict[];
  isCompatible: boolean;
  warnings: string[];
  summary: {
    addedProperties: number;
    mergedComponents: number;
    totalConflicts: number;
    resolvedConflicts: number;
    unresolvedConflicts: number;
  };
  mergeSteps: Array<{
    stepNumber: number;
    fromDocument: string;
    toDocument: string;
    patches: any[];
    conflicts: number;
  }>;
}

export interface DocumentCompatibilityCheck {
  isCompatible: boolean;
  reason?: string;
  fileTypeMatch: boolean;
  structuralCompatibility: boolean;
}

export class DocumentMergeEngine {
  /**
   * Check if documents can be merged together
   */
  static checkCompatibility(documents: Document[]): DocumentCompatibilityCheck {
    if (documents.length < 2) {
      return {
        isCompatible: false,
        reason: 'At least 2 documents required for merging',
        fileTypeMatch: false,
        structuralCompatibility: false
      };
    }

    // Check file type compatibility
    const firstFileType = documents[0].file_type;
    const fileTypeMatch = documents.every(doc => doc.file_type === firstFileType);
    
    if (!fileTypeMatch) {
      return {
        isCompatible: false,
        reason: 'All documents must have the same file type',
        fileTypeMatch: false,
        structuralCompatibility: false
      };
    }

    // Check structural compatibility based on document type
    const structuralCompatibility = firstFileType === 'json-schema' 
      ? this.checkJsonSchemaCompatibility(documents)
      : this.checkOpenApiCompatibility(documents);

    return {
      isCompatible: fileTypeMatch && structuralCompatibility,
      fileTypeMatch,
      structuralCompatibility
    };
  }

  /**
   * Merge multiple documents sequentially like import version process
   */
  static mergeDocuments(documents: Document[], resultName: string): DocumentMergeResult {
    const compatibility = this.checkCompatibility(documents);
    
    if (!compatibility.isCompatible) {
      return {
        mergedSchema: {},
        conflicts: [{
          path: '/',
          type: 'incompatible_schema',
          severity: 'high',
          description: compatibility.reason || 'Documents are not compatible for merging',
          documentSource: documents[0]?.name || 'Unknown',
          documentDestination: documents[documents.length - 1]?.name || 'Unknown',
          values: []
        }],
        isCompatible: false,
        warnings: [compatibility.reason || 'Incompatible documents'],
        summary: { addedProperties: 0, mergedComponents: 0, totalConflicts: 1, resolvedConflicts: 0, unresolvedConflicts: 1 },
        mergeSteps: []
      };
    }

    return this.mergeDocumentsSequentially(documents, resultName);
  }

  /**
   * Sequential merge using import version comparison approach with enhanced array conflict detection
   */
  private static mergeDocumentsSequentially(documents: Document[], resultName: string): DocumentMergeResult {
    console.log('🔄 Starting sequential merge of', documents.length, 'documents');
    
    const allConflicts: MergeConflict[] = [];
    const mergeSteps: Array<{stepNumber: number; fromDocument: string; toDocument: string; patches: any[]; conflicts: number}> = [];
    let currentResult = documents[0].content; // Start with first document
    let totalAddedProperties = 0;
    let totalMergedComponents = 0;

    // Sequentially merge each additional document
    for (let i = 1; i < documents.length; i++) {
      const currentDoc = documents[i];
      console.log(`🔄 Step ${i}: Merging ${currentDoc.name} into accumulated result`);

      try {
        // Use the same comparison logic as import version
        const comparison = compareDocumentVersions(currentResult, currentDoc.content);
        console.log(`📊 Step ${i} comparison:`, comparison);

        // Apply patches to get merged result - pass importSchema for smart array merging
        const stepResult = applyImportPatches(currentResult, comparison.patches, undefined, currentDoc.content);
        
        // Convert import conflicts to merge conflicts and detect array item conflicts
        const stepConflicts = comparison.mergeConflicts.map(conflict => ({
          path: conflict.path,
          type: this.mapConflictType(conflict.conflictType),
          severity: conflict.severity,
          description: `Step ${i} (${currentDoc.name}): ${conflict.description}`,
          documentSource: i === 1 ? documents[0].name : 'Previous merge result',
          documentDestination: currentDoc.name,
          values: [conflict.currentValue, conflict.importValue],
          suggestedResolution: 'Manual review required',
          resolution: 'unresolved' as const,
          currentValue: conflict.currentValue,
          incomingValue: conflict.importValue,
          stepNumber: i // Track which step this conflict came from
        }));

    // Enhance with array item-level conflicts (without sorting yet)
    const enhancedConflicts = this.enhanceArrayConflicts(stepConflicts, currentResult, currentDoc.content, false);
    
    // Add step number to enhanced conflicts
    const enhancedConflictsWithStep = enhancedConflicts.map(c => ({ ...c, stepNumber: i }));
    
    allConflicts.push(...enhancedConflictsWithStep);
        
        // Track merge step
        mergeSteps.push({
          stepNumber: i,
          fromDocument: currentDoc.name,
          toDocument: i === 1 ? documents[0].name : 'Accumulated Result',
          patches: comparison.patches,
          conflicts: enhancedConflicts.length
        });

        // Update accumulated result
        currentResult = stepResult;
        
        // Count properties/components added in this step
        const addedInStep = comparison.patches.filter(p => p.op === 'add').length;
        totalAddedProperties += addedInStep;

        console.log(`✅ Step ${i} completed. Added ${addedInStep} properties, ${enhancedConflicts.length} conflicts`);

      } catch (error) {
        console.error(`❌ Error in merge step ${i}:`, error);
        allConflicts.push({
          path: '/',
          type: 'incompatible_schema',
          severity: 'high',
          description: `Failed to merge ${currentDoc.name}: ${error.message}`,
          documentSource: documents[0].name,
          documentDestination: currentDoc.name,
          values: [],
          suggestedResolution: 'Review document structure and try again'
        });
      }
    }

    // Set final result properties, preserving any merged root-level values
    const finalResult = {
      ...currentResult,
      // Only set title if it wasn't already set by the merge process
      ...(currentResult.title ? {} : { title: resultName }),
      // Only set description if it wasn't already set by the merge process
      ...(currentResult.description ? {} : { 
        description: `Merged schema from: ${documents.map(d => d.name).join(', ')}` 
      })
    };

    // Handle different schema formats - preserve merged info if it exists
    if (finalResult.openapi || finalResult.swagger || finalResult.info) {
      finalResult.info = {
        title: resultName,
        version: '1.0.0',
        description: `Merged API specification from: ${documents.map(d => d.name).join(', ')}`,
        ...finalResult.info, // Preserve any merged info properties
      };
    }

    // Sort all conflicts after all documents have been merged (structural depth-first order)
    const sortedConflicts = this.sortConflictsByPathDepth(allConflicts);
    
    const resolvedConflicts = sortedConflicts.filter(c => c.resolution !== 'unresolved').length;
    const unresolvedConflicts = sortedConflicts.filter(c => c.resolution === 'unresolved').length;

    console.log('🎯 Sequential merge completed:', {
      steps: mergeSteps.length,
      totalConflicts: sortedConflicts.length,
      resolvedConflicts,
      unresolvedConflicts,
      totalAddedProperties
    });

    return {
      mergedSchema: finalResult,
      conflicts: sortedConflicts,
      isCompatible: true,
      warnings: allConflicts.length > 0 ? [`${allConflicts.length} conflicts detected during merge`] : [],
      summary: {
        addedProperties: totalAddedProperties,
        mergedComponents: totalMergedComponents,
        totalConflicts: allConflicts.length,
        resolvedConflicts,
        unresolvedConflicts
      },
      mergeSteps
    };
  }

  /**
   * Normalize path to use bracket notation for array indices
   */
  private static normalizeArrayPath(path: string): string {
    // Convert dot notation array indices (e.g., root.tags.0) to bracket notation (e.g., root.tags[0])
    return path.replace(/\.(\d+)(?=\.|$)/g, '[$1]');
  }

  /**
   * Sort conflicts in depth-first tree order (structural order)
   * e.g. root.info, root.info.description, root.info.title, root.components, root.components.schemas
   */
  private static sortConflictsByPathDepth(conflicts: MergeConflict[]): MergeConflict[] {
    return conflicts.sort((a, b) => {
      const pathA = a.path;
      const pathB = b.path;
      
      // Split paths into segments, handling both dot notation and bracket notation
      const segmentsA = pathA.split(/\.|\[/).map(s => s.replace(/\]$/, ''));
      const segmentsB = pathB.split(/\.|\[/).map(s => s.replace(/\]$/, ''));
      
      // Compare segment by segment for depth-first tree order
      const minLength = Math.min(segmentsA.length, segmentsB.length);
      
      for (let i = 0; i < minLength; i++) {
        const segA = segmentsA[i];
        const segB = segmentsB[i];
        
        if (segA !== segB) {
          // Different segments at this level - sort alphabetically
          // Try to parse as numbers for array indices
          const numA = parseInt(segA);
          const numB = parseInt(segB);
          
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB; // Both are numbers, sort numerically
          }
          
          return segA.localeCompare(segB); // Sort alphabetically
        }
      }
      
      // All compared segments are equal, shorter path comes first (parent before children)
      return segmentsA.length - segmentsB.length;
    });
  }

  /**
   * Enhance conflicts by detecting array item-level conflicts
   */
  private static enhanceArrayConflicts(
    baseConflicts: MergeConflict[], 
    currentSchema: any, 
    incomingSchema: any,
    shouldSort: boolean = true
  ): MergeConflict[] {
    // First, normalize all paths to use bracket notation and remove duplicates
    const normalizedConflicts = baseConflicts.map(conflict => ({
      ...conflict,
      path: this.normalizeArrayPath(conflict.path)
    }));

    // Remove duplicates based on path
    const uniqueConflicts = normalizedConflicts.reduce((acc, conflict) => {
      const existing = acc.find(c => c.path === conflict.path);
      if (!existing) {
        acc.push(conflict);
      }
      return acc;
    }, [] as MergeConflict[]);

    const enhancedConflicts = [...uniqueConflicts];
    const processedArrayItems = new Set<string>();

    // Find all array paths that have property-level conflicts
    const arrayPathsWithConflicts = new Set<string>();
    uniqueConflicts.forEach(conflict => {
      // Match patterns like root.tags[0].name -> extract root.tags[0]
      const itemMatch = conflict.path.match(/^(root\.[^[]*(?:\.[^[]*)*\[\d+\])/);
      if (itemMatch) {
        arrayPathsWithConflicts.add(itemMatch[1]);
      }
    });

    // For each array item that has property conflicts, create an item-level conflict
    arrayPathsWithConflicts.forEach(itemPath => {
      if (processedArrayItems.has(itemPath)) return;
      processedArrayItems.add(itemPath);

      // Check if we already have a conflict at the item level
      const hasItemConflict = enhancedConflicts.some(c => c.path === itemPath);
      if (hasItemConflict) return;

      // Extract array path and item index
      const match = itemPath.match(/^(root\.[^[]*(?:\.[^[]*)*)\[(\d+)\]/);
      if (!match) return;
      
      const arrayPath = match[1];
      const itemIndex = parseInt(match[2]);

      // Get the array values
      const currentArray = this.getValueAtPath(currentSchema, arrayPath);
      const incomingArray = this.getValueAtPath(incomingSchema, arrayPath);

      if (Array.isArray(currentArray) && Array.isArray(incomingArray)) {
        const currentItem = currentArray[itemIndex];
        const incomingItem = incomingArray[itemIndex];

        // Only create conflict if items are actually different
        if (JSON.stringify(currentItem) !== JSON.stringify(incomingItem)) {
            enhancedConflicts.push({
            path: itemPath,
            type: 'structure_conflict',
            severity: 'medium',
            description: `Array item at index ${itemIndex} differs between documents`,
            documentSource: 'current',
            documentDestination: 'incoming',
            values: [currentItem, incomingItem],
            suggestedResolution: 'Choose Smart Merge to combine array items intelligently',
            resolution: 'unresolved',
            currentValue: currentItem,
            incomingValue: incomingItem,
            stepNumber: undefined // Will be set by caller
          });
        }
      }
    });

    // Also detect array-level conflicts where arrays have different lengths or completely different items
    const arrayPaths = new Set<string>();
    [...uniqueConflicts, ...Array.from(arrayPathsWithConflicts)].forEach(item => {
      const path = typeof item === 'string' ? item : item.path;
      const match = path.match(/^(root\.[^[]*(?:\.[^[]*)*)\[/);
      if (match) {
        arrayPaths.add(match[1]);
      }
    });

    arrayPaths.forEach(arrayPath => {
      const currentArray = this.getValueAtPath(currentSchema, arrayPath);
      const incomingArray = this.getValueAtPath(incomingSchema, arrayPath);

      if (Array.isArray(currentArray) && Array.isArray(incomingArray)) {
        // Check all items and create item-level conflicts for differing items
        const maxLength = Math.max(currentArray.length, incomingArray.length);
        
        for (let i = 0; i < maxLength; i++) {
          const itemPath = `${arrayPath}[${i}]`;
          if (processedArrayItems.has(itemPath)) continue;
          
          const currentItem = currentArray[i];
          const incomingItem = incomingArray[i];
          
          // Skip if both are undefined (past array length)
          if (currentItem === undefined && incomingItem === undefined) continue;
          
          // Create conflict if items differ
          if (JSON.stringify(currentItem) !== JSON.stringify(incomingItem)) {
            processedArrayItems.add(itemPath);
            
            // Check if we already have this conflict
            const hasConflict = enhancedConflicts.some(c => c.path === itemPath);
            if (!hasConflict) {
              enhancedConflicts.push({
                path: itemPath,
                type: 'structure_conflict',
                severity: 'medium',
                description: currentItem === undefined 
                  ? `New array item at index ${i} from incoming document`
                  : incomingItem === undefined
                  ? `Array item at index ${i} only exists in current document`
                  : `Array item at index ${i} differs between documents`,
                documentSource: 'current',
                documentDestination: 'incoming',
                values: [currentItem, incomingItem],
                suggestedResolution: 'Choose Smart Merge to combine array items intelligently',
                resolution: 'unresolved',
                currentValue: currentItem,
                incomingValue: incomingItem,
                stepNumber: undefined // Will be set by caller
              });
            }
          }
        }
      }
    });

    // Link parent array item conflicts to their child property conflicts
    // Only link if they have the same documentSource
    enhancedConflicts.forEach(conflict => {
      // Check if this is an array item-level conflict (e.g., root.tags[0])
      const itemMatch = conflict.path.match(/^(root\.[^[]*(?:\.[^[]*)*\[\d+\])$/);
      if (itemMatch) {
        const itemPath = itemMatch[1];
        console.log(`🔍 Found array item conflict: ${itemPath}`, {
          documentSource: conflict.documentSource,
          documentDestination: conflict.documentDestination
        });
        
        // Find all child property conflicts from the same documentSource
        const childConflictPaths: string[] = [];
        enhancedConflicts.forEach(c => {
          // Check if this conflict is a child of the current array item
          const isChild = c.path.startsWith(itemPath + '.');
          
          if (isChild) {
            // Only link if they have the same documentSource
            if (c.documentSource === conflict.documentSource) {
              console.log(`  👶 Linked child property: ${c.path} (same source: ${c.documentSource})`);
              childConflictPaths.push(c.path);
            } else {
              console.log(`  ⚠️ Skipped child property: ${c.path} (different source: ${c.documentSource} vs ${conflict.documentSource})`);
            }
          }
        });
        
        if (childConflictPaths.length > 0) {
          conflict.linkedConflictPaths = childConflictPaths;
          console.log(`🔗 Linked ${childConflictPaths.length} child conflicts to ${itemPath}:`, childConflictPaths);
        } else {
          console.log(`⚠️ No child conflicts found for ${itemPath} with matching documentSource`);
        }
      }
    });

    // Only sort if requested (sorting should be done after all documents are merged)
    return shouldSort ? this.sortConflictsByPathDepth(enhancedConflicts) : enhancedConflicts;
  }

  /**
   * Get value at dot notation path
   */
  private static getValueAtPath(obj: any, path: string): any {
    if (!path || path === 'root') return obj;
    
    const pathParts = path.split('.').filter(part => part !== 'root');
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
   * Regenerate conflicts from a specific step onwards based on resolved state
   */
  static regenerateFromStep(
    documents: Document[],
    resultName: string,
    currentMergeResult: DocumentMergeResult,
    changedStepNumber: number
  ): DocumentMergeResult {
    console.log(`🔄 Regenerating merge from step ${changedStepNumber} onwards`);
    
    // Get conflicts for steps before the changed step (these remain unchanged)
    const unchangedConflicts = currentMergeResult.conflicts.filter(
      c => c.stepNumber !== undefined && c.stepNumber < changedStepNumber
    );
    
    // Save current resolutions for the changed step and onwards
    const savedResolutions = new Map<string, MergeConflict['resolution']>();
    currentMergeResult.conflicts.forEach(conflict => {
      if (conflict.stepNumber !== undefined && conflict.stepNumber >= changedStepNumber) {
        const key = `${conflict.stepNumber}|${conflict.path}|${conflict.type}|${conflict.description}`;
        if (conflict.resolution && conflict.resolution !== 'unresolved') {
          savedResolutions.set(key, conflict.resolution);
          console.log(`💾 Saving resolution for ${conflict.path}: ${conflict.resolution}`);
        }
      }
    });
    
    // Apply resolutions up to (but not including) the changed step to get the base state
    let baseState = documents[0].content;
    
    for (let step = 1; step < changedStepNumber; step++) {
      const stepConflicts = currentMergeResult.conflicts.filter(c => c.stepNumber === step);
      if (stepConflicts.length > 0) {
        baseState = this.applyConflictResolutions(baseState, stepConflicts);
      } else {
        // If no conflicts for this step, merge normally
        if (documents[step]) {
          const comparison = compareDocumentVersions(baseState, documents[step].content);
          baseState = applyImportPatches(baseState, comparison.patches, undefined, documents[step].content);
        }
      }
    }
    
    // Now regenerate from the changed step onwards
    const newConflicts = [...unchangedConflicts];
    let currentResult = baseState;
    
    for (let i = changedStepNumber; i < documents.length; i++) {
      const currentDoc = documents[i];
      console.log(`🔄 Regenerating step ${i}: Merging ${currentDoc.name}`);
      
      try {
        // Get the resolved state from the previous step
        if (i > changedStepNumber) {
          const prevStepConflicts = newConflicts.filter(c => c.stepNumber === i - 1);
          if (prevStepConflicts.length > 0) {
            currentResult = this.applyConflictResolutions(currentResult, prevStepConflicts);
          }
        } else if (i === changedStepNumber) {
          // For the changed step, apply current resolutions
          const changedStepConflicts = currentMergeResult.conflicts.filter(c => c.stepNumber === changedStepNumber);
          if (changedStepConflicts.length > 0) {
            currentResult = this.applyConflictResolutions(currentResult, changedStepConflicts);
          }
        }
        
        // Compare against the resolved state (not the original document)
        const comparison = compareDocumentVersions(currentResult, currentDoc.content);
        
        // Apply patches to get merged result
        const stepResult = applyImportPatches(currentResult, comparison.patches, undefined, currentDoc.content);
        
        // Convert to merge conflicts
        const stepConflicts = comparison.mergeConflicts.map(conflict => {
          // Try to restore saved resolution
          const key = `${i}|${conflict.path}|${this.mapConflictType(conflict.conflictType)}|Step ${i} (${currentDoc.name}): ${conflict.description}`;
          const savedResolution = savedResolutions.get(key);
          
          if (savedResolution) {
            console.log(`♻️ Restoring resolution for ${conflict.path} in step ${i}: ${savedResolution}`);
          }
          
          return {
            path: conflict.path,
            type: this.mapConflictType(conflict.conflictType),
            severity: conflict.severity,
            description: `Step ${i} (${currentDoc.name}): ${conflict.description}`,
            documentSource: i === 1 ? documents[0].name : 'Previous merge result',
            documentDestination: currentDoc.name,
            values: [conflict.currentValue, conflict.importValue],
            suggestedResolution: 'Manual review required',
            resolution: savedResolution || ('unresolved' as const),
            currentValue: conflict.currentValue,
            incomingValue: conflict.importValue,
            stepNumber: i
          };
        });
        
        // Enhance with array conflicts
        const enhancedConflicts = this.enhanceArrayConflicts(stepConflicts, currentResult, currentDoc.content, false);
        const enhancedConflictsWithStep = enhancedConflicts.map(c => {
          // Try to restore resolution for enhanced conflicts too
          const key = `${i}|${c.path}|${c.type}|${c.description}`;
          const savedResolution = savedResolutions.get(key);
          
          if (savedResolution && c.resolution === 'unresolved') {
            console.log(`♻️ Restoring resolution for enhanced conflict ${c.path}: ${savedResolution}`);
            return { ...c, resolution: savedResolution, stepNumber: i };
          }
          
          return { ...c, stepNumber: i };
        });
        
        newConflicts.push(...enhancedConflictsWithStep);
        
        // Update current result
        currentResult = stepResult;
      } catch (error) {
        console.error(`❌ Error regenerating step ${i}:`, error);
      }
    }
    
    // Sort all conflicts
    const sortedConflicts = this.sortConflictsByPathDepth(newConflicts);
    
    // Apply all resolutions to get final schema
    const finalMergedSchema = this.applyConflictResolutions(
      currentResult,
      sortedConflicts
    );
    
    const resolvedCount = sortedConflicts.filter(c => c.resolution !== 'unresolved').length;
    
    return {
      ...currentMergeResult,
      conflicts: sortedConflicts,
      mergedSchema: finalMergedSchema,
      summary: {
        ...currentMergeResult.summary,
        totalConflicts: sortedConflicts.length,
        resolvedConflicts: resolvedCount,
        unresolvedConflicts: sortedConflicts.length - resolvedCount
      }
    };
  }

  /**
   * Apply conflict resolutions to generate final merged schema with path ordering and cascading resolution
   */
  static applyConflictResolutions(baseSchema: any, conflicts: MergeConflict[], pathOrder?: string[]): any {
    let result = JSON.parse(JSON.stringify(baseSchema));
    
    // Group conflicts by path
    const conflictsByPath = conflicts.reduce((acc, conflict) => {
      if (!acc[conflict.path]) {
        acc[conflict.path] = [];
      }
      acc[conflict.path].push(conflict);
      return acc;
    }, {} as Record<string, MergeConflict[]>);
    
    // Apply conflicts in specified path order, or default order if no order specified
    const pathsToProcess = pathOrder || Object.keys(conflictsByPath);
    
    // Handle cascading resolution for array items first
    this.applyCascadingResolution(conflicts);
    
    // Group array item conflicts by their parent array path
    const arrayItemConflicts = conflicts.filter(c => 
      c.path.includes('[') && c.path.includes(']') && c.resolution === 'additive'
    );
    
    const arrayGroups = new Map<string, MergeConflict[]>();
    arrayItemConflicts.forEach(conflict => {
      const arrayPath = conflict.path.substring(0, conflict.path.indexOf('['));
      if (!arrayGroups.has(arrayPath)) {
        arrayGroups.set(arrayPath, []);
      }
      arrayGroups.get(arrayPath)!.push(conflict);
    });
    
    // Collect all linked child conflict paths that were auto-resolved
    const autoResolvedPaths = new Set<string>();
    arrayItemConflicts.forEach(conflict => {
      if (conflict.linkedConflictPaths) {
        conflict.linkedConflictPaths.forEach(linkedPath => {
          autoResolvedPaths.add(linkedPath);
        });
      }
    });
    
    console.log(`📋 Auto-resolved ${autoResolvedPaths.size} linked child conflicts via Smart Merge`);
    
    // Process array groups with Smart Merge
    arrayGroups.forEach((itemConflicts, arrayPath) => {
      console.log(`🔄 Processing Smart Merge for array: ${arrayPath}`);
      
      // Collect all items from both current and incoming arrays
      const allItems: any[] = [];
      const seenItems = new Set<string>();
      
      itemConflicts.forEach(conflict => {
        // Add current value if exists
        if (conflict.currentValue !== undefined && conflict.currentValue !== null) {
          const itemKey = JSON.stringify(conflict.currentValue);
          if (!seenItems.has(itemKey)) {
            seenItems.add(itemKey);
            allItems.push(conflict.currentValue);
          }
        }
        
        // Add incoming value if exists and different from current
        if (conflict.incomingValue !== undefined && conflict.incomingValue !== null) {
          const itemKey = JSON.stringify(conflict.incomingValue);
          if (!seenItems.has(itemKey)) {
            seenItems.add(itemKey);
            allItems.push(conflict.incomingValue);
          }
        }
      });
      
      console.log(`✅ Smart Merge result for ${arrayPath}:`, allItems);
      
      // Set the merged array at the parent path
      this.setValueAtPath(result, arrayPath, allItems);
    });
    
    // Process remaining non-array conflicts
    pathsToProcess.forEach(path => {
      // Skip array item paths that were already handled by Smart Merge
      const isArrayItemPath = path.includes('[') && path.includes(']');
      const arrayPath = isArrayItemPath ? path.substring(0, path.indexOf('[')) : null;
      if (isArrayItemPath && arrayGroups.has(arrayPath!)) {
        return; // Skip, already handled
      }
      
      // Skip child property paths that were auto-resolved via Smart Merge
      if (autoResolvedPaths.has(path)) {
        console.log(`⏭️  Skipping auto-resolved child conflict: ${path}`);
        return;
      }
      
      const pathConflicts = conflictsByPath[path] || [];
      
      pathConflicts.forEach(conflict => {
        if (conflict.resolution && conflict.resolution !== 'unresolved') {
          let valueToApply;
          
          switch (conflict.resolution) {
            case 'current':
              valueToApply = conflict.currentValue;
              break;
            case 'incoming':
              valueToApply = conflict.incomingValue;
              break;
            case 'additive':
              // For non-array-item paths, use regular additive logic
              valueToApply = this.getAdditiveValue(conflict.currentValue, conflict.incomingValue);
              break;
            case 'custom':
              valueToApply = conflict.customValue;
              break;
          }
          
          if (valueToApply !== undefined) {
            this.setValueAtPath(result, conflict.path, valueToApply);
          }
        }
      });
    });
    
    return result;
  }

  /**
   * Apply cascading resolution when array item conflicts are resolved as 'additive'
   * Uses linkedConflictPaths to automatically resolve child conflicts
   */
  private static applyCascadingResolution(conflicts: MergeConflict[]): void {
    conflicts.forEach(conflict => {
      if (conflict.resolution === 'additive' && conflict.linkedConflictPaths && conflict.linkedConflictPaths.length > 0) {
        console.log(`🔄 Applying cascading resolution for ${conflict.path} to ${conflict.linkedConflictPaths.length} linked conflicts`);
        
        // Find all linked child conflicts and auto-resolve them if they're also set to Smart Merge or unresolved
        conflict.linkedConflictPaths.forEach(linkedPath => {
          const linkedConflict = conflicts.find(c => c.path === linkedPath);
          if (linkedConflict && (linkedConflict.resolution === 'unresolved' || linkedConflict.resolution === 'additive')) {
            linkedConflict.resolution = 'additive';
            console.log(`✅ Auto-resolved linked conflict: ${linkedPath} (cascaded from ${conflict.path})`);
          }
        });
      }
    });
  }

  /**
   * Get the additive value with special array handling for Smart Merge
   */
  private static getAdditiveValue(currentValue: any, incomingValue: any): any {
    // If one is null/undefined and the other isn't, prefer the non-null
    if ((currentValue === null || currentValue === undefined) && 
        (incomingValue !== null && incomingValue !== undefined)) {
      return incomingValue;
    }
    if ((incomingValue === null || incomingValue === undefined) && 
        (currentValue !== null && currentValue !== undefined)) {
      return currentValue;
    }

    // Special handling for arrays - merge array items intelligently
    if (Array.isArray(currentValue) && Array.isArray(incomingValue)) {
      return this.mergeArrays(currentValue, incomingValue);
    }

    // If both are non-null or both are null, prefer incoming (default behavior)
    return incomingValue;
  }

  /**
   * Merge arrays by combining items, avoiding duplicates based on content
   */
  private static mergeArrays(currentArray: any[], incomingArray: any[]): any[] {
    console.log('🔄 Merging arrays:', { currentArray, incomingArray });
    
    const result = [...currentArray]; // Start with current array
    
    // Add items from incoming array that don't already exist
    incomingArray.forEach(incomingItem => {
      const exists = currentArray.some(currentItem => 
        this.areArrayItemsEqual(currentItem, incomingItem)
      );
      
      if (!exists) {
        result.push(incomingItem);
        console.log('➕ Added unique array item:', incomingItem);
      } else {
        console.log('⏭️ Skipped duplicate array item:', incomingItem);
      }
    });
    
    console.log('✅ Array merge result:', result);
    return result;
  }

  /**
   * Compare array items for equality, handling both primitive and object types
   */
  private static areArrayItemsEqual(item1: any, item2: any): boolean {
    // Handle primitive values
    if (item1 === item2) {
      return true;
    }
    
    // Handle null/undefined cases
    if (item1 == null || item2 == null) {
      return item1 == item2;
    }
    
    // Handle objects/arrays by comparing JSON strings
    if (typeof item1 === 'object' && typeof item2 === 'object') {
      try {
        return JSON.stringify(item1) === JSON.stringify(item2);
      } catch (error) {
        console.warn('Error comparing array items:', error);
        return false;
      }
    }
    
    // Handle other types
    return String(item1) === String(item2);
  }

  /**
   * Set value at dot notation path in object, supporting array bracket notation
   */
  private static setValueAtPath(obj: any, path: string, value: any): void {
    // Handle root path
    if (path === 'root' || path === '') {
      return;
    }

    // Handle JSON pointer paths (e.g., "/title", "/tags")
    if (path.startsWith('/')) {
      const jsonPath = path.slice(1); // Remove leading slash
      if (jsonPath === '') {
        return; // Root path, nothing to set
      }
      
      // For root-level properties, set directly on the object
      if (!jsonPath.includes('/')) {
        obj[jsonPath] = value;
        return;
      }
      
      // For nested paths, split and navigate
      const pathParts = jsonPath.split('/');
      let current = obj;
      
      // Navigate to the parent object
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
      
      // Set the final value
      const finalPart = pathParts[pathParts.length - 1];
      current[finalPart] = value;
      return;
    }

    // Handle dot notation paths with array bracket notation (e.g., root.tags[0])
    // Convert array bracket notation to dot notation: tags[0] -> tags.0
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    const pathParts = normalizedPath.split('.').filter(part => part !== '' && part !== 'root');
    
    if (pathParts.length === 0) {
      return;
    }
    
    let current = obj;
    
    // Navigate through the path
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      const nextPart = pathParts[i + 1];
      
      // Check if next part is a numeric index (for array access)
      const isNextArray = /^\d+$/.test(nextPart);
      
      if (!current[part]) {
        // Create array if next part is numeric, otherwise create object
        current[part] = isNextArray ? [] : {};
      }
      
      current = current[part];
    }
    
    // Set the final value
    const finalPart = pathParts[pathParts.length - 1];
    
    // If final part is numeric, we're setting an array index
    if (/^\d+$/.test(finalPart)) {
      const index = parseInt(finalPart);
      if (Array.isArray(current)) {
        current[index] = value;
      } else {
        console.warn(`Attempting to set array index ${index} on non-array:`, current);
      }
    } else {
      current[finalPart] = value;
    }
  }

  /**
   * Map import conflict types to merge conflict types
   */
  private static mapConflictType(importConflictType: string): MergeConflict['type'] {
    switch (importConflictType) {
      case 'property_removed':
      case 'property_added':
      case 'value_changed':
        return 'duplicate_key';
      case 'type_changed':
        return 'type_mismatch';
      default:
        return 'structure_conflict';
    }
  }

  /**
   * Merge JSON Schema documents
   */
  private static mergeJsonSchemas(documents: Document[], resultName: string): DocumentMergeResult {
    const conflicts: MergeConflict[] = [];
    const warnings: string[] = [];
    const mergedSchema: any = {
      type: 'object',
      title: resultName,
      description: `Merged schema from: ${documents.map(d => d.name).join(', ')}`,
      properties: {},
      required: [],
      definitions: {}
    };

    let addedProperties = 0;
    let mergedComponents = 0;

    // Merge properties from all documents
    documents.forEach((doc, docIndex) => {
      const schema = doc.content;
      
      // Merge top-level properties
      if (schema.properties) {
        Object.entries(schema.properties).forEach(([key, value]) => {
          if (mergedSchema.properties[key]) {
            // Property conflict detected
            const existingValue = mergedSchema.properties[key];
            if (JSON.stringify(existingValue) !== JSON.stringify(value)) {
              conflicts.push({
                path: `/properties/${key}`,
                type: 'duplicate_key',
                severity: 'medium',
                description: `Property "${key}" exists in multiple documents with different definitions`,
                documentSource: documents[0].name,
                documentDestination: doc.name,
                values: [existingValue, value],
                suggestedResolution: 'Manual review required to resolve property conflicts'
              });
            }
          } else {
            mergedSchema.properties[key] = value;
            addedProperties++;
          }
        });
      }

      // Merge required fields
      if (schema.required && Array.isArray(schema.required)) {
        schema.required.forEach((field: string) => {
          if (!mergedSchema.required.includes(field)) {
            mergedSchema.required.push(field);
          }
        });
      }

      // Merge definitions
      if (schema.definitions) {
        Object.entries(schema.definitions).forEach(([key, value]) => {
          if (mergedSchema.definitions[key]) {
            if (JSON.stringify(mergedSchema.definitions[key]) !== JSON.stringify(value)) {
              conflicts.push({
                path: `/definitions/${key}`,
                type: 'duplicate_key',
                severity: 'high',
                description: `Definition "${key}" conflicts between documents`,
                documentSource: documents[0].name,
                documentDestination: doc.name,
                values: [mergedSchema.definitions[key], value],
                suggestedResolution: 'Rename conflicting definitions or merge manually'
              });
            }
          } else {
            mergedSchema.definitions[key] = value;
            mergedComponents++;
          }
        });
      }

      // Copy other top-level properties if they don't exist
      ['$schema', '$id', 'examples'].forEach(prop => {
        if (schema[prop] && !mergedSchema[prop]) {
          mergedSchema[prop] = schema[prop];
        }
      });
    });

    return {
      mergedSchema,
      conflicts,
      isCompatible: true,
      warnings,
      summary: {
        addedProperties,
        mergedComponents,
        totalConflicts: conflicts.length,
        resolvedConflicts: 0,
        unresolvedConflicts: conflicts.length
      },
      mergeSteps: [] // Legacy merge method doesn't track steps
    };
  }

  /**
   * Merge OpenAPI specification documents
   */
  private static mergeOpenApiSpecs(documents: Document[], resultName: string): DocumentMergeResult {
    const conflicts: MergeConflict[] = [];
    const warnings: string[] = [];
    const mergedSpec: any = {
      openapi: '3.1.0',
      info: {
        title: resultName,
        version: '1.0.0',
        description: `Merged API specification from: ${documents.map(d => d.name).join(', ')}`
      },
      paths: {},
      components: {
        schemas: {},
        parameters: {},
        responses: {},
        securitySchemes: {}
      }
    };

    let addedProperties = 0;
    let mergedComponents = 0;

    documents.forEach((doc, docIndex) => {
      const spec = doc.content;

      // Merge paths
      if (spec.paths) {
        Object.entries(spec.paths).forEach(([path, pathItem]) => {
          if (mergedSpec.paths[path]) {
            // Path conflict - check if methods overlap
            const existingMethods = Object.keys(mergedSpec.paths[path]);
            const newMethods = Object.keys(pathItem as any);
            const overlapping = existingMethods.filter(method => newMethods.includes(method));
            
            if (overlapping.length > 0) {
              conflicts.push({
                path: `/paths${path}`,
                type: 'duplicate_key',
                severity: 'high',
                description: `Path "${path}" has overlapping HTTP methods: ${overlapping.join(', ')}`,
                documentSource: documents[0].name,
                documentDestination: doc.name,
                values: [mergedSpec.paths[path], pathItem],
                suggestedResolution: 'Review conflicting endpoints and merge manually'
              });
            } else {
              // Merge non-overlapping methods
              mergedSpec.paths[path] = { ...mergedSpec.paths[path], ...(pathItem as any) };
            }
          } else {
            mergedSpec.paths[path] = pathItem;
            addedProperties++;
          }
        });
      }

      // Merge components
      if (spec.components) {
        ['schemas', 'parameters', 'responses', 'securitySchemes'].forEach(componentType => {
          if (spec.components[componentType]) {
            Object.entries(spec.components[componentType]).forEach(([key, value]) => {
              if (mergedSpec.components[componentType][key]) {
                if (JSON.stringify(mergedSpec.components[componentType][key]) !== JSON.stringify(value)) {
                  conflicts.push({
                    path: `/components/${componentType}/${key}`,
                    type: 'duplicate_key',
                    severity: 'medium',
                    description: `Component "${key}" in ${componentType} conflicts between documents`,
                    documentSource: documents[0].name,
                    documentDestination: doc.name,
                    values: [mergedSpec.components[componentType][key], value],
                    suggestedResolution: 'Rename conflicting components or merge manually'
                  });
                }
              } else {
                mergedSpec.components[componentType][key] = value;
                mergedComponents++;
              }
            });
          }
        });
      }

      // Handle info object (use first document's info as base)
      if (docIndex === 0 && spec.info) {
        mergedSpec.info = { ...mergedSpec.info, ...spec.info, title: resultName };
      }
    });

    return {
      mergedSchema: mergedSpec,
      conflicts,
      isCompatible: true,
      warnings,
      summary: {
        addedProperties,
        mergedComponents,
        totalConflicts: conflicts.length,
        resolvedConflicts: 0,
        unresolvedConflicts: conflicts.length
      },
      mergeSteps: [] // Legacy merge method doesn't track steps
    };
  }

  /**
   * Check if JSON Schema documents are structurally compatible
   */
  private static checkJsonSchemaCompatibility(documents: Document[]): boolean {
    return documents.every(doc => {
      const schema = doc.content;
      return schema && (
        typeof schema === 'object' &&
        (schema.type === 'object' || schema.properties || schema.definitions)
      );
    });
  }

  /**
   * Check if OpenAPI documents are structurally compatible
   */
  private static checkOpenApiCompatibility(documents: Document[]): boolean {
    return documents.every(doc => {
      const spec = doc.content;
      return spec && (
        typeof spec === 'object' &&
        (spec.openapi || spec.swagger) &&
        (spec.info || spec.paths)
      );
    });
  }
}