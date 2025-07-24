
export const defaultSchema = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/your-schema.json",
  "title": "GenericObject",
  "description": "A generic schema blueprint for any JSON object.",
  "type": "object",
  "properties": {
    "exampleString": {
      "type": "string",
      "description": "A simple string field",
      "customAttribute": "test value",
      "maxLength": 50
    },
    "exampleNumber": {
      "type": "number",
      "description": "A numeric field",
      "minimum": 0,
      "maximum": 100,
      "customValidation": true
    },
    "exampleBoolean": {
      "type": "boolean",
      "description": "A true/false flag"
    },
    "exampleArray": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "An array of strings"
    },
    "exampleObject": {
      "type": "object",
      "properties": {
        "nestedField": {
          "type": "integer"
        }
      },
      "required": ["nestedField"]
    }
  },
  "required": ["exampleString", "exampleNumber"],
  "additionalProperties": false
}`;
