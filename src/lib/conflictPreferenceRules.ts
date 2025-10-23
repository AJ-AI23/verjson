import { ConflictType, ConflictResolutionPreferences } from './documentMergeEngine';

/**
 * Defines which preferences are applicable for each conflict type and resolution combination
 */
export type PreferenceKey = keyof ConflictResolutionPreferences;

export interface PreferenceRule {
  preferenceKeys: PreferenceKey[];
  description: string;
  applicableResolutions: ('current' | 'incoming' | 'combine' | 'interpolate' | 'extrapolate' | 'custom')[];
}

/**
 * Maps conflict types to their applicable preference configurations
 */
export const CONFLICT_PREFERENCE_RULES: Partial<Record<ConflictType, PreferenceRule>> = {
  // Array conflicts - order and merge preferences
  'array_items_added': {
    preferenceKeys: ['arrayMergeStrategy', 'arrayDuplicateHandling'],
    description: 'Configure how new items are combined with existing ones',
    applicableResolutions: ['combine', 'extrapolate']
  },
  'array_items_removed': {
    preferenceKeys: ['arrayMergeStrategy'],
    description: 'Configure how to handle removed items',
    applicableResolutions: ['interpolate', 'extrapolate']
  },
  'array_items_reordered': {
    preferenceKeys: ['arrayOrderPreference'],
    description: 'Choose which order to maintain',
    applicableResolutions: ['current', 'incoming']
  },
  'array_items_modified': {
    preferenceKeys: ['arrayMergeStrategy', 'arrayDuplicateHandling', 'arrayOrderPreference'],
    description: 'Configure how modified items are merged',
    applicableResolutions: ['combine', 'interpolate', 'extrapolate']
  },
  'array_length_mismatch': {
    preferenceKeys: ['arrayMergeStrategy', 'arrayDuplicateHandling'],
    description: 'Configure how arrays of different lengths are combined',
    applicableResolutions: ['combine', 'interpolate', 'extrapolate']
  },
  
  // Object conflicts
  'object_property_added': {
    preferenceKeys: ['objectPropertyConflict', 'objectMergeDepth'],
    description: 'Configure how new properties are merged',
    applicableResolutions: ['combine', 'extrapolate']
  },
  'object_property_removed': {
    preferenceKeys: ['objectPropertyConflict', 'objectMergeDepth'],
    description: 'Configure how removed properties are handled',
    applicableResolutions: ['interpolate', 'extrapolate']
  },
  'object_property_value_changed': {
    preferenceKeys: ['objectPropertyConflict', 'objectMergeDepth'],
    description: 'Configure how property value conflicts are resolved',
    applicableResolutions: ['custom']
  },
  'object_nested_conflict': {
    preferenceKeys: ['objectPropertyConflict', 'objectMergeDepth'],
    description: 'Configure recursive merge depth and strategy',
    applicableResolutions: ['combine', 'interpolate', 'extrapolate']
  },
  
  // String conflicts
  'primitive_string_conflict': {
    preferenceKeys: ['stringMergeStrategy', 'stringConcatenationSeparator'],
    description: 'Configure how conflicting strings are merged',
    applicableResolutions: ['combine', 'custom']
  },
  'description_conflict': {
    preferenceKeys: ['descriptionStrategy', 'stringConcatenationSeparator'],
    description: 'Configure how descriptions are combined',
    applicableResolutions: ['combine']
  },
  'example_conflict': {
    preferenceKeys: ['stringMergeStrategy'],
    description: 'Configure how example values are handled',
    applicableResolutions: ['combine']
  },
  
  // Numeric conflicts
  'primitive_number_conflict': {
    preferenceKeys: ['numericStrategy'],
    description: 'Choose how numeric values are resolved (average, min, max)',
    applicableResolutions: ['custom']
  },
  'constraint_loosened': {
    preferenceKeys: ['constraintStrategy'],
    description: 'Choose constraint resolution strategy',
    applicableResolutions: ['combine']
  },
  'constraint_tightened': {
    preferenceKeys: ['constraintStrategy'],
    description: 'Choose constraint resolution strategy',
    applicableResolutions: ['current', 'incoming']
  },
  
  // Boolean conflicts
  'primitive_boolean_conflict': {
    preferenceKeys: ['booleanStrategy'],
    description: 'Choose boolean logic resolution (AND/OR)',
    applicableResolutions: ['custom']
  },
  
  // Schema-specific
  'enum_values_added': {
    preferenceKeys: ['enumStrategy'],
    description: 'Configure how enum values are merged',
    applicableResolutions: ['combine']
  },
  'enum_values_removed': {
    preferenceKeys: ['enumStrategy'],
    description: 'Configure enum resolution strategy',
    applicableResolutions: ['current', 'incoming']
  },
  
  // Property structure
  'property_removed_optional': {
    preferenceKeys: ['objectPropertyConflict'],
    description: 'Configure whether to keep optional properties',
    applicableResolutions: ['combine']
  },
  'property_added_new': {
    preferenceKeys: ['objectPropertyConflict'],
    description: 'Configure how new properties are added',
    applicableResolutions: ['combine']
  },
  
  // Legacy array types
  'array_length_changed': {
    preferenceKeys: ['arrayMergeStrategy', 'arrayDuplicateHandling'],
    description: 'Configure how arrays are merged',
    applicableResolutions: ['combine', 'interpolate', 'extrapolate']
  },
  'array_order_changed': {
    preferenceKeys: ['arrayOrderPreference'],
    description: 'Choose which order to maintain',
    applicableResolutions: ['current', 'incoming']
  },
  
  // Legacy object types
  'object_properties_added': {
    preferenceKeys: ['objectPropertyConflict', 'objectMergeDepth'],
    description: 'Configure how new properties are merged',
    applicableResolutions: ['combine', 'extrapolate']
  },
  'object_properties_removed': {
    preferenceKeys: ['objectPropertyConflict', 'objectMergeDepth'],
    description: 'Configure how removed properties are handled',
    applicableResolutions: ['interpolate', 'extrapolate']
  },
  'object_structure_changed': {
    preferenceKeys: ['objectPropertyConflict', 'objectMergeDepth'],
    description: 'Configure structure merge strategy',
    applicableResolutions: ['combine', 'interpolate', 'extrapolate']
  },
  
  // Legacy enum
  'enum_values_changed': {
    preferenceKeys: ['enumStrategy'],
    description: 'Configure how enum values are merged',
    applicableResolutions: ['combine', 'interpolate', 'extrapolate']
  },
  
  // Legacy description
  'description_changed': {
    preferenceKeys: ['descriptionStrategy', 'stringConcatenationSeparator'],
    description: 'Configure how descriptions are combined',
    applicableResolutions: ['combine']
  },
};

/**
 * Get applicable preferences for a conflict type and resolution
 */
export function getApplicablePreferences(
  conflictType: ConflictType,
  resolution?: string
): PreferenceKey[] {
  const rule = CONFLICT_PREFERENCE_RULES[conflictType];
  
  if (!rule) {
    return [];
  }
  
  // If resolution is provided, check if it's applicable
  if (resolution && !rule.applicableResolutions.includes(resolution as any)) {
    return [];
  }
  
  return rule.preferenceKeys;
}

/**
 * Check if a conflict type needs preferences for a given resolution
 */
export function needsPreferences(
  conflictType: ConflictType,
  resolution?: string
): boolean {
  const preferences = getApplicablePreferences(conflictType, resolution);
  return preferences.length > 0;
}

/**
 * Get description for preference configuration
 */
export function getPreferenceDescription(conflictType: ConflictType): string {
  const rule = CONFLICT_PREFERENCE_RULES[conflictType];
  return rule?.description || 'Configure resolution preferences';
}

/**
 * Get human-readable label for preference key
 */
export function getPreferenceLabel(preferenceKey: PreferenceKey): string {
  const labels: Record<PreferenceKey, string> = {
    arrayOrderPreference: 'Array Order',
    arrayDuplicateHandling: 'Duplicate Handling',
    arrayMergeStrategy: 'Array Merge Strategy',
    stringMergeStrategy: 'String Merge Strategy',
    stringConcatenationSeparator: 'Concatenation Separator',
    objectPropertyConflict: 'Property Conflict Strategy',
    objectMergeDepth: 'Merge Depth',
    enumStrategy: 'Enum Strategy',
    constraintStrategy: 'Constraint Strategy',
    descriptionStrategy: 'Description Strategy',
    numericStrategy: 'Numeric Strategy',
    booleanStrategy: 'Boolean Strategy',
  };
  
  return labels[preferenceKey] || preferenceKey;
}
