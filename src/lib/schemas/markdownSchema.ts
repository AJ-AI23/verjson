import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export const markdownSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://verjson.io/schemas/markdown.v1.json",
  "title": "VerjSON Markdown Document",
  "description": "A markdown document with hierarchical line indexing for version-friendly editing",
  "type": "object",
  "required": ["verjson", "type", "info", "data"],
  "properties": {
    "verjson": {
      "type": "string",
      "const": "1.0.0",
      "description": "VerjSON format version"
    },
    "type": {
      "type": "string",
      "const": "markdown",
      "description": "Document type identifier"
    },
    "info": {
      "$ref": "#/$defs/documentInfo"
    },
    "data": {
      "$ref": "#/$defs/markdownData"
    },
    "styles": {
      "type": "object",
      "description": "Optional styling configuration"
    },
    "selectedTheme": {
      "type": "string",
      "description": "Current active theme"
    }
  },
  "$defs": {
    "documentInfo": {
      "type": "object",
      "required": ["version", "title"],
      "properties": {
        "version": {
          "type": "string",
          "description": "Document version (semantic versioning)"
        },
        "title": {
          "type": "string",
          "description": "Document title"
        },
        "description": {
          "type": "string",
          "description": "Document description"
        },
        "author": {
          "type": "string",
          "description": "Document author"
        },
        "created": {
          "type": "string",
          "format": "date-time",
          "description": "Creation timestamp"
        },
        "modified": {
          "type": "string",
          "format": "date-time",
          "description": "Last modification timestamp"
        }
      }
    },
    "markdownData": {
      "type": "object",
      "required": ["pages"],
      "properties": {
        "pages": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/markdownPage"
          },
          "description": "Array of document pages"
        },
        "embeds": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/markdownEmbed"
          },
          "description": "Embedded content references"
        }
      }
    },
    "markdownPage": {
      "type": "object",
      "required": ["id", "lines"],
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique page identifier"
        },
        "title": {
          "type": "string",
          "description": "Page title"
        },
        "lines": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          },
          "description": "Hierarchical line content with dot-notation keys (e.g., '1', '1.1', '1.2.1')"
        }
      }
    },
    "markdownEmbed": {
      "type": "object",
      "required": ["id", "type", "ref"],
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique embed identifier"
        },
        "type": {
          "type": "string",
          "enum": ["image", "diagram"],
          "description": "Type of embedded content"
        },
        "ref": {
          "type": "string",
          "description": "Reference URI (storage:// for images, document:// for diagrams)"
        },
        "alt": {
          "type": "string",
          "description": "Alternative text for accessibility"
        },
        "caption": {
          "type": "string",
          "description": "Caption text"
        }
      }
    }
  }
};

// Initialize Ajv for validation
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export const validateMarkdown = ajv.compile(markdownSchema);

/**
 * Get all schema definitions
 */
export function getMarkdownSchemaDefinitions(): Record<string, any> {
  return markdownSchema.$defs || {};
}

/**
 * Get the schema for items within a specific array path
 */
export function getMarkdownArrayItemSchema(arrayPath: string): any {
  const definitions = getMarkdownSchemaDefinitions();
  
  if (arrayPath === 'data.pages') {
    return definitions.markdownPage;
  }
  if (arrayPath === 'data.embeds') {
    return definitions.markdownEmbed;
  }
  
  return null;
}

/**
 * Get the fixed type name for array items
 */
export function getMarkdownArrayItemTypeName(arrayPath: string): string | null {
  const typeMap: Record<string, string> = {
    'data.pages': 'page',
    'data.embeds': 'embed'
  };
  
  return typeMap[arrayPath] || null;
}

/**
 * Get schema for a specific property path
 */
export function getMarkdownPropertySchema(path: string): any {
  const parts = path.split('.');
  let current: any = markdownSchema;
  
  for (const part of parts) {
    if (current.properties && current.properties[part]) {
      current = current.properties[part];
    } else if (current.$ref) {
      const refPath = current.$ref.replace('#/$defs/', '');
      const definitions = getMarkdownSchemaDefinitions();
      current = definitions[refPath];
      if (current?.properties?.[part]) {
        current = current.properties[part];
      }
    } else {
      return null;
    }
  }
  
  return current;
}
