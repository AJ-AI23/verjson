import { ConflictType, MergeConflict } from './documentMergeEngine';

/**
 * Defines which resolutions are valid for each conflict type
 */
export const CONFLICT_RESOLUTION_RULES: Record<ConflictType, MergeConflict['resolution'][]> = {
  // Property Structure Conflicts
  'property_removed_required': ['current', 'incoming', 'unresolved'], // HIGH - breaking change
  'property_removed_optional': ['current', 'incoming', 'combine', 'unresolved'], // MEDIUM - can auto-resolve
  'property_added_new': ['incoming', 'combine', 'unresolved'], // LOW - safe to add
  'property_added_duplicate': ['current', 'incoming', 'custom', 'unresolved'], // MEDIUM - needs decision
  'property_renamed': ['current', 'incoming', 'custom', 'unresolved'], // MEDIUM - suggest merge
  'property_moved': ['current', 'incoming', 'custom', 'unresolved'], // MEDIUM - path change
  
  // Type Conflicts
  'type_primitive_changed': ['current', 'incoming', 'unresolved'], // HIGH - manual only
  'type_expanded': ['current', 'incoming', 'unresolved'], // MEDIUM - could be compatible
  'type_collapsed': ['current', 'incoming', 'unresolved'], // HIGH - data loss
  'type_array_to_object': ['current', 'incoming', 'unresolved'], // HIGH - structural
  'type_object_to_array': ['current', 'incoming', 'unresolved'], // HIGH - structural
  'type_nullable_changed': ['current', 'incoming', 'unresolved'], // MEDIUM
  
  // Array Conflicts
  'array_items_added': ['current', 'incoming', 'combine', 'extrapolate', 'unresolved'], // LOW
  'array_items_removed': ['current', 'incoming', 'interpolate', 'extrapolate', 'unresolved'], // MEDIUM
  'array_items_reordered': ['current', 'incoming', 'unresolved'], // MEDIUM - needs preference
  'array_items_modified': ['current', 'incoming', 'combine', 'interpolate', 'extrapolate', 'unresolved'], // HIGH
  'array_length_mismatch': ['current', 'incoming', 'combine', 'interpolate', 'extrapolate', 'unresolved'], // MEDIUM
  'array_type_conflict': ['current', 'incoming', 'unresolved'], // HIGH - manual
  
  // Object Conflicts
  'object_property_added': ['current', 'incoming', 'combine', 'extrapolate', 'unresolved'], // LOW
  'object_property_removed': ['current', 'incoming', 'interpolate', 'extrapolate', 'unresolved'], // MEDIUM
  'object_property_value_changed': ['current', 'incoming', 'custom', 'unresolved'], // MEDIUM
  'object_structure_diverged': ['current', 'incoming', 'unresolved'], // HIGH - manual
  'object_nested_conflict': ['current', 'incoming', 'combine', 'interpolate', 'extrapolate', 'unresolved'], // Cascade
  
  // Primitive Conflicts
  'primitive_string_conflict': ['current', 'incoming', 'combine', 'custom', 'unresolved'], // LOW - can show diff
  'primitive_number_conflict': ['current', 'incoming', 'custom', 'unresolved'], // MEDIUM
  'primitive_boolean_conflict': ['current', 'incoming', 'unresolved'], // HIGH - logic conflict
  'primitive_null_vs_value': ['current', 'incoming', 'unresolved'], // MEDIUM
  
  // Schema-Specific Conflicts
  'enum_values_added': ['incoming', 'combine', 'unresolved'], // LOW - safe
  'enum_values_removed': ['current', 'incoming', 'unresolved'], // HIGH - breaking
  'required_array_modified': ['current', 'incoming', 'unresolved'], // HIGH - breaking
  'constraint_tightened': ['current', 'incoming', 'unresolved'], // HIGH - breaking
  'constraint_loosened': ['incoming', 'combine', 'unresolved'], // MEDIUM - usually safe
  'format_changed': ['current', 'incoming', 'unresolved'], // MEDIUM
  'pattern_changed': ['current', 'incoming', 'unresolved'], // HIGH
  'reference_broken': ['current', 'incoming', 'unresolved'], // HIGH - manual
  'reference_added': ['incoming', 'combine', 'unresolved'], // LOW
  'schema_composition_conflict': ['current', 'incoming', 'unresolved'], // HIGH - complex
  
  // Semantic/Content Conflicts
  'description_conflict': ['current', 'incoming', 'combine', 'unresolved'], // LOW
  'example_conflict': ['current', 'incoming', 'combine', 'unresolved'], // LOW
  'default_value_conflict': ['current', 'incoming', 'unresolved'], // MEDIUM
  'deprecated_status_conflict': ['current', 'incoming', 'unresolved'], // MEDIUM
  
  // Legacy types (backward compatibility)
  'property_removed': ['current', 'incoming', 'combine', 'unresolved'],
  'property_added': ['current', 'incoming', 'combine', 'unresolved'],
  'type_changed': ['current', 'incoming', 'unresolved'],
  'type_format_changed': ['current', 'incoming', 'unresolved'],
  'array_length_changed': ['current', 'incoming', 'combine', 'interpolate', 'extrapolate', 'unresolved'],
  'array_order_changed': ['current', 'incoming', 'unresolved'],
  'object_properties_added': ['current', 'incoming', 'combine', 'extrapolate', 'unresolved'],
  'object_properties_removed': ['current', 'incoming', 'interpolate', 'extrapolate', 'unresolved'],
  'object_structure_changed': ['current', 'incoming', 'combine', 'interpolate', 'extrapolate', 'unresolved'],
  'value_changed_primitive': ['current', 'incoming', 'custom', 'unresolved'],
  'enum_values_changed': ['current', 'incoming', 'combine', 'interpolate', 'extrapolate', 'unresolved'],
  'constraint_changed': ['current', 'incoming', 'unresolved'],
  'description_changed': ['current', 'incoming', 'combine', 'unresolved'],
  'type_mismatch': ['current', 'incoming', 'unresolved'],
  'duplicate_key': ['current', 'incoming', 'combine', 'custom', 'unresolved'],
  'incompatible_schema': ['current', 'incoming', 'unresolved'],
  'structure_conflict': ['current', 'incoming', 'combine', 'interpolate', 'extrapolate', 'custom', 'unresolved'],
};

/**
 * Get severity level for each conflict type
 */
export const CONFLICT_SEVERITY: Record<ConflictType, MergeConflict['severity']> = {
  // Property Structure Conflicts
  'property_removed_required': 'critical',
  'property_removed_optional': 'medium',
  'property_added_new': 'low',
  'property_added_duplicate': 'medium',
  'property_renamed': 'medium',
  'property_moved': 'medium',
  
  // Type Conflicts
  'type_primitive_changed': 'critical',
  'type_expanded': 'high',
  'type_collapsed': 'critical',
  'type_array_to_object': 'critical',
  'type_object_to_array': 'critical',
  'type_nullable_changed': 'medium',
  
  // Array Conflicts
  'array_items_added': 'low',
  'array_items_removed': 'medium',
  'array_items_reordered': 'medium',
  'array_items_modified': 'high',
  'array_length_mismatch': 'medium',
  'array_type_conflict': 'critical',
  
  // Object Conflicts
  'object_property_added': 'low',
  'object_property_removed': 'medium',
  'object_property_value_changed': 'medium',
  'object_structure_diverged': 'critical',
  'object_nested_conflict': 'medium',
  
  // Primitive Conflicts
  'primitive_string_conflict': 'low',
  'primitive_number_conflict': 'medium',
  'primitive_boolean_conflict': 'high',
  'primitive_null_vs_value': 'medium',
  
  // Schema-Specific Conflicts
  'enum_values_added': 'low',
  'enum_values_removed': 'critical',
  'required_array_modified': 'critical',
  'constraint_tightened': 'critical',
  'constraint_loosened': 'medium',
  'format_changed': 'medium',
  'pattern_changed': 'critical',
  'reference_broken': 'critical',
  'reference_added': 'low',
  'schema_composition_conflict': 'critical',
  
  // Semantic/Content Conflicts
  'description_conflict': 'info',
  'example_conflict': 'info',
  'default_value_conflict': 'medium',
  'deprecated_status_conflict': 'medium',
  
  // Legacy types
  'property_removed': 'medium',
  'property_added': 'low',
  'type_changed': 'high',
  'type_format_changed': 'medium',
  'array_length_changed': 'medium',
  'array_order_changed': 'medium',
  'object_properties_added': 'low',
  'object_properties_removed': 'medium',
  'object_structure_changed': 'high',
  'value_changed_primitive': 'medium',
  'enum_values_changed': 'medium',
  'constraint_changed': 'medium',
  'description_changed': 'info',
  'type_mismatch': 'high',
  'duplicate_key': 'medium',
  'incompatible_schema': 'critical',
  'structure_conflict': 'high',
};

/**
 * Determine if conflict requires manual review
 */
export const REQUIRES_MANUAL_REVIEW: Record<ConflictType, boolean> = {
  // Property Structure Conflicts
  'property_removed_required': true,
  'property_removed_optional': false,
  'property_added_new': false,
  'property_added_duplicate': true,
  'property_renamed': true,
  'property_moved': true,
  
  // Type Conflicts - all require manual review
  'type_primitive_changed': true,
  'type_expanded': true,
  'type_collapsed': true,
  'type_array_to_object': true,
  'type_object_to_array': true,
  'type_nullable_changed': true,
  
  // Array Conflicts
  'array_items_added': false,
  'array_items_removed': true,
  'array_items_reordered': true,
  'array_items_modified': true,
  'array_length_mismatch': false,
  'array_type_conflict': true,
  
  // Object Conflicts
  'object_property_added': false,
  'object_property_removed': true,
  'object_property_value_changed': true,
  'object_structure_diverged': true,
  'object_nested_conflict': false,
  
  // Primitive Conflicts
  'primitive_string_conflict': false,
  'primitive_number_conflict': true,
  'primitive_boolean_conflict': true,
  'primitive_null_vs_value': true,
  
  // Schema-Specific Conflicts
  'enum_values_added': false,
  'enum_values_removed': true,
  'required_array_modified': true,
  'constraint_tightened': true,
  'constraint_loosened': false,
  'format_changed': true,
  'pattern_changed': true,
  'reference_broken': true,
  'reference_added': false,
  'schema_composition_conflict': true,
  
  // Semantic/Content Conflicts
  'description_conflict': false,
  'example_conflict': false,
  'default_value_conflict': true,
  'deprecated_status_conflict': true,
  
  // Legacy types
  'property_removed': true,
  'property_added': false,
  'type_changed': true,
  'type_format_changed': true,
  'array_length_changed': false,
  'array_order_changed': true,
  'object_properties_added': false,
  'object_properties_removed': true,
  'object_structure_changed': true,
  'value_changed_primitive': true,
  'enum_values_changed': false,
  'constraint_changed': true,
  'description_changed': false,
  'type_mismatch': true,
  'duplicate_key': true,
  'incompatible_schema': true,
  'structure_conflict': true,
};

/**
 * Get valid resolutions for a specific conflict type
 */
export function getValidResolutions(conflictType: ConflictType): MergeConflict['resolution'][] {
  return CONFLICT_RESOLUTION_RULES[conflictType] || ['current', 'incoming', 'unresolved'];
}

/**
 * Get severity for a conflict type
 */
export function getConflictSeverity(conflictType: ConflictType): MergeConflict['severity'] {
  return CONFLICT_SEVERITY[conflictType] || 'medium';
}

/**
 * Check if conflict requires manual review
 */
export function requiresManualReview(conflictType: ConflictType): boolean {
  return REQUIRES_MANUAL_REVIEW[conflictType] || true;
}

/**
 * Check if a resolution is valid for a conflict type
 */
export function isResolutionValid(conflictType: ConflictType, resolution: MergeConflict['resolution']): boolean {
  const validResolutions = getValidResolutions(conflictType);
  return validResolutions.includes(resolution);
}

/**
 * Get a human-readable explanation of why certain resolutions are available
 */
export function getResolutionExplanation(conflictType: ConflictType): string {
  // Property Structure
  if (conflictType === 'property_removed_required') {
    return 'Required property removal is a breaking change. Manual review required.';
  }
  if (conflictType === 'property_removed_optional') {
    return 'Optional property can be kept (current), removed (incoming), or conditionally included (combine).';
  }
  if (conflictType === 'property_added_new') {
    return 'New properties are safe to add. Use incoming or combine to include them.';
  }
  if (conflictType === 'property_added_duplicate') {
    return 'Property exists elsewhere. Choose which location to keep or provide custom path.';
  }
  if (conflictType === 'property_renamed' || conflictType === 'property_moved') {
    return 'Property path changed. Choose old path (current), new path (incoming), or custom path.';
  }
  
  // Type Conflicts
  if (conflictType.startsWith('type_')) {
    return 'Type conflicts require explicit choice. Automatic merging would cause data loss or corruption.';
  }
  
  // Array Conflicts
  if (conflictType === 'array_items_added') {
    return 'New items can be combined (union) or kept separate (difference).';
  }
  if (conflictType === 'array_items_removed') {
    return 'Items removed. Keep current, accept removal, or use set operations.';
  }
  if (conflictType === 'array_items_reordered') {
    return 'Item order differs. Choose which order to maintain based on your array order preference.';
  }
  if (conflictType === 'array_items_modified') {
    return 'Array items changed. Can combine unique items, find intersection, or get differences.';
  }
  
  // Object Conflicts
  if (conflictType === 'object_property_added') {
    return 'New properties can be combined or kept as differences.';
  }
  if (conflictType === 'object_property_removed') {
    return 'Properties removed. Use intersection to keep only shared, or difference for unique values.';
  }
  if (conflictType === 'object_structure_diverged') {
    return 'Object structures completely different. Manual review required.';
  }
  
  // Primitives
  if (conflictType.startsWith('primitive_')) {
    if (conflictType === 'primitive_string_conflict') {
      return 'Strings can be combined (concatenated), or one chosen explicitly.';
    }
    if (conflictType === 'primitive_boolean_conflict') {
      return 'Boolean logic conflict requires manual decision - this affects application behavior.';
    }
    return 'Primitive values require explicit choice or custom value.';
  }
  
  // Schema-Specific
  if (conflictType === 'enum_values_added') {
    return 'New enum values are backward compatible. Safe to combine.';
  }
  if (conflictType === 'enum_values_removed') {
    return 'Removing enum values is a breaking change. Manual review required.';
  }
  if (conflictType === 'required_array_modified') {
    return 'Changes to required fields are breaking changes. Manual review required.';
  }
  if (conflictType === 'constraint_tightened') {
    return 'Tighter constraints may break existing data. Manual review required.';
  }
  if (conflictType === 'constraint_loosened') {
    return 'Looser constraints are usually safe. Can be combined automatically.';
  }
  if (conflictType.includes('reference')) {
    return 'Reference changes affect schema relationships. Manual verification needed.';
  }
  
  // Semantic
  if (conflictType.startsWith('description_') || conflictType.startsWith('example_')) {
    return 'Documentation conflicts can be combined (concatenated) or one chosen.';
  }
  if (conflictType === 'default_value_conflict') {
    return 'Different defaults affect behavior. Choose which default is correct.';
  }
  
  return 'Available resolutions depend on the conflict type and your merge strategy.';
}
