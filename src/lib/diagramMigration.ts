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

    const migratedData: SequenceDiagramData = {
      lifelines: [defaultLifeline],
      nodes: (data.nodes || []).map((node: any) => ({
        ...node,
        lifelineId: node.lifelineId || defaultLifeline.id
      })),
      edges: data.edges || [],
      anchors: []
    };

    return {
      ...document,
      data: migratedData
    };
  }

  return document;
};
