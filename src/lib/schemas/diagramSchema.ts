import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * VerjSON Diagram Schema v1.0.0
 * 
 * This is the authoritative schema for VerjSON diagram documents.
 * Keep in sync with public/api/diagram-schema.v1.json
 */
export const diagramSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://verjson.lovable.app/schemas/diagram/v1.0.0',
  title: 'VerjSON Diagram Schema',
  description: 'Schema for VerjSON diagram documents (sequence diagrams and flowcharts)',
  type: 'object',
  required: ['verjson', 'type', 'info', 'data'],
  properties: {
    verjson: {
      type: 'string',
      const: '1.0.0',
      description: 'VerjSON format version - always "1.0.0" for this schema version'
    },
    type: {
      type: 'string',
      enum: ['sequence', 'flowchart'],
      description: 'Type of diagram'
    },
    info: {
      $ref: '#/definitions/info'
    },
    selectedTheme: {
      type: 'string',
      description: 'Currently active theme (e.g., "light" or "dark")'
    },
    data: {
      oneOf: [
        { $ref: '#/definitions/sequenceDiagramData' },
        { $ref: '#/definitions/flowchartData' }
      ]
    },
    styles: {
      $ref: '#/definitions/diagramStyles'
    }
  },
  definitions: {
    info: {
      type: 'object',
      required: ['version', 'title'],
      properties: {
        version: {
          type: 'string',
          pattern: '^\\d+\\.\\d+\\.\\d+$',
          description: 'Document version (semantic versioning)'
        },
        title: {
          type: 'string',
          minLength: 1,
          description: 'Title of the diagram'
        },
        description: {
          type: 'string',
          description: 'Optional description'
        },
        author: {
          type: 'string',
          description: 'Author of the diagram'
        },
        created: {
          type: 'string',
          format: 'date-time',
          description: 'Creation timestamp'
        },
        modified: {
          type: 'string',
          format: 'date-time',
          description: 'Last modification timestamp'
        }
      }
    },
    sequenceDiagramData: {
      type: 'object',
      required: ['lifelines', 'nodes'],
      properties: {
        lifelines: {
          type: 'array',
          items: { $ref: '#/definitions/lifeline' },
          description: 'Lifelines for organizing nodes'
        },
        nodes: {
          type: 'array',
          items: { $ref: '#/definitions/diagramNode' },
          description: 'Diagram nodes representing interactions'
        },
        processes: {
          type: 'array',
          items: { $ref: '#/definitions/processNode' },
          description: 'Process nodes spanning multiple anchors'
        }
      }
    },
    flowchartData: {
      type: 'object',
      required: ['nodes', 'edges'],
      properties: {
        nodes: {
          type: 'array',
          items: { $ref: '#/definitions/diagramNode' },
          description: 'Diagram nodes'
        },
        edges: {
          type: 'array',
          items: { $ref: '#/definitions/diagramEdge' },
          description: 'Connections between nodes'
        }
      }
    },
    lifeline: {
      type: 'object',
      required: ['id', 'name', 'order'],
      properties: {
        id: {
          type: 'string',
          minLength: 1,
          description: 'Unique identifier'
        },
        name: {
          type: 'string',
          minLength: 1,
          description: 'Lifeline name'
        },
        order: {
          type: 'number',
          minimum: 0,
          description: 'Display order'
        },
        width: {
          type: 'number',
          minimum: 100,
          description: 'Lifeline width in pixels'
        },
        description: {
          type: 'string',
          description: 'Optional description'
        },
        color: {
          type: 'string',
          pattern: '^#[0-9A-Fa-f]{6}$',
          description: 'Hex color code'
        },
        anchorColor: {
          type: 'string',
          pattern: '^#[0-9A-Fa-f]{6}$',
          description: 'Anchor color override'
        }
      }
    },
    anchorNode: {
      type: 'object',
      required: ['id', 'lifelineId', 'anchorType'],
      properties: {
        id: {
          type: 'string',
          minLength: 1,
          description: 'Unique anchor identifier'
        },
        lifelineId: {
          type: 'string',
          minLength: 1,
          description: 'Reference to lifeline ID'
        },
        anchorType: {
          type: 'string',
          enum: ['source', 'target'],
          description: 'Anchor type (source or target of interaction)'
        },
        processId: {
          type: 'string',
          description: 'ID of the process this anchor belongs to (if any)'
        }
      }
    },
    diagramNode: {
      type: 'object',
      required: ['id', 'type', 'label', 'anchors'],
      properties: {
        id: {
          type: 'string',
          minLength: 1,
          description: 'Unique node identifier'
        },
        type: {
          type: 'string',
          enum: ['endpoint', 'process', 'decision', 'data', 'custom'],
          description: 'Node type'
        },
        label: {
          type: 'string',
          minLength: 1,
          description: 'Node label'
        },
        description: {
          type: 'string',
          description: 'Node description'
        },
        anchors: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: { $ref: '#/definitions/anchorNode' },
          description: 'Source and target anchors'
        },
        yPosition: {
          type: 'number',
          description: 'Vertical position in the diagram'
        },
        data: {
          type: 'object',
          properties: {
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
              description: 'HTTP method for endpoint nodes'
            },
            path: {
              type: 'string',
              description: 'API path for endpoint nodes'
            },
            openApiRef: {
              type: 'object',
              required: ['documentId', 'path', 'method'],
              properties: {
                documentId: { type: 'string' },
                path: { type: 'string' },
                method: { type: 'string' }
              },
              description: 'Reference to OpenAPI document endpoint'
            },
            icon: {
              type: 'string',
              description: 'Icon name or URL'
            },
            color: {
              type: 'string',
              description: 'Custom color'
            }
          },
          additionalProperties: true
        }
      }
    },
    processNode: {
      type: 'object',
      required: ['id', 'type', 'lifelineId', 'anchorIds', 'description'],
      properties: {
        id: {
          type: 'string',
          minLength: 1,
          description: 'Unique process identifier'
        },
        type: {
          type: 'string',
          const: 'lifelineProcess',
          description: 'Process type'
        },
        lifelineId: {
          type: 'string',
          minLength: 1,
          description: 'ID of the lifeline this process belongs to'
        },
        anchorIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of anchor IDs connected to this process'
        },
        description: {
          type: 'string',
          description: 'Process description'
        },
        parallelIndex: {
          type: 'number',
          minimum: 0,
          maximum: 2,
          description: 'Index for parallel process positioning (0-2)'
        },
        color: {
          type: 'string',
          description: 'Optional custom color'
        }
      }
    },
    diagramEdge: {
      type: 'object',
      required: ['id', 'source', 'target'],
      properties: {
        id: {
          type: 'string',
          minLength: 1,
          description: 'Unique edge identifier'
        },
        source: {
          type: 'string',
          minLength: 1,
          description: 'Source node ID'
        },
        target: {
          type: 'string',
          minLength: 1,
          description: 'Target node ID'
        },
        label: {
          type: 'string',
          description: 'Edge label'
        },
        type: {
          type: 'string',
          enum: ['default', 'sync', 'async', 'return'],
          description: 'Edge type'
        },
        animated: {
          type: 'boolean',
          description: 'Whether edge is animated'
        },
        style: {
          type: 'object',
          properties: {
            stroke: { type: 'string' },
            strokeWidth: { type: 'number' },
            strokeDasharray: { type: 'string' }
          }
        }
      }
    },
    diagramStyles: {
      type: 'object',
      properties: {
        themes: {
          type: 'object',
          additionalProperties: { $ref: '#/definitions/diagramTheme' },
          description: 'Named theme configurations'
        }
      }
    },
    diagramTheme: {
      type: 'object',
      properties: {
        background: { type: 'string' },
        nodeBackground: { type: 'string' },
        nodeBorder: { type: 'string' },
        nodeText: { type: 'string' },
        edgeColor: { type: 'string' },
        lifelineColors: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              background: { type: 'string' },
              anchorColor: { type: 'string' },
              anchorBorder: { type: 'string' },
              processColor: { type: 'string' }
            }
          }
        }
      }
    }
  }
};

// Helper to get schema definitions for use in structure editor
export const getDiagramSchemaDefinitions = () => diagramSchema.definitions;

// Helper to get item schema for a specific array path
export const getDiagramArrayItemSchema = (arrayPath: string): Record<string, any> | null => {
  const definitions = diagramSchema.definitions as Record<string, any>;
  
// Map array paths to their item schema definitions
  const pathToSchema: Record<string, string> = {
    'data.lifelines': 'lifeline',
    'data.nodes': 'diagramNode',
    'data.processes': 'processNode',
    'data.edges': 'diagramEdge',
  };
  
  const schemaKey = pathToSchema[arrayPath];
  if (schemaKey && definitions[schemaKey]) {
    return definitions[schemaKey];
  }
  
  return null;
};

// Get the fixed type name for diagram array items (returns null if type is not fixed/single)
export const getDiagramArrayItemTypeName = (arrayPath: string): string | null => {
  const pathToTypeName: Record<string, string> = {
    'data.lifelines': 'lifeline',
    'data.nodes': 'diagramNode',
    'data.processes': 'processNode',
    'data.edges': 'diagramEdge',
  };
  
  return pathToTypeName[arrayPath] || null;
};

// Get property schema for diagram fields
export const getDiagramPropertySchema = (path: string): Record<string, any> | null => {
  const parts = path.split('.');
  let current: any = diagramSchema;
  
  for (const part of parts) {
    if (current.properties?.[part]) {
      current = current.properties[part];
    } else if (current.$ref) {
      const refPath = current.$ref.replace('#/definitions/', '');
      current = (diagramSchema.definitions as Record<string, any>)[refPath];
      if (current?.properties?.[part]) {
        current = current.properties[part];
      }
    } else {
      return null;
    }
  }
  
  // Resolve $ref if present
  if (current?.$ref) {
    const refPath = current.$ref.replace('#/definitions/', '');
    return (diagramSchema.definitions as Record<string, any>)[refPath] || null;
  }
  
  return current || null;
};

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
export const validateDiagram = ajv.compile(diagramSchema);
