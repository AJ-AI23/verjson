
import Ajv from 'ajv';
import metaSchemaDraft07 from 'ajv/lib/refs/json-schema-draft-07.json';
import addFormats from 'ajv-formats';

// Create a singleton instance of Ajv with support for multiple drafts
const ajv = new Ajv({ 
  allErrors: true,
  strict: false, // Allow newer features
  loadSchema: async (uri: string) => {
    // Handle loading of remote schemas
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to load schema from ${uri}:`, error);
      throw error;
    }
  }
});
addFormats(ajv);

// Add draft-07 meta-schema
if (!ajv.getSchema(metaSchemaDraft07.$id)) {
  ajv.addMetaSchema(metaSchemaDraft07);
}

// Add support for draft 2020-12 meta-schema
const draft202012MetaSchemaUrl = 'https://json-schema.org/draft/2020-12/schema';
try {
  // Try to add the 2020-12 meta-schema if not already present
  if (!ajv.getSchema(draft202012MetaSchemaUrl)) {
    // We'll load this dynamically when needed
  }
} catch (e) {
  console.warn('Could not pre-load draft 2020-12 meta-schema:', e);
}

export type SchemaType = 'json-schema' | 'openapi';

export const validateJsonSchema = (jsonString: string, schemaType: SchemaType = 'json-schema'): any => {
  try {
    // Parse JSON
    const parsedSchema = JSON.parse(jsonString);
    
    // Validate based on schema type
    if (schemaType === 'json-schema') {
      // Check if it has the basic structure of a JSON Schema
      if (!parsedSchema.type) {
        console.warn('Schema is missing "type" property');
        throw new Error('Schema is missing "type" property');
      }
    } else if (schemaType === 'openapi') {
      // Check if it has the basic structure of an OAS 3.1 document
      if (!parsedSchema.openapi) {
        console.warn('Schema is missing "openapi" property');
        throw new Error('Schema is missing "openapi" property');
      }
      
      if (!parsedSchema.components?.schemas) {
        console.warn('Schema is missing "components.schemas" section');
        throw new Error('Schema is missing "components.schemas" section');
      }
    }
    
    return parsedSchema;
  } catch (e) {
    if (e instanceof SyntaxError) {
      // Provide more user-friendly JSON syntax error message
      const lineMatch = e.message.match(/at position (\d+)/);
      if (lineMatch && lineMatch[1]) {
        const position = parseInt(lineMatch[1], 10);
        // Calculate approximate line and column
        const upToError = jsonString.substring(0, position);
        const lines = upToError.split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;
        throw new Error(`JSON Syntax Error at line ${line}, column ${column}: ${e.message}`);
      } else {
        throw new Error(`Invalid JSON: ${e.message}`);
      }
    }
    throw e;
  }
};

export const parseJsonSchema = (jsonString: string): any => {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse JSON schema:', e);
    return null;
  }
};

export const formatJsonSchema = (schema: any): string => {
  try {
    return JSON.stringify(schema, null, 2);
  } catch (e) {
    console.error('Failed to format JSON schema:', e);
    return '';
  }
};

export const detectSchemaType = (schema: any): SchemaType => {
  if (!schema || typeof schema !== 'object') {
    return 'json-schema'; // Default fallback
  }
  
  // Check for OpenAPI indicators
  if (schema.openapi || schema.swagger) {
    return 'openapi';
  }
  
  // Check for typical OpenAPI structure
  if (schema.info && (schema.paths || schema.components)) {
    return 'openapi';
  }
  
  // Default to JSON Schema if no OpenAPI indicators
  return 'json-schema';
};

export const extractSchemaComponents = (schema: any, schemaType: SchemaType = 'json-schema'): any => {
  console.log('Extracting schema components for type:', schemaType);
  
  if (!schema) {
    console.error('Schema is null or undefined in extractSchemaComponents');
    return null;
  }
  
  if (schemaType === 'json-schema') {
    // For JSON Schema, return the schema directly
    console.log('Returning JSON schema directly');
    return schema;
  } else if (schemaType === 'openapi') {
    // For OpenAPI schemas, return the full schema to preserve OpenAPI structure
    console.log('Returning full OpenAPI schema for diagram visualization');
    return schema;
  }
  
  console.log('Schema did not match expected format, returning original');
  return schema;
};

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

export const validateSyntax = async (jsonString: string): Promise<ValidationResult> => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  try {
    // First, validate JSON syntax
    const parsedSchema = JSON.parse(jsonString);
    
    // Detect schema type
    const schemaType = detectSchemaType(parsedSchema);
    
    if (schemaType === 'json-schema') {
      return await validateJsonSchemaSyntax(parsedSchema);
    } else if (schemaType === 'openapi') {
      return validateOpenAPISyntax(parsedSchema);
    }
    
    result.warnings.push({
      path: 'root',
      message: 'Unable to determine schema type',
      suggestion: 'Ensure your schema follows JSON Schema or OpenAPI specifications'
    });
    
  } catch (e) {
    result.isValid = false;
    if (e instanceof SyntaxError) {
      const lineMatch = e.message.match(/at position (\d+)/);
      if (lineMatch && lineMatch[1]) {
        const position = parseInt(lineMatch[1], 10);
        const upToError = jsonString.substring(0, position);
        const lines = upToError.split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;
        result.errors.push({
          path: `line ${line}, column ${column}`,
          message: `JSON Syntax Error: ${e.message}`,
          severity: 'error'
        });
      } else {
        result.errors.push({
          path: 'root',
          message: `Invalid JSON: ${e.message}`,
          severity: 'error'
        });
      }
    } else {
      result.errors.push({
        path: 'root',
        message: `Validation error: ${e instanceof Error ? e.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }
  
  return result;
};

const validateJsonSchemaSyntax = async (schema: any): Promise<ValidationResult> => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  try {
    // Check schema version and handle accordingly
    const schemaVersion = schema.$schema;
    
    if (schemaVersion && schemaVersion.includes('2020-12')) {
      // For JSON Schema 2020-12, use basic validation since the meta-schema is complex
      result.warnings.push({
        path: '$schema',
        message: 'Using basic validation for JSON Schema 2020-12',
        suggestion: 'Full 2020-12 meta-schema validation requires complex reference resolution'
      });
      
      // Perform basic structural validation
      return validateBasicJsonSchemaStructure(schema);
    } else {
      // For older versions (draft-07 and earlier), use AJV validation
      const isValid = ajv.validateSchema(schema);
      
      if (!isValid && ajv.errors) {
        result.isValid = false;
        ajv.errors.forEach(error => {
          result.errors.push({
            path: error.instancePath || error.schemaPath || 'root',
            message: `${error.message}`,
            severity: 'error'
          });
        });
      }
    }

    // Additional JSON Schema best practices checks
    if (!schema.$schema) {
      result.warnings.push({
        path: 'root',
        message: 'Missing $schema property',
        suggestion: 'Add "$schema": "https://json-schema.org/draft/2020-12/schema" to specify the JSON Schema version'
      });
    }

    if (!schema.title) {
      result.warnings.push({
        path: 'root',
        message: 'Missing title property',
        suggestion: 'Add a "title" property to describe what this schema represents'
      });
    }

    if (!schema.description) {
      result.warnings.push({
        path: 'root',
        message: 'Missing description property',
        suggestion: 'Add a "description" property to explain the purpose of this schema'
      });
    }

    // Check for required properties when type is object
    if (schema.type === 'object' && schema.properties && !schema.required) {
      result.warnings.push({
        path: 'root',
        message: 'Object type without required properties',
        suggestion: 'Consider adding a "required" array to specify which properties are mandatory'
      });
    }

  } catch (error) {
    result.isValid = false;
    result.errors.push({
      path: 'root',
      message: `JSON Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error'
    });
  }

  return result;
};

// Basic structural validation for JSON Schema 2020-12
const validateBasicJsonSchemaStructure = (schema: any): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check basic JSON Schema structure
  if (typeof schema !== 'object' || schema === null) {
    result.isValid = false;
    result.errors.push({
      path: 'root',
      message: 'Schema must be an object',
      severity: 'error'
    });
    return result;
  }

  // Check for valid type values
  if (schema.type) {
    const validTypes = ['null', 'boolean', 'object', 'array', 'number', 'string', 'integer'];
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    
    types.forEach((type: string) => {
      if (!validTypes.includes(type)) {
        result.errors.push({
          path: 'type',
          message: `Invalid type "${type}". Valid types are: ${validTypes.join(', ')}`,
          severity: 'error'
        });
      }
    });
  }

  // Check properties structure
  if (schema.properties && typeof schema.properties !== 'object') {
    result.errors.push({
      path: 'properties',
      message: 'Properties must be an object',
      severity: 'error'
    });
  }

  // Check required array
  if (schema.required && !Array.isArray(schema.required)) {
    result.errors.push({
      path: 'required',
      message: 'Required must be an array',
      severity: 'error'
    });
  }

  // Check items structure
  if (schema.items && typeof schema.items !== 'object' && typeof schema.items !== 'boolean') {
    result.errors.push({
      path: 'items',
      message: 'Items must be an object or boolean',
      severity: 'error'
    });
  }

  // Add best practice warnings
  if (!schema.title) {
    result.warnings.push({
      path: 'root',
      message: 'Missing title property',
      suggestion: 'Add a "title" property to describe what this schema represents'
    });
  }

  if (!schema.description) {
    result.warnings.push({
      path: 'root',
      message: 'Missing description property',
      suggestion: 'Add a "description" property to explain the purpose of this schema'
    });
  }

  if (result.errors.length > 0) {
    result.isValid = false;
  }

  return result;
};

const validateOpenAPISyntax = (schema: any): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check required OpenAPI fields
  if (!schema.openapi) {
    result.isValid = false;
    result.errors.push({
      path: 'root',
      message: 'Missing required "openapi" property',
      severity: 'error'
    });
  } else {
    // Check OpenAPI version format
    const versionRegex = /^3\.\d+\.\d+$/;
    if (!versionRegex.test(schema.openapi)) {
      result.errors.push({
        path: 'openapi',
        message: 'Invalid OpenAPI version format',
        severity: 'error'
      });
    }
  }

  if (!schema.info) {
    result.isValid = false;
    result.errors.push({
      path: 'root',
      message: 'Missing required "info" object',
      severity: 'error'
    });
  } else {
    if (!schema.info.title) {
      result.isValid = false;
      result.errors.push({
        path: 'info',
        message: 'Missing required "title" property in info object',
        severity: 'error'
      });
    }
    if (!schema.info.version) {
      result.isValid = false;
      result.errors.push({
        path: 'info',
        message: 'Missing required "version" property in info object',
        severity: 'error'
      });
    }
  }

  // Check for either paths or webhooks (required in 3.1)
  if (!schema.paths && !schema.webhooks) {
    result.warnings.push({
      path: 'root',
      message: 'Missing "paths" or "webhooks" object',
      suggestion: 'OpenAPI documents should define API paths or webhooks'
    });
  }

  // Validate paths structure if present
  if (schema.paths) {
    Object.keys(schema.paths).forEach(path => {
      if (!path.startsWith('/')) {
        result.errors.push({
          path: `paths.${path}`,
          message: 'Path must start with "/"',
          severity: 'error'
        });
      }
    });
  }

  // Check components structure
  if (schema.components) {
    const validComponentTypes = ['schemas', 'responses', 'parameters', 'examples', 'requestBodies', 'headers', 'securitySchemes', 'links', 'callbacks'];
    Object.keys(schema.components).forEach(componentType => {
      if (!validComponentTypes.includes(componentType)) {
        result.warnings.push({
          path: `components.${componentType}`,
          message: `Unknown component type "${componentType}"`,
          suggestion: `Valid component types are: ${validComponentTypes.join(', ')}`
        });
      }
    });
  }

  return result;
};
