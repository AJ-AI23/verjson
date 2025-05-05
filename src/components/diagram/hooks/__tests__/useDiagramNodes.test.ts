
import { renderHook, act } from '@testing-library/react';
import { useDiagramNodes } from '../useDiagramNodes';

// Mock dependencies
(jest as any).mock('@xyflow/react', () => ({
  useNodesState: () => {
    const nodes: any[] = [];
    const setNodes = (jest as any).fn();
    const onNodesChange = (jest as any).fn();
    return [nodes, setNodes, onNodesChange];
  },
  useEdgesState: () => {
    const edges: any[] = [];
    const setEdges = (jest as any).fn();
    const onEdgesChange = (jest as any).fn();
    return [edges, setEdges, onEdgesChange];
  },
}));

(jest as any).mock('@/lib/diagram', () => ({
  generateNodesAndEdges: (jest as any).fn(() => ({ nodes: [], edges: [] }))
}));

(jest as any).mock('../useNodePositions', () => ({
  useNodePositions: () => ({
    nodePositionsRef: { current: {} },
    applyStoredPositions: (nodes: any) => nodes
  })
}));

describe('useDiagramNodes', () => {
  beforeEach(() => {
    (jest as any).clearAllMocks();
  });

  it('should initialize with empty nodes and edges when schema is null', () => {
    const { result } = renderHook(() => 
      useDiagramNodes(null, false, false)
    );
    
    (expect as any)(result.current.nodes).toEqual([]);
    (expect as any)(result.current.edges).toEqual([]);
  });
  
  it('should increment schemaKey when schema changes', () => {
    const { result, rerender } = renderHook(
      (props: any) => useDiagramNodes(props.schema, props.error, props.groupProperties),
      { initialProps: { schema: null, error: false, groupProperties: false } }
    );
    
    const initialSchemaKey = result.current.schemaKey;
    
    // Change the schema
    rerender({ schema: { type: 'object' }, error: false, groupProperties: false });
    
    // Check that schemaKey incremented
    (expect as any)(result.current.schemaKey).toBe(initialSchemaKey + 1);
  });
  
  // More tests would be added here for validateAndSetEdges and other functionality
});
