import Ajv from 'ajv';

const diagramSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['version', 'type', 'metadata', 'data'],
  properties: {
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
      description: 'Semantic version of the diagram format'
    },
    type: {
      type: 'string',
      enum: ['sequence', 'flowchart'],
      description: 'Type of diagram'
    },
    metadata: {
      type: 'object',
      required: ['title'],
      properties: {
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
    data: {
      oneOf: [
        {
          $ref: '#/definitions/sequenceDiagramData'
        },
        {
          $ref: '#/definitions/flowchartData'
        }
      ]
    }
  },
  definitions: {
    sequenceDiagramData: {
      type: 'object',
      required: ['lifelines', 'nodes', 'edges'],
      properties: {
        lifelines: {
          type: 'array',
          items: { $ref: '#/definitions/lifeline' },
          description: 'Lifelines for organizing nodes'
        },
        nodes: {
          type: 'array',
          items: { $ref: '#/definitions/node' },
          description: 'Diagram nodes'
        },
        edges: {
          type: 'array',
          items: { $ref: '#/definitions/edge' },
          description: 'Connections between nodes'
        }
      }
    },
    flowchartData: {
      type: 'object',
      required: ['nodes', 'edges'],
      properties: {
        nodes: {
          type: 'array',
          items: { $ref: '#/definitions/node' },
          description: 'Diagram nodes'
        },
        edges: {
          type: 'array',
          items: { $ref: '#/definitions/edge' },
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
        color: {
          type: 'string',
          pattern: '^#[0-9A-Fa-f]{6}$',
          description: 'Hex color code'
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
        }
      }
    },
    anchor: {
      type: 'object',
      required: ['id', 'lifelineId', 'yPosition', 'anchorType'],
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
        yPosition: {
          type: 'number',
          description: 'Vertical position'
        },
        anchorType: {
          type: 'string',
          enum: ['source', 'target'],
          description: 'Anchor type'
        }
      }
    },
    node: {
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
          items: { $ref: '#/definitions/anchor' },
          description: 'Source and target anchors'
        },
        position: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' }
          },
          required: ['x', 'y']
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
          }
        }
      }
    },
    edge: {
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
    }
  }
};

const ajv = new Ajv({ allErrors: true });
export const validateDiagram = ajv.compile(diagramSchema);

export { diagramSchema };
