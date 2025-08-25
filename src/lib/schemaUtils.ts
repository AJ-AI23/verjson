
import Ajv from 'ajv';
import metaSchema from 'ajv/lib/refs/json-schema-draft-07.json';

// Create a singleton instance of Ajv
const ajv = new Ajv({ allErrors: true });

// Only add the meta schema if it hasn't been added yet
// This check prevents the "schema already exists" error
if (!ajv.getSchema(metaSchema.$id)) {
  ajv.addMetaSchema(metaSchema);
}

export type SchemaType = 'json-schema' | 'oas-3.1';

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
    } else if (schemaType === 'oas-3.1') {
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
  } else if (schemaType === 'oas-3.1') {
    // For OpenAPI schemas, return the full schema to preserve OpenAPI structure
    console.log('Returning full OpenAPI schema for diagram visualization');
    return schema;
  }
  
  console.log('Schema did not match expected format, returning original');
  return schema;
};
