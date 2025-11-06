import { Node, Edge } from '@xyflow/react';
import { DiagramElements } from './types';

/**
 * Truncates ancestral boxes in the diagram.
 * An ancestral box is a node that:
 * - Has exactly 1 incoming edge (from parent)
 * - Has exactly 1 outgoing edge (to child)
 * - The child is also expanded (not collapsed)
 * 
 * Such nodes are removed and their parent is connected directly to their child.
 * A special "truncated" property is added to show which intermediate properties were removed.
 */
export const truncateAncestralBoxes = (elements: DiagramElements): DiagramElements => {
  const { nodes, edges } = elements;
  
  // Build edge mappings for quick lookup
  const incomingEdges = new Map<string, Edge[]>();
  const outgoingEdges = new Map<string, Edge[]>();
  
  edges.forEach(edge => {
    if (!incomingEdges.has(edge.target)) {
      incomingEdges.set(edge.target, []);
    }
    incomingEdges.get(edge.target)!.push(edge);
    
    if (!outgoingEdges.has(edge.source)) {
      outgoingEdges.set(edge.source, []);
    }
    outgoingEdges.get(edge.source)!.push(edge);
  });
  
  // Identify nodes that can be truncated
  const nodesToTruncate = new Set<string>();
  const truncationChains: string[][] = [];
  
  nodes.forEach(node => {
    // Skip root node and special nodes
    if (node.id === 'root' || node.data.nodeType === 'info' || node.data.nodeType === 'endpoint') {
      return;
    }
    
    const incoming = incomingEdges.get(node.id) || [];
    const outgoing = outgoingEdges.get(node.id) || [];
    
    // Check if this node qualifies for truncation
    if (incoming.length === 1 && outgoing.length === 1) {
      const childNode = nodes.find(n => n.id === outgoing[0].target);
      // Only truncate if child is not collapsed
      if (childNode && !childNode.data.isCollapsed) {
        nodesToTruncate.add(node.id);
      }
    }
  });
  
  // Build chains of consecutive truncatable nodes
  const visited = new Set<string>();
  
  nodesToTruncate.forEach(nodeId => {
    if (visited.has(nodeId)) return;
    
    const chain: string[] = [];
    let currentId = nodeId;
    
    // Build chain backwards to find the start
    while (nodesToTruncate.has(currentId) && !visited.has(currentId)) {
      const incoming = incomingEdges.get(currentId) || [];
      if (incoming.length === 1) {
        const parentId = incoming[0].source;
        if (nodesToTruncate.has(parentId)) {
          currentId = parentId;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    
    // Build chain forwards from the start
    while (nodesToTruncate.has(currentId) && !visited.has(currentId)) {
      chain.push(currentId);
      visited.add(currentId);
      
      const outgoing = outgoingEdges.get(currentId) || [];
      if (outgoing.length === 1) {
        const childId = outgoing[0].target;
        if (nodesToTruncate.has(childId)) {
          currentId = childId;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    
    if (chain.length > 0) {
      truncationChains.push(chain);
    }
  });
  
  // Apply truncation for each chain
  const nodesToRemove = new Set<string>();
  const edgesToRemove = new Set<string>();
  const newEdges: Edge[] = [];
  const newNodes: Node[] = [];
  
  truncationChains.forEach((chain, chainIndex) => {
    if (chain.length === 0) return;
    
    const firstNodeId = chain[0];
    const lastNodeId = chain[chain.length - 1];
    
    // Find parent and child
    const incomingToFirst = incomingEdges.get(firstNodeId) || [];
    const outgoingFromLast = outgoingEdges.get(lastNodeId) || [];
    
    if (incomingToFirst.length === 0 || outgoingFromLast.length === 0) return;
    
    const parentEdge = incomingToFirst[0];
    const childEdge = outgoingFromLast[0];
    
    // Mark nodes and edges for removal
    chain.forEach(nodeId => {
      nodesToRemove.add(nodeId);
      (incomingEdges.get(nodeId) || []).forEach(e => edgesToRemove.add(e.id));
      (outgoingEdges.get(nodeId) || []).forEach(e => edgesToRemove.add(e.id));
    });
    
    // Collect truncated property names and types
    const truncatedProperties = chain
      .map(nodeId => {
        const node = nodes.find(n => n.id === nodeId);
        return {
          label: node?.data.label || nodeId,
          type: node?.data.type
        };
      })
      .filter(Boolean);
    
    // Get the first node's position to place the representative node
    const firstNode = nodes.find(n => n.id === firstNodeId);
    const position = firstNode?.position || { x: 0, y: 0 };
    
    // Create a representative node for the truncated chain
    const representativeNodeId = `truncated-chain-${chainIndex}`;
    const representativeNode: Node = {
      id: representativeNodeId,
      type: 'schemaType',
      position,
      data: {
        label: `${chain.length} properties`,
        type: 'truncated',
        isTruncatedRepresentative: true,
        truncatedProperties: truncatedProperties,
        nodeType: 'property'
      }
    };
    
    newNodes.push(representativeNode);
    
    // Create edges: parent -> representative -> child
    newEdges.push({
      id: `${parentEdge.source}-${representativeNodeId}`,
      source: parentEdge.source,
      target: representativeNodeId,
      type: 'default'
    });
    
    newEdges.push({
      id: `${representativeNodeId}-${childEdge.target}`,
      source: representativeNodeId,
      target: childEdge.target,
      type: 'default'
    });
  });
  
  // Build final node and edge lists
  const finalNodes = [
    ...nodes.filter(node => !nodesToRemove.has(node.id)),
    ...newNodes
  ];
  
  const finalEdges = [
    ...edges.filter(edge => !edgesToRemove.has(edge.id)),
    ...newEdges
  ];
  
  return {
    nodes: finalNodes,
    edges: finalEdges
  };
};
