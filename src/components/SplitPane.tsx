
import React, { ReactNode } from 'react';
import * as ResizablePrimitive from 'react-resizable-panels';
import { cn } from '@/lib/utils';

interface SplitPaneProps {
  children: ReactNode[];
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export const SplitPane = ({ 
  children, 
  direction = 'horizontal',
  className 
}: SplitPaneProps) => {
  return (
    <ResizablePrimitive.PanelGroup
      direction={direction}
      className={cn(
        "h-full w-full flex",
        direction === 'horizontal' ? 'flex-row' : 'flex-col',
        className
      )}
    >
      <ResizablePrimitive.Panel defaultSize={50} minSize={30}>
        {children[0]}
      </ResizablePrimitive.Panel>
      <ResizablePrimitive.PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/20 transition-colors duration-200">
        <div className="h-full w-full flex items-center justify-center">
          <div className="h-8 w-1 rounded-full bg-slate-300" />
        </div>
      </ResizablePrimitive.PanelResizeHandle>
      <ResizablePrimitive.Panel defaultSize={50} minSize={30}>
        {children[1]}
      </ResizablePrimitive.Panel>
    </ResizablePrimitive.PanelGroup>
  );
};
