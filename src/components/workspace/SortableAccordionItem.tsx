import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { GripVertical } from 'lucide-react';

interface SortableAccordionItemProps {
  id: string;
  children: React.ReactNode;
  triggerContent: React.ReactNode;
  value: string;
}

export function SortableAccordionItem({ id, children, triggerContent, value }: SortableAccordionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <AccordionItem ref={setNodeRef} style={style} value={value} className="relative">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-2 w-full">
          <div
            className="cursor-grab hover:cursor-grabbing p-1 hover:bg-muted rounded"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 text-left">
            {triggerContent}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}