import { generateNodesAndEdges } from '../index';
import { CollapsedState } from '../types';

// Mock layout generators with more detailed implementations
const mockGenerateGroupedLayout = jest.fn();
const mockGenerateExpandedLayout = jest.fn();
const mockCreateRootNode = jest.fn();

jest.mock('../groupedPropertiesLayout', () => ({
  generateGroupedLayout: mockGenerateGroupedLayout
}));

jest.mock('../expandedPropertiesLayout', () => ({
  generateExpandedLayout: mockGenerateExpandedLayout
}));

jest.mock('../nodeGenerator', () => ({
  createRootNode: mockCreateRootNode
}));

describe('Diagram Sync with Collapsed Paths', () => {
  const testSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      address: {
        type: 'object',
        properties: {
          street: { type: 'string' },
          city: { type: 'string' }
        }
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCreateRootNode.mockReturnValue({
      id: 'root',
      type: 'schemaType',
      position: { x: 0, y: 0 }
    });

    mockGenerateExpandedLayout.mockReturnValue({
      nodes: [
        { id: 'root.properties', type: 'schemaType' },
        { id: 'root.properties.name', type: 'schemaType' },
        { id: 'root.properties.address', type: 'schemaType' }
      ],
      edges: [
        { id: 'e1', source: 'root', target: 'root.properties' },
        { id: 'e2', source: 'root.properties', target: 'root.properties.name' }
      ]
    });

    mockGenerateGroupedLayout.mockReturnValue({
      nodes: [
        { id: 'root.properties', type: 'group' }
      ],
      edges: [
        { id: 'e1', source: 'root', target: 'root.properties' }
      ]
    });
  });

  describe('collapsed paths parameter passing', () => {
    it('should pass collapsedPaths to expanded layout generator', () => {
      const collapsedPaths: CollapsedState = {
        'root.properties': true,
        'root.properties.address': false
      };

      generateNodesAndEdges(testSchema, false, 3, collapsedPaths);

      expect(mockGenerateExpandedLayout).toHaveBeenCalledWith(
        testSchema,
        3,
        collapsedPaths
      );
    });

    it('should pass collapsedPaths to grouped layout generator', () => {
      const collapsedPaths: CollapsedState = {
        'root.properties': false
      };

      generateNodesAndEdges(testSchema, true, 2, collapsedPaths);

      expect(mockGenerateGroupedLayout).toHaveBeenCalledWith(
        testSchema,
        2,
        collapsedPaths
      );
    });

    it('should handle undefined collapsedPaths', () => {
      generateNodesAndEdges(testSchema, false, 1, undefined);

      expect(mockGenerateExpandedLayout).toHaveBeenCalledWith(
        testSchema,
        1,
        undefined
      );
    });

    it('should handle empty collapsedPaths object', () => {
      const collapsedPaths: CollapsedState = {};

      generateNodesAndEdges(testSchema, false, 1, collapsedPaths);

      expect(mockGenerateExpandedLayout).toHaveBeenCalledWith(
        testSchema,
        1,
        collapsedPaths
      );
    });
  });

  describe('node visibility based on collapsed state', () => {
    it('should generate different results based on collapsed paths', () => {
      // First call with some paths collapsed
      const collapsedPaths1: CollapsedState = {
        'root.properties.address': true
      };

      const result1 = generateNodesAndEdges(testSchema, false, 3, collapsedPaths1);

      // Second call with different collapsed paths
      const collapsedPaths2: CollapsedState = {
        'root.properties': true
      };

      mockGenerateExpandedLayout.mockClear();
      const result2 = generateNodesAndEdges(testSchema, false, 3, collapsedPaths2);

      // Should have called the layout generator with different collapsed paths
      expect(mockGenerateExpandedLayout).toHaveBeenCalledWith(
        testSchema,
        3,
        collapsedPaths2
      );
    });
  });

  describe('integration with layout generators', () => {
    it('should combine root node with layout-generated nodes', () => {
      const collapsedPaths: CollapsedState = {
        'root.properties': false
      };

      const result = generateNodesAndEdges(testSchema, false, 2, collapsedPaths);

      // Should include root node + layout nodes
      expect(result.nodes).toHaveLength(4); // 1 root + 3 from layout
      expect(result.nodes[0]).toEqual({
        id: 'root',
        type: 'schemaType',
        position: { x: 0, y: 0 }
      });
    });

    it('should include layout-generated edges', () => {
      const collapsedPaths: CollapsedState = {};

      const result = generateNodesAndEdges(testSchema, false, 2, collapsedPaths);

      expect(result.edges).toHaveLength(2);
      expect(result.edges).toContainEqual({
        id: 'e1',
        source: 'root',
        target: 'root.properties'
      });
    });
  });

  describe('error handling with collapsed paths', () => {
    it('should handle layout generator errors gracefully', () => {
      mockGenerateExpandedLayout.mockImplementation(() => {
        throw new Error('Layout generation failed');
      });

      const collapsedPaths: CollapsedState = {
        'root.properties': true
      };

      expect(() => {
        generateNodesAndEdges(testSchema, false, 2, collapsedPaths);
      }).not.toThrow();
    });

    it('should return root node even if layout generation fails', () => {
      mockGenerateExpandedLayout.mockImplementation(() => {
        throw new Error('Layout failed');
      });

      const collapsedPaths: CollapsedState = {};

      const result = generateNodesAndEdges(testSchema, false, 2, collapsedPaths);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('root');
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('performance with collapsed paths', () => {
    it('should not regenerate unnecessarily for same collapsed paths', () => {
      const collapsedPaths: CollapsedState = {
        'root.properties': true,
        'root.properties.address': false
      };

      // Multiple calls with same collapsed paths
      generateNodesAndEdges(testSchema, false, 2, collapsedPaths);
      generateNodesAndEdges(testSchema, false, 2, collapsedPaths);

      // Layout generator should be called each time (no caching at this level)
      expect(mockGenerateExpandedLayout).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle schema with no properties', () => {
      const simpleSchema = { type: 'string' };
      const collapsedPaths: CollapsedState = {
        'root': false
      };

      const result = generateNodesAndEdges(simpleSchema, false, 1, collapsedPaths);

      expect(result.nodes).toHaveLength(4); // Root + layout nodes
      expect(mockGenerateExpandedLayout).toHaveBeenCalledWith(
        simpleSchema,
        1,
        collapsedPaths
      );
    });

    it('should handle deeply nested collapsed paths', () => {
      const deepCollapsedPaths: CollapsedState = {
        'root.properties.address.properties.coordinates': true,
        'root.properties.address.properties.coordinates.properties': false,
        'root.properties.address.properties.coordinates.properties.lat': true
      };

      generateNodesAndEdges(testSchema, false, 5, deepCollapsedPaths);

      expect(mockGenerateExpandedLayout).toHaveBeenCalledWith(
        testSchema,
        5,
        deepCollapsedPaths
      );
    });
  });
});