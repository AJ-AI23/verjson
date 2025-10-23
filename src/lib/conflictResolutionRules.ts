import { ConflictType, MergeConflict } from './documentMergeEngine';

/**
 * Defines which resolutions are valid for each conflict type
 */
export const CONFLICT_RESOLUTION_RULES: Record<ConflictType, MergeConflict['resolution'][]> = {
  // Property Structure Conflicts
  'property_removed': ['current', 'incoming', 'combine', 'unresolved'],
  'property_added': ['current', 'incoming', 'combine', 'unresolved'],
  'property_renamed': ['current', 'incoming', 'custom', 'unresolved'],
  
  // Type Conflicts - only allow explicit choice
  'type_changed': ['current', 'incoming', 'unresolved'],
  'type_nullable_changed': ['current', 'incoming', 'unresolved'],
  'type_format_changed': ['current', 'incoming', 'unresolved'],
  
  // Array Conflicts - all operations valid
  'array_length_changed': ['current', 'incoming', 'combine', 'interpolate', 'extrapolate', 'unresolved'],
  'array_order_changed': ['current', 'incoming', 'unresolved'],
  'array_items_added': ['current', 'incoming', 'combine', 'extrapolate', 'unresolved'],
  'array_items_removed': ['current', 'incoming', 'interpolate', 'extrapolate', 'unresolved'],
  'array_items_modified': ['current', 'incoming', 'combine', 'interpolate', 'extrapolate', 'unresolved'],
  
  // Object Conflicts
  'object_properties_added': ['current', 'incoming', 'combine', 'extrapolate', 'unresolved'],
  'object_properties_removed': ['current', 'incoming', 'interpolate', 'extrapolate', 'unresolved'],
  'object_structure_changed': ['current', 'incoming', 'combine', 'interpolate', 'extrapolate', 'unresolved'],
  
  // Primitive Conflicts
  'value_changed_primitive': ['current', 'incoming', 'custom', 'unresolved'],
  
  // Schema-Specific Conflicts
  'enum_values_changed': ['current', 'incoming', 'combine', 'interpolate', 'extrapolate', 'unresolved'],
  'constraint_changed': ['current', 'incoming', 'unresolved'],
  
  // Semantic Conflicts
  'description_changed': ['current', 'incoming', 'combine', 'unresolved'],
  
  // Legacy types (for backward compatibility)
  'type_mismatch': ['current', 'incoming', 'unresolved'],
  'duplicate_key': ['current', 'incoming', 'combine', 'custom', 'unresolved'],
  'incompatible_schema': ['current', 'incoming', 'unresolved'],
  'structure_conflict': ['current', 'incoming', 'combine', 'interpolate', 'extrapolate', 'custom', 'unresolved'],
};

/**
 * Get valid resolutions for a specific conflict type
 */
export function getValidResolutions(conflictType: ConflictType): MergeConflict['resolution'][] {
  return CONFLICT_RESOLUTION_RULES[conflictType] || ['current', 'incoming', 'unresolved'];
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
  switch (conflictType) {
    case 'type_changed':
    case 'type_nullable_changed':
    case 'type_format_changed':
      return 'Type conflicts require explicit choice between current or incoming type.';
    
    case 'property_removed':
    case 'property_added':
      return 'Can keep current, use incoming, or combine both properties.';
    
    case 'array_items_added':
    case 'array_items_removed':
    case 'array_items_modified':
      return 'Array operations support union (combine), intersection (interpolate), or difference (extrapolate).';
    
    case 'object_properties_added':
    case 'object_properties_removed':
      return 'Object property conflicts support set operations for merging.';
    
    case 'value_changed_primitive':
      return 'Primitive values can be explicitly chosen or a custom value entered.';
    
    case 'enum_values_changed':
      return 'Enum conflicts support union (combine), intersection (interpolate), or symmetric difference (extrapolate).';
    
    case 'constraint_changed':
      return 'Constraint conflicts require explicit choice of which constraint to apply.';
    
    case 'description_changed':
      return 'Descriptions can be combined or one chosen explicitly.';
    
    default:
      return 'Available resolutions depend on the conflict type.';
  }
}
