
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SchemaTypeNodeProps {
  id: string;
  data: {
    label: string;
    type?: string;
    required?: boolean;
    description?: string;
    properties?: number;
    items?: { type: string };
    minItems?: number;
    maxItems?: number;
    hasMoreChildren?: boolean;
    expandable?: boolean;
    expanded?: boolean;
    onExpand?: () => void;
  };
}

export const SchemaTypeNode: React.FC<SchemaTypeNodeProps> = ({ id, data }) => {
  // Get type-specific styles
  const getNodeTypeClass = () => {
    if (data.type === 'object') return 'bg-blue-50 border-blue-300';
    if (data.type === 'array') return 'bg-purple-50 border-purple-300';
    if (data.type === 'string') return 'bg-green-50 border-green-300';
    if (data.type === 'number' || data.type === 'integer') return 'bg-yellow-50 border-yellow-300';
    if (data.type === 'boolean') return 'bg-pink-50 border-pink-300';
    if (data.label === 'Properties') return 'bg-gray-50 border-gray-300';
    // Group node
    return 'bg-gray-50 border-gray-300';
  };

  return (
    <div 
      className={`px-3 py-2 rounded-md border ${getNodeTypeClass()} min-w-[140px] max-w-[240px] shadow-sm`}
    >
      <Handle type="target" position={Position.Top} />
      
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm truncate" title={data.label}>
          {data.label}
        </div>
        
        {/* Show expand/collapse button if the node has more children to show */}
        {data.expandable && (
          <button 
            className="p-1 rounded hover:bg-gray-200 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (data.onExpand) data.onExpand();
            }}
            title={data.expanded ? "Collapse" : "Expand"}
          >
            {data.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}

        {/* Show indicator that there are more items beyond the depth limit */}
        {!data.expandable && data.hasMoreChildren && (
          <span className="text-xs text-gray-500 px-1 bg-gray-100 rounded">...</span>
        )}
      </div>
      
      {/* Type badge */}
      {data.type && (
        <div className="mt-1 flex items-center gap-1">
          <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
            {data.type}
          </span>
          {data.required && (
            <span className="text-xs px-1.5 py-0.5 bg-red-100 rounded text-red-600">
              required
            </span>
          )}
        </div>
      )}
      
      {/* Show counts if available */}
      {(data.properties !== undefined || data.minItems !== undefined || data.maxItems !== undefined) && (
        <div className="mt-1 text-xs text-gray-500">
          {data.properties !== undefined && (
            <span>{data.properties} properties</span>
          )}
          {data.minItems !== undefined && data.maxItems !== undefined && (
            <span>items: {data.minItems}-{data.maxItems}</span>
          )}
          {data.minItems !== undefined && data.maxItems === undefined && (
            <span>min items: {data.minItems}</span>
          )}
          {data.maxItems !== undefined && data.minItems === undefined && (
            <span>max items: {data.maxItems}</span>
          )}
        </div>
      )}
      
      {/* Description tooltip */}
      {data.description && (
        <div className="mt-1 text-xs text-gray-500 truncate" title={data.description}>
          {data.description.length > 50
            ? `${data.description.substring(0, 50)}...`
            : data.description
          }
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};
