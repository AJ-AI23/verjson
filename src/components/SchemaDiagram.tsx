import React, { useEffect, useState, useRef } from 'react';
import { 
  ReactFlow,
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SchemaTypeNode } from '@/components/SchemaTypeNode';
import { generateNodesAndEdges } from '@/lib/diagram';

interface SchemaDiagramProps {
  schema: any;
  error: boolean;
  groupProperties?: boolean;
}

const nodeTypes = {
  schemaType: SchemaTypeNode,
};

export const SchemaDiagram = ({ schema, error, groupProperties = false }: SchemaDiagramProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [prevGroupSetting, setPrevGroupSetting] = useState(groupProperties);
  const [schemaKey, setSchemaKey] = useState(0); // Key for tracking schema changes
  const nodePositionsRef = useRef<Record<string, { x: number, y: number }>>({});

  // Store node positions when they change
  useEffect(() => {
    if (nodes.length > 0) {
      const newPositions: Record<string, { x: number, y: number }> = {};
      nodes.forEach(node => {
        newPositions[node.id] = { x: node.position.x, y: node.position.y };
      });
      nodePositionsRef.current = newPositions;
    }
  }, [nodes]);

  // Generate a new schema key when schema changes to force complete re-evaluation
  useEffect(() => {
    if (schema) {
      setSchemaKey(prev => prev + 1);
    }
  }, [schema, error, groupProperties]);

  // Effect for schema or error changes
  useEffect(() => {
    if (schema && !error) {
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
      
      // Apply saved positions to new nodes where possible
      const positionedNodes = newNodes.map(node => {
        if (nodePositionsRef.current[node.id]) {
          return {
            ...node,
            position: nodePositionsRef.current[node.id]
          };
        }
        return node;
      });
      
      // Always reset both nodes and edges completely to avoid orphaned edges
      setNodes(positionedNodes);
      // Ensure we start with a clean slate for edges
      setEdges([]);
      // Then add the new edges after a small delay to ensure nodes are rendered
      setTimeout(() => {
        setEdges(newEdges);
      }, 50);
    } else {
      // Clear both nodes and edges when there's an error or no schema
      setNodes([]);
      setEdges([]);
    }
  }, [schema, error, groupProperties, setNodes, setEdges, schemaKey]);

  // Effect specifically for groupProperties toggle changes
  useEffect(() => {
    if (prevGroupSetting !== groupProperties) {
      // Force a complete reset of edges when toggling the grouping mode
      setPrevGroupSetting(groupProperties);
      
      if (schema && !error) {
        const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
        
        // When changing group mode, try to maintain positions where possible
        const positionedNodes = newNodes.map(node => {
          if (nodePositionsRef.current[node.id]) {
            return {
              ...node,
              position: nodePositionsRef.current[node.id]
            };
          }
          return node;
        });
        
        // Clear edges before setting nodes to avoid orphaned edges
        setEdges([]);
        setNodes(positionedNodes);
        
        // Add edges after a small delay to ensure nodes are rendered
        setTimeout(() => {
          validateAndSetEdges(newEdges);
        }, 50);
      }
    }
  }, [groupProperties, prevGroupSetting, schema, error, setNodes, setEdges]);

  // Validate edges against nodes to ensure no orphaned edges
  useEffect(() => {
    if (nodes.length > 0) {
      validateAndSetEdges(edges);
    } else if (nodes.length === 0 && edges.length > 0) {
      // If there are no nodes but there are edges, clear the edges
      setEdges([]);
    }
  }, [nodes, edges.length, setEdges]);

  // Helper function to validate edges
  const validateAndSetEdges = (currentEdges: Edge[]) => {
    if (nodes.length === 0) {
      setEdges([]);
      return;
    }
    
    // Get all valid node IDs
    const nodeIds = new Set(nodes.map(node => node.id));
    
    // Filter edges to only include those where both source and target exist
    const validEdges = currentEdges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
    
    // If we filtered out any edges, update the edges state
    if (validEdges.length !== currentEdges.length) {
      console.log(`Removed ${currentEdges.length - validEdges.length} orphaned edges`);
      setEdges(validEdges);
    }
  };

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-2 border-b bg-slate-50">
          <h2 className="font-semibold text-slate-700">Schema Diagram</h2>
        </div>
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="p-4 text-center text-slate-500">
            <p>Fix Schema errors to view diagram</p>
          </div>
        </div>
      </div>
    );
  }

  if (!schema || (Array.isArray(nodes) && nodes.length === 0)) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-2 border-b bg-slate-50">
          <h2 className="font-semibold text-slate-700">Schema Diagram</h2>
        </div>
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="p-4 text-center text-slate-500">
            <p>No schema components to display</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-slate-50">
        <h2 className="font-semibold text-slate-700">Schema Diagram</h2>
      </div>
      <div className="flex-1 diagram-container">
        <ReactFlow
          key={`flow-${schemaKey}`}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView={nodes.length > 0 && !Object.keys(nodePositionsRef.current).length}
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.5}
          maxZoom={2}
          deleteKeyCode={null} // Disable deletion with Delete key
        >
          <Controls />
          <Background gap={16} size={1} color="#e5e7eb" />
        </ReactFlow>
      </div>
    </div>
  );
};
