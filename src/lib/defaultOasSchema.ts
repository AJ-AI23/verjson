
export const defaultOasSchema = `{
  "openapi": "3.1.0",
  "info": {
    "title": "Sample API",
    "description": "A sample API to demonstrate OpenAPI 3.1 with JSON Schema",
    "version": "0.0.1"
  },
  "paths": {
    "/users": {
      "get": {
        "summary": "Returns a list of users",
        "responses": {
          "200": {
            "description": "A JSON array of user objects",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/User"
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "description": "The user ID"
          },
          "name": {
            "type": "string",
            "description": "The user's name"
          },
          "email": {
            "type": "string",
            "format": "email",
            "description": "The user's email"
          },
          "address": {
            "$ref": "#/components/schemas/Address"
          },
          "status": {
            "type": "string",
            "enum": ["active", "inactive", "pending"],
            "description": "User account status"
          }
        },
        "required": ["id", "name", "email"]
      },
      "Address": {
        "type": "object",
        "properties": {
          "street": {
            "type": "string"
          },
          "city": {
            "type": "string"
          },
          "zipCode": {
            "type": "string",
            "pattern": "^[0-9]{5}(?:-[0-9]{4})?$"
          }
        },
        "required": ["street", "city"]
      }
    }
  }
}`;
