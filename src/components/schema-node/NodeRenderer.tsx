import React, { memo } from 'react';
import { SchemaTypeNode } from './SchemaTypeNode';
import { InfoNode } from './InfoNode';
import { EndpointNode } from './EndpointNode';
import { ComponentsNode } from './ComponentsNode';
import { MethodNode } from './MethodNode';
import { ResponseNode } from './ResponseNode';
import { ContentTypeNode } from './ContentTypeNode';
import { RequestBodyNode } from './RequestBodyNode';
import { ParametersNode } from './ParametersNode';
import { MethodTagsNode } from './MethodTagsNode';
import { SecurityNode } from './SecurityNode';

interface NodeRendererProps {
  data: any;
  id: string;
  isConnectable: boolean;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  expandedNotationPaths?: Set<string>;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const NodeRenderer = memo(({ data, id, isConnectable, onAddNotation, expandedNotationPaths, onToggleCollapse }: NodeRendererProps) => {
  // Check if this is a grouped properties node first
  if (data.isGroupedProperties || id.includes('grouped')) {
    return <SchemaTypeNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} expandedNotationPaths={expandedNotationPaths} onToggleCollapse={onToggleCollapse} />;
  }
  
  const nodeType = data.nodeType || (id.includes('info') ? 'info' : 
                   id.includes('endpoint') ? 'endpoint' :
                   id.includes('components') && !id.includes('grouped') ? 'components' :
                   id.includes('method') ? 'method' :
                   id.includes('response') ? 'response' :
                   id.includes('content-type') ? 'contentType' :
                   id.includes('request-body') ? 'requestBody' :
                   id.startsWith('parameters-') ? 'parameters' :
                   id.startsWith('tags-') ? 'tags' :
                   id.startsWith('security-') ? 'security' :
                   'schemaType');

  switch (nodeType) {
    case 'info':
      return <InfoNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} onToggleCollapse={onToggleCollapse} />;
    case 'endpoint':
      return <EndpointNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} onToggleCollapse={onToggleCollapse} />;
    case 'components':
      return <ComponentsNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} onToggleCollapse={onToggleCollapse} />;
    case 'method':
      return <MethodNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} onToggleCollapse={onToggleCollapse} />;
    case 'response':
      return <ResponseNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} onToggleCollapse={onToggleCollapse} />;
    case 'contentType':
      return <ContentTypeNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} onToggleCollapse={onToggleCollapse} />;
    case 'requestBody':
      return <RequestBodyNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} onToggleCollapse={onToggleCollapse} />;
    case 'parameters':
      return <ParametersNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} onToggleCollapse={onToggleCollapse} />;
    case 'tags':
      return <MethodTagsNode data={data} id={id} isConnectable={isConnectable} onToggleCollapse={onToggleCollapse} />;
    case 'security':
      return <SecurityNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} onToggleCollapse={onToggleCollapse} />;
    default:
      return <SchemaTypeNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} expandedNotationPaths={expandedNotationPaths} onToggleCollapse={onToggleCollapse} />;
  }
});

NodeRenderer.displayName = 'NodeRenderer';