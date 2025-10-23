import { ConflictType, MergeConflict } from './documentMergeEngine';

/**
 * Defines which resolutions are valid for each conflict type
 */
export const CONFLICT_RESOLUTION_RULES: Record<ConflictType, MergeConflict['resolution'][]> = {
  // Property Structure Conflicts
  'property_removed_required': ['current', 'incoming', 'unresolved'], // Critical - breaking change, no auto
  'property_removed_optional': ['incoming', 'combine', 'current', 'unresolved'], // Medium - prefer add back with combine
  'property_added_new': ['incoming', 'combine', 'unresolved'], // Low - safe to add (no current option, property doesn't exist)
  'property_added_duplicate': ['current', 'incoming', 'combine', 'custom', 'unresolved'], // Medium - can merge both
  'property_renamed': ['current', 'incoming', 'combine', 'custom', 'unresolved'], // Medium - combine creates alias
  'property_moved': ['current', 'incoming', 'combine', 'custom', 'unresolved'], // Medium - combine keeps both paths
  
  // Type Conflicts - All require manual decision, no auto-resolution
  'type_primitive_changed': ['current', 'incoming', 'unresolved'], // Critical - incompatible types
  'type_expanded': ['incoming', 'current', 'unresolved'], // High - prefer expanded (backward compat)
  'type_collapsed': ['current', 'incoming', 'unresolved'], // Critical - data loss, prefer current
  'type_array_to_object': ['current', 'incoming', 'unresolved'], // Critical - structural change
  'type_object_to_array': ['current', 'incoming', 'unresolved'], // Critical - structural change
  'type_nullable_changed': ['incoming', 'current', 'unresolved'], // Medium - prefer nullable (safer)
  
  // Array Conflicts - Order matters, preferences required
  'array_items_added': ['combine', 'incoming', 'extrapolate', 'current', 'unresolved'], // Low - prefer combine (union)
  'array_items_removed': ['current', 'interpolate', 'incoming', 'extrapolate', 'unresolved'], // Medium - prefer keep
  'array_items_reordered': ['current', 'incoming', 'unresolved'], // Medium - order preference required
  'array_items_modified': ['combine', 'current', 'incoming', 'interpolate', 'extrapolate', 'unresolved'], // High - item-level merge
  'array_length_mismatch': ['combine', 'current', 'incoming', 'interpolate', 'extrapolate', 'unresolved'], // Medium - merge strategy needed
  'array_type_conflict': ['current', 'incoming', 'unresolved'], // Critical - incompatible item types
  
  // Object Conflicts - Recursive merge support
  'object_property_added': ['combine', 'incoming', 'extrapolate', 'current', 'unresolved'], // Low - prefer add
  'object_property_removed': ['current', 'interpolate', 'incoming', 'extrapolate', 'unresolved'], // Medium - prefer keep
  'object_property_value_changed': ['current', 'incoming', 'combine', 'custom', 'unresolved'], // Medium - allow merge
  'object_structure_diverged': ['current', 'incoming', 'unresolved'], // Critical - completely different
  'object_nested_conflict': ['combine', 'current', 'incoming', 'interpolate', 'extrapolate', 'unresolved'], // Cascade - recursive
  
  // Primitive Conflicts - Simple value conflicts
  'primitive_string_conflict': ['combine', 'current', 'incoming', 'custom', 'unresolved'], // Low - can concatenate
  'primitive_number_conflict': ['current', 'incoming', 'custom', 'unresolved'], // Medium - can average/min/max
  'primitive_boolean_conflict': ['current', 'incoming', 'custom', 'unresolved'], // High - logic requires decision
  'primitive_null_vs_value': ['incoming', 'current', 'unresolved'], // Medium - prefer value over null
  
  // Schema-Specific Conflicts - OpenAPI/JSON Schema rules
  'enum_values_added': ['combine', 'incoming', 'unresolved'], // Low - backward compatible
  'enum_values_removed': ['current', 'incoming', 'interpolate', 'unresolved'], // Critical - breaking, intersection available
  'required_array_modified': ['current', 'incoming', 'combine', 'interpolate', 'unresolved'], // Critical - set operations
  'constraint_tightened': ['current', 'incoming', 'unresolved'], // Critical - data may fail validation
  'constraint_loosened': ['incoming', 'combine', 'current', 'unresolved'], // Medium - safe, prefer looser
  'format_changed': ['current', 'incoming', 'unresolved'], // Medium - validation impact
  'pattern_changed': ['current', 'incoming', 'unresolved'], // Critical - regex validation
  'reference_broken': ['current', 'incoming', 'custom', 'unresolved'], // Critical - fix $ref path
  'reference_added': ['incoming', 'combine', 'unresolved'], // Low - safe addition
  'schema_composition_conflict': ['current', 'incoming', 'combine', 'unresolved'], // Critical - allOf/anyOf/oneOf merge
  
  // Semantic/Content Conflicts - Documentation and metadata
  'description_conflict': ['combine', 'current', 'incoming', 'unresolved'], // Info - prefer concatenate
  'example_conflict': ['combine', 'current', 'incoming', 'unresolved'], // Info - keep all examples
  'default_value_conflict': ['current', 'incoming', 'unresolved'], // Medium - behavior impact
  'deprecated_status_conflict': ['incoming', 'current', 'unresolved'], // Medium - prefer deprecated (safer)
  
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
