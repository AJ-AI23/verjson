import { renderHook } from '@testing-library/react';
import { useBulkExpandCollapse } from '../useBulkExpandCollapse';

describe('useBulkExpandCollapse', () => {
  let mockOnToggleCollapse: (path: string, isCollapsed: boolean) => void;
  let mockEditorRef: React.MutableRefObject<any>;
  let mockCollapsedPathsRef: React.MutableRefObject<any>;

  const mockSchema = {
    type: 'object',
    properties: {
      exampleString: { type: 'string' },
      exampleNumber: { type: 'number' },
      exampleObject: {
        type: 'object',
        properties: {
          nestedField: { type: 'integer' },
          deepObject: {
            type: 'object',
            properties: {
              veryDeepField: { type: 'string' }
            }
          }
        }
      },
      exampleArray: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  };

  beforeEach(() => {
    mockOnToggleCollapse = jest.fn();
    mockEditorRef = {
      current: {
        expand: jest.fn()
      }
    };
    mockCollapsedPathsRef = {
      current: {}
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('depth 1 behavior', () => {
    it('should not trigger bulk expansion for depth 1', () => {
      const { result } = renderHook(() =>
        useBulkExpandCollapse({
          onToggleCollapse: mockOnToggleCollapse,
          maxDepth: 1
        })
      );

      result.current.bulkExpand(
        'root',
        mockSchema,
        true,
        mockEditorRef,
        mockCollapsedPathsRef
      );

      // Should not call onToggleCollapse for any paths (no bulk expansion)
      expect(mockOnToggleCollapse).not.toHaveBeenCalled();
      expect(mockEditorRef.current.expand).not.toHaveBeenCalled();
    });

    it('should not trigger bulk expansion for root.properties with depth 1', () => {
      const { result } = renderHook(() =>
        useBulkExpandCollapse({
          onToggleCollapse: mockOnToggleCollapse,
          maxDepth: 1
        })
      );

      result.current.bulkExpand(
        'root.properties',
        mockSchema,
        true,
        mockEditorRef,
        mockCollapsedPathsRef
      );

      expect(mockOnToggleCollapse).not.toHaveBeenCalled();
      expect(mockEditorRef.current.expand).not.toHaveBeenCalled();
    });
  });

  describe('depth 2 behavior', () => {
    it('should expand 1 additional level from root with depth 2', () => {
      const { result } = renderHook(() =>
        useBulkExpandCollapse({
          onToggleCollapse: mockOnToggleCollapse,
          maxDepth: 2
        })
      );

      result.current.bulkExpand(
        'root',
        mockSchema,
        true,
        mockEditorRef,
        mockCollapsedPathsRef
      );

      // Should expand root.properties only (1 additional level)
      expect(mockOnToggleCollapse).toHaveBeenCalledWith('root.properties', false);
      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(1);
    });

    it('should expand 1 additional level from root.properties with depth 2', () => {
      const { result } = renderHook(() =>
        useBulkExpandCollapse({
          onToggleCollapse: mockOnToggleCollapse,
          maxDepth: 2
        })
      );

      result.current.bulkExpand(
        'root.properties',
        mockSchema,
        true,
        mockEditorRef,
        mockCollapsedPathsRef
      );

      // Should expand all direct children of root.properties
      const expectedPaths = [
        'root.properties.exampleString',
        'root.properties.exampleNumber',
        'root.properties.exampleObject',
        'root.properties.exampleArray'
      ];

      expectedPaths.forEach(path => {
        expect(mockOnToggleCollapse).toHaveBeenCalledWith(path, false);
      });
      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(expectedPaths.length);
    });
  });

  describe('depth 3 behavior', () => {
    it('should expand 2 additional levels from root.properties with depth 3', () => {
      const { result } = renderHook(() =>
        useBulkExpandCollapse({
          onToggleCollapse: mockOnToggleCollapse,
          maxDepth: 3
        })
      );

      result.current.bulkExpand(
        'root.properties',
        mockSchema,
        true,
        mockEditorRef,
        mockCollapsedPathsRef
      );

      // Should expand direct children and their children
      const expectedPaths = [
        'root.properties.exampleString',
        'root.properties.exampleNumber',
        'root.properties.exampleObject',
        'root.properties.exampleObject.properties',
        'root.properties.exampleArray',
        'root.properties.exampleArray.items'
      ];

      expectedPaths.forEach(path => {
        expect(mockOnToggleCollapse).toHaveBeenCalledWith(path, false);
      });
      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(expectedPaths.length);
    });
  });

  describe('depth cleanup', () => {
    it('should collapse deeper paths when switching to lower depth', () => {
      mockCollapsedPathsRef.current = {
        'root.properties': false,
        'root.properties.exampleObject': false,
        'root.properties.exampleObject.properties': false,
        'root.properties.exampleObject.properties.nestedField': false,
        'root.properties.exampleObject.properties.deepObject': false
      };

      const { result } = renderHook(() =>
        useBulkExpandCollapse({
          onToggleCollapse: mockOnToggleCollapse,
          maxDepth: 2
        })
      );

      result.current.bulkExpand(
        'root.properties',
        mockSchema,
        true,
        mockEditorRef,
        mockCollapsedPathsRef
      );

      // Should collapse paths deeper than baseDepth + (maxDepth - 1)
      // baseDepth = 1, maxDepth = 2, so max allowed depth = 2
      expect(mockOnToggleCollapse).toHaveBeenCalledWith('root.properties.exampleObject.properties', true);
      expect(mockOnToggleCollapse).toHaveBeenCalledWith('root.properties.exampleObject.properties.nestedField', true);
      expect(mockOnToggleCollapse).toHaveBeenCalledWith('root.properties.exampleObject.properties.deepObject', true);
    });
  });

  describe('path normalization', () => {
    it('should handle nested object properties correctly', () => {
      const { result } = renderHook(() =>
        useBulkExpandCollapse({
          onToggleCollapse: mockOnToggleCollapse,
          maxDepth: 3
        })
      );

      result.current.bulkExpand(
        'root.properties.exampleObject.properties',
        mockSchema,
        true,
        mockEditorRef,
        mockCollapsedPathsRef
      );

      // Should expand children of the nested object
      const expectedPaths = [
        'root.properties.exampleObject.properties.nestedField',
        'root.properties.exampleObject.properties.deepObject'
      ];

      expectedPaths.forEach(path => {
        expect(mockOnToggleCollapse).toHaveBeenCalledWith(path, false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle missing editor reference gracefully', () => {
      const { result } = renderHook(() =>
        useBulkExpandCollapse({
          onToggleCollapse: mockOnToggleCollapse,
          maxDepth: 2
        })
      );

      const nullEditorRef = { current: null };

      expect(() => {
        result.current.bulkExpand(
          'root.properties',
          mockSchema,
          true,
          nullEditorRef,
          mockCollapsedPathsRef
        );
      }).not.toThrow();

      expect(mockOnToggleCollapse).not.toHaveBeenCalled();
    });

    it('should handle missing onToggleCollapse callback gracefully', () => {
      const { result } = renderHook(() =>
        useBulkExpandCollapse({
          onToggleCollapse: undefined,
          maxDepth: 2
        })
      );

      expect(() => {
        result.current.bulkExpand(
          'root.properties',
          mockSchema,
          true,
          mockEditorRef,
          mockCollapsedPathsRef
        );
      }).not.toThrow();
    });

    it('should handle invalid schema gracefully', () => {
      const { result } = renderHook(() =>
        useBulkExpandCollapse({
          onToggleCollapse: mockOnToggleCollapse,
          maxDepth: 2
        })
      );

      expect(() => {
        result.current.bulkExpand(
          'root.properties',
          null,
          true,
          mockEditorRef,
          mockCollapsedPathsRef
        );
      }).not.toThrow();
    });
  });
});