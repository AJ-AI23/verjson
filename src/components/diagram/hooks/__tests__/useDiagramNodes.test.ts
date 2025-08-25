
import { renderHook, act } from '@testing-library/react';
import { useDiagramNodes } from '../useDiagramNodes';

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

describe('useDiagramNodes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with empty nodes and edges when schema is null', () => {
    const { result } = renderHook(() => 
      useDiagramNodes(null, false, false, 1)
    );
    
    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
  });
  
  it('should increment schemaKey when schema changes', () => {
    const { result, rerender } = renderHook(
      (props: any) => useDiagramNodes(props.schema, props.error, props.groupProperties, props.maxDepth),
      { initialProps: { schema: null, error: false, groupProperties: false, maxDepth: 1 } }
    );
    
    const initialSchemaKey = result.current.schemaKey;
    
    // Change the schema
    rerender({ schema: { type: 'object' }, error: false, groupProperties: false, maxDepth: 1 });
    
    // Check that schemaKey incremented
    expect(result.current.schemaKey).toBe(initialSchemaKey + 1);
  });
  
  // More tests would be added here for validateAndSetEdges and other functionality
});
