import React, { memo, useState } from 'react';
import { NotationsIndicator } from './NotationsIndicator';
import { NotationsPanel } from './NotationsPanel';
import { NotationComment } from '@/types/notations';

interface NodeNotationsProps {
  notations?: NotationComment[];
  notationCount?: number;
  hasNotations?: boolean;
  onAddNotation?: (user: string, message: string) => void;
}

export const NodeNotations = memo(({ 
  notations = [], 
  notationCount = 0, 
  hasNotations = false, 
  onAddNotation 
}: NodeNotationsProps) => {
  const [isNotationsExpanded, setIsNotationsExpanded] = useState(false);

  const handleAddNotation = (user: string, message: string) => {
    if (onAddNotation) {
      onAddNotation(user, message);
    }
  };

  if (!hasNotations && !onAddNotation) {
    return null;
  }

  return (
    <>
      <NotationsIndicator
        count={notationCount}
        isExpanded={isNotationsExpanded}
        onClick={() => setIsNotationsExpanded(!isNotationsExpanded)}
        hasAddFunction={!!onAddNotation}
      />
      {(hasNotations || onAddNotation) && (
        <NotationsPanel
          notations={notations}
          isExpanded={isNotationsExpanded}
          onAddNotation={onAddNotation ? handleAddNotation : undefined}
        />
      )}
    </>
  );
});

NodeNotations.displayName = 'NodeNotations';