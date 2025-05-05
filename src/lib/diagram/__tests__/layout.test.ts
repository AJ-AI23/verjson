
import { generateGroupedLayout } from '../groupedPropertiesLayout';
import { generateExpandedLayout } from '../expandedPropertiesLayout';

// Mock node and edge generators to simplify tests
jest.mock('../nodeGenerator', () => ({
  createGroupNode: jest.fn().mockImplementation((parentId) => ({
    id: `${parentId}-props`,
    type: 'schemaType',
    position: { x: 0, y: 150 },
    data: { label: 'Properties' }
  })),
  createArrayNode: jest.fn().mockImplementation((groupId, propName) => ({
    id: `${groupId}-${propName}-array`,
    type: 'schemaType',
    position: { x: -200, y: 150 },
    data: { label: `${propName} (Array)` }
  })),
  createPropertyNode: jest.fn().mockImplementation((propName) => ({
    id: `prop-${propName}`,
    type: 'schemaType',
    position: { x: 0, y: 150 },
    data: { label: propName }
  })),
  createNestedPropertyNode: jest.fn().mockImplementation((parentId, nestedName) => ({
    id: `${parentId}-${nestedName}`,
    type: 'schemaType',
    position: { x: 0, y: 300 },
    data: { label: nestedName }
  })),
  createArrayItemNode: jest.fn().mockImplementation((parentId) => ({
    id: `${parentId}-items`,
    type: 'schemaType',
    position: { x: 0, y: 300 },
    data: { label: 'Array Item' }
  }))
}));

jest.mock('../edgeGenerator', () => ({
  createEdge: jest.fn().mockImplementation((source, target) => ({
    id: `edge-${source}-${target}`,
    source,
    target
  }))
}));

describe('Layout Generators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('generateGroupedLayout', () => {
    it('should return empty result for invalid schema', () => {
      const result = generateGroupedLayout(null);
      expect(result).toEqual({ nodes: [], edges: [] });
      
      const nonObjectResult = generateGroupedLayout({ type: 'string' });
      expect(nonObjectResult).toEqual({ nodes: [], edges: [] });
    });
    
    it('should generate layout for simple object schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };
      
      const result = generateGroupedLayout(schema);
      
      // Should have at least one node (the group node) and one edge
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.edges.length).toBeGreaterThan(0);
    });
  });
  
  describe('generateExpandedLayout', () => {
    it('should return empty result for invalid schema', () => {
      const result = generateExpandedLayout(null);
      expect(result).toEqual({ nodes: [], edges: [] });
      
      const nonObjectResult = generateExpandedLayout({ type: 'string' });
      expect(nonObjectResult).toEqual({ nodes: [], edges: [] });
    });
    
    it('should generate layout for simple object schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };
      
      const result = generateExpandedLayout(schema);
      
      // Should have two nodes (one for each property) and two edges
      expect(result.nodes.length).toBe(2);
      expect(result.edges.length).toBe(2);
    });
  });
});
