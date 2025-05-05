
import { createEdge } from '../edgeGenerator';

describe('Edge Generators', () => {
  describe('createEdge', () => {
    it('should create an edge with correct properties', () => {
      const edge = createEdge('source-id', 'target-id');
      
      expect(edge).toEqual({
        id: 'edge-source-id-target-id',
        source: 'source-id',
        target: 'target-id',
        animated: false,
        label: undefined,
        style: { stroke: '#64748b' }
      });
    });
    
    it('should create an edge with label when provided', () => {
      const edge = createEdge('source-id', 'target-id', 'Test Label');
      
      expect(edge.label).toBe('Test Label');
    });
    
    it('should create an animated edge when specified', () => {
      const edge = createEdge('source-id', 'target-id', 'Test Label', true);
      
      expect(edge.animated).toBe(true);
    });
    
    it('should apply custom style when provided', () => {
      const customStyle = { stroke: 'red', strokeWidth: 2 };
      const edge = createEdge('source-id', 'target-id', undefined, false, customStyle);
      
      expect(edge.style).toEqual(customStyle);
    });
  });
});
