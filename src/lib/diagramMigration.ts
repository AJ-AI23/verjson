import { DiagramDocument, SequenceDiagramData } from '@/types/diagram';

/**
 * Migrates old diagram documents with swimlanes/columns to new lifeline-based structure
 */
export const migrateDiagramDocument = (document: DiagramDocument): DiagramDocument => {
  if (document.type !== 'sequence') {
    return document;
  }

  const data = document.data as any;

  // Check if this is an old document with swimlanes and columns
  if (data.swimlanes || data.columns) {
    console.log('🔄 Migrating diagram document from old structure to lifeline-based structure');
    
    // Use columns as lifelines (columns were the vertical divisions)
    const lifelines = data.columns || [];
    
    // Update nodes to use lifelineId instead of columnId/swimlaneId
    const migratedNodes = (data.nodes || []).map((node: any) => {
      const { swimlaneId, columnId, ...rest } = node;
      return {
        ...rest,
        lifelineId: columnId || swimlaneId || lifelines[0]?.id
      };
    });

    const migratedData: SequenceDiagramData = {
      lifelines,
      nodes: migratedNodes,
      edges: data.edges || [],
      anchors: []
    };

    return {
      ...document,
      data: migratedData
    };
  }

  // Check if lifelines exist but might be undefined
  if (!data.lifelines) {
    console.warn('⚠️ Document has no lifelines, creating default lifeline');
    
    const defaultLifeline = {
      id: 'lifeline-default',
      name: 'Default',
      order: 0,
      description: 'Default lifeline'
    };

    data.lifelines = [defaultLifeline];
  }

  // Update nodes to use anchors array instead of lifelineId/swimlaneId/columnId
  if (data.nodes) {
    const anchors: any[] = [];
    
    data.nodes = data.nodes.map((node: any, index: number) => {
      const updatedNode = { ...node };
      
      // Get the lifeline ID (from old or new structure)
      let lifelineId = node.lifelineId || node.swimlaneId || node.columnId;
      
      // If no lifeline, use first lifeline or create default
      if (!lifelineId && data.lifelines && data.lifelines.length > 0) {
        lifelineId = data.lifelines[0].id;
      }
      
      // If node already has anchors array, keep it
      if (node.anchors && Array.isArray(node.anchors) && node.anchors.length === 2) {
        // Make sure anchors exist in anchors array
        node.anchors.forEach((anchor: any, anchorIndex: number) => {
          const anchorType = anchorIndex === 0 ? 'source' : 'target';
          const existingAnchor = data.anchors?.find((a: any) => a.id === anchor.id);
          
          if (!existingAnchor) {
            anchors.push({
              id: anchor.id,
              lifelineId: anchor.lifelineId,
              yPosition: node.position?.y || 100 + index * 140,
              connectedNodeId: node.id,
              anchorType
            });
          }
        });
        
        return updatedNode;
      }
      
      // Create new anchors structure
      const sourceLifelineId = lifelineId;
      const targetLifelineId = data.lifelines && data.lifelines.length > 1 
        ? data.lifelines[1].id 
        : sourceLifelineId;
      
      const sourceAnchorId = `anchor-${node.id}-source`;
      const targetAnchorId = `anchor-${node.id}-target`;
      
      updatedNode.anchors = [
        { lifelineId: sourceLifelineId, id: sourceAnchorId },
        { lifelineId: targetLifelineId, id: targetAnchorId }
      ];
      
      // Create anchor nodes
      const yPos = node.position?.y || 100 + index * 140;
      
      anchors.push({
        id: sourceAnchorId,
        lifelineId: sourceLifelineId,
        yPosition: yPos,
        connectedNodeId: node.id,
        anchorType: 'source'
      });
      
      anchors.push({
        id: targetAnchorId,
        lifelineId: targetLifelineId,
        yPosition: yPos,
        connectedNodeId: node.id,
        anchorType: 'target'
      });
      
      // Remove old properties
      delete updatedNode.lifelineId;
      delete updatedNode.swimlaneId;
      delete updatedNode.columnId;
      delete updatedNode.sourceAnchorId;
      delete updatedNode.targetAnchorId;
      
      return updatedNode;
    });
    
    // Add or merge anchors
    if (!data.anchors) {
      data.anchors = anchors;
    } else {
      data.anchors = [...data.anchors, ...anchors];
    }
  }

  return document;
};
