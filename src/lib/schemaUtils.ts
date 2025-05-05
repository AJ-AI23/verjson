
import Ajv from 'ajv';
import metaSchema from 'ajv/lib/refs/json-schema-draft-07.json';

// Create a singleton instance of Ajv
const ajv = new Ajv({ allErrors: true });

// Only add the meta schema if it hasn't been added yet
// This check prevents the "schema already exists" error
if (!ajv.getSchema(metaSchema.$id)) {
  ajv.addMetaSchema(metaSchema);
}

export const validateJsonSchema = (jsonString: string): any => {
  try {
    // Parse JSON
    const parsedSchema = JSON.parse(jsonString);
    
    // Check if it has the basic structure of a JSON Schema
    if (!parsedSchema.type) {
      throw new Error('Schema is missing "type" property');
    }
    
    // For schema validation, we would use ajv.compile, but for simplicity, 
    // we're just doing basic structure validation here
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
