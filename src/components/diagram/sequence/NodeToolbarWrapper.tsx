import React, { useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { NodeToolbar, EntityType } from './NodeToolbar';

interface NodeToolbarWrapperProps {
  diagramPosition: { x: number; y: number } | null;
  selectedCount: number;
  entityType?: EntityType;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  canDuplicate?: boolean;
  duplicateDisabledReason?: string;
}

export const NodeToolbarWrapper: React.FC<NodeToolbarWrapperProps> = ({
  diagramPosition,
  selectedCount,
  entityType = 'node',
  onEdit,
  onDelete,
  onDuplicate,
  canDuplicate = true,
  duplicateDisabledReason
}) => {
  const { getViewport } = useReactFlow();
  const [screenPosition, setScreenPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (diagramPosition) {
      const viewport = getViewport();
      // Convert diagram coordinates to screen coordinates
      const x = diagramPosition.x * viewport.zoom + viewport.x;
      const y = diagramPosition.y * viewport.zoom + viewport.y;
      setScreenPosition({ x, y });
    } else {
      setScreenPosition(null);
    }
  }, [diagramPosition, getViewport]);

  if (!screenPosition) return null;

  return (
    <NodeToolbar
      position={screenPosition}
      selectedCount={selectedCount}
      entityType={entityType}
      onEdit={onEdit}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
      canDuplicate={canDuplicate}
      duplicateDisabledReason={duplicateDisabledReason}
    />
  );
};
