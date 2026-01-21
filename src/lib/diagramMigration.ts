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
      nodes: migratedNodes
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

  // Update nodes to embed anchors instead of using separate arrays
  if (data.nodes) {
    data.nodes = data.nodes.map((node: any, index: number) => {
      const updatedNode = { ...node };
      
      // Get the lifeline ID (from old or new structure)
      let lifelineId = node.lifelineId || node.swimlaneId || node.columnId;
      
      // If no lifeline, use first lifeline or create default
      if (!lifelineId && data.lifelines && data.lifelines.length > 0) {
        lifelineId = data.lifelines[0].id;
      }
      
      // If node already has anchors with full AnchorNode structure, keep it
      if (node.anchors && Array.isArray(node.anchors) && node.anchors.length === 2) {
        // Check if anchors are already full AnchorNode objects (have yPosition and anchorType)
        if (node.anchors[0].yPosition !== undefined && node.anchors[0].anchorType !== undefined) {
          return updatedNode;
        }
        
        // Convert from old reference format to full AnchorNode objects
        const yPos = node.position?.y || 100 + index * 140;
        updatedNode.anchors = [
          {
            id: node.anchors[0].id || `${node.id}-anchor-source`,
            lifelineId: node.anchors[0].lifelineId || lifelineId,
            yPosition: yPos,
            anchorType: 'source'
          },
          {
            id: node.anchors[1].id || `${node.id}-anchor-target`,
            lifelineId: node.anchors[1].lifelineId || (data.lifelines && data.lifelines.length > 1 ? data.lifelines[1].id : lifelineId),
            yPosition: yPos,
            anchorType: 'target'
          }
        ];
        
        return updatedNode;
      }
      
      // Create new full anchor structure
      const sourceLifelineId = lifelineId;
      const targetLifelineId = data.lifelines && data.lifelines.length > 1 
        ? data.lifelines[1].id 
        : sourceLifelineId;
      
      const yPos = node.position?.y || 100 + index * 140;
      
      updatedNode.anchors = [
        {
          id: `${node.id}-anchor-source`,
          lifelineId: sourceLifelineId,
          yPosition: yPos,
          anchorType: 'source'
        },
        {
          id: `${node.id}-anchor-target`,
          lifelineId: targetLifelineId,
          yPosition: yPos,
          anchorType: 'target'
        }
      ];
      
      // Remove old properties
      delete updatedNode.lifelineId;
      delete updatedNode.swimlaneId;
      delete updatedNode.columnId;
      delete updatedNode.sourceAnchorId;
      delete updatedNode.targetAnchorId;
      
      return updatedNode;
    });
    
    // Remove the global anchors array if it exists
    delete data.anchors;
  }

  return document;
};
