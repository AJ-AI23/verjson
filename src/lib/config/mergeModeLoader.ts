/**
 * Merge Mode Loader
 * Loads and provides type-safe access to the VerJSON merge modes
 */

import mergeModesJson from './verjson-merge-modes.v1.json';
import { MergeModesConfig, MergeMode, ConflictSeverity, ConflictResolution } from './types';

export type MergeModeName = 'additive' | 'subtractive' | 'interpolate' | 'extrapolate';

class MergeModeLoader {
  private config: MergeModesConfig;

  constructor() {
    this.config = mergeModesJson as MergeModesConfig;
  }

  /**
   * Get all available merge mode names
   */
  getModeNames(): MergeModeName[] {
    return Object.keys(this.config.modes) as MergeModeName[];
  }

  /**
   * Get merge mode by name
   */
  getMode(modeName: MergeModeName): MergeMode | undefined {
    return this.config.modes[modeName];
  }

  /**
   * Get preferred resolution order for a mode
   */
  getPreferredResolutionOrder(modeName: MergeModeName): ConflictResolution[] {
    const mode = this.getMode(modeName);
    return mode?.preferredResolutionOrder || [];
  }

  /**
   * Get default preferences for a mode
   */
  getDefaultPreferences(modeName: MergeModeName): Record<string, string | number | boolean> {
    const mode = this.getMode(modeName);
    return mode?.defaultPreferencesOverrides || {};
  }

  /**
   * Check if severity should be auto-resolved in a mode
   */
  shouldAutoResolve(modeName: MergeModeName, severity: ConflictSeverity): boolean {
    const mode = this.getMode(modeName);
    return mode?.severityThresholds.autoResolve.includes(severity) ?? false;
  }

  /**
   * Check if severity requires manual review in a mode
   */
  requiresManual(modeName: MergeModeName, severity: ConflictSeverity): boolean {
    const mode = this.getMode(modeName);
    return mode?.severityThresholds.requireManual.includes(severity) ?? true;
  }

  /**
   * Get mode description
   */
  getDescription(modeName: MergeModeName): string {
    const mode = this.getMode(modeName);
    return mode?.description || '';
  }

  /**
   * Get suggested resolution for a conflict in a specific mode
   */
  getSuggestedResolution(modeName: MergeModeName, validResolutions: ConflictResolution[]): ConflictResolution | undefined {
    const preferredOrder = this.getPreferredResolutionOrder(modeName);
    
    // Find the first preferred resolution that's valid for this conflict
    for (const resolution of preferredOrder) {
      if (validResolutions.includes(resolution)) {
        return resolution;
      }
    }
    
    // Fallback to first valid resolution
    return validResolutions[0];
  }

  /**
   * Get config version
   */
  getVersion(): string {
    return this.config.version;
  }
}

// Export singleton instance
export const mergeModeLoader = new MergeModeLoader();
