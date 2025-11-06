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
}

export const NodeRenderer = memo(({ data, id, isConnectable, onAddNotation, expandedNotationPaths }: NodeRendererProps) => {
  // Check if this is a grouped properties node first
  if (data.isGroupedProperties || id.includes('grouped')) {
    return <SchemaTypeNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} expandedNotationPaths={expandedNotationPaths} />;
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
      return <InfoNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} />;
    case 'endpoint':
      return <EndpointNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} />;
    case 'components':
      return <ComponentsNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} />;
    case 'method':
      return <MethodNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} />;
    case 'response':
      return <ResponseNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} />;
    case 'contentType':
      return <ContentTypeNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} />;
    case 'requestBody':
      return <RequestBodyNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} />;
    case 'parameters':
      return <ParametersNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} />;
    case 'tags':
      return <MethodTagsNode data={data} id={id} isConnectable={isConnectable} />;
    case 'security':
      return <SecurityNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} />;
    default:
      return <SchemaTypeNode data={data} id={id} isConnectable={isConnectable} onAddNotation={onAddNotation} expandedNotationPaths={expandedNotationPaths} />;
  }
});

NodeRenderer.displayName = 'NodeRenderer';