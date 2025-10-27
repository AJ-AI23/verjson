/**
 * Conflict Preference Rules
 * Dynamically loaded from VerJSON Conflict Registry
 */

import { conflictRegistry } from './config';
import { ConflictResolutionPreferences } from './documentMergeEngine';

export type PreferenceKey = keyof ConflictResolutionPreferences;

export interface PreferenceRule {
  preferenceKeys: PreferenceKey[];
  description: string;
  applicableResolutions: string[];
}

/**
 * Get applicable preferences for a conflict type and resolution from registry
 */
export function getApplicablePreferences(
  conflictType: string,
  resolution?: string
): PreferenceKey[] {
  const applicablePrefs = conflictRegistry.getApplicablePreferences(conflictType);
  
  if (!applicablePrefs || applicablePrefs.length === 0) {
    return [];
  }
  
  // Map registry preference keys to our type system
  // Filter only valid keys that exist in ConflictResolutionPreferences
  return applicablePrefs.filter(key => 
    key in getDefaultPreferences()
  ) as PreferenceKey[];
}

/**
 * Check if a conflict type needs preferences for a given resolution
 */
export function needsPreferences(
  conflictType: string,
  resolution?: string
): boolean {
  const preferences = getApplicablePreferences(conflictType, resolution);
  return preferences.length > 0;
}

/**
 * Get description for preference configuration
 */
export function getPreferenceDescription(conflictType: string): string {
  return conflictRegistry.getDescription(conflictType);
}

/**
 * Get human-readable label for preference key
 */
export function getPreferenceLabel(preferenceKey: PreferenceKey): string {
  const labels: Partial<Record<PreferenceKey, string>> = {
    arrayOrderPreference: 'Array Order',
    arrayDuplicateHandling: 'Duplicate Handling',
    arrayMergeStrategy: 'Array Merge Strategy',
    stringMergeStrategy: 'String Merge Strategy',
    stringConcatenationSeparator: 'Concatenation Separator',
    stringNormalization: 'String Normalization',
    objectPropertyConflict: 'Property Conflict Strategy',
    objectMergeDepth: 'Merge Depth',
    additionalPropsStrategy: 'Additional Properties',
    keyNormalization: 'Key Normalization',
    propertyRenamePolicy: 'Property Rename Policy',
    dependentRequiredStrategy: 'Dependent Required',
    enumStrategy: 'Enum Strategy',
    constraintStrategy: 'Constraint Strategy',
    formatStrategy: 'Format Strategy',
    descriptionStrategy: 'Description Strategy',
    examplesStrategy: 'Examples Strategy',
    deprecationStrategy: 'Deprecation Strategy',
    numericStrategy: 'Numeric Strategy',
    numericPrecision: 'Numeric Precision',
    numericTieBreak: 'Numeric Tie Break',
    booleanStrategy: 'Boolean Strategy',
    schemaVersionStrategy: 'Schema Version',
    refNormalization: 'Reference Normalization',
    refCycleStrategy: 'Reference Cycle',
    defRenameStrategy: 'Definition Rename',
    compositionStrategy: 'Composition Strategy',
    disjunctionStrategy: 'Disjunction Strategy',
    altDedupStrategy: 'Alternative Deduplication',
    conditionalStrategy: 'Conditional Strategy',
    wideningGuard: 'Widening Guard',
    tighteningGuard: 'Tightening Guard',
    unknownKeywordPolicy: 'Unknown Keywords',
    tuplePolicy: 'Tuple Policy',
    uniqueItemsPolicy: 'Unique Items Policy',
  };
  
  return labels[preferenceKey] || preferenceKey;
}

/**
 * Get preference definition from registry
 */
export function getPreferenceDefinition(preferenceKey: string) {
  return conflictRegistry.getPreferenceDefinition(preferenceKey);
}

/**
 * Get default preferences from registry
 */
export function getDefaultPreferences(): ConflictResolutionPreferences {
  const allPreferences = conflictRegistry.getAllPreferences();
  
  // Build default preferences object from registry defaults
  const defaults: any = {};
  Object.entries(allPreferences).forEach(([key, definition]) => {
    defaults[key] = definition.default;
  });
  
  return defaults as ConflictResolutionPreferences;
}

/**
 * Get possible values for an enum preference
 */
export function getPreferenceValues(preferenceKey: string): string[] {
  const definition = getPreferenceDefinition(preferenceKey);
  return definition?.values || [];
}

/**
 * Get preference type
 */
export function getPreferenceType(preferenceKey: string): 'enum' | 'string' | 'integer' | 'number' | 'boolean' {
  const definition = getPreferenceDefinition(preferenceKey);
  return definition?.type || 'string';
}

// Legacy export for backward compatibility
export const CONFLICT_PREFERENCE_RULES: Partial<Record<string, PreferenceRule>> = {};
