
import { renderHook } from '@testing-library/react';
import { useEdgeValidator } from '../useEdgeValidator';

describe('useEdgeValidator', () => {
  it('should set empty edges when nodes array is empty', () => {
    const setEdges = jest.fn();
    const nodes: any[] = [];
    
    const { result } = renderHook(() => useEdgeValidator(setEdges, nodes));
    
    // Call the validateAndSetEdges function
    result.current([{ id: 'edge1', source: 'node1', target: 'node2' }]);
    
    // Expect setEdges to be called with empty array
    expect(setEdges).toHaveBeenCalledWith([]);
  });
  
  it('should filter out orphaned edges', () => {
    const setEdges = jest.fn();
    const nodes = [
      { id: 'node1' },
      { id: 'node3' }
    ];
    
    const edges = [
      { id: 'edge1', source: 'node1', target: 'node2' }, // node2 doesn't exist
      { id: 'edge2', source: 'node1', target: 'node3' }, // valid
      { id: 'edge3', source: 'node4', target: 'node3' }  // node4 doesn't exist
    ];
    
    const { result } = renderHook(() => useEdgeValidator(setEdges, nodes));
    
    // Call the validateAndSetEdges function
    result.current(edges);
    
    // Expect setEdges to be called with only the valid edge
    expect(setEdges).toHaveBeenCalledWith([
      { id: 'edge2', source: 'node1', target: 'node3' }
    ]);
  });
  
  it('should not filter edges when all are valid', () => {
    const setEdges = jest.fn();
    const nodes = [
      { id: 'node1' },
      { id: 'node2' }
    ];
    
    const edges = [
      { id: 'edge1', source: 'node1', target: 'node2' }
    ];
    
    const { result } = renderHook(() => useEdgeValidator(setEdges, nodes));
    
    // Call the validateAndSetEdges function
    result.current(edges);
    
    // Expect setEdges to be called with the same edges
    expect(setEdges).toHaveBeenCalledWith(edges);
  });
});
