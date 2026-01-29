
export const exampleSchema = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/your-schema.json",
  "title": "GenericObject",
  "description": "A generic schema blueprint for any JSON object.",
  "type": "object",
  "$notations": [
    {
      "id": "note-1",
      "timestamp": "2024-01-15T10:30:00Z",
      "user": "alice",
      "message": "This is the root schema - might need validation updates"
    }
  ],
  "properties": {
    "exampleString": {
      "type": "string",
      "description": "A simple string field",
      "customAttribute": "test value",
      "maxLength": 50,
      "$notations": [
        {
          "id": "note-2", 
          "timestamp": "2024-01-15T11:00:00Z",
          "user": "bob",
          "message": "Should we increase the maxLength to 100?"
        },
        {
          "id": "note-3",
          "timestamp": "2024-01-15T11:15:00Z", 
          "user": "alice",
          "message": "Good point, let's discuss this in the next review."
        }
      ]
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
          "type": "integer",
          "$notations": [
            {
              "id": "note-4",
              "timestamp": "2024-01-15T12:00:00Z",
              "user": "charlie", 
              "message": "This field needs better validation constraints"
            }
          ]
        }
      },
      "required": ["nestedField"]
    }
  },
  "required": ["exampleString", "exampleNumber"],
  "additionalProperties": false
}`;

export const defaultSchema = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "version": "0.0.1",
  "title": "My Schema",
  "type": "object",
  "properties": {
    
  }
}`;
