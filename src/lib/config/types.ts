/**
 * TypeScript type definitions for VerJSON configuration files
 */

export type ConflictSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type ConflictResolution = 'current' | 'incoming' | 'combine' | 'custom' | 'unresolved' | 'interpolate' | 'extrapolate' | 'strictest';

export interface ConflictDefinition {
  severity: ConflictSeverity;
  resolutions: ConflictResolution[];
  manualReview: boolean;
  preferences?: string[];
  description: string;
}

export interface PreferenceDefinition {
  type: 'enum' | 'string' | 'integer' | 'number' | 'boolean';
  values?: string[];
  minimum?: number;
  maximum?: number;
  default: string | number | boolean;
  description: string;
}

export interface ConflictRegistry {
  $schema: string;
  $id: string;
  title: string;
  version: string;
  conflicts: Record<string, ConflictDefinition>;
  preferences: Record<string, PreferenceDefinition>;
  templatePlaceholders?: {
    description: string;
    placeholders: Record<string, string>;
  };
}

export interface MergeMode {
  description: string;
  preferredResolutionOrder: ConflictResolution[];
  severityThresholds: {
    autoResolve: ConflictSeverity[];
    requireManual: ConflictSeverity[];
  };
  defaultPreferencesOverrides: Record<string, string | number | boolean>;
}

export interface MergeModesConfig {
  $schema: string;
  $id: string;
  title: string;
  version: string;
  modes: Record<string, MergeMode>;
}
