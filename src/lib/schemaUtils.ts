
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
        throw new Error('Schema is missing "type" property');
      }
    } else if (schemaType === 'oas-3.1') {
      // Check if it has the basic structure of an OAS 3.1 document
      if (!parsedSchema.openapi) {
        throw new Error('Schema is missing "openapi" property');
      }
      
      if (!parsedSchema.components?.schemas) {
        throw new Error('Schema is missing "components.schemas" section');
      }
    }
    
    return parsedSchema;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
    throw e;
  }
};

export const parseJsonSchema = (jsonString: string): any => {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return null;
  }
};

export const formatJsonSchema = (schema: any): string => {
  try {
    return JSON.stringify(schema, null, 2);
  } catch (e) {
    return '';
  }
};

// Extract schema components from OAS schema for diagram visualization
export const extractSchemaComponents = (schema: any, schemaType: SchemaType = 'json-schema'): any => {
  if (schemaType === 'json-schema') {
    return schema;
  } else if (schemaType === 'oas-3.1' && schema?.components?.schemas) {
    // For OAS, we'll visualize the schema components
    // Create a root object that points to all the schemas
    return {
      type: "object",
      title: "API Schemas",
      description: "Components from OpenAPI specification",
      properties: schema.components.schemas
    };
  }
  return schema;
};
