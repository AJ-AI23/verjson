/**
 * Conflict Resolution Rules
 * Dynamically loaded from VerJSON Conflict Registry
 */

import { conflictRegistry } from './config';
import { MergeConflict } from './documentMergeEngine';

/**
 * Get valid resolutions for a conflict type from the registry
 */
export function getValidResolutions(conflictType: MergeConflict['type']): MergeConflict['resolution'][] {
  return conflictRegistry.getValidResolutions(conflictType) as MergeConflict['resolution'][];
}

/**
 * Get severity level for a conflict type from the registry
 */
export function getConflictSeverity(
  conflictType: MergeConflict['type']
): MergeConflict['severity'] {
  return conflictRegistry.getSeverity(conflictType);
}

/**
 * Check if a conflict type requires manual review from the registry
 */
export function requiresManualReview(conflictType: MergeConflict['type']): boolean {
  return conflictRegistry.requiresManualReview(conflictType);
}

/**
 * Check if a resolution is valid for a conflict type
 */
export function isResolutionValid(
  conflictType: MergeConflict['type'],
  resolution: MergeConflict['resolution']
): boolean {
  return conflictRegistry.isResolutionValid(conflictType, resolution);
}

/**
 * Get explanation for why certain resolutions are available
 */
export function getResolutionExplanation(conflictType: MergeConflict['type']): string {
  // Get description from registry
  const description = conflictRegistry.getDescription(conflictType);
  if (description) {
    return description;
  }
  
  // Fallback for unknown conflict types
  return 'Available resolutions depend on the conflict type and your merge strategy.';
}

// Legacy exports for backward compatibility
export const CONFLICT_RESOLUTION_RULES: Record<string, MergeConflict['resolution'][]> = 
  Object.fromEntries(
    conflictRegistry.getConflictTypes().map(type => [
      type,
      conflictRegistry.getValidResolutions(type)
    ])
  );

export const CONFLICT_SEVERITY: Record<string, MergeConflict['severity']> = 
  Object.fromEntries(
    conflictRegistry.getConflictTypes().map(type => [
      type,
      conflictRegistry.getSeverity(type)
    ])
  );

export const REQUIRES_MANUAL_REVIEW: Record<string, boolean> = 
  Object.fromEntries(
    conflictRegistry.getConflictTypes().map(type => [
      type,
      conflictRegistry.requiresManualReview(type)
    ])
  );
