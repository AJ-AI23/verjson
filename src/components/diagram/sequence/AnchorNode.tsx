import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { DiagramStyleTheme } from '@/types/diagramStyles';

interface AnchorNodeProps {
  data: {
    lifelineId: string;
    styles?: DiagramStyleTheme;
  };
}

export const AnchorNode: React.FC<AnchorNodeProps> = ({ data }) => {
  const { styles } = data;
  
  return (
    <div
      className="relative"
      style={{
        width: '16px',
        height: '16px',
      }}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!opacity-0 !pointer-events-none" 
      />
      <div
        className="w-full h-full rounded-full border-2 shadow-md cursor-move transition-all hover:scale-125 hover:shadow-lg"
        style={{
          backgroundColor: '#3b82f6',
          borderColor: '#1e40af',
        }}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!opacity-0 !pointer-events-none" 
      />
    </div>
  );
};
