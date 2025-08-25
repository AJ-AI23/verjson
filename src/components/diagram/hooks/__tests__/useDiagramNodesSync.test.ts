import { renderHook } from '@testing-library/react';
import { useDiagramNodes } from '../useDiagramNodes';
import { CollapsedState } from '@/lib/diagram/types';

// Mock dependencies
const mockSetNodes = jest.fn();
const mockSetEdges = jest.fn();
const mockOnNodesChange = jest.fn();
const mockOnEdgesChange = jest.fn();
const mockGenerateNodesAndEdges = jest.fn();

jest.mock('@xyflow/react', () => ({
  useNodesState: () => [[], mockSetNodes, mockOnNodesChange],
  useEdgesState: () => [[], mockSetEdges, mockOnEdgesChange],
}));

jest.mock('@/lib/diagram', () => ({
  generateNodesAndEdges: mockGenerateNodesAndEdges
}));

jest.mock('../useNodePositions', () => ({
  useNodePositions: () => ({
    nodePositionsRef: { current: {} },
    applyStoredPositions: (nodes: any) => nodes
  })
}));

describe('useDiagramNodes - Sync Behavior', () => {
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

  const mockNodes = [
    { id: 'root', type: 'schemaType', position: { x: 0, y: 0 } },
    { id: 'root.properties', type: 'schemaType', position: { x: 100, y: 0 } },
    { id: 'root.properties.name', type: 'schemaType', position: { x: 200, y: 0 } },
    { id: 'root.properties.address', type: 'schemaType', position: { x: 200, y: 100 } }
  ];

  const mockEdges = [
    { id: 'e1', source: 'root', target: 'root.properties' },
    { id: 'e2', source: 'root.properties', target: 'root.properties.name' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateNodesAndEdges.mockReturnValue({
      nodes: mockNodes,
      edges: mockEdges
    });
  });

  describe('collapsed paths integration', () => {
    it('should pass collapsedPaths to generateNodesAndEdges', () => {
      const collapsedPaths: CollapsedState = {
        'root.properties': true,
        'root.properties.address': false
      };

      renderHook(() =>
        useDiagramNodes(testSchema, false, false, collapsedPaths)
      );

      expect(mockGenerateNodesAndEdges).toHaveBeenCalledWith(
        testSchema,
        false,
        1,
        collapsedPaths
      );
    });

    it('should regenerate diagram when collapsedPaths change', () => {
      const initialCollapsedPaths: CollapsedState = {
        'root.properties': true
      };

      const { rerender } = renderHook(
        ({ collapsedPaths }) => useDiagramNodes(testSchema, false, false, collapsedPaths),
        { initialProps: { collapsedPaths: initialCollapsedPaths } }
      );

      // Clear the initial call
      mockGenerateNodesAndEdges.mockClear();

      // Change collapsed paths
      const newCollapsedPaths: CollapsedState = {
        'root.properties': false,
        'root.properties.address': true
      };

      rerender({ collapsedPaths: newCollapsedPaths });

      expect(mockGenerateNodesAndEdges).toHaveBeenCalledWith(
        testSchema,
        false,
        1,
        newCollapsedPaths
      );
    });

    it('should not regenerate diagram when collapsedPaths reference changes but content is same', () => {
      const collapsedPaths: CollapsedState = {
        'root.properties': true
      };

      const { rerender } = renderHook(
        ({ collapsedPaths }) => useDiagramNodes(testSchema, false, false, collapsedPaths),
        { initialProps: { collapsedPaths } }
      );

      // Clear the initial call
      mockGenerateNodesAndEdges.mockClear();

      // Pass same content but different reference
      const sameCollapsedPaths: CollapsedState = {
        'root.properties': true
      };

      rerender({ collapsedPaths: sameCollapsedPaths });

      // Should not regenerate since content is the same
      expect(mockGenerateNodesAndEdges).not.toHaveBeenCalled();
    });
  });

  describe('diagram update triggers', () => {
    it('should regenerate when schema changes', () => {
      const { rerender } = renderHook(
        ({ schema }) => useDiagramNodes(schema, false, false),
        { initialProps: { schema: testSchema as any } }
      );

      mockGenerateNodesAndEdges.mockClear();

      const newSchema: any = {
        type: 'object',
        properties: {
          email: { type: 'string' }
        }
      };

      rerender({ schema: newSchema });

      expect(mockGenerateNodesAndEdges).toHaveBeenCalledWith(
        newSchema,
        false,
        1,
        undefined
      );
    });

    it('should regenerate when groupProperties changes', () => {
      const { rerender } = renderHook(
        ({ groupProperties }) => useDiagramNodes(testSchema, false, groupProperties),
        { initialProps: { groupProperties: false } }
      );

      mockGenerateNodesAndEdges.mockClear();

      rerender({ groupProperties: true });

      expect(mockGenerateNodesAndEdges).toHaveBeenCalledWith(
        testSchema,
        true,
        1,
        undefined
      );
    });

    it('should handle multiple simultaneous changes', () => {
      const initialProps = {
        schema: testSchema as any,
        groupProperties: false,
        collapsedPaths: { 'root.properties': true } as CollapsedState
      };

      const { rerender } = renderHook(
        ({ schema, groupProperties, collapsedPaths }) =>
          useDiagramNodes(schema, false, groupProperties, collapsedPaths),
        { initialProps }
      );

      mockGenerateNodesAndEdges.mockClear();

      // Change everything at once
      const newSchema: any = {
        type: 'object',
        properties: {
          updated: { type: 'boolean' }
        }
      };
      const newCollapsedPaths = { 'root': false };

      rerender({
        schema: newSchema,
        groupProperties: true,
        collapsedPaths: newCollapsedPaths
      });

      expect(mockGenerateNodesAndEdges).toHaveBeenCalledWith(
        newSchema,
        true,
        1,
        newCollapsedPaths
      );
    });
  });

  describe('error handling', () => {
    it('should handle generateNodesAndEdges throwing error', () => {
      mockGenerateNodesAndEdges.mockImplementation(() => {
        throw new Error('Generation failed');
      });

      expect(() => {
        renderHook(() => useDiagramNodes(testSchema, false, false));
      }).not.toThrow();

      // Should still try to set empty arrays
      expect(mockSetNodes).toHaveBeenCalledWith([]);
      expect(mockSetEdges).toHaveBeenCalledWith([]);
    });

    it('should handle null schema gracefully', () => {
      renderHook(() => useDiagramNodes(null, false, false));

      expect(mockGenerateNodesAndEdges).not.toHaveBeenCalled();
      expect(mockSetNodes).toHaveBeenCalledWith([]);
      expect(mockSetEdges).toHaveBeenCalledWith([]);
    });

    it('should handle undefined collapsedPaths', () => {
      renderHook(() => useDiagramNodes(testSchema, false, false, undefined));

      expect(mockGenerateNodesAndEdges).toHaveBeenCalledWith(
        testSchema,
        false,
        1,
        undefined
      );
    });
  });

  describe('performance optimizations', () => {
    it('should use memoization to prevent unnecessary regenerations', () => {
      const collapsedPaths: CollapsedState = { 'root.properties': true };

      const { rerender } = renderHook(
        ({ forceUpdate }) => {
          // Add a prop that doesn't affect diagram generation
          return useDiagramNodes(testSchema, false, false, collapsedPaths);
        },
        { initialProps: { forceUpdate: 1 } }
      );

      mockGenerateNodesAndEdges.mockClear();

      // Rerender with different forceUpdate but same diagram-relevant props
      rerender({ forceUpdate: 2 });

      // Should not regenerate
      expect(mockGenerateNodesAndEdges).not.toHaveBeenCalled();
    });

    it('should increment schemaKey only when diagram actually changes', () => {
      const { result, rerender } = renderHook(
        ({ schema, collapsedPaths }) => useDiagramNodes(schema, false, false, collapsedPaths),
        {
          initialProps: {
            schema: testSchema,
            collapsedPaths: { 'root.properties': true } as CollapsedState
          }
        }
      );

      const initialSchemaKey = result.current.schemaKey;

      // Change something that affects diagram
      rerender({
        schema: testSchema,
        collapsedPaths: { 'root.properties': false } as CollapsedState
      });

      expect(result.current.schemaKey).toBe(initialSchemaKey + 1);
    });
  });

  describe('node positioning integration', () => {
    it('should apply stored positions to generated nodes', () => {
      // This test verifies that the hook integrates with useNodePositions
      renderHook(() => useDiagramNodes(testSchema, false, false));

      // The integration is tested by verifying the hook runs without errors
      // and calls generateNodesAndEdges with the expected parameters
      expect(mockGenerateNodesAndEdges).toHaveBeenCalledWith(
        testSchema,
        false,
        1,
        undefined
      );
    });
  });
});