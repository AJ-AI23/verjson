import { renderHook, act } from '@testing-library/react';
import { useNodePositions } from '../useNodePositions';
import type { Node } from '@xyflow/react';

describe('useNodePositions', () => {
  it('should store node positions when nodes change', () => {
    const mockNodes = [
      { id: 'node1', position: { x: 100, y: 200 }, data: {} },
      { id: 'node2', position: { x: 300, y: 400 }, data: {} }
    ] as Node[];
    
    const { result } = renderHook(() => useNodePositions(mockNodes));
    
    // Check that nodePositionsRef has the correct positions
    expect(result.current.nodePositionsRef.current).toEqual({
      node1: { x: 100, y: 200 },
      node2: { x: 300, y: 400 }
    });
  });
  
  it('should apply stored positions to new nodes', () => {
    const initialNodes = [
      { id: 'node1', position: { x: 100, y: 200 }, data: {} }
    ] as Node[];
    
    const { result, rerender } = renderHook(
      (props) => useNodePositions(props),
      { initialProps: initialNodes }
    );
    
    // Add a new node that doesn't have a stored position
    const newNodes = [
      { id: 'node1', position: { x: 0, y: 0 }, data: {} },
      { id: 'node2', position: { x: 0, y: 0 }, data: {} }
    ] as Node[];
    
    // Apply the stored positions
    const positionedNodes = result.current.applyStoredPositions(newNodes);
    
    // Check that node1 has its stored position, while node2 remains unchanged
    expect(positionedNodes).toEqual([
      { id: 'node1', position: { x: 100, y: 200 }, data: {} },
      { id: 'node2', position: { x: 0, y: 0 }, data: {} }
    ]);
  });
});
