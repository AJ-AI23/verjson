import { Document } from '@/types/workspace';
import { compareDocumentVersions, applyImportPatches } from '@/lib/importVersionUtils';

// ============================================================================
// GRANULAR CONFLICT TYPES (17 types instead of 4)
// ============================================================================

export type ConflictType =
  // Schema/Meta Conflicts
  | '$schema_version_mismatch'
  | 'id_base_uri_changed'
  | 'ref_target_changed'
  | 'ref_cycle_detected'
  | 'defs_renamed_moved'
  
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
  
  // Array Conflicts
  | 'array_items_added'
  | 'array_items_removed'
  | 'array_items_reordered'
  | 'array_items_modified'
  | 'array_length_mismatch'
  | 'array_type_conflict'
  | 'tuple_items_changed'
  | 'items_schema_changed'
  | 'uniqueItems_changed'
  | 'contains_changed'
  | 'minItems_changed'
  | 'maxItems_changed'
  
  // Object Conflicts
  | 'object_property_added'
  | 'object_property_removed'
  | 'object_property_value_changed'
  | 'object_structure_diverged'
  | 'object_nested_conflict'
  | 'additionalProperties_changed'
  | 'unevaluatedProperties_changed'
  | 'patternProperties_changed'
  | 'propertyNames_changed'
  | 'dependentRequired_changed'
  | 'dependentSchemas_changed'
  | 'additionalProperties_boolean_flip'
  
  // Primitive Conflicts
  | 'primitive_string_conflict'
  | 'primitive_number_conflict'
  | 'primitive_boolean_conflict'
  | 'primitive_null_vs_value'
  | 'const_changed'
  
  // Composition/Conditional
  | 'allOf_changed'
  | 'anyOf_changed'
  | 'oneOf_changed'
  | 'not_changed'
  | 'schema_composition_incompatible'
  | 'conditional_structure_changed'
  | 'conditional_invalidated'
  
  // Enum/Required Conflicts
  | 'enum_values_added'
  | 'enum_values_removed'
  | 'enum_to_const'
  | 'const_to_enum'
  | 'enum_order_changed'
  | 'required_entry_removed'
  | 'required_entry_added'
  
  // Constraint Conflicts
  | 'constraint_tightened'
  | 'constraint_loosened'
  | 'multipleOf_changed'
  | 'min_changed'
  | 'max_changed'
  | 'exclusiveMin_changed'
  | 'exclusiveMax_changed'
  | 'minLength_changed'
  | 'maxLength_changed'
  | 'minProperties_changed'
  | 'maxProperties_changed'
  | 'minContains_changed'
  | 'maxContains_changed'
  | 'format_added'
  | 'format_removed'
  | 'pattern_added'
  | 'pattern_removed'
  
  // Reference Conflicts
  | 'reference_broken'
  | 'reference_added'
  
  // Semantic/Metadata Conflicts
  | 'title_conflict'
  | 'description_conflict'
  | 'example_conflict'
  | 'default_value_conflict'
  | 'deprecated_status_conflict'
  | 'readOnly_writeOnly_changed'
  | 'contentMediaType_changed'
  | 'contentEncoding_changed'
  | 'contentSchema_changed'
  
  // Legacy types (backward compatibility)
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
  | 'structure_conflict'
  | 'required_array_modified'
  | 'format_changed'
  | 'pattern_changed'
  | 'schema_composition_conflict';

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

export interface ConflictResolutionPreferences {
  // Array preferences
  arrayOrderPreference?: 'preserve-current' | 'preserve-incoming' | 'sort-alpha' | 'sort-reverse';
  arrayDuplicateHandling?: 'keep-first' | 'keep-last' | 'keep-all' | 'remove-all';
  arrayMergeStrategy?: 'union' | 'intersection' | 'difference-current' | 'difference-incoming';
  tuplePolicy?: 'align-by-index' | 'align-by-similarity' | 'pad-shorter';
  uniqueItemsPolicy?: 'prefer-true' | 'prefer-false' | 'prefer-current' | 'prefer-incoming';
  
  // String preferences
  stringMergeStrategy?: 'concatenate' | 'prefer-longer' | 'prefer-shorter' | 'prefer-current' | 'prefer-incoming';
  stringConcatenationSeparator?: string;
  stringNormalization?: 'none' | 'trim' | 'collapse-whitespace' | 'lowercase' | 'uppercase' | 'nfc';
  
  // Object preferences
  objectPropertyConflict?: 'merge-recursive' | 'prefer-current' | 'prefer-incoming';
  objectMergeDepth?: number;
  additionalPropsStrategy?: 'strictest' | 'loosest' | 'prefer-current' | 'prefer-incoming';
  keyNormalization?: 'case-sensitive' | 'case-insensitive' | 'unicode-nfc';
  propertyRenamePolicy?: 'reject' | 'auto-suffix' | 'namespace-with-prefix';
  dependentRequiredStrategy?: 'union' | 'intersection' | 'strict-current' | 'strict-incoming';
  
  // Schema-specific preferences
  enumStrategy?: 'union' | 'intersection' | 'strict-current' | 'strict-incoming';
  constraintStrategy?: 'strictest' | 'loosest' | 'current' | 'incoming';
  formatStrategy?: 'prefer-stricter' | 'prefer-laxer' | 'prefer-current' | 'prefer-incoming';
  descriptionStrategy?: 'concatenate' | 'prefer-current' | 'prefer-incoming' | 'prefer-longer';
  examplesStrategy?: 'union' | 'prefer-current' | 'prefer-incoming' | 'dedupe-by-hash';
  deprecationStrategy?: 'prefer-deprecated' | 'prefer-non-deprecated' | 'prefer-current' | 'prefer-incoming';
  
  // Numeric preferences
  numericStrategy?: 'average' | 'min' | 'max' | 'current' | 'incoming';
  numericPrecision?: number;
  numericTieBreak?: 'current' | 'incoming' | 'min' | 'max';
  
  // Boolean preferences
  booleanStrategy?: 'and' | 'or' | 'current' | 'incoming';
  
  // Schema/Reference preferences
  schemaVersionStrategy?: 'prefer-current' | 'prefer-incoming' | 'max-supported' | 'min-common';
  refNormalization?: 'preserve' | 'rebase' | 'dereference';
  refCycleStrategy?: 'reject' | 'inline-once' | 'break-with-anchor';
  defRenameStrategy?: 'track-by-hash' | 'track-by-similarity' | 'require-explicit-map';
  
  // Composition preferences
  compositionStrategy?: 'flatten' | 'preserve';
  disjunctionStrategy?: 'union' | 'prefer-current' | 'prefer-incoming' | 'minimize-alternatives';
  altDedupStrategy?: 'by-hash' | 'by-serialization';
  conditionalStrategy?: 'preserve-if' | 'preserve-then-else' | 're-evaluate';
  
  // Guards
  wideningGuard?: 'reject' | 'allow-with-warning';
  tighteningGuard?: 'allow' | 'require-review';
  unknownKeywordPolicy?: 'preserve' | 'drop' | 'fail';
}

export interface MergeConflict {
  path: string;
  type: ConflictType;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  description: string;
  documentSource: string;
  documentDestination: string;
  values: any[];
  suggestedResolution?: string;
  resolution?: 'current' | 'incoming' | 'combine' | 'interpolate' | 'extrapolate' | 'custom' | 'unresolved' | 'strictest';
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
  
  // NEW: Per-conflict preferences
  preferences?: ConflictResolutionPreferences;
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
// CONFLICT DETECTION CONTEXT FOR PHASED DETECTION
// ============================================================================

interface ConflictDetectionContext {
  currentSchema: any;
  incomingSchema: any;
  detectedConflicts: MergeConflict[];
  claimedPaths: Set<string>;
  claimedPathsByPhase: Map<string, number>;
  defsRenameMap: Map<string, string>; // oldName -> newName
  propertyRenameMap: Map<string, string>; // oldPath -> newPath
  referenceGraph: Map<string, string[]>; // ref -> [paths that use it]
  normalizedCurrent: any; // After OpenAPI nullable conversion
  normalizedIncoming: any; // After OpenAPI nullable conversion
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
        
        // Use phased conflict detection
        const stepConflicts = this.detectConflictsPhased(
          currentResult,
          currentDoc.content,
          i === 1 ? documents[0].name : 'Previous merge result',
          currentDoc.name,
          i
        );

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
        
        // Use phased conflict detection
        const stepConflicts = this.detectConflictsPhased(
          currentResult,
          currentDoc.content,
          i === 1 ? documents[0].name : 'Previous merge result',
          currentDoc.name,
          i
        ).map(conflict => {
          const key = `${i}|${conflict.path}|${conflict.type}|${conflict.description}`;
          const savedResolution = savedResolutions.get(key);
          
          if (savedResolution && conflict.resolution === 'unresolved') {
            return { ...conflict, resolution: savedResolution };
          }
          
          return conflict;
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
  // PHASED CONFLICT DETECTION (12 Phases)
  // ============================================================================

  // ============================================================================
  // PHASED CONFLICT DETECTION (12 Phases)
  // ============================================================================

  private static detectConflictsPhased(
    currentSchema: any,
    incomingSchema: any,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): MergeConflict[] {
    console.group(`🔍 PHASED CONFLICT DETECTION - Step ${stepNumber}`);
    
    const context: ConflictDetectionContext = {
      currentSchema,
      incomingSchema,
      detectedConflicts: [],
      claimedPaths: new Set(),
      claimedPathsByPhase: new Map(),
      defsRenameMap: new Map(),
      propertyRenameMap: new Map(),
      referenceGraph: new Map(),
      normalizedCurrent: currentSchema,
      normalizedIncoming: incomingSchema
    };

    // PHASE 1: Meta/Setup (Normalization)
    console.log('🔵 Phase 1: Meta/Setup');
    this.phaseMetaSetup(context, documentSource, documentDestination, stepNumber);

    // PHASE 2: Reference Resolution/Safety
    console.log('🔵 Phase 2: Reference Resolution/Safety');
    this.phaseReferenceResolution(context, documentSource, documentDestination, stepNumber);

    // PHASE 3: $defs Identity and Rename/Move Mapping
    console.log('🔵 Phase 3: $defs Identity');
    this.phaseDefsIdentity(context, documentSource, documentDestination, stepNumber);

    // PHASE 4: High-Level Composition
    console.log('🔵 Phase 4: High-Level Composition');
    this.phaseHighLevelComposition(context, documentSource, documentDestination, stepNumber);

    // PHASE 5: Object-Shape Governance
    console.log('🔵 Phase 5: Object-Shape Governance');
    this.phaseObjectShapeGovernance(context, documentSource, documentDestination, stepNumber);

    // PHASE 6: Property Set Topology
    console.log('🔵 Phase 6: Property Set Topology');
    this.phasePropertySetTopology(context, documentSource, documentDestination, stepNumber);

    // PHASE 7: Array Topology
    console.log('🔵 Phase 7: Array Topology');
    this.phaseArrayTopology(context, documentSource, documentDestination, stepNumber);

    // PHASE 8: Type System Deltas
    console.log('🔵 Phase 8: Type System Deltas');
    this.phaseTypeSystemDeltas(context, documentSource, documentDestination, stepNumber);

    // PHASE 9: Constraint Keywords
    console.log('🔵 Phase 9: Constraint Keywords');
    this.phaseConstraintKeywords(context, documentSource, documentDestination, stepNumber);

    // PHASE 10: Required and Cross-Field Relations
    console.log('🔵 Phase 10: Required Relations');
    this.phaseRequiredRelations(context, documentSource, documentDestination, stepNumber);

    // PHASE 11: Annotations and Content
    console.log('🔵 Phase 11: Annotations');
    this.phaseAnnotations(context, documentSource, documentDestination, stepNumber);

    // PHASE 12: Late Reference Re-validation
    console.log('🔵 Phase 12: Late Reference Re-validation');
    this.phaseLateReferenceValidation(context, documentSource, documentDestination, stepNumber);

    console.log(`✅ Total conflicts detected: ${context.detectedConflicts.length}`);
    console.groupEnd();
    
    return context.detectedConflicts;
  }

  // ============================================================================
  // PHASE 1: META/SETUP (NORMALIZATION)
  // ============================================================================

  private static phaseMetaSetup(
    context: ConflictDetectionContext,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): void {
    // Normalize OpenAPI nullable: true → type: ["string", "null"]
    context.normalizedCurrent = this.normalizeOpenApiNullable(context.currentSchema);
    context.normalizedIncoming = this.normalizeOpenApiNullable(context.incomingSchema);

    // Check $schema at root
    if (context.currentSchema.$schema && context.incomingSchema.$schema &&
        context.currentSchema.$schema !== context.incomingSchema.$schema) {
      const conflict = this.createConflict(
        '/$schema',
        '$schema_version_mismatch',
        'high',
        `$schema version differs: "${context.currentSchema.$schema}" vs "${context.incomingSchema.$schema}"`,
        context.currentSchema.$schema,
        context.incomingSchema.$schema,
        documentSource,
        documentDestination,
        stepNumber
      );
      context.detectedConflicts.push(conflict);
      this.claimPath(context, '/$schema', 1);
      console.log('  ✅ Detected: $schema_version_mismatch');
    }

    // Check $id/id at root
    const currentId = context.currentSchema.$id || context.currentSchema.id;
    const incomingId = context.incomingSchema.$id || context.incomingSchema.id;
    if (currentId && incomingId && currentId !== incomingId) {
      const idPath = context.currentSchema.$id ? '/$id' : '/id';
      const conflict = this.createConflict(
        idPath,
        'id_base_uri_changed',
        'high',
        `Base URI changed: "${currentId}" → "${incomingId}"`,
        currentId,
        incomingId,
        documentSource,
        documentDestination,
        stepNumber
      );
      context.detectedConflicts.push(conflict);
      this.claimPath(context, idPath, 1);
      console.log('  ✅ Detected: id_base_uri_changed');
    }
  }

  // ============================================================================
  // PHASE 2: REFERENCE RESOLUTION/SAFETY
  // ============================================================================

  private static phaseReferenceResolution(
    context: ConflictDetectionContext,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): void {
    // Build reference graphs
    const currentRefs = this.buildReferenceGraph(context.currentSchema);
    const incomingRefs = this.buildReferenceGraph(context.incomingSchema);

    // Detect cyclic references
    const currentCycles = this.detectCyclicReferences(context.currentSchema, currentRefs);
    const incomingCycles = this.detectCyclicReferences(context.incomingSchema, incomingRefs);

    currentCycles.forEach(cycle => {
      const conflict = this.createConflict(
        cycle.path,
        'ref_cycle_detected',
        'critical',
        `Cyclic reference detected in current schema: ${cycle.cycle.join(' → ')}`,
        cycle.ref,
        null,
        documentSource,
        documentDestination,
        stepNumber
      );
      context.detectedConflicts.push(conflict);
      this.claimPath(context, cycle.path, 2);
    });

    incomingCycles.forEach(cycle => {
      const conflict = this.createConflict(
        cycle.path,
        'ref_cycle_detected',
        'critical',
        `Cyclic reference detected in incoming schema: ${cycle.cycle.join(' → ')}`,
        null,
        cycle.ref,
        documentSource,
        documentDestination,
        stepNumber
      );
      context.detectedConflicts.push(conflict);
      this.claimPath(context, cycle.path, 2);
    });

    // Detect broken references
    incomingRefs.forEach((ref, path) => {
      if (!this.checkReferenceExists(ref, context.incomingSchema)) {
        const conflict = this.createConflict(
          path,
          'reference_broken',
          'high',
          `Reference broken in incoming schema: "${ref}" does not exist`,
          null,
          ref,
          documentSource,
          documentDestination,
          stepNumber
        );
        context.detectedConflicts.push(conflict);
        this.claimPath(context, path, 2);
        console.log(`  ✅ Detected: reference_broken at ${path}`);
      }
    });
  }

  // ============================================================================
  // PHASE 3: $DEFS IDENTITY AND RENAME/MOVE MAPPING
  // ============================================================================

  private static phaseDefsIdentity(
    context: ConflictDetectionContext,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): void {
    const currentDefs = context.currentSchema.$defs || context.currentSchema.definitions || {};
    const incomingDefs = context.incomingSchema.$defs || context.incomingSchema.definitions || {};

    // Find renamed/moved definitions
    const renameMap = this.findSimilarDefinitions(currentDefs, incomingDefs);
    context.defsRenameMap = renameMap;

    renameMap.forEach((newName, oldName) => {
      const defPath = context.currentSchema.$defs ? '/$defs' : '/definitions';
      const conflict = this.createConflict(
        `${defPath}/${oldName}`,
        'defs_renamed_moved',
        'medium',
        `Definition "${oldName}" renamed to "${newName}"`,
        currentDefs[oldName],
        incomingDefs[newName],
        documentSource,
        documentDestination,
        stepNumber
      );
      context.detectedConflicts.push(conflict);
      this.claimPath(context, `${defPath}/${oldName}`, 3);
      this.claimPath(context, `${defPath}/${newName}`, 3);
      console.log(`  ✅ Detected: defs_renamed_moved "${oldName}" → "${newName}"`);
    });
  }

  // ============================================================================
  // PHASE 4: HIGH-LEVEL COMPOSITION
  // ============================================================================

  private static phaseHighLevelComposition(
    context: ConflictDetectionContext,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): void {
    const compositionKeywords = ['allOf', 'anyOf', 'oneOf', 'not'];
    
    this.walkSchema(context.currentSchema, context.incomingSchema, '', (path, currentVal, incomingVal, key) => {
      if (this.isPathClaimed(context, path)) return;

      if (compositionKeywords.includes(key)) {
        if (JSON.stringify(currentVal) !== JSON.stringify(incomingVal)) {
          const conflictType = `${key}_changed` as ConflictType;
          const conflict = this.createConflict(
            path,
            conflictType,
            'high',
            `Composition keyword "${key}" changed`,
            currentVal,
            incomingVal,
            documentSource,
            documentDestination,
            stepNumber
          );
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 4);
          console.log(`  ✅ Detected: ${conflictType} at ${path}`);
        }
      }

      // Conditional keywords (if/then/else)
      if (['if', 'then', 'else'].includes(key)) {
        if (JSON.stringify(currentVal) !== JSON.stringify(incomingVal)) {
          const conflict = this.createConflict(
            path,
            'conditional_structure_changed',
            'high',
            `Conditional structure "${key}" changed`,
            currentVal,
            incomingVal,
            documentSource,
            documentDestination,
            stepNumber
          );
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 4);
          console.log(`  ✅ Detected: conditional_structure_changed at ${path}`);
        }
      }
    });
  }

  // ============================================================================
  // PHASE 5: OBJECT-SHAPE GOVERNANCE
  // ============================================================================

  private static phaseObjectShapeGovernance(
    context: ConflictDetectionContext,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): void {
    const governanceKeywords = [
      'additionalProperties',
      'unevaluatedProperties',
      'patternProperties',
      'propertyNames',
      'dependentRequired',
      'dependentSchemas'
    ];

    this.walkSchema(context.currentSchema, context.incomingSchema, '', (path, currentVal, incomingVal, key) => {
      if (this.isPathClaimed(context, path)) return;

      if (governanceKeywords.includes(key)) {
        if (JSON.stringify(currentVal) !== JSON.stringify(incomingVal)) {
          let conflictType: ConflictType;
          
          if (key === 'additionalProperties' && typeof currentVal === 'boolean' && typeof incomingVal === 'boolean') {
            conflictType = 'additionalProperties_boolean_flip';
          } else {
            conflictType = `${key}_changed` as ConflictType;
          }

          const conflict = this.createConflict(
            path,
            conflictType,
            'medium',
            `Object governance keyword "${key}" changed`,
            currentVal,
            incomingVal,
            documentSource,
            documentDestination,
            stepNumber
          );
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 5);
          console.log(`  ✅ Detected: ${conflictType} at ${path}`);
        }
      }
    });
  }

  // ============================================================================
  // PHASE 6: PROPERTY SET TOPOLOGY
  // ============================================================================

  private static phasePropertySetTopology(
    context: ConflictDetectionContext,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): void {
    this.walkSchema(context.currentSchema, context.incomingSchema, '', (path, currentVal, incomingVal, key, currentParent, incomingParent) => {
      if (this.isPathClaimed(context, path)) return;

      // Check for property additions
      if (currentVal === undefined && incomingVal !== undefined && typeof incomingParent === 'object') {
        const conflictType = this.detectPropertyAdditionPhased(path, key, incomingVal, incomingParent, context);
        const conflict = this.createConflict(
          path,
          conflictType,
          conflictType === 'property_added_duplicate' ? 'medium' : 'low',
          `Property "${key}" added`,
          currentVal,
          incomingVal,
          documentSource,
          documentDestination,
          stepNumber
        );
        context.detectedConflicts.push(conflict);
        this.claimPath(context, path, 6);
        console.log(`  ✅ Detected: ${conflictType} at ${path}`);
        return;
      }

      // Check for property removals
      if (currentVal !== undefined && incomingVal === undefined && typeof currentParent === 'object') {
        const isRequired = currentParent.required?.includes(key);
        const conflictType = isRequired ? 'property_removed_required' : 'property_removed_optional';
        
        // Check for rename
        if (incomingParent && typeof incomingParent === 'object') {
          const similarKey = this.findSimilarProperty(key, Object.keys(incomingParent));
          if (similarKey) {
            context.propertyRenameMap.set(path, path.replace(key, similarKey));
            const conflict = this.createConflict(
              path,
              'property_renamed',
              'medium',
              `Property "${key}" renamed to "${similarKey}"`,
              currentVal,
              incomingParent[similarKey],
              documentSource,
              documentDestination,
              stepNumber
            );
            context.detectedConflicts.push(conflict);
            this.claimPath(context, path, 6);
            this.claimPath(context, path.replace(key, similarKey), 6);
            console.log(`  ✅ Detected: property_renamed "${key}" → "${similarKey}"`);
            return;
          }
        }

        const conflict = this.createConflict(
          path,
          conflictType,
          isRequired ? 'high' : 'medium',
          `Property "${key}" removed ${isRequired ? '(was required)' : '(was optional)'}`,
          currentVal,
          incomingVal,
          documentSource,
          documentDestination,
          stepNumber
        );
        context.detectedConflicts.push(conflict);
        this.claimPath(context, path, 6);
        console.log(`  ✅ Detected: ${conflictType} at ${path}`);
      }
    });
  }

  // ============================================================================
  // PHASE 7: ARRAY TOPOLOGY
  // ============================================================================

  private static phaseArrayTopology(
    context: ConflictDetectionContext,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): void {
    this.walkSchema(context.currentSchema, context.incomingSchema, '', (path, currentVal, incomingVal, key) => {
      if (this.isPathClaimed(context, path)) return;

      // Array-specific keywords
      const arrayKeywords = ['items', 'prefixItems', 'contains', 'uniqueItems', 'minItems', 'maxItems', 'minContains', 'maxContains'];
      
      if (arrayKeywords.includes(key) && JSON.stringify(currentVal) !== JSON.stringify(incomingVal)) {
        let conflictType: ConflictType;
        
        switch (key) {
          case 'prefixItems':
            conflictType = 'tuple_items_changed';
            break;
          case 'items':
            conflictType = 'items_schema_changed';
            break;
          case 'contains':
            conflictType = 'contains_changed';
            break;
          case 'uniqueItems':
            conflictType = 'uniqueItems_changed';
            break;
          case 'minItems':
            conflictType = 'minItems_changed';
            break;
          case 'maxItems':
            conflictType = 'maxItems_changed';
            break;
          case 'minContains':
            conflictType = 'minContains_changed';
            break;
          case 'maxContains':
            conflictType = 'maxContains_changed';
            break;
          default:
            conflictType = 'array_items_modified';
        }

        const conflict = this.createConflict(
          path,
          conflictType,
          'medium',
          `Array keyword "${key}" changed`,
          currentVal,
          incomingVal,
          documentSource,
          documentDestination,
          stepNumber
        );
        context.detectedConflicts.push(conflict);
        this.claimPath(context, path, 7);
        console.log(`  ✅ Detected: ${conflictType} at ${path}`);
      }

      // Array length mismatches
      if (Array.isArray(currentVal) && Array.isArray(incomingVal) && currentVal.length !== incomingVal.length) {
        if (!this.isPathClaimed(context, path)) {
          const conflict = this.createConflict(
            path,
            'array_length_mismatch',
            'medium',
            `Array length changed: ${currentVal.length} → ${incomingVal.length}`,
            currentVal,
            incomingVal,
            documentSource,
            documentDestination,
            stepNumber
          );
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 7);
          console.log(`  ✅ Detected: array_length_mismatch at ${path}`);
        }
      }
    });
  }

  // ============================================================================
  // PHASE 8: TYPE SYSTEM DELTAS
  // ============================================================================

  private static phaseTypeSystemDeltas(
    context: ConflictDetectionContext,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): void {
    this.walkSchema(context.currentSchema, context.incomingSchema, '', (path, currentVal, incomingVal, key) => {
      if (this.isPathClaimed(context, path)) return;

      if (key === 'type' && currentVal !== undefined && incomingVal !== undefined) {
        if (JSON.stringify(currentVal) !== JSON.stringify(incomingVal)) {
          const conflictType = this.detectTypeChangePhased(currentVal, incomingVal);
          const conflict = this.createConflict(
            path,
            conflictType,
            'high',
            `Type changed: ${JSON.stringify(currentVal)} → ${JSON.stringify(incomingVal)}`,
            currentVal,
            incomingVal,
            documentSource,
            documentDestination,
            stepNumber
          );
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 8);
          
          // Suppress downstream constraints when type changes
          const parentPath = path.substring(0, path.lastIndexOf('/'));
          this.claimPath(context, `${parentPath}/minLength`, 8);
          this.claimPath(context, `${parentPath}/maxLength`, 8);
          this.claimPath(context, `${parentPath}/pattern`, 8);
          this.claimPath(context, `${parentPath}/format`, 8);
          this.claimPath(context, `${parentPath}/minimum`, 8);
          this.claimPath(context, `${parentPath}/maximum`, 8);
          
          console.log(`  ✅ Detected: ${conflictType} at ${path}`);
        }
      }

      // Nullable changes
      if (key === 'nullable' && currentVal !== incomingVal) {
        if (!this.isPathClaimed(context, path)) {
          const conflict = this.createConflict(
            path,
            'type_nullable_changed',
            'medium',
            `Nullable changed: ${currentVal} → ${incomingVal}`,
            currentVal,
            incomingVal,
            documentSource,
            documentDestination,
            stepNumber
          );
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 8);
          console.log(`  ✅ Detected: type_nullable_changed at ${path}`);
        }
      }
    });
  }

  // ============================================================================
  // PHASE 9: CONSTRAINT KEYWORDS
  // ============================================================================

  private static phaseConstraintKeywords(
    context: ConflictDetectionContext,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): void {
    const constraintKeywords: Record<string, ConflictType> = {
      'minimum': 'min_changed',
      'maximum': 'max_changed',
      'exclusiveMinimum': 'exclusiveMin_changed',
      'exclusiveMaximum': 'exclusiveMax_changed',
      'multipleOf': 'multipleOf_changed',
      'minLength': 'minLength_changed',
      'maxLength': 'maxLength_changed',
      'minProperties': 'minProperties_changed',
      'maxProperties': 'maxProperties_changed'
    };

    this.walkSchema(context.currentSchema, context.incomingSchema, '', (path, currentVal, incomingVal, key) => {
      if (this.isPathClaimed(context, path)) return;

      // Numeric and string constraints
      if (key in constraintKeywords && currentVal !== incomingVal) {
        const conflict = this.createConflict(
          path,
          constraintKeywords[key],
          'medium',
          `Constraint "${key}" changed: ${currentVal} → ${incomingVal}`,
          currentVal,
          incomingVal,
          documentSource,
          documentDestination,
          stepNumber
        );
        context.detectedConflicts.push(conflict);
        this.claimPath(context, path, 9);
        console.log(`  ✅ Detected: ${constraintKeywords[key]} at ${path}`);
      }

      // Pattern and format
      if (key === 'pattern') {
        if (currentVal === undefined && incomingVal !== undefined) {
          const conflict = this.createConflict(path, 'pattern_added', 'low', `Pattern added: "${incomingVal}"`, currentVal, incomingVal, documentSource, documentDestination, stepNumber);
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 9);
          console.log(`  ✅ Detected: pattern_added at ${path}`);
        } else if (currentVal !== undefined && incomingVal === undefined) {
          const conflict = this.createConflict(path, 'pattern_removed', 'medium', `Pattern removed: "${currentVal}"`, currentVal, incomingVal, documentSource, documentDestination, stepNumber);
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 9);
          console.log(`  ✅ Detected: pattern_removed at ${path}`);
        } else if (currentVal !== incomingVal) {
          const conflict = this.createConflict(path, 'pattern_changed', 'medium', `Pattern changed: "${currentVal}" → "${incomingVal}"`, currentVal, incomingVal, documentSource, documentDestination, stepNumber);
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 9);
          console.log(`  ✅ Detected: pattern_changed at ${path}`);
        }
      }

      if (key === 'format') {
        if (currentVal === undefined && incomingVal !== undefined) {
          const conflict = this.createConflict(path, 'format_added', 'low', `Format added: "${incomingVal}"`, currentVal, incomingVal, documentSource, documentDestination, stepNumber);
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 9);
        } else if (currentVal !== undefined && incomingVal === undefined) {
          const conflict = this.createConflict(path, 'format_removed', 'medium', `Format removed: "${currentVal}"`, currentVal, incomingVal, documentSource, documentDestination, stepNumber);
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 9);
        } else if (currentVal !== incomingVal) {
          const conflict = this.createConflict(path, 'format_changed', 'medium', `Format changed: "${currentVal}" → "${incomingVal}"`, currentVal, incomingVal, documentSource, documentDestination, stepNumber);
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 9);
        }
      }

      // Enum and const
      if (key === 'enum' && Array.isArray(currentVal) && Array.isArray(incomingVal)) {
        const added = incomingVal.filter(v => !currentVal.includes(v));
        const removed = currentVal.filter(v => !incomingVal.includes(v));
        
        if (added.length > 0 && removed.length === 0) {
          const conflict = this.createConflict(path, 'enum_values_added', 'low', `Enum values added: ${JSON.stringify(added)}`, currentVal, incomingVal, documentSource, documentDestination, stepNumber);
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 9);
          console.log(`  ✅ Detected: enum_values_added at ${path}`);
        } else if (removed.length > 0) {
          const conflict = this.createConflict(path, 'enum_values_removed', 'high', `Enum values removed: ${JSON.stringify(removed)}`, currentVal, incomingVal, documentSource, documentDestination, stepNumber);
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 9);
          console.log(`  ✅ Detected: enum_values_removed at ${path}`);
        } else if (JSON.stringify(currentVal) !== JSON.stringify(incomingVal)) {
          const conflict = this.createConflict(path, 'enum_order_changed', 'low', 'Enum order changed', currentVal, incomingVal, documentSource, documentDestination, stepNumber);
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 9);
        }
      }

      if (key === 'const' && currentVal !== incomingVal) {
        const conflict = this.createConflict(path, 'const_changed', 'high', `Const value changed: ${JSON.stringify(currentVal)} → ${JSON.stringify(incomingVal)}`, currentVal, incomingVal, documentSource, documentDestination, stepNumber);
        context.detectedConflicts.push(conflict);
        this.claimPath(context, path, 9);
        console.log(`  ✅ Detected: const_changed at ${path}`);
      }
    });
  }

  // ============================================================================
  // PHASE 10: REQUIRED AND CROSS-FIELD RELATIONS
  // ============================================================================

  private static phaseRequiredRelations(
    context: ConflictDetectionContext,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): void {
    this.walkSchema(context.currentSchema, context.incomingSchema, '', (path, currentVal, incomingVal, key) => {
      if (this.isPathClaimed(context, path)) return;

      if (key === 'required' && Array.isArray(currentVal) && Array.isArray(incomingVal)) {
        const added = incomingVal.filter(item => !currentVal.includes(item));
        const removed = currentVal.filter(item => !incomingVal.includes(item));

        if (added.length > 0) {
          const conflict = this.createConflict(
            path,
            'required_entry_added',
            'high',
            `Required fields added: ${added.join(', ')}`,
            currentVal,
            incomingVal,
            documentSource,
            documentDestination,
            stepNumber
          );
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 10);
          console.log(`  ✅ Detected: required_entry_added at ${path}`);
        }

        if (removed.length > 0) {
          const conflict = this.createConflict(
            path,
            'required_entry_removed',
            'medium',
            `Required fields removed: ${removed.join(', ')}`,
            currentVal,
            incomingVal,
            documentSource,
            documentDestination,
            stepNumber
          );
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 10);
          console.log(`  ✅ Detected: required_entry_removed at ${path}`);
        }
      }
    });
  }

  // ============================================================================
  // PHASE 11: ANNOTATIONS AND CONTENT
  // ============================================================================

  private static phaseAnnotations(
    context: ConflictDetectionContext,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): void {
    const annotationKeywords: Record<string, ConflictType> = {
      'title': 'title_conflict',
      'description': 'description_conflict',
      'default': 'default_value_conflict',
      'example': 'example_conflict',
      'examples': 'example_conflict',
      'deprecated': 'deprecated_status_conflict'
    };

    this.walkSchema(context.currentSchema, context.incomingSchema, '', (path, currentVal, incomingVal, key) => {
      if (this.isPathClaimed(context, path)) return;

      if (key in annotationKeywords && currentVal !== undefined && incomingVal !== undefined) {
        if (JSON.stringify(currentVal) !== JSON.stringify(incomingVal)) {
          const conflict = this.createConflict(
            path,
            annotationKeywords[key],
            'info',
            `Annotation "${key}" differs`,
            currentVal,
            incomingVal,
            documentSource,
            documentDestination,
            stepNumber
          );
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 11);
          console.log(`  ✅ Detected: ${annotationKeywords[key]} at ${path}`);
        }
      }

      // ReadOnly/WriteOnly coalesced
      if ((key === 'readOnly' || key === 'writeOnly') && currentVal !== incomingVal) {
        if (!this.isPathClaimed(context, path)) {
          const conflict = this.createConflict(
            path,
            'readOnly_writeOnly_changed',
            'info',
            `${key} changed: ${currentVal} → ${incomingVal}`,
            currentVal,
            incomingVal,
            documentSource,
            documentDestination,
            stepNumber
          );
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 11);
        }
      }
    });
  }

  // ============================================================================
  // PHASE 12: LATE REFERENCE RE-VALIDATION
  // ============================================================================

  private static phaseLateReferenceValidation(
    context: ConflictDetectionContext,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): void {
    // After all structural merges, validate references again
    const incomingRefs = this.buildReferenceGraph(context.incomingSchema);
    
    incomingRefs.forEach((ref, path) => {
      if (!this.isPathClaimed(context, path)) {
        if (!this.checkReferenceExists(ref, context.incomingSchema)) {
          const conflict = this.createConflict(
            path,
            'reference_broken',
            'high',
            `Reference validation failed after merge: "${ref}" does not exist`,
            null,
            ref,
            documentSource,
            documentDestination,
            stepNumber
          );
          context.detectedConflicts.push(conflict);
          this.claimPath(context, path, 12);
          console.log(`  ✅ Late validation: reference_broken at ${path}`);
        }
      }
    });
  }

  private static detectPropertyAddition(
    path: string, 
    value: any, 
    incomingSchema: any, 
    currentSchema: any,
    segments: string[]
  ): ConflictType {
    console.log('  🆕 detectPropertyAddition:', { path, value, segments });
    const propertyName = segments[segments.length - 1];
    
    // Check for reference broken (added property with broken $ref)
    if (typeof value === 'object' && value?.$ref) {
      const refExists = this.checkReferenceExists(value.$ref, incomingSchema);
      console.log('  🔗 Reference check:', { ref: value.$ref, exists: refExists });
      if (!refExists) {
        return 'reference_broken';
      }
      return 'reference_added';
    }

    // Check if it's a duplicate (exists elsewhere)
    const parentPath = '/' + segments.slice(0, -1).join('/');
    const incomingParent = this.getValueAtPath(incomingSchema, parentPath);
    
    const isDuplicate = this.propertyExistsElsewhere(propertyName, incomingParent, path);
    console.log('  🔄 Duplicate check:', { propertyName, isDuplicate });
    if (isDuplicate) {
      return 'property_added_duplicate';
    }

    return 'object_property_added';
  }

  private static detectPropertyRemoval(
    path: string, 
    value: any, 
    currentSchema: any,
    incomingSchema: any,
    segments: string[]
  ): ConflictType {
    console.log('  🗑️ detectPropertyRemoval:', { path, value, segments });
    const propertyName = segments[segments.length - 1];
    const parentPath = '/' + segments.slice(0, -1).join('/');
    const currentParent = this.getValueAtPath(currentSchema, parentPath);
    const incomingParent = this.getValueAtPath(incomingSchema, parentPath);

    // Check if property is in required array
    const isRequired = currentParent?.required?.includes(propertyName);
    console.log('  ✔️ Required check:', { propertyName, isRequired, required: currentParent?.required });
    if (isRequired) {
      return 'property_removed_required';
    }

    // Check for $defs/$definitions rename/move
    if (segments.includes('$defs') || segments.includes('definitions')) {
      const incomingDefs = incomingSchema.$defs || incomingSchema.definitions || {};
      const hasRenamedDef = Object.keys(incomingDefs).some(key => 
        this.levenshteinDistance(key, propertyName) <= 3
      );
      console.log('  🏷️ Defs rename check:', { propertyName, hasRenamedDef, incomingDefs: Object.keys(incomingDefs) });
      if (hasRenamedDef) {
        return 'defs_renamed_moved';
      }
    }

    // Check if property might be renamed (exists with similar name elsewhere)
    const possiblyRenamed = this.possiblyRenamed(propertyName, incomingParent);
    console.log('  🔄 Rename check:', { propertyName, possiblyRenamed });
    if (possiblyRenamed) {
      return 'property_renamed';
    }

    return 'object_property_removed';
  }

  private static detectTypeChange(
    currentType: string, 
    incomingType: string, 
    path: string,
    currentValue: any,
    incomingValue: any
  ): ConflictType {
    // Check for type expansion: single type -> array of types (e.g., "string" -> ["string", "null"])
    if (currentType === 'string' && incomingType === 'array' && 
        typeof currentValue === 'string' && Array.isArray(incomingValue)) {
      // This is likely a JSON Schema type field being expanded
      return 'type_expanded';
    }

    // Check for type collapse: array of types -> single type
    if (currentType === 'array' && incomingType === 'string' &&
        Array.isArray(currentValue) && typeof incomingValue === 'string') {
      return 'type_collapsed';
    }

    // Primitive type changes
    if (currentType !== 'object' && currentType !== 'array' && 
        incomingType !== 'object' && incomingType !== 'array') {
      return 'type_primitive_changed';
    }

    // Expansion: primitive -> complex
    if ((currentType !== 'object' && currentType !== 'array') &&
        (incomingType === 'object' || incomingType === 'array')) {
      return 'type_expanded';
    }

    // Collapse: complex -> primitive
    if ((currentType === 'object' || currentType === 'array') &&
        (incomingType !== 'object' && incomingType !== 'array')) {
      return 'type_collapsed';
    }

    // Array <-> Object conversions
    if (currentType === 'array' && incomingType === 'object') {
      return 'type_array_to_object';
    }
    if (currentType === 'object' && incomingType === 'array') {
      return 'type_object_to_array';
    }

    return 'type_changed';
  }

  private static detectArrayConflict(currentArray: any[], incomingArray: any[], path: string, keyword: string): ConflictType {
    console.log('  📊 detectArrayConflict:', { keyword, path, currentLength: currentArray.length, incomingLength: incomingArray.length });
    
    // Check for specific array keyword conflicts
    if (keyword === 'required') {
      const added = incomingArray.filter(item => !currentArray.includes(item));
      const removed = currentArray.filter(item => !incomingArray.includes(item));
      console.log('  ✔️ Required array changes:', { added, removed });
      
      if (added.length > 0 && removed.length === 0) {
        return 'required_entry_added';
      }
      if (removed.length > 0 && added.length === 0) {
        return 'required_entry_removed';
      }
      if (added.length > 0 && removed.length > 0) {
        return 'required_array_modified';
      }
    }

    if (keyword === 'enum') {
      const added = incomingArray.filter(item => !currentArray.includes(item));
      const removed = currentArray.filter(item => !incomingArray.includes(item));
      
      if (added.length > 0 && removed.length === 0) {
        return 'enum_values_added';
      }
      if (removed.length > 0) {
        return 'enum_values_removed';
      }
    }

    if (keyword === 'allOf' || keyword === 'anyOf' || keyword === 'oneOf') {
      return `${keyword}_changed` as ConflictType;
    }

    const currentLength = currentArray.length;
    const incomingLength = incomingArray.length;

    // Check for type conflicts in array items
    if (this.hasArrayTypeConflict(currentArray, incomingArray)) {
      return 'array_type_conflict';
    }

    // Check if items were added
    const addedItems = incomingArray.filter(item => 
      !currentArray.some(curr => this.areArrayItemsEqual(curr, item))
    );

    // Check if items were removed
    const removedItems = currentArray.filter(item =>
      !incomingArray.some(inc => this.areArrayItemsEqual(item, inc))
    );

    // Check if order changed (same items, different order)
    if (addedItems.length === 0 && removedItems.length === 0 && currentLength === incomingLength) {
      if (!this.arraysHaveSameOrder(currentArray, incomingArray)) {
        return 'array_items_reordered';
      }
    }

    // Check if items were modified
    const hasModifiedItems = currentArray.some((item, idx) => {
      const incomingItem = incomingArray[idx];
      return incomingItem !== undefined && !this.areArrayItemsEqual(item, incomingItem);
    });

    if (hasModifiedItems) {
      return 'array_items_modified';
    }

    if (addedItems.length > 0 && removedItems.length === 0) {
      return 'array_items_added';
    }

    if (removedItems.length > 0 && addedItems.length === 0) {
      return 'array_items_removed';
    }

    if (currentLength !== incomingLength) {
      return 'array_length_mismatch';
    }

    return 'array_items_modified';
  }

  private static detectObjectConflict(
    currentObj: any, 
    incomingObj: any, 
    path: string,
    currentSchema: any,
    incomingSchema: any,
    keyword: string
  ): ConflictType {
    const currentKeys = Object.keys(currentObj);
    const incomingKeys = Object.keys(incomingObj);

    const addedKeys = incomingKeys.filter(k => !currentKeys.includes(k));
    const removedKeys = currentKeys.filter(k => !incomingKeys.includes(k));
    const commonKeys = currentKeys.filter(k => incomingKeys.includes(k));

    // Check for schema-specific conflicts first
    const schemaConflict = this.detectSchemaSpecificConflict(currentObj, incomingObj, path, currentSchema, incomingSchema);
    if (schemaConflict) {
      return schemaConflict;
    }

    // Check if properties were modified
    const modifiedKeys = commonKeys.filter(k => 
      JSON.stringify(currentObj[k]) !== JSON.stringify(incomingObj[k])
    );

    // Structure completely diverged
    const totalKeys = new Set([...currentKeys, ...incomingKeys]).size;
    const divergenceRatio = (addedKeys.length + removedKeys.length) / totalKeys;
    
    if (divergenceRatio > 0.5) {
      return 'object_structure_diverged';
    }

    // Check for nested conflicts
    if (this.hasNestedConflicts(currentObj, incomingObj, commonKeys)) {
      return 'object_nested_conflict';
    }

    if (modifiedKeys.length > 0) {
      return 'object_property_value_changed';
    }

    if (addedKeys.length > 0 && removedKeys.length === 0) {
      return 'object_property_added';
    }

    if (removedKeys.length > 0 && addedKeys.length === 0) {
      return 'object_property_removed';
    }

    return 'object_structure_changed';
  }

  private static detectStringConflict(
    currentStr: string,
    incomingStr: string,
    path: string,
    keyword: string
  ): ConflictType {
    console.log('  📝 detectStringConflict:', { keyword, path, currentStr, incomingStr });
    
    // Check for schema meta conflicts FIRST
    if (keyword === '$schema' || path === '/$schema') {
      console.log('  ✅ Matched $schema');
      return '$schema_version_mismatch';
    }
    if (keyword === '$id' || keyword === 'id' || path === '/$id' || path === '/id') {
      console.log('  ✅ Matched $id/id');
      return 'id_base_uri_changed';
    }

    // Check for description conflicts
    if (keyword === 'description' || path.endsWith('/description')) {
      console.log('  ✅ Matched description');
      return 'description_conflict';
    }

    // Check for example conflicts
    if (keyword === 'example' || keyword === 'examples' || path.includes('/example')) {
      console.log('  ✅ Matched example');
      return 'example_conflict';
    }

    // Check for title conflicts
    if (keyword === 'title') {
      console.log('  ✅ Matched title');
      return 'title_conflict';
    }

    console.log('  ⚠️ Falling back to primitive_string_conflict');
    return 'primitive_string_conflict';
  }

  private static detectBooleanConflict(
    currentBool: boolean,
    incomingBool: boolean,
    path: string,
    keyword: string
  ): ConflictType {
    console.log('  🔘 detectBooleanConflict:', { keyword, path, currentBool, incomingBool });
    
    // Check for specific boolean flip conflicts
    if (keyword === 'additionalProperties') {
      console.log('  ✅ Matched additionalProperties');
      return 'additionalProperties_boolean_flip';
    }
    if (keyword === 'uniqueItems') {
      console.log('  ✅ Matched uniqueItems');
      return 'uniqueItems_changed';
    }
    if (keyword === 'readOnly' || keyword === 'writeOnly') {
      console.log('  ✅ Matched readOnly/writeOnly');
      return 'readOnly_writeOnly_changed';
    }
    if (keyword === 'deprecated') {
      console.log('  ✅ Matched deprecated');
      return 'deprecated_status_conflict';
    }
    if (keyword === 'nullable') {
      console.log('  ✅ Matched nullable');
      return 'type_nullable_changed';
    }
    console.log('  ⚠️ Falling back to primitive_boolean_conflict');
    return 'primitive_boolean_conflict';
  }

  private static detectKeywordConflict(
    keyword: string,
    currentValue: any,
    incomingValue: any,
    path: string,
    currentSchema: any,
    incomingSchema: any
  ): ConflictType | null {
    console.log('  🔑 detectKeywordConflict:', { keyword, path });
    // Handle specific JSON Schema keyword conflicts

    // Meta and structural keywords
    if (keyword === '$schema') {
      console.log('  ✅ Matched $schema keyword');
      return '$schema_version_mismatch';
    }
    if (keyword === '$id' || keyword === 'id') {
      console.log('  ✅ Matched $id/id keyword');
      return 'id_base_uri_changed';
    }
    
    // Specific constraint keywords - return granular types
    if (keyword === 'minLength') {
      console.log('  ✅ Matched minLength');
      return 'minLength_changed';
    }
    if (keyword === 'maxLength') {
      console.log('  ✅ Matched maxLength');
      return 'maxLength_changed';
    }
    if (keyword === 'minimum') {
      console.log('  ✅ Matched minimum');
      return 'min_changed';
    }
    if (keyword === 'maximum') {
      console.log('  ✅ Matched maximum');
      return 'max_changed';
    }
    if (keyword === 'minItems') {
      console.log('  ✅ Matched minItems');
      return 'minItems_changed';
    }
    if (keyword === 'maxItems') {
      console.log('  ✅ Matched maxItems');
      return 'maxItems_changed';
    }
    if (keyword === 'minProperties') {
      console.log('  ✅ Matched minProperties');
      return 'minProperties_changed';
    }
    if (keyword === 'maxProperties') {
      console.log('  ✅ Matched maxProperties');
      return 'maxProperties_changed';
    }
    if (keyword === 'minContains') {
      console.log('  ✅ Matched minContains');
      return 'minContains_changed';
    }
    if (keyword === 'maxContains') {
      console.log('  ✅ Matched maxContains');
      return 'maxContains_changed';
    }
    if (keyword === 'multipleOf') {
      console.log('  ✅ Matched multipleOf');
      return 'multipleOf_changed';
    }

    // Pattern and format
    if (keyword === 'pattern') {
      if (currentValue === undefined) return 'pattern_added';
      if (incomingValue === undefined) return 'pattern_removed';
      return 'pattern_changed';
    }
    if (keyword === 'format') {
      if (currentValue === undefined) return 'format_added';
      if (incomingValue === undefined) return 'format_removed';
      return 'format_changed';
    }

    // Const and default
    if (keyword === 'const') return 'const_changed';
    if (keyword === 'default') return 'default_value_conflict';

    // Items and tuple handling
    if (keyword === 'items') return 'items_schema_changed';
    if (keyword === 'prefixItems') return 'tuple_items_changed';
    if (keyword === 'contains') return 'contains_changed';

    // Property patterns
    if (keyword === 'propertyNames') return 'propertyNames_changed';
    if (keyword === 'patternProperties') return 'patternProperties_changed';
    if (keyword === 'additionalProperties') {
      // Check if it's a boolean flip
      if (typeof currentValue === 'boolean' && typeof incomingValue === 'boolean') {
        return 'additionalProperties_boolean_flip';
      }
      return 'additionalProperties_changed';
    }
    if (keyword === 'unevaluatedProperties') return 'unevaluatedProperties_changed';

    // Composition keywords
    if (keyword === 'allOf') return 'allOf_changed';
    if (keyword === 'anyOf') return 'anyOf_changed';
    if (keyword === 'oneOf') return 'oneOf_changed';
    if (keyword === 'not') return 'not_changed';

    // Conditional keywords
    if (keyword === 'if' || keyword === 'then' || keyword === 'else') {
      return 'conditional_structure_changed';
    }

    // Dependencies
    if (keyword === 'dependentRequired') return 'dependentRequired_changed';
    if (keyword === 'dependentSchemas') return 'dependentSchemas_changed';

    // Boolean properties
    if (keyword === 'uniqueItems') return 'uniqueItems_changed';
    if (keyword === 'readOnly' || keyword === 'writeOnly') return 'readOnly_writeOnly_changed';
    if (keyword === 'deprecated') return 'deprecated_status_conflict';
    if (keyword === 'nullable') return 'type_nullable_changed';

    // Semantic keywords
    if (keyword === 'description') return 'description_conflict';
    if (keyword === 'title') return 'title_conflict';
    if (keyword === 'examples' || keyword === 'example') return 'example_conflict';

    return null;
  }

  private static checkReferenceExists(ref: string, schema: any): boolean {
    if (!ref || !ref.startsWith('#/')) return false;
    
    const path = ref.substring(2); // Remove '#/'
    const segments = path.split('/');
    
    let current = schema;
    for (const segment of segments) {
      if (!current || typeof current !== 'object') return false;
      current = current[segment];
    }
    
    return current !== undefined;
  }

  private static detectSchemaSpecificConflict(
    currentObj: any,
    incomingObj: any,
    path: string,
    currentSchema: any,
    incomingSchema: any
  ): ConflictType | null {
    // Check for schema composition incompatibility (e.g., minContains > maxContains)
    if (incomingObj.minContains !== undefined && incomingObj.maxContains !== undefined) {
      if (incomingObj.minContains > incomingObj.maxContains) {
        return 'schema_composition_incompatible';
      }
    }
    if (incomingObj.minItems !== undefined && incomingObj.maxItems !== undefined) {
      if (incomingObj.minItems > incomingObj.maxItems) {
        return 'schema_composition_incompatible';
      }
    }
    if (incomingObj.minLength !== undefined && incomingObj.maxLength !== undefined) {
      if (incomingObj.minLength > incomingObj.maxLength) {
        return 'schema_composition_incompatible';
      }
    }
    if (incomingObj.minimum !== undefined && incomingObj.maximum !== undefined) {
      if (incomingObj.minimum > incomingObj.maximum) {
        return 'schema_composition_incompatible';
      }
    }
    if (incomingObj.minProperties !== undefined && incomingObj.maxProperties !== undefined) {
      if (incomingObj.minProperties > incomingObj.maxProperties) {
        return 'schema_composition_incompatible';
      }
    }

    // Check for type expansion (e.g., "string" -> ["string", "null"])
    if (currentObj.type && incomingObj.type) {
      const currentIsArray = Array.isArray(currentObj.type);
      const incomingIsArray = Array.isArray(incomingObj.type);
      
      if (!currentIsArray && incomingIsArray) {
        return 'type_expanded';
      }
      if (currentIsArray && !incomingIsArray) {
        return 'type_collapsed';
      }
    }

    // Reference conflicts - check if reference target exists
    if (incomingObj.$ref && !currentObj.$ref) {
      const refExists = this.checkReferenceExists(incomingObj.$ref, incomingSchema);
      if (!refExists) {
        return 'reference_broken';
      }
      return 'reference_added';
    }
    if (currentObj.$ref && !incomingObj.$ref) {
      return 'reference_broken'; // Removed reference is also a broken reference
    }
    if (currentObj.$ref && incomingObj.$ref && currentObj.$ref !== incomingObj.$ref) {
      // Check if incoming ref is broken
      const refExists = this.checkReferenceExists(incomingObj.$ref, incomingSchema);
      if (!refExists) {
        return 'reference_broken';
      }
      return 'ref_target_changed';
    }

    return null;
  }

  // ============================================================================
  // HELPER METHODS FOR CONFLICT DETECTION
  // ============================================================================

  private static getValueType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  private static propertyExistsElsewhere(propertyName: string, parentSchema: any, currentPath: string): boolean {
    // Simple heuristic: check if property with same name exists in different location
    return false; // Simplified for now
  }

  private static possiblyRenamed(propertyName: string, parentSchema: any): boolean {
    // Check for similar property names (edit distance < 3)
    if (!parentSchema?.properties) return false;
    
    const propertyNames = Object.keys(parentSchema.properties);
    return propertyNames.some(name => {
      if (name === propertyName) return false;
      return this.levenshteinDistance(name, propertyName) <= 2;
    });
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private static hasArrayTypeConflict(currentArray: any[], incomingArray: any[]): boolean {
    if (currentArray.length === 0 || incomingArray.length === 0) return false;

    const currentTypes = new Set(currentArray.map(item => this.getValueType(item)));
    const incomingTypes = new Set(incomingArray.map(item => this.getValueType(item)));

    // If both arrays have mixed types, no conflict
    if (currentTypes.size > 1 && incomingTypes.size > 1) return false;

    // If one has single type and other has different single type
    if (currentTypes.size === 1 && incomingTypes.size === 1) {
      const currentType = Array.from(currentTypes)[0];
      const incomingType = Array.from(incomingTypes)[0];
      return currentType !== incomingType;
    }

    return false;
  }

  private static arraysHaveSameOrder(arr1: any[], arr2: any[]): boolean {
    if (arr1.length !== arr2.length) return false;
    
    for (let i = 0; i < arr1.length; i++) {
      if (!this.areArrayItemsEqual(arr1[i], arr2[i])) {
        return false;
      }
    }
    
    return true;
  }

  private static hasNestedConflicts(currentObj: any, incomingObj: any, commonKeys: string[]): boolean {
    return commonKeys.some(key => {
      const current = currentObj[key];
      const incoming = incomingObj[key];
      
      if (typeof current === 'object' && typeof incoming === 'object' &&
          current !== null && incoming !== null) {
        return JSON.stringify(current) !== JSON.stringify(incoming);
      }
      
      return false;
    });
  }

  private static isConstraintTightened(field: string, currentValue: any, incomingValue: any): boolean {
    if (currentValue === undefined) return true; // Adding constraint is tightening
    if (incomingValue === undefined) return false; // Removing constraint is loosening

    // For min* fields, higher value = tighter
    if (field.startsWith('min')) {
      return incomingValue > currentValue;
    }
    
    // For max* fields, lower value = tighter
    if (field.startsWith('max')) {
      return incomingValue < currentValue;
    }

    return false;
  }

  // ============================================================================
  // LEGACY CONFLICT TYPE MAPPING
  // ============================================================================

  private static mapConflictType(importConflictType: string): ConflictType {
    // Legacy fallback - should not be used after refactoring
    switch (importConflictType) {
      case 'property_removed':
        return 'property_removed_optional';
      case 'property_added':
        return 'property_added_new';
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

  // ============================================================================
  // PHASED DETECTION HELPER METHODS
  // ============================================================================

  /**
   * Normalize OpenAPI nullable: true → type: ["string", "null"]
   */
  private static normalizeOpenApiNullable(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema;
    
    const normalized = JSON.parse(JSON.stringify(schema));
    
    const normalize = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.nullable === true && obj.type && typeof obj.type === 'string') {
        obj.type = [obj.type, 'null'];
        delete obj.nullable;
      }
      
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'object') {
          normalize(obj[key]);
        }
      });
    };
    
    normalize(normalized);
    return normalized;
  }

  /**
   * Create a MergeConflict object
   */
  private static createConflict(
    path: string,
    type: ConflictType,
    severity: MergeConflict['severity'],
    description: string,
    currentValue: any,
    incomingValue: any,
    documentSource: string,
    documentDestination: string,
    stepNumber: number
  ): MergeConflict {
    return {
      path,
      type,
      severity,
      description,
      currentValue,
      incomingValue,
      values: [currentValue, incomingValue],
      documentSource,
      documentDestination,
      stepNumber,
      resolution: 'unresolved',
      requiresManualReview: severity === 'high' || severity === 'critical',
      autoResolvable: severity === 'low' || severity === 'info'
    };
  }

  /**
   * Mark a path as claimed by a detection phase
   */
  private static claimPath(context: ConflictDetectionContext, path: string, phase: number): void {
    context.claimedPaths.add(path);
    context.claimedPathsByPhase.set(path, phase);
  }

  /**
   * Check if a path has already been claimed
   */
  private static isPathClaimed(context: ConflictDetectionContext, path: string): boolean {
    return context.claimedPaths.has(path);
  }

  /**
   * Build a map of all $ref references in the schema
   */
  private static buildReferenceGraph(schema: any, currentPath: string = ''): Map<string, string> {
    const refs = new Map<string, string>();
    
    const traverse = (obj: any, path: string) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.$ref && typeof obj.$ref === 'string') {
        refs.set(path || '/', obj.$ref);
      }
      
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => traverse(item, `${path}[${idx}]`));
      } else {
        Object.keys(obj).forEach(key => {
          traverse(obj[key], path ? `${path}/${key}` : `/${key}`);
        });
      }
    };
    
    traverse(schema, currentPath);
    return refs;
  }

  /**
   * Detect cyclic references in schema
   */
  private static detectCyclicReferences(
    schema: any,
    refs: Map<string, string>
  ): Array<{ path: string; ref: string; cycle: string[] }> {
    const cycles: Array<{ path: string; ref: string; cycle: string[] }> = [];
    
    refs.forEach((ref, path) => {
      const visited = new Set<string>();
      const chain: string[] = [ref];
      let currentRef = ref;
      
      while (currentRef && currentRef.startsWith('#/')) {
        if (visited.has(currentRef)) {
          // Cycle detected
          cycles.push({ path, ref, cycle: chain });
          break;
        }
        
        visited.add(currentRef);
        
        // Try to resolve the reference
        const targetValue = this.resolveReference(schema, currentRef);
        if (targetValue && typeof targetValue === 'object' && targetValue.$ref) {
          currentRef = targetValue.$ref;
          chain.push(currentRef);
        } else {
          break;
        }
      }
    });
    
    return cycles;
  }

  /**
   * Resolve a $ref to its target value
   */
  private static resolveReference(schema: any, ref: string): any {
    if (!ref || !ref.startsWith('#/')) return undefined;
    
    const path = ref.substring(2);
    const segments = path.split('/');
    
    let current = schema;
    for (const segment of segments) {
      if (!current || typeof current !== 'object') return undefined;
      current = current[segment];
    }
    
    return current;
  }

  /**
   * Find similar definitions using structure hashing and name similarity
   */
  private static findSimilarDefinitions(
    currentDefs: Record<string, any>,
    incomingDefs: Record<string, any>
  ): Map<string, string> {
    const renameMap = new Map<string, string>();
    
    const currentKeys = Object.keys(currentDefs);
    const incomingKeys = Object.keys(incomingDefs);
    
    currentKeys.forEach(oldName => {
      // Check if definition was removed
      if (!incomingDefs[oldName]) {
        // Try to find similar definition by structure and name
        const currentDef = currentDefs[oldName];
        const currentHash = this.structureHash(currentDef);
        
        for (const newName of incomingKeys) {
          if (renameMap.has(newName)) continue; // Already mapped
          
          const incomingDef = incomingDefs[newName];
          const incomingHash = this.structureHash(incomingDef);
          
          // Check structure similarity and name similarity
          if (currentHash === incomingHash && this.levenshteinDistance(oldName, newName) <= 3) {
            renameMap.set(oldName, newName);
            break;
          }
        }
      }
    });
    
    return renameMap;
  }

  /**
   * Create a structural hash of an object (based on property names and types)
   */
  private static structureHash(obj: any): string {
    if (!obj || typeof obj !== 'object') return typeof obj;
    
    if (Array.isArray(obj)) {
      return `[${obj.map(item => this.structureHash(item)).join(',')}]`;
    }
    
    const keys = Object.keys(obj).sort();
    const signature = keys.map(key => {
      const value = obj[key];
      if (typeof value === 'object') {
        return `${key}:object`;
      }
      return `${key}:${typeof value}`;
    }).join('|');
    
    return signature;
  }

  /**
   * Find a similar property name using Levenshtein distance
   */
  private static findSimilarProperty(propertyName: string, propertyNames: string[]): string | null {
    for (const name of propertyNames) {
      if (this.levenshteinDistance(propertyName, name) <= 2) {
        return name;
      }
    }
    return null;
  }

  /**
   * Walk through two schemas in parallel and invoke callback for each path
   */
  private static walkSchema(
    current: any,
    incoming: any,
    basePath: string,
    callback: (
      path: string,
      currentVal: any,
      incomingVal: any,
      key: string,
      currentParent?: any,
      incomingParent?: any
    ) => void
  ): void {
    const walk = (curr: any, inc: any, path: string, parent: any = null, incParent: any = null) => {
      if (curr === null || curr === undefined) {
        if (inc !== null && inc !== undefined) {
          // Value added
          if (typeof inc === 'object' && !Array.isArray(inc)) {
            Object.keys(inc).forEach(key => {
              const newPath = path ? `${path}/${key}` : `/${key}`;
              callback(newPath, undefined, inc[key], key, parent, incParent);
            });
          }
        }
        return;
      }
      
      if (inc === null || inc === undefined) {
        if (curr !== null && curr !== undefined) {
          // Value removed
          if (typeof curr === 'object' && !Array.isArray(curr)) {
            Object.keys(curr).forEach(key => {
              const newPath = path ? `${path}/${key}` : `/${key}`;
              callback(newPath, curr[key], undefined, key, parent, incParent);
            });
          }
        }
        return;
      }
      
      // Both values exist
      const currType = Array.isArray(curr) ? 'array' : typeof curr;
      const incType = Array.isArray(inc) ? 'array' : typeof inc;
      
      if (currType === 'object' && incType === 'object') {
        const allKeys = new Set([...Object.keys(curr), ...Object.keys(inc)]);
        allKeys.forEach(key => {
          const newPath = path ? `${path}/${key}` : `/${key}`;
          callback(newPath, curr[key], inc[key], key, curr, inc);
          
          // Recurse if both are objects
          if (typeof curr[key] === 'object' && typeof inc[key] === 'object') {
            walk(curr[key], inc[key], newPath, curr, inc);
          }
        });
      } else if (currType === 'array' && incType === 'array') {
        // Handle arrays
        const maxLen = Math.max(curr.length, inc.length);
        for (let i = 0; i < maxLen; i++) {
          const newPath = `${path}[${i}]`;
          callback(newPath, curr[i], inc[i], `${i}`, curr, inc);
          
          if (typeof curr[i] === 'object' && typeof inc[i] === 'object') {
            walk(curr[i], inc[i], newPath, curr, inc);
          }
        }
      }
    };
    
    walk(current, incoming, basePath);
  }

  /**
   * Detect property addition type in phased detection
   */
  private static detectPropertyAdditionPhased(
    path: string,
    propertyName: string,
    incomingValue: any,
    incomingParent: any,
    context: ConflictDetectionContext
  ): ConflictType {
    // Check for reference broken
    if (typeof incomingValue === 'object' && incomingValue?.$ref) {
      const refExists = this.checkReferenceExists(incomingValue.$ref, context.incomingSchema);
      if (!refExists) {
        return 'reference_broken';
      }
      return 'reference_added';
    }

    // Check if it's a duplicate
    const isDuplicate = this.propertyExistsElsewhere(propertyName, incomingParent, path);
    if (isDuplicate) {
      return 'property_added_duplicate';
    }

    return 'property_added_new';
  }

  /**
   * Detect type change in phased detection
   */
  private static detectTypeChangePhased(currentType: any, incomingType: any): ConflictType {
    // Type is a single value
    const currIsArray = Array.isArray(currentType);
    const incIsArray = Array.isArray(incomingType);
    
    if (!currIsArray && incIsArray) {
      return 'type_expanded';
    }
    
    if (currIsArray && !incIsArray) {
      return 'type_collapsed';
    }
    
    if (currIsArray && incIsArray) {
      // Both are arrays - check for nullable changes
      const currHasNull = currentType.includes('null');
      const incHasNull = incomingType.includes('null');
      
      if (currHasNull !== incHasNull) {
        return 'type_nullable_changed';
      }
      
      return 'type_primitive_changed';
    }
    
    // Both are strings
    if (currentType === 'object' && incomingType === 'array') {
      return 'type_object_to_array';
    }
    
    if (currentType === 'array' && incomingType === 'object') {
      return 'type_array_to_object';
    }
    
    return 'type_primitive_changed';
  }
}
