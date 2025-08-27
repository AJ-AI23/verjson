import { Document } from '@/types/workspace';
import { compareDocumentVersions, applyImportPatches } from '@/lib/importVersionUtils';
import { compare } from 'fast-json-patch';

export interface MergeConflict {
  path: string;
  type: 'type_mismatch' | 'duplicate_key' | 'incompatible_schema' | 'structure_conflict';
  severity: 'high' | 'medium' | 'low';
  description: string;
  documents: string[];
  values: any[];
  suggestedResolution?: string;
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
  };
  mergeSteps: Array<{
    stepNumber: number;
    fromDocument: string;
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
          documents: documents.map(d => d.name),
          values: []
        }],
        isCompatible: false,
        warnings: [compatibility.reason || 'Incompatible documents'],
        summary: { addedProperties: 0, mergedComponents: 0, totalConflicts: 1 },
        mergeSteps: []
      };
    }

    return this.mergeDocumentsSequentially(documents, resultName);
  }

  /**
   * Sequential merge using import version comparison approach
   */
  private static mergeDocumentsSequentially(documents: Document[], resultName: string): DocumentMergeResult {
    console.log('🔄 Starting sequential merge of', documents.length, 'documents');
    
    const allConflicts: MergeConflict[] = [];
    const mergeSteps: Array<{stepNumber: number; fromDocument: string; patches: any[]; conflicts: number}> = [];
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

        // Apply patches to get merged result
        const stepResult = applyImportPatches(currentResult, comparison.patches);
        
        // Convert import conflicts to merge conflicts
        const stepConflicts = comparison.mergeConflicts.map(conflict => ({
          path: conflict.path,
          type: this.mapConflictType(conflict.conflictType),
          severity: conflict.severity,
          description: `Step ${i} (${currentDoc.name}): ${conflict.description}`,
          documents: [i === 1 ? documents[0].name : 'Previous merge result', currentDoc.name],
          values: [conflict.currentValue, conflict.importValue],
          suggestedResolution: 'Manual review required'
        }));

        allConflicts.push(...stepConflicts);
        
        // Track merge step
        mergeSteps.push({
          stepNumber: i,
          fromDocument: currentDoc.name,
          patches: comparison.patches,
          conflicts: stepConflicts.length
        });

        // Update accumulated result
        currentResult = stepResult;
        
        // Count properties/components added in this step
        const addedInStep = comparison.patches.filter(p => p.op === 'add').length;
        totalAddedProperties += addedInStep;

        console.log(`✅ Step ${i} completed. Added ${addedInStep} properties, ${stepConflicts.length} conflicts`);

      } catch (error) {
        console.error(`❌ Error in merge step ${i}:`, error);
        allConflicts.push({
          path: '/',
          type: 'incompatible_schema',
          severity: 'high',
          description: `Failed to merge ${currentDoc.name}: ${error.message}`,
          documents: [documents[0].name, currentDoc.name],
          values: [],
          suggestedResolution: 'Review document structure and try again'
        });
      }
    }

    // Set final result properties
    const finalResult = {
      ...currentResult,
      title: resultName,
      description: `Merged schema from: ${documents.map(d => d.name).join(', ')}`
    };

    // Handle different schema formats
    if (finalResult.info) {
      finalResult.info = {
        ...finalResult.info,
        title: resultName,
        description: `Merged API specification from: ${documents.map(d => d.name).join(', ')}`
      };
    }

    console.log('🎯 Sequential merge completed:', {
      steps: mergeSteps.length,
      totalConflicts: allConflicts.length,
      totalAddedProperties
    });

    return {
      mergedSchema: finalResult,
      conflicts: allConflicts,
      isCompatible: true,
      warnings: allConflicts.length > 0 ? [`${allConflicts.length} conflicts detected during merge`] : [],
      summary: {
        addedProperties: totalAddedProperties,
        mergedComponents: totalMergedComponents,
        totalConflicts: allConflicts.length
      },
      mergeSteps
    };
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
                documents: [documents[0].name, doc.name],
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
                documents: [documents[0].name, doc.name],
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
        totalConflicts: conflicts.length
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
                documents: [documents[0].name, doc.name],
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
                    documents: [documents[0].name, doc.name],
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
        totalConflicts: conflicts.length
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