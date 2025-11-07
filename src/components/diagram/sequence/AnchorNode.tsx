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
      {/* Both source and target handles on left side */}
      <Handle 
        type="target" 
        position={Position.Left}
        id="left"
        className="!opacity-0 !pointer-events-none" 
      />
      <Handle 
        type="source" 
        position={Position.Left}
        id="left"
        className="!opacity-0 !pointer-events-none" 
      />
      
      <div
        className="w-full h-full rounded-full border-2 shadow-md cursor-move transition-all hover:scale-125 hover:shadow-lg"
        style={{
          backgroundColor: '#3b82f6',
          borderColor: '#1e40af',
        }}
      />
      
      {/* Both source and target handles on right side */}
      <Handle 
        type="source" 
        position={Position.Right}
        id="right"
        className="!opacity-0 !pointer-events-none" 
      />
      <Handle 
        type="target" 
        position={Position.Right}
        id="right"
        className="!opacity-0 !pointer-events-none" 
      />
    </div>
  );
};
