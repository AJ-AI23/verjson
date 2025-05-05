
import { renderHook, act } from '@testing-library/react';
import { useDiagramNodes } from '../useDiagramNodes';
import { useSchemaProcessor } from '../useSchemaProcessor';
import { useEdgeValidator } from '../useEdgeValidator';

// Mock dependencies
jest.mock('@xyflow/react', () => ({
  useNodesState: () => {
    const nodes: any[] = [];
    const setNodes = jest.fn();
    const onNodesChange = jest.fn();
    return [nodes, setNodes, onNodesChange];
  },
  useEdgesState: () => {
    const edges: any[] = [];
    const setEdges = jest.fn();
    const onEdgesChange = jest.fn();
    return [edges, setEdges, onEdgesChange];
  },
}));

jest.mock('@/lib/diagram', () => ({
  generateNodesAndEdges: jest.fn(() => ({ nodes: [], edges: [] }))
}));

jest.mock('../useNodePositions', () => ({
  useNodePositions: () => ({
    nodePositionsRef: { current: {} },
    applyStoredPositions: (nodes: any) => nodes
  })
}));

jest.mock('../useSchemaProcessor', () => ({
  useSchemaProcessor: jest.fn(() => ({
    generatedElements: { nodes: [], edges: [] },
    schemaKey: 0
  }))
}));

jest.mock('../useEdgeValidator', () => ({
  useEdgeValidator: jest.fn(() => jest.fn())
}));

describe('useDiagramNodes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with empty nodes and edges when schema is null', () => {
    const { result } = renderHook(() => 
      useDiagramNodes(null, false, false)
    );
    
    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
  });
  
  it('should use the schemaKey from useSchemaProcessor', () => {
    // Mock the schemaKey value
    (useSchemaProcessor as jest.Mock).mockReturnValue({
      generatedElements: { nodes: [], edges: [] },
      schemaKey: 42
    });
    
    const { result } = renderHook(() => 
      useDiagramNodes({ type: 'object' }, false, false)
    );
    
    expect(result.current.schemaKey).toBe(42);
  });
  
  // Test that validateAndSetEdges is called with the right arguments
  it('should use the edge validator', () => {
    const mockValidator = jest.fn();
    (useEdgeValidator as jest.Mock).mockReturnValue(mockValidator);
    
    (useSchemaProcessor as jest.Mock).mockReturnValue({
      generatedElements: { nodes: [{ id: 'test' }], edges: [{ id: 'edge1' }] },
      schemaKey: 1
    });
    
    renderHook(() => 
      useDiagramNodes({ type: 'object' }, false, false)
    );
    
    expect(mockValidator).toHaveBeenCalledWith([{ id: 'edge1' }]);
  });
});
