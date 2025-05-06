
import { generateNodesAndEdges } from '../index';

// Mock layout generators
jest.mock('../groupedPropertiesLayout', () => ({
  generateGroupedLayout: jest.fn().mockReturnValue({
    nodes: [{ id: 'group-node', type: 'schemaType' }],
    edges: [{ id: 'group-edge', source: 'root', target: 'group-node' }]
  })
}));

jest.mock('../expandedPropertiesLayout', () => ({
  generateExpandedLayout: jest.fn().mockReturnValue({
    nodes: [{ id: 'prop-node', type: 'schemaType' }],
    edges: [{ id: 'prop-edge', source: 'root', target: 'prop-node' }]
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
    const result = generateNodesAndEdges(null);
    expect(result).toEqual({ nodes: [], edges: [] });
  });
  
  it('should call createRootNode for valid schema', () => {
    const { createRootNode } = require('../nodeGenerator');
    
    generateNodesAndEdges({ type: 'object' });
    
    expect(createRootNode).toHaveBeenCalled();
  });
  
  it('should call generateGroupedLayout when groupProperties is true', () => {
    const { generateGroupedLayout } = require('../groupedPropertiesLayout');
    
    const schema = {
      type: 'object',
      properties: {}
    };
    
    const result = generateNodesAndEdges(schema, true);
    
    expect(generateGroupedLayout).toHaveBeenCalled();
    expect(result.nodes.length).toBe(2); // Root node + group node
    expect(result.edges.length).toBe(1); // Group edge
  });
  
  it('should call generateExpandedLayout when groupProperties is false', () => {
    const { generateExpandedLayout } = require('../expandedPropertiesLayout');
    
    const schema = {
      type: 'object',
      properties: {}
    };
    
    const result = generateNodesAndEdges(schema, false);
    
    expect(generateExpandedLayout).toHaveBeenCalled();
    expect(result.nodes.length).toBe(2); // Root node + prop node
    expect(result.edges.length).toBe(1); // Prop edge
  });
  
  it('should pass maxDepth parameter to layout generators', () => {
    const { generateExpandedLayout } = require('../expandedPropertiesLayout');
    const { generateGroupedLayout } = require('../groupedPropertiesLayout');
    
    const schema = {
      type: 'object',
      properties: {}
    };
    
    // Test with expanded layout
    generateNodesAndEdges(schema, false, 5);
    expect(generateExpandedLayout).toHaveBeenCalledWith(schema, 5);
    
    jest.clearAllMocks();
    
    // Test with grouped layout
    generateNodesAndEdges(schema, true, 4);
    expect(generateGroupedLayout).toHaveBeenCalledWith(schema, 4);
  });
});
