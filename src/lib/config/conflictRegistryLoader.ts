/**
 * Conflict Registry Loader
 * Loads and provides type-safe access to the VerJSON conflict registry
 */

import conflictRegistryJson from './verjson-conflict-registry.v1.json';
import { ConflictRegistry, ConflictDefinition, PreferenceDefinition, ConflictSeverity, ConflictResolution } from './types';

class ConflictRegistryLoader {
  private registry: ConflictRegistry;

  constructor() {
    this.registry = conflictRegistryJson as ConflictRegistry;
  }

  /**
   * Get all conflict types
   */
  getConflictTypes(): string[] {
    return Object.keys(this.registry.conflicts);
  }

  /**
   * Get conflict definition by type
   */
  getConflictDefinition(conflictType: string): ConflictDefinition | undefined {
    return this.registry.conflicts[conflictType];
  }

  /**
   * Get valid resolutions for a conflict type
   */
  getValidResolutions(conflictType: string): ConflictResolution[] {
    const definition = this.getConflictDefinition(conflictType);
    return definition?.resolutions || [];
  }

  /**
   * Get severity for a conflict type
   */
  getSeverity(conflictType: string): ConflictSeverity {
    const definition = this.getConflictDefinition(conflictType);
    return definition?.severity || 'medium';
  }

  /**
   * Check if conflict requires manual review
   */
  requiresManualReview(conflictType: string): boolean {
    const definition = this.getConflictDefinition(conflictType);
    return definition?.manualReview ?? true;
  }

  /**
   * Get applicable preferences for a conflict type
   */
  getApplicablePreferences(conflictType: string): string[] {
    const definition = this.getConflictDefinition(conflictType);
    return definition?.preferences || [];
  }

  /**
   * Get description template for a conflict type
   */
  getDescription(conflictType: string): string {
    const definition = this.getConflictDefinition(conflictType);
    return definition?.description || '';
  }

  /**
   * Check if a resolution is valid for a conflict type
   */
  isResolutionValid(conflictType: string, resolution: ConflictResolution): boolean {
    const validResolutions = this.getValidResolutions(conflictType);
    return validResolutions.includes(resolution);
  }

  /**
   * Get all preference definitions
   */
  getAllPreferences(): Record<string, PreferenceDefinition> {
    return this.registry.preferences;
  }

  /**
   * Get preference definition by key
   */
  getPreferenceDefinition(preferenceKey: string): PreferenceDefinition | undefined {
    return this.registry.preferences[preferenceKey];
  }

  /**
   * Get default value for a preference
   */
  getPreferenceDefault(preferenceKey: string): string | number | boolean | undefined {
    const definition = this.getPreferenceDefinition(preferenceKey);
    return definition?.default;
  }

  /**
   * Get template placeholders
   */
  getTemplatePlaceholders(): Record<string, string> {
    return this.registry.templatePlaceholders?.placeholders || {};
  }

  /**
   * Format conflict description with values
   */
  formatDescription(conflictType: string, values: Record<string, any>): string {
    let description = this.getDescription(conflictType);
    
    // Replace placeholders with actual values
    Object.entries(values).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      if (description.includes(placeholder)) {
        const formattedValue = typeof value === 'object' 
          ? JSON.stringify(value) 
          : String(value);
        description = description.replace(new RegExp(placeholder, 'g'), formattedValue);
      }
    });
    
    return description;
  }

  /**
   * Get registry version
   */
  getVersion(): string {
    return this.registry.version;
  }
}

// Export singleton instance
export const conflictRegistry = new ConflictRegistryLoader();
