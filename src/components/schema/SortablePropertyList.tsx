import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export const SortableItem: React.FC<SortableItemProps> = ({ id, children, disabled = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "relative",
        isDragging && "z-50 opacity-80"
      )}
    >
      <div className="flex items-start">
        {!disabled && (
          <div
            {...attributes}
            {...listeners}
            className="flex items-center justify-center w-4 h-6 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground shrink-0"
          >
            <GripVertical className="h-3 w-3" />
          </div>
        )}
        <div className={cn("flex-1", !disabled && "-ml-1")}>
          {children}
        </div>
      </div>
    </div>
  );
};

interface SortablePropertyListProps {
  items: string[];
  onReorder: (oldIndex: number, newIndex: number) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export const SortablePropertyList: React.FC<SortablePropertyListProps> = ({
  items,
  onReorder,
  children,
  disabled = false,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      onReorder(oldIndex, newIndex);
    }
  };

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
};

// Helper function to reorder object properties
export const reorderObjectProperties = (
  obj: Record<string, any>,
  oldIndex: number,
  newIndex: number
): Record<string, any> => {
  const entries = Object.entries(obj);
  const movedEntries = arrayMove(entries, oldIndex, newIndex);
  return Object.fromEntries(movedEntries);
};

// Helper function to reorder array items
export const reorderArrayItems = <T,>(
  arr: T[],
  oldIndex: number,
  newIndex: number
): T[] => {
  return arrayMove(arr, oldIndex, newIndex);
};
