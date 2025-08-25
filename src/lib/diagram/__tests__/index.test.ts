
import { generateNodesAndEdges } from '../index';

// Mock layout generators
jest.mock('../layout/groupedPropertiesLayout', () => ({
  generateGroupedLayout: jest.fn().mockReturnValue({
    nodes: [{ id: 'group-node', type: 'schemaType' }],
    edges: [{ id: 'group-edge', source: 'root', target: 'group-node' }]
  })
}));

jest.mock('../layout/expandedPropertiesLayout', () => ({
  generateExpandedLayout: jest.fn().mockReturnValue({
    nodes: [{ id: 'prop-node', type: 'schemaType' }],
    edges: [{ id: 'prop-edge', source: 'root', target: 'prop-node' }]
  })
}));

jest.mock('../layout/openApiLayout', () => ({
  generateOpenApiLayout: jest.fn().mockReturnValue({
    nodes: [{ id: 'openapi-node', type: 'schemaType' }],
    edges: [{ id: 'openapi-edge', source: 'root', target: 'openapi-node' }]
  })
}));

// Mock node generator
jest.mock('../nodeGenerator', () => ({
  createRootNode: jest.fn().mockReturnValue({
    id: 'root',
    type: 'schemaType',
    position: { x: 0, y: 0 },
    data: { label: 'Root Schema' }
  })
}));

describe('generateNodesAndEdges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should return empty result for invalid schema', () => {
    const result = generateNodesAndEdges(null, false, 1);
    expect(result).toEqual({ nodes: [], edges: [] });
  });
  
  it('should call createRootNode for valid schema', () => {
    const { createRootNode } = require('../nodeGenerator');
    
    generateNodesAndEdges({ type: 'object' }, false, 1);
    
    expect(createRootNode).toHaveBeenCalled();
  });
  
  it('should call generateGroupedLayout when groupProperties is true', () => {
    const { generateGroupedLayout } = require('../layout/groupedPropertiesLayout');
    
    const schema = {
      type: 'object',
      properties: {}
    };
    
    const result = generateNodesAndEdges(schema, true, 1);
    
    expect(generateGroupedLayout).toHaveBeenCalled();
    expect(result.nodes.length).toBe(2); // Root node + group node
    expect(result.edges.length).toBe(1); // Group edge
  });
  
  it('should call generateExpandedLayout when groupProperties is false', () => {
    const { generateExpandedLayout } = require('../layout/expandedPropertiesLayout');
    
    const schema = {
      type: 'object',
      properties: {}
    };
    
    const result = generateNodesAndEdges(schema, false, 1);
    
    expect(generateExpandedLayout).toHaveBeenCalled();
    expect(result.nodes.length).toBe(2); // Root node + prop node
    expect(result.edges.length).toBe(1); // Prop edge
  });
  
  it('should use OpenAPI layout for OpenAPI schemas', () => {
    const { generateOpenApiLayout } = require('../layout/openApiLayout');
    const { generateGroupedLayout } = require('../layout/groupedPropertiesLayout');
    const { generateExpandedLayout } = require('../layout/expandedPropertiesLayout');
    
    const openApiSchema = { 
      openapi: '3.1.0', 
      info: { title: 'Test API', version: '1.0.0' },
      paths: {}
    };
    
    const result = generateNodesAndEdges(openApiSchema, false, 5, {});
    
    // For OpenAPI schemas, OpenAPI layout should be called
    expect(generateOpenApiLayout).toHaveBeenCalledWith(openApiSchema, 5, {});
    // Neither grouped nor expanded layout should be called
    expect(generateGroupedLayout).not.toHaveBeenCalled();
    expect(generateExpandedLayout).not.toHaveBeenCalled();
    
    expect(result.nodes.length).toBe(2); // Root node + openapi node
    expect(result.edges.length).toBe(1); // OpenAPI edge
  });
  
  it('should pass maxDepth parameter to layout generators', () => {
    const { generateExpandedLayout } = require('../layout/expandedPropertiesLayout');
    const { generateGroupedLayout } = require('../layout/groupedPropertiesLayout');
    
    const schema = {
      type: 'object',
      properties: {}
    };
    
    // Test with expanded layout
    generateNodesAndEdges(schema, false, 5);
    expect(generateExpandedLayout).toHaveBeenCalledWith(schema, 5, undefined);
    
    jest.clearAllMocks();
    
    // Test with grouped layout
    generateNodesAndEdges(schema, true, 4);
    expect(generateGroupedLayout).toHaveBeenCalledWith(schema, 4, undefined);
  });
});
