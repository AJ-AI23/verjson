/**
 * Estimates node dimensions based on content for layout calculations.
 * Used by the tree layout engine to prevent node overlaps.
 */

export interface NodeDimensions {
  width: number;
  height: number;
}

// Base sizes for different node types
const BASE_SIZES: Record<string, NodeDimensions> = {
  root: { width: 200, height: 60 },
  property: { width: 180, height: 50 },
  info: { width: 220, height: 80 },
  endpoint: { width: 240, height: 60 },
  method: { width: 200, height: 70 },
  response: { width: 160, height: 50 },
  contentType: { width: 180, height: 50 },
  requestBody: { width: 180, height: 60 },
  parameters: { width: 180, height: 50 },
  security: { width: 160, height: 50 },
  components: { width: 200, height: 60 },
  arrayItem: { width: 160, height: 50 },
  groupedProperties: { width: 200, height: 80 },
  server: { width: 180, height: 50 },
  tag: { width: 160, height: 50 },
  default: { width: 180, height: 50 },
};

// Character width estimate (in pixels)
const CHAR_WIDTH = 7;
const MIN_LABEL_PADDING = 40;
const MAX_WIDTH = 320;
const MIN_WIDTH = 120;

// Height per property row
const PROPERTY_ROW_HEIGHT = 20;
const MAX_VISIBLE_PROPERTIES = 6;

/**
 * Estimates the dimensions of a node based on its data
 */
export function estimateNodeSize(nodeData: any, nodeId?: string): NodeDimensions {
  // Determine node type
  let nodeType = nodeData?.nodeType || 'default';
  
  // Infer from node ID if nodeType not set
  if (nodeId) {
    if (nodeId === 'root') nodeType = 'root';
    else if (nodeId.startsWith('info')) nodeType = 'info';
    else if (nodeId.includes('endpoint')) nodeType = 'endpoint';
    else if (nodeId.includes('method')) nodeType = 'method';
    else if (nodeId.includes('response')) nodeType = 'response';
    else if (nodeId.includes('contentType')) nodeType = 'contentType';
    else if (nodeId.includes('requestBody')) nodeType = 'requestBody';
    else if (nodeId.includes('parameters')) nodeType = 'parameters';
    else if (nodeId.includes('security')) nodeType = 'security';
    else if (nodeId.includes('components')) nodeType = 'components';
    else if (nodeId.includes('arrayItem')) nodeType = 'arrayItem';
    else if (nodeId.includes('grouped')) nodeType = 'groupedProperties';
  }
  
  const base = BASE_SIZES[nodeType] || BASE_SIZES.default;
  
  // Calculate width based on label/title length
  let width = base.width;
  const label = nodeData?.label || nodeData?.title || nodeData?.name || '';
  if (label) {
    const labelWidth = label.length * CHAR_WIDTH + MIN_LABEL_PADDING;
    width = Math.max(width, Math.min(labelWidth, MAX_WIDTH));
  }
  
  // Ensure minimum width
  width = Math.max(width, MIN_WIDTH);
  
  // Calculate height based on content
  let height = base.height;
  
  // Add height for description if present
  if (nodeData?.description) {
    const descLines = Math.ceil(nodeData.description.length / 30);
    height += Math.min(descLines, 2) * 16;
  }
  
  // Add height for inline properties if shown
  if (nodeData?.properties && typeof nodeData.properties === 'number') {
    const propCount = Math.min(nodeData.properties, MAX_VISIBLE_PROPERTIES);
    height += propCount * PROPERTY_ROW_HEIGHT;
  }
  
  // Add height for grouped properties
  if (nodeData?.groupedProperties && Array.isArray(nodeData.groupedProperties)) {
    const groupCount = Math.min(nodeData.groupedProperties.length, MAX_VISIBLE_PROPERTIES);
    height += groupCount * PROPERTY_ROW_HEIGHT;
  }
  
  return { width, height };
}

/**
 * Gets the estimated size for a collection of nodes
 */
export function estimateNodeSizes(nodes: Array<{ id: string; data: any }>): Map<string, NodeDimensions> {
  const sizes = new Map<string, NodeDimensions>();
  
  for (const node of nodes) {
    sizes.set(node.id, estimateNodeSize(node.data, node.id));
  }
  
  return sizes;
}
