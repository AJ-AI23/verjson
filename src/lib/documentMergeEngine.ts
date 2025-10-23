import { Document } from '@/types/workspace';
import { compareDocumentVersions, applyImportPatches } from '@/lib/importVersionUtils';

// ============================================================================
// GRANULAR CONFLICT TYPES (17 types instead of 4)
// ============================================================================

export type ConflictType =
  // Property Structure Conflicts
  | 'property_removed_required'
  | 'property_removed_optional'
  | 'property_added_new'
  | 'property_added_duplicate'
  | 'property_renamed'
  | 'property_moved'
  
  // Type Conflicts
  | 'type_primitive_changed'
  | 'type_expanded'
  | 'type_collapsed'
  | 'type_array_to_object'
  | 'type_object_to_array'
  | 'type_nullable_changed'
  
  // Value Conflicts - Arrays
  | 'array_items_added'
  | 'array_items_removed'
  | 'array_items_reordered'
  | 'array_items_modified'
  | 'array_length_mismatch'
  | 'array_type_conflict'
  
  // Value Conflicts - Objects
  | 'object_property_added'
  | 'object_property_removed'
  | 'object_property_value_changed'
  | 'object_structure_diverged'
  | 'object_nested_conflict'
  
  // Value Conflicts - Primitives
  | 'primitive_string_conflict'
  | 'primitive_number_conflict'
  | 'primitive_boolean_conflict'
  | 'primitive_null_vs_value'
  
  // Schema-Specific Conflicts (OpenAPI/JSON Schema)
  | 'enum_values_added'
  | 'enum_values_removed'
  | 'required_array_modified'
  | 'constraint_tightened'
  | 'constraint_loosened'
  | 'format_changed'
  | 'pattern_changed'
  | 'reference_broken'
  | 'reference_added'
  | 'schema_composition_conflict'
  
  // Semantic/Content Conflicts
  | 'description_conflict'
  | 'example_conflict'
  | 'default_value_conflict'
  | 'deprecated_status_conflict'
  
  // Legacy types for backward compatibility
  | 'property_removed'
  | 'property_added'
  | 'type_changed'
  | 'type_format_changed'
  | 'array_length_changed'
  | 'array_order_changed'
  | 'object_properties_added'
  | 'object_properties_removed'
  | 'object_structure_changed'
  | 'value_changed_primitive'
  | 'enum_values_changed'
  | 'constraint_changed'
  | 'description_changed'
  | 'type_mismatch'
  | 'duplicate_key'
  | 'incompatible_schema'
  | 'structure_conflict';

// ============================================================================
// RESOLUTION PARAMETERS
// ============================================================================

export interface ResolutionParameters {
  // Array handling
  arrayOrderPreference?: 'maintain_current' | 'use_incoming' | 'sort_alphabetical' | 'sort_numeric';
  arrayDuplicateHandling?: 'keep_all' | 'keep_first' | 'keep_last' | 'remove_duplicates';
  arrayMergeStrategy?: 'append' | 'prepend' | 'interleave';
  
  // Null/Undefined handling
  nullTreatment?: 'as_empty' | 'as_removal' | 'as_explicit_value';
  undefinedTreatment?: 'as_missing' | 'as_null' | 'as_explicit_value';
  
  // String merging
  stringMergeStrategy?: 'concatenate' | 'choose_longer' | 'choose_shorter' | 'manual';
  stringConcatenationSeparator?: string;
  
  // Object merging
  objectMergeDepth?: number;
  objectPropertyConflict?: 'prefer_current' | 'prefer_incoming' | 'merge_recursive' | 'manual';
  
  // Type conflicts
  typeCoercion?: 'strict' | 'attempt_coercion' | 'prefer_more_specific';
  
  // Enum handling
  enumStrategy?: 'union' | 'intersection' | 'prefer_current' | 'prefer_incoming';
  
  // Description merging
  descriptionStrategy?: 'prefer_current' | 'prefer_incoming' | 'concatenate' | 'prefer_longer';
  
  // Constraint conflicts
  constraintStrategy?: 'most_restrictive' | 'least_restrictive' | 'prefer_current' | 'prefer_incoming';
}

export const DEFAULT_RESOLUTION_PARAMETERS: ResolutionParameters = {
  arrayOrderPreference: 'maintain_current',
  arrayDuplicateHandling: 'remove_duplicates',
  arrayMergeStrategy: 'append',
  nullTreatment: 'as_removal',
  undefinedTreatment: 'as_missing',
  stringMergeStrategy: 'choose_longer',
  stringConcatenationSeparator: ' | ',
  objectMergeDepth: -1,
  objectPropertyConflict: 'merge_recursive',
  typeCoercion: 'strict',
  enumStrategy: 'union',
  descriptionStrategy: 'prefer_longer',
  constraintStrategy: 'most_restrictive'
};

// ============================================================================
// INTERFACES
// ============================================================================

export interface MergeConflict {
  path: string;
  type: ConflictType;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  description: string;
  documentSource: string;
  documentDestination: string;
  values: any[];
  suggestedResolution?: string;
  resolution?: 'current' | 'incoming' | 'combine' | 'interpolate' | 'extrapolate' | 'custom' | 'unresolved';
  customValue?: any;
  currentValue?: any;
  incomingValue?: any;
  linkedConflictPaths?: string[];
  stepNumber?: number;
  
  // NEW: Manual review and auto-resolution fields
  requiresManualReview?: boolean;
  autoResolvable?: boolean;
  resolutionParameters?: ResolutionParameters;
  resolutionRationale?: string;
}

export interface MergeStep {
  stepNumber: number;
  documentName: string;
  documentId?: string;
  fromDocument?: string;
  toDocument?: string;
  patches?: any[];
  conflicts: number;
  mode?: 'manual' | 'additive' | 'subtractive' | 'interpolate' | 'extrapolate';
  resolutionParameters?: ResolutionParameters;
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
  mergeSteps: MergeStep[];
}

export interface DocumentCompatibilityCheck {
  isCompatible: boolean;
  reason?: string;
  fileTypeMatch: boolean;
  structuralCompatibility: boolean;
}

// ============================================================================
// DOCUMENT MERGE ENGINE
// ============================================================================

export class DocumentMergeEngine {
  private static equalityCache = new WeakMap<any, Map<any, boolean>>();

  static checkCompatibility(documents: Document[]): DocumentCompatibilityCheck {
    if (documents.length < 2) {
      return {
        isCompatible: false,
        reason: 'At least 2 documents required for merging',
        fileTypeMatch: false,
        structuralCompatibility: false
      };
    }

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

    const structuralCompatibility = firstFileType === 'json-schema' 
      ? this.checkJsonSchemaCompatibility(documents)
      : this.checkOpenApiCompatibility(documents);

    return {
      isCompatible: fileTypeMatch && structuralCompatibility,
      fileTypeMatch,
      structuralCompatibility
    };
  }

  static mergeDocuments(documents: Document[], resultName: string): DocumentMergeResult {
    const compatibility = this.checkCompatibility(documents);
    
    if (!compatibility.isCompatible) {
      return {
        mergedSchema: {},
        conflicts: [{
          path: '/',
          type: 'incompatible_schema',
          severity: 'critical',
          description: compatibility.reason || 'Documents are not compatible for merging',
          documentSource: documents[0]?.name || 'Unknown',
          documentDestination: documents[documents.length - 1]?.name || 'Unknown',
          values: [],
          requiresManualReview: true,
          autoResolvable: false
        }],
        isCompatible: false,
        warnings: [compatibility.reason || 'Incompatible documents'],
        summary: { addedProperties: 0, mergedComponents: 0, totalConflicts: 1, resolvedConflicts: 0, unresolvedConflicts: 1 },
        mergeSteps: []
      };
    }

    return this.mergeDocumentsSequentially(documents, resultName);
  }

  private static mergeDocumentsSequentially(documents: Document[], resultName: string): DocumentMergeResult {
    console.log('🔄 Starting sequential merge of', documents.length, 'documents');
    
    const allConflicts: MergeConflict[] = [];
    const mergeSteps: MergeStep[] = [];
    let currentResult = documents[0].content;
    let totalAddedProperties = 0;
    let totalMergedComponents = 0;

    for (let i = 1; i < documents.length; i++) {
      const currentDoc = documents[i];
      console.log(`🔄 Step ${i}: Merging ${currentDoc.name} into accumulated result`);

      try {
        const comparison = compareDocumentVersions(currentResult, currentDoc.content);
        console.log(`📊 Step ${i} comparison:`, comparison);

        const stepResult = applyImportPatches(currentResult, comparison.patches, undefined, currentDoc.content);
        
        const stepConflicts = comparison.mergeConflicts.map(conflict => ({
          path: conflict.path,
          type: this.mapConflictType(conflict.conflictType),
          severity: conflict.severity as MergeConflict['severity'],
          description: `Step ${i} (${currentDoc.name}): ${conflict.description}`,
          documentSource: i === 1 ? documents[0].name : 'Previous merge result',
          documentDestination: currentDoc.name,
          values: [conflict.currentValue, conflict.importValue],
          suggestedResolution: 'Manual review required',
          resolution: 'unresolved' as const,
          currentValue: conflict.currentValue,
          incomingValue: conflict.importValue,
          stepNumber: i,
          autoResolvable: false,
          requiresManualReview: true
        }));

        const enhancedConflicts = this.enhanceArrayConflicts(stepConflicts, currentResult, currentDoc.content, false);
        const enhancedConflictsWithStep = enhancedConflicts.map(c => ({ ...c, stepNumber: i }));
        
        allConflicts.push(...enhancedConflictsWithStep);
        
        mergeSteps.push({
          stepNumber: i,
          documentName: currentDoc.name,
          documentId: currentDoc.id,
          fromDocument: currentDoc.name,
          toDocument: i === 1 ? documents[0].name : 'Accumulated Result',
          patches: comparison.patches,
          conflicts: enhancedConflicts.length
        });

        currentResult = stepResult;
        
        const addedInStep = comparison.patches.filter(p => p.op === 'add').length;
        totalAddedProperties += addedInStep;

        console.log(`✅ Step ${i} completed. Added ${addedInStep} properties, ${enhancedConflicts.length} conflicts`);

      } catch (error: any) {
        console.error(`❌ Error in merge step ${i}:`, error);
        allConflicts.push({
          path: '/',
          type: 'incompatible_schema',
          severity: 'critical',
          description: `Failed to merge ${currentDoc.name}: ${error.message}`,
          documentSource: documents[0].name,
          documentDestination: currentDoc.name,
          values: [],
          suggestedResolution: 'Review document structure and try again',
          requiresManualReview: true,
          autoResolvable: false
        });
      }
    }

    const finalResult = {
      ...currentResult,
      ...(currentResult.title ? {} : { title: resultName }),
      ...(currentResult.description ? {} : { 
        description: `Merged schema from: ${documents.map(d => d.name).join(', ')}` 
      })
    };

    if (finalResult.openapi || finalResult.swagger || finalResult.info) {
      finalResult.info = {
        title: resultName,
        version: '1.0.0',
        description: `Merged API specification from: ${documents.map(d => d.name).join(', ')}`,
        ...finalResult.info,
      };
    }

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

  // ============================================================================
  // HELPER METHODS (Path normalization, sorting, etc.)
  // ============================================================================

  private static normalizeArrayPath(path: string): string {
    return path.replace(/\.(\d+)(?=\.|$)/g, '[$1]');
  }

  private static sortConflictsByPathDepth(conflicts: MergeConflict[]): MergeConflict[] {
    return conflicts.sort((a, b) => {
      const pathA = a.path;
      const pathB = b.path;
      
      const segmentsA = pathA.split(/\.|\[/).map(s => s.replace(/\]$/, ''));
      const segmentsB = pathB.split(/\.|\[/).map(s => s.replace(/\]$/, ''));
      
      const minLength = Math.min(segmentsA.length, segmentsB.length);
      
      for (let i = 0; i < minLength; i++) {
        const segA = segmentsA[i];
        const segB = segmentsB[i];
        
        if (segA !== segB) {
          const numA = parseInt(segA);
          const numB = parseInt(segB);
          
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          
          return segA.localeCompare(segB);
        }
      }
      
      return segmentsA.length - segmentsB.length;
    });
  }

  private static enhanceArrayConflicts(
    baseConflicts: MergeConflict[], 
    currentSchema: any, 
    incomingSchema: any,
    shouldSort: boolean = true
  ): MergeConflict[] {
    const normalizedConflicts = baseConflicts.map(conflict => ({
      ...conflict,
      path: this.normalizeArrayPath(conflict.path)
    }));

    const uniqueConflicts = normalizedConflicts.reduce((acc, conflict) => {
      const existing = acc.find(c => c.path === conflict.path);
      if (!existing) {
        acc.push(conflict);
      }
      return acc;
    }, [] as MergeConflict[]);

    const enhancedConflicts = [...uniqueConflicts];
    const processedArrayItems = new Set<string>();

    const arrayPathsWithConflicts = new Set<string>();
    uniqueConflicts.forEach(conflict => {
      const itemMatch = conflict.path.match(/^(root\.[^[]*(?:\.[^[]*)*\[\d+\])/);
      if (itemMatch) {
        arrayPathsWithConflicts.add(itemMatch[1]);
      }
    });

    arrayPathsWithConflicts.forEach(itemPath => {
      if (processedArrayItems.has(itemPath)) return;
      processedArrayItems.add(itemPath);

      const hasItemConflict = enhancedConflicts.some(c => c.path === itemPath);
      if (hasItemConflict) return;

      const match = itemPath.match(/^(root\.[^[]*(?:\.[^[]*)*)\[(\d+)\]/);
      if (!match) return;
      
      const arrayPath = match[1];
      const itemIndex = parseInt(match[2]);

      const currentArray = this.getValueAtPath(currentSchema, arrayPath);
      const incomingArray = this.getValueAtPath(incomingSchema, arrayPath);

      if (Array.isArray(currentArray) && Array.isArray(incomingArray)) {
        const currentItem = currentArray[itemIndex];
        const incomingItem = incomingArray[itemIndex];

        if (JSON.stringify(currentItem) !== JSON.stringify(incomingItem)) {
          enhancedConflicts.push({
            path: itemPath,
            type: 'array_items_modified',
            severity: 'medium',
            description: `Array item at index ${itemIndex} differs between documents`,
            documentSource: 'current',
            documentDestination: 'incoming',
            values: [currentItem, incomingItem],
            suggestedResolution: 'Choose combine to merge array items intelligently',
            resolution: 'unresolved',
            currentValue: currentItem,
            incomingValue: incomingItem,
            stepNumber: undefined,
            autoResolvable: true,
            requiresManualReview: false
          });
        }
      }
    });

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
        const maxLength = Math.max(currentArray.length, incomingArray.length);
        
        for (let i = 0; i < maxLength; i++) {
          const itemPath = `${arrayPath}[${i}]`;
          if (processedArrayItems.has(itemPath)) continue;
          
          const currentItem = currentArray[i];
          const incomingItem = incomingArray[i];
          
          if (currentItem === undefined && incomingItem === undefined) continue;
          
          if (JSON.stringify(currentItem) !== JSON.stringify(incomingItem)) {
            processedArrayItems.add(itemPath);
            
            const hasConflict = enhancedConflicts.some(c => c.path === itemPath);
            if (!hasConflict) {
              enhancedConflicts.push({
                path: itemPath,
                type: currentItem === undefined ? 'array_items_added' : 
                      incomingItem === undefined ? 'array_items_removed' : 'array_items_modified',
                severity: 'medium',
                description: currentItem === undefined 
                  ? `New array item at index ${i} from incoming document`
                  : incomingItem === undefined
                  ? `Array item at index ${i} only exists in current document`
                  : `Array item at index ${i} differs between documents`,
                documentSource: 'current',
                documentDestination: 'incoming',
                values: [currentItem, incomingItem],
                suggestedResolution: 'Choose combine to merge array items intelligently',
                resolution: 'unresolved',
                currentValue: currentItem,
                incomingValue: incomingItem,
                stepNumber: undefined,
                autoResolvable: currentItem !== undefined && incomingItem !== undefined,
                requiresManualReview: currentItem === undefined || incomingItem === undefined
              });
            }
          }
        }
      }
    });

    enhancedConflicts.forEach(conflict => {
      const itemMatch = conflict.path.match(/^(root\.[^[]*(?:\.[^[]*)*\[\d+\])$/);
      if (itemMatch) {
        const itemPath = itemMatch[1];
        
        const childConflictPaths: string[] = [];
        enhancedConflicts.forEach(c => {
          const isChild = c.path.startsWith(itemPath + '.');
          
          if (isChild && c.documentSource === conflict.documentSource) {
            childConflictPaths.push(c.path);
          }
        });
        
        if (childConflictPaths.length > 0) {
          conflict.linkedConflictPaths = childConflictPaths;
        }
      }
    });

    return shouldSort ? this.sortConflictsByPathDepth(enhancedConflicts) : enhancedConflicts;
  }

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

  // ============================================================================
  // REGENERATION LOGIC (regenerateFromStep)
  // ============================================================================

  static regenerateFromStep(
    documents: Document[],
    resultName: string,
    currentMergeResult: DocumentMergeResult,
    changedStepNumber: number
  ): DocumentMergeResult {
    console.log(`🔄 Regenerating merge from step ${changedStepNumber} onwards`);
    
    const unchangedConflicts = currentMergeResult.conflicts.filter(
      c => c.stepNumber !== undefined && c.stepNumber < changedStepNumber
    );
    
    const savedResolutions = new Map<string, MergeConflict['resolution']>();
    currentMergeResult.conflicts.forEach(conflict => {
      if (conflict.stepNumber !== undefined && conflict.stepNumber >= changedStepNumber) {
        const key = `${conflict.stepNumber}|${conflict.path}|${conflict.type}|${conflict.description}`;
        if (conflict.resolution && conflict.resolution !== 'unresolved') {
          savedResolutions.set(key, conflict.resolution);
        }
      }
    });
    
    let baseState = documents[0].content;
    
    for (let step = 1; step < changedStepNumber; step++) {
      const stepConflicts = currentMergeResult.conflicts.filter(c => c.stepNumber === step);
      if (stepConflicts.length > 0) {
        baseState = this.applyConflictResolutions(baseState, stepConflicts);
      } else {
        if (documents[step]) {
          const comparison = compareDocumentVersions(baseState, documents[step].content);
          baseState = applyImportPatches(baseState, comparison.patches, undefined, documents[step].content);
        }
      }
    }
    
    const newConflicts = [...unchangedConflicts];
    let currentResult = baseState;
    
    for (let i = changedStepNumber; i < documents.length; i++) {
      const currentDoc = documents[i];
      console.log(`🔄 Regenerating step ${i}: Merging ${currentDoc.name}`);
      
      try {
        if (i === changedStepNumber) {
          const changedStepConflicts = currentMergeResult.conflicts.filter(c => c.stepNumber === changedStepNumber);
          if (changedStepConflicts.length > 0) {
            console.log(`📝 Applying ${changedStepConflicts.length} resolutions from changed step ${changedStepNumber}`);
            currentResult = this.applyConflictResolutions(currentResult, changedStepConflicts);
          }
        }
        
        const comparison = compareDocumentVersions(currentResult, currentDoc.content);
        
        const stepConflicts = comparison.mergeConflicts.map(conflict => {
          const key = `${i}|${conflict.path}|${this.mapConflictType(conflict.conflictType)}|Step ${i} (${currentDoc.name}): ${conflict.description}`;
          const savedResolution = savedResolutions.get(key);
          
          return {
            path: conflict.path,
            type: this.mapConflictType(conflict.conflictType),
            severity: conflict.severity as MergeConflict['severity'],
            description: `Step ${i} (${currentDoc.name}): ${conflict.description}`,
            documentSource: i === 1 ? documents[0].name : 'Previous merge result',
            documentDestination: currentDoc.name,
            values: [conflict.currentValue, conflict.importValue],
            suggestedResolution: 'Manual review required',
            resolution: savedResolution || ('unresolved' as const),
            currentValue: conflict.currentValue,
            incomingValue: conflict.importValue,
            stepNumber: i,
            autoResolvable: false,
            requiresManualReview: true
          };
        });
        
        const enhancedConflicts = this.enhanceArrayConflicts(stepConflicts, currentResult, currentDoc.content, false);
        const enhancedConflictsWithStep = enhancedConflicts.map(c => {
          const key = `${i}|${c.path}|${c.type}|${c.description}`;
          const savedResolution = savedResolutions.get(key);
          
          if (savedResolution && c.resolution === 'unresolved') {
            return { ...c, resolution: savedResolution, stepNumber: i };
          }
          
          return { ...c, stepNumber: i };
        });
        
        newConflicts.push(...enhancedConflictsWithStep);
        
        currentResult = this.applyConflictResolutions(currentResult, enhancedConflictsWithStep);
      } catch (error) {
        console.error(`❌ Error regenerating step ${i}:`, error);
      }
    }
    
    const sortedConflicts = this.sortConflictsByPathDepth(newConflicts);
    
    let finalMergedSchema = baseState;
    
    for (let step = changedStepNumber; step < documents.length; step++) {
      const stepConflicts = sortedConflicts.filter(c => c.stepNumber === step);
      if (stepConflicts.length > 0) {
        finalMergedSchema = this.applyConflictResolutions(finalMergedSchema, stepConflicts);
      } else {
        const comparison = compareDocumentVersions(finalMergedSchema, documents[step].content);
        finalMergedSchema = applyImportPatches(finalMergedSchema, comparison.patches, undefined, documents[step].content);
      }
    }
    
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

  // ============================================================================
  // APPLY CONFLICT RESOLUTIONS (Updated for combine/interpolate/extrapolate)
  // ============================================================================

  static applyConflictResolutions(baseSchema: any, conflicts: MergeConflict[], pathOrder?: string[]): any {
    let result = JSON.parse(JSON.stringify(baseSchema));
    
    const conflictsByPath = conflicts.reduce((acc, conflict) => {
      if (!acc[conflict.path]) {
        acc[conflict.path] = [];
      }
      acc[conflict.path].push(conflict);
      return acc;
    }, {} as Record<string, MergeConflict[]>);
    
    const pathsToProcess = pathOrder || Object.keys(conflictsByPath);
    
    this.applyCascadingResolution(conflicts);
    
    const arrayItemConflicts = conflicts.filter(c => 
      c.path.includes('[') && c.path.includes(']') && (c.resolution === 'combine' || c.resolution === 'incoming' || c.resolution === 'current')
    );
    
    const arrayGroups = new Map<string, MergeConflict[]>();
    arrayItemConflicts.forEach(conflict => {
      const arrayPath = conflict.path.substring(0, conflict.path.indexOf('['));
      if (!arrayGroups.has(arrayPath)) {
        arrayGroups.set(arrayPath, []);
      }
      arrayGroups.get(arrayPath)!.push(conflict);
    });
    
    const autoResolvedPaths = new Set<string>();
    arrayItemConflicts.forEach(conflict => {
      if (conflict.linkedConflictPaths) {
        conflict.linkedConflictPaths.forEach(linkedPath => {
          autoResolvedPaths.add(linkedPath);
        });
      }
    });
    
    arrayGroups.forEach((itemConflicts, arrayPath) => {
      const allItems: any[] = [];
      const seenItems = new Set<string>();
      
      itemConflicts.forEach(conflict => {
        if (conflict.resolution === 'combine') {
          if (conflict.currentValue !== undefined && conflict.currentValue !== null) {
            const itemKey = JSON.stringify(conflict.currentValue);
            if (!seenItems.has(itemKey)) {
              seenItems.add(itemKey);
              allItems.push(conflict.currentValue);
            }
          }
          
          if (conflict.incomingValue !== undefined && conflict.incomingValue !== null) {
            const itemKey = JSON.stringify(conflict.incomingValue);
            if (!seenItems.has(itemKey)) {
              seenItems.add(itemKey);
              allItems.push(conflict.incomingValue);
            }
          }
        } else if (conflict.resolution === 'current') {
          if (conflict.currentValue !== undefined && conflict.currentValue !== null) {
            const itemKey = JSON.stringify(conflict.currentValue);
            if (!seenItems.has(itemKey)) {
              seenItems.add(itemKey);
              allItems.push(conflict.currentValue);
            }
          }
        } else if (conflict.resolution === 'incoming') {
          if (conflict.incomingValue !== undefined && conflict.incomingValue !== null) {
            const itemKey = JSON.stringify(conflict.incomingValue);
            if (!seenItems.has(itemKey)) {
              seenItems.add(itemKey);
              allItems.push(conflict.incomingValue);
            }
          }
        }
      });
      
      this.setValueAtPath(result, arrayPath, allItems);
    });
    
    pathsToProcess.forEach(path => {
      const isArrayItemPath = path.includes('[') && path.includes(']');
      const arrayPath = isArrayItemPath ? path.substring(0, path.indexOf('[')) : null;
      if (isArrayItemPath && arrayGroups.has(arrayPath!)) {
        return;
      }
      
      if (autoResolvedPaths.has(path)) {
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
            case 'combine':
              valueToApply = this.combineValues(conflict.currentValue, conflict.incomingValue, DEFAULT_RESOLUTION_PARAMETERS);
              break;
            case 'interpolate':
              valueToApply = this.interpolateValues(conflict.currentValue, conflict.incomingValue);
              break;
            case 'extrapolate':
              valueToApply = this.extrapolateValues(conflict.currentValue, conflict.incomingValue);
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

  private static applyCascadingResolution(conflicts: MergeConflict[]): void {
    conflicts.forEach(conflict => {
      if ((conflict.resolution === 'combine' || conflict.resolution === 'incoming' || conflict.resolution === 'current') && 
          conflict.linkedConflictPaths && conflict.linkedConflictPaths.length > 0) {
        conflict.linkedConflictPaths.forEach(linkedPath => {
          const linkedConflict = conflicts.find(c => c.path === linkedPath);
          if (linkedConflict && (linkedConflict.resolution === 'unresolved' || linkedConflict.resolution === 'combine')) {
            linkedConflict.resolution = conflict.resolution;
          }
        });
      }
    });
  }

  // ============================================================================
  // VALUE COMBINATION HELPERS
  // ============================================================================

  private static combineValues(currentValue: any, incomingValue: any, parameters: ResolutionParameters): any {
    if ((currentValue === null || currentValue === undefined) && 
        (incomingValue !== null && incomingValue !== undefined)) {
      return incomingValue;
    }
    if ((incomingValue === null || incomingValue === undefined) && 
        (currentValue !== null && currentValue !== undefined)) {
      return currentValue;
    }

    if (Array.isArray(currentValue) && Array.isArray(incomingValue)) {
      return this.combineArrays(currentValue, incomingValue, parameters);
    }

    if (typeof currentValue === 'object' && typeof incomingValue === 'object') {
      return this.combineObjects(currentValue, incomingValue, parameters);
    }

    return incomingValue;
  }

  private static combineArrays(currentArray: any[], incomingArray: any[], parameters: ResolutionParameters): any[] {
    const result = [...currentArray];
    
    incomingArray.forEach(incomingItem => {
      const exists = currentArray.some(currentItem => 
        this.areArrayItemsEqual(currentItem, incomingItem)
      );
      
      if (!exists) {
        result.push(incomingItem);
      }
    });
    
    return result;
  }

  private static combineObjects(currentObj: any, incomingObj: any, parameters: ResolutionParameters, depth: number = 0): any {
    if (parameters.objectMergeDepth !== -1 && depth >= parameters.objectMergeDepth!) {
      return parameters.objectPropertyConflict === 'prefer_current' ? currentObj : incomingObj;
    }
    
    const result = { ...currentObj };
    
    Object.keys(incomingObj).forEach(key => {
      if (!(key in currentObj)) {
        result[key] = incomingObj[key];
      } else if (typeof currentObj[key] === 'object' && typeof incomingObj[key] === 'object' &&
                 !Array.isArray(currentObj[key]) && !Array.isArray(incomingObj[key])) {
        if (parameters.objectPropertyConflict === 'merge_recursive') {
          result[key] = this.combineObjects(currentObj[key], incomingObj[key], parameters, depth + 1);
        } else if (parameters.objectPropertyConflict === 'prefer_incoming') {
          result[key] = incomingObj[key];
        }
      } else {
        if (parameters.objectPropertyConflict === 'prefer_incoming') {
          result[key] = incomingObj[key];
        }
      }
    });
    
    return result;
  }

  private static interpolateValues(currentValue: any, incomingValue: any): any {
    if (Array.isArray(currentValue) && Array.isArray(incomingValue)) {
      return currentValue.filter(currItem =>
        incomingValue.some(incItem => this.areArrayItemsEqual(currItem, incItem))
      );
    }

    if (typeof currentValue === 'object' && typeof incomingValue === 'object') {
      const result: any = {};
      Object.keys(currentValue).forEach(key => {
        if (key in incomingValue && JSON.stringify(currentValue[key]) === JSON.stringify(incomingValue[key])) {
          result[key] = currentValue[key];
        }
      });
      return result;
    }

    return currentValue;
  }

  private static extrapolateValues(currentValue: any, incomingValue: any): any {
    if (Array.isArray(currentValue) && Array.isArray(incomingValue)) {
      const currentUnique = currentValue.filter(currItem =>
        !incomingValue.some(incItem => this.areArrayItemsEqual(currItem, incItem))
      );
      
      const incomingUnique = incomingValue.filter(incItem =>
        !currentValue.some(currItem => this.areArrayItemsEqual(currItem, incItem))
      );
      
      return [...currentUnique, ...incomingUnique];
    }

    if (typeof currentValue === 'object' && typeof incomingValue === 'object') {
      const result: any = {};
      
      Object.keys(currentValue).forEach(key => {
        if (!(key in incomingValue)) {
          result[key] = currentValue[key];
        } else if (JSON.stringify(currentValue[key]) !== JSON.stringify(incomingValue[key])) {
          result[key] = currentValue[key];
        }
      });
      
      Object.keys(incomingValue).forEach(key => {
        if (!(key in currentValue)) {
          result[key] = incomingValue[key];
        }
      });
      
      return result;
    }

    return incomingValue;
  }

  private static areArrayItemsEqual(item1: any, item2: any): boolean {
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

  // ============================================================================
  // SET VALUE AT PATH
  // ============================================================================

  private static setValueAtPath(obj: any, path: string, value: any): void {
    if (path.startsWith('/')) {
      const jsonPath = path.substring(1);
      
      if (jsonPath === '') {
        Object.assign(obj, value);
        return;
      }
      
      if (!jsonPath.includes('/')) {
        obj[jsonPath] = value;
        return;
      }
      
      const pathParts = jsonPath.split('/');
      let current = obj;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
      
      const finalPart = pathParts[pathParts.length - 1];
      current[finalPart] = value;
      return;
    }

    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    const pathParts = normalizedPath.split('.').filter(part => part !== '' && part !== 'root');
    
    if (pathParts.length === 0) return;
    
    let current = obj;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      const nextPart = pathParts[i + 1];
      
      const isNextArray = /^\d+$/.test(nextPart);
      
      if (!current[part]) {
        current[part] = isNextArray ? [] : {};
      }
      
      current = current[part];
    }
    
    const finalPart = pathParts[pathParts.length - 1];
    
    if (/^\d+$/.test(finalPart)) {
      const index = parseInt(finalPart);
      if (Array.isArray(current)) {
        current[index] = value;
      }
    } else {
      current[finalPart] = value;
    }
  }

  // ============================================================================
  // CONFLICT TYPE MAPPING
  // ============================================================================

  private static mapConflictType(importConflictType: string): ConflictType {
    switch (importConflictType) {
      case 'property_removed':
        return 'property_removed';
      case 'property_added':
        return 'property_added';
      case 'value_changed':
        return 'duplicate_key';
      case 'type_changed':
        return 'type_mismatch';
      default:
        return 'structure_conflict';
    }
  }

  // ============================================================================
  // COMPATIBILITY CHECKS
  // ============================================================================

  private static checkJsonSchemaCompatibility(documents: Document[]): boolean {
    return documents.every(doc => {
      const schema = doc.content;
      return schema && (
        typeof schema === 'object' &&
        (schema.type === 'object' || schema.properties || schema.definitions)
      );
    });
  }

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
