import { useState, useCallback, useEffect, useMemo } from 'react';
import { Node } from '@xyflow/react';
import { 
  resolveCollisions, 
  animateNodes, 
  DEFAULT_COLLISION_CONFIG,
  CollisionConfig 
} from '@/lib/diagram/layout/collisionResolver';

const STORAGE_KEY = 'diagram-collision-avoidance';

// Keep default config referentially stable so hooks using `useCollisionAvoidance()`
// don't recreate callbacks every render (which can cancel scheduled timeouts).
const EMPTY_CONFIG: Partial<CollisionConfig> = {};

export function useCollisionAvoidance(config: Partial<CollisionConfig> = EMPTY_CONFIG) {
  const [enabled, setEnabled] = useState(() => {
    // Load preference from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== 'false'; // Default to true
    }
    return true;
  });

  const mergedConfig: CollisionConfig = useMemo(
    () => ({
      ...DEFAULT_COLLISION_CONFIG,
      ...config,
    }),
    [config]
  );

  // Persist preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  /**
   * Resolve collisions if enabled
   * Returns the resolved nodes (or original if disabled)
   */
  const resolveIfEnabled = useCallback((nodes: Node[]): Node[] => {
    if (!enabled || nodes.length < 2) return nodes;
    return resolveCollisions(nodes, mergedConfig);
  }, [enabled, mergedConfig]);

  /**
   * Resolve collisions with animation if enabled
   */
  const resolveAnimatedIfEnabled = useCallback((
    nodes: Node[],
    setNodes: (updater: (nodes: Node[]) => Node[]) => void,
    animate: boolean = true
  ): void => {
    if (!enabled || nodes.length < 2) return;

    const resolved = resolveCollisions(nodes, mergedConfig);

    if (animate) {
      animateNodes(nodes, resolved, setNodes, mergedConfig.animationDuration);
    } else {
      setNodes(() => resolved);
    }
  }, [enabled, mergedConfig]);

  /**
   * Force resolve collisions regardless of enabled state
   */
  const forceResolve = useCallback((
    nodes: Node[],
    setNodes: (updater: (nodes: Node[]) => Node[]) => void,
    animate: boolean = true
  ): void => {
    if (nodes.length < 2) return;

    const resolved = resolveCollisions(nodes, mergedConfig);

    if (animate) {
      animateNodes(nodes, resolved, setNodes, mergedConfig.animationDuration);
    } else {
      setNodes(() => resolved);
    }
  }, [mergedConfig]);

  return {
    enabled,
    toggle,
    setEnabled,
    resolveIfEnabled,
    resolveAnimatedIfEnabled,
    forceResolve,
    config: mergedConfig
  };
}
