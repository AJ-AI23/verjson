
import { renderHook, act } from '@testing-library/react';
import { useSchemaProcessor } from '../useSchemaProcessor';
import { generateNodesAndEdges } from '@/lib/diagram';

// Mock dependencies
jest.mock('@/lib/diagram', () => ({
  generateNodesAndEdges: jest.fn(() => ({ nodes: [], edges: [] }))
}));

describe('useSchemaProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return empty elements when schema is null', () => {
    const { result } = renderHook(() => 
      useSchemaProcessor(null, false, false)
    );
    
    expect(result.current.generatedElements).toEqual({ nodes: [], edges: [] });
  });
  
  it('should increment schemaKey when schema changes', () => {
    const { result, rerender } = renderHook(
      (props: any) => useSchemaProcessor(props.schema, props.error, props.groupProperties),
      { initialProps: { schema: null, error: false, groupProperties: false } }
    );
    
    const initialSchemaKey = result.current.schemaKey;
    
    // Change the schema
    rerender({ schema: { type: 'object' }, error: false, groupProperties: false });
    
    // Check that schemaKey incremented
    expect(result.current.schemaKey).toBe(initialSchemaKey + 1);
  });
  
  it('should call generateNodesAndEdges when schema is valid', () => {
    const mockSchema = { type: 'object', properties: {} };
    
    (generateNodesAndEdges as jest.Mock<any>).mockReturnValue({
      nodes: [{ id: 'node1' }],
      edges: [{ id: 'edge1' }]
    });
    
    renderHook(() => 
      useSchemaProcessor(mockSchema, false, false)
    );
    
    // Fast-forward timers
    jest.runAllTimers();
    
    expect(generateNodesAndEdges).toHaveBeenCalledWith(mockSchema, false);
  });
  
  it('should update generatedElements when groupProperties changes', () => {
    const mockSchema = { type: 'object', properties: {} };
    
    const { rerender } = renderHook(
      (props: any) => useSchemaProcessor(props.schema, props.error, props.groupProperties),
      { initialProps: { schema: mockSchema, error: false, groupProperties: false } }
    );
    
    // First call with groupProperties: false
    expect(generateNodesAndEdges).toHaveBeenCalledWith(mockSchema, false);
    
    // Rerender with groupProperties: true
    rerender({ schema: mockSchema, error: false, groupProperties: true });
    
    // Expect the second call with groupProperties: true
    expect(generateNodesAndEdges).toHaveBeenCalledWith(mockSchema, true);
  });
});
