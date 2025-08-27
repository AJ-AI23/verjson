import { useMemo } from 'react';
import { generateNodesAndEdges } from './index';
import { CollapsedState } from './types';
import { createStableHash } from '@/lib/utils/deepEqual';

/**
 * Memoized diagram generation hook to prevent unnecessary re-computations
 */
export const useMemoizedDiagramGeneration = (
  schema: any,
  groupProperties: boolean,
  maxDepth: number,
  collapsedPaths: CollapsedState
) => {
  // Create stable hashes for dependencies
  const schemaHash = useMemo(() => createStableHash(schema), [schema]);
  const collapsedPathsHash = useMemo(() => createStableHash(collapsedPaths), [collapsedPaths]);
  
  // Memoize the diagram generation with stable dependencies
  return useMemo(() => {
    if (!schema) {
      return { nodes: [], edges: [] };
    }
    
    return generateNodesAndEdges(schema, groupProperties, maxDepth, collapsedPaths);
  }, [schemaHash, groupProperties, maxDepth, collapsedPathsHash]);
};