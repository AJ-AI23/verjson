import { NotationComment } from '@/types/notations';

/**
 * Extracts $notations from a schema property
 */
export const extractNotations = (schema: any): NotationComment[] => {
  if (!schema || !schema.$notations || !Array.isArray(schema.$notations)) {
    return [];
  }

  return schema.$notations.map((notation: any, index: number) => ({
    id: notation.id || `notation-${index}-${Date.now()}`,
    timestamp: notation.timestamp || new Date().toISOString(),
    user: notation.user || 'unknown',
    message: notation.message || ''
  }));
};

/**
 * Checks if a schema property has notations
 */
export const hasNotations = (schema: any): boolean => {
  return schema?.$notations && Array.isArray(schema.$notations) && schema.$notations.length > 0;
};

/**
 * Gets the count of notations for a schema property
 */
export const getNotationCount = (schema: any): number => {
  return hasNotations(schema) ? schema.$notations.length : 0;
};

/**
 * Standard JSON Schema properties that should be excluded from additional properties
 */
export const STANDARD_SCHEMA_PROPS = [
  'type', 'description', 'properties', 'items', 'required', 'format', 
  'minItems', 'maxItems', '$ref', 'enum', 'const', 'examples', 'default',
  'minimum', 'maximum', 'pattern', 'minLength', 'maxLength', 'additionalProperties',
  '$comment', '$notations' // Include $notations as a standard prop to exclude
];