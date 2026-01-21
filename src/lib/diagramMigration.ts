import { DiagramDocument, SequenceDiagramData, DiagramNode } from '@/types/diagram';

/**
 * Migrates old diagram documents to the current schema format.
 * Handles:
 * - Schema restructuring: version/metadata → verjson/info
 * - Swimlanes/columns to lifeline-based structure
 * - Anchor format updates
 */
export const migrateDiagramDocument = (document: any): DiagramDocument => {
  // First, migrate the root structure if needed (version/metadata → verjson/info)
  let migratedDoc = migrateSchemaStructure(document);
  
  if (migratedDoc.type !== 'sequence') {
    return migratedDoc;
  }

  const data = migratedDoc.data as any;

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
      ...migratedDoc,
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
    // Track anchor counter for generating incremental IDs
    let anchorCounter = 1;
    
    // First pass: find the highest existing anchor number
    data.nodes.forEach((node: any) => {
      if (node.anchors && Array.isArray(node.anchors)) {
        node.anchors.forEach((anchor: any) => {
          if (anchor.id && anchor.id.startsWith('anchor-')) {
            const num = parseInt(anchor.id.replace('anchor-', ''), 10);
            if (!isNaN(num) && num >= anchorCounter) {
              anchorCounter = num + 1;
            }
          }
        });
      }
    });
    
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
            id: node.anchors[0].id || `anchor-${anchorCounter++}`,
            lifelineId: node.anchors[0].lifelineId || lifelineId,
            yPosition: yPos,
            anchorType: 'source'
          },
          {
            id: node.anchors[1].id || `anchor-${anchorCounter++}`,
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
          id: `anchor-${anchorCounter++}`,
          lifelineId: sourceLifelineId,
          yPosition: yPos,
          anchorType: 'source'
        },
        {
          id: `anchor-${anchorCounter++}`,
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

  return migratedDoc;
};

/**
 * Migrates old schema structure (version/metadata) to new structure (verjson/info)
 */
const migrateSchemaStructure = (document: any): DiagramDocument => {
  // Already in new format
  if (document.verjson && document.info) {
    return document as DiagramDocument;
  }

  // Migrate from old format
  const oldVersion = document.version;
  const oldMetadata = document.metadata || {};

  console.log('🔄 Migrating diagram schema structure: version/metadata → verjson/info');

  const migratedDocument: DiagramDocument = {
    verjson: '1.0.0',
    type: document.type || 'sequence',
    info: {
      version: oldVersion || '0.1.0',
      title: oldMetadata.title || 'Untitled Diagram',
      description: oldMetadata.description,
      author: oldMetadata.author,
      created: oldMetadata.created,
      modified: oldMetadata.modified || new Date().toISOString()
    },
    data: document.data || { lifelines: [], nodes: [] },
    styles: document.styles,
    selectedTheme: document.selectedTheme
  };

  // Clean up undefined properties from info
  Object.keys(migratedDocument.info).forEach(key => {
    if ((migratedDocument.info as any)[key] === undefined) {
      delete (migratedDocument.info as any)[key];
    }
  });

  return migratedDocument;
};
