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
  }))
}));

jest.mock('../../edgeGenerator', () => ({
  createEdge: jest.fn((source, target, label) => ({
    id: `${source}-${target}`,
    source,
    target,
    label: label || undefined
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
      info: { title: 'Test API', version: '1.0.0' },
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
    
    // Should create nodes for openapi, info, paths, components
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(4);
    
    // Check that nodes were created with correct names
    const nodeLabels = result.nodes.map(node => node.data.label);
    expect(nodeLabels).toContain('openapi');
    expect(nodeLabels).toContain('info');
    expect(nodeLabels).toContain('paths');
    expect(nodeLabels).toContain('components');
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
    
    expect(result.nodes).toHaveLength(3); // swagger, info, paths
    expect(result.edges).toHaveLength(3);
  });
});