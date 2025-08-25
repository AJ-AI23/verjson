import { generateOpenApiLayout } from '../openApiLayout';

// Mock dependencies
jest.mock('../../nodeGenerator', () => ({
  createPropertyNode: jest.fn((name, schema, required, x, y, collapsed) => ({
    id: `prop-${name}`,
    type: 'schemaType',
    position: { x, y },
    data: {
      label: name,
      type: schema.type || 'object',
      description: schema.description || '',
      required: required.includes(name),
      isCollapsed: collapsed
    }
  })),
  createInfoNode: jest.fn((infoData, x, y) => ({
    id: 'info-node',
    type: 'info',
    position: { x, y },
    data: {
      title: infoData.title || 'API',
      version: infoData.version || '1.0.0',
      description: infoData.description,
      properties: []
    }
  })),
  createEndpointNode: jest.fn((path, pathData, x, y) => ({
    id: `endpoint-${path.replace(/[^\w]/g, '-')}`,
    type: 'endpoint',
    position: { x, y },
    data: {
      path,
      methods: []
    }
  })),
  createComponentsNode: jest.fn((schemasData, x, y) => ({
    id: 'components-node',
    type: 'components',
    position: { x, y },
    data: {
      schemasCount: Object.keys(schemasData).length,
      schemas: []
    }
  }))
}));

jest.mock('../../edgeGenerator', () => ({
  createEdge: jest.fn((source, target, label, animated, style, edgeType) => ({
    id: `${source}-${target}`,
    source,
    target,
    label: label || undefined,
    type: edgeType || 'default'
  }))
}));

describe('generateOpenApiLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty result for non-OpenAPI schema', () => {
    const schema = { type: 'object', properties: { test: { type: 'string' } } };
    const result = generateOpenApiLayout(schema, 5, {});
    
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('should return empty result when root is collapsed', () => {
    const openApiSchema = {
      openapi: '3.1.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {}
    };
    const collapsedPaths = { 'root': true };
    
    const result = generateOpenApiLayout(openApiSchema, 5, collapsedPaths);
    
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('should return empty result when root.properties is not expanded', () => {
    const openApiSchema = {
      openapi: '3.1.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {}
    };
    const collapsedPaths = { 'root': false }; // root expanded but properties not explicitly expanded
    
    const result = generateOpenApiLayout(openApiSchema, 5, collapsedPaths);
    
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('should generate nodes for OpenAPI properties when root.properties is expanded', () => {
    const openApiSchema = {
      openapi: '3.1.0',
      info: { title: 'Test API', version: '1.0.0', description: 'Test description' },
      paths: {
        '/users': {
          get: { summary: 'Get users' }
        }
      },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          }
        }
      }
    };
    const collapsedPaths = { 'root.properties': false };
    
    const result = generateOpenApiLayout(openApiSchema, 5, collapsedPaths);
    
    // Should create special nodes: info, components + endpoints
    expect(result.nodes.length).toBeGreaterThan(2);
    expect(result.edges.length).toBeGreaterThan(2);
    
    // Check that special nodes were created
    const nodeTypes = result.nodes.map(node => node.type);
    expect(nodeTypes).toContain('info');
    expect(nodeTypes).toContain('components');
    expect(nodeTypes).toContain('endpoint');
  });

  it('should handle components.schemas as JSON schemas', () => {
    const openApiSchema = {
      openapi: '3.1.0',
      info: { title: 'Test API', version: '1.0.0' },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          }
        }
      }
    };
    const collapsedPaths = { 
      'root.properties': false,
      'root.properties.components.properties': false 
    };
    
    const result = generateOpenApiLayout(openApiSchema, 5, collapsedPaths);
    
    // Should create nodes for openapi, info, components + schema nodes
    expect(result.nodes.length).toBeGreaterThan(2);
    expect(result.edges.length).toBeGreaterThan(2);
  });

  it('should detect OpenAPI schema with swagger field', () => {
    const swaggerSchema = {
      swagger: '2.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {}
    };
    const collapsedPaths = { 'root.properties': false };
    
    const result = generateOpenApiLayout(swaggerSchema, 5, collapsedPaths);
    
    expect(result.nodes.length).toBeGreaterThan(0); // Should create info node
    expect(result.edges.length).toBeGreaterThan(0);
  });
});