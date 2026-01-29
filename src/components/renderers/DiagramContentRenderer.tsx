import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { SequenceDiagramRenderer } from '@/components/diagram/sequence/SequenceDiagramRenderer';
import { SequenceDiagramData } from '@/types/diagram';
import { DiagramStyles, defaultLightTheme, defaultDarkTheme } from '@/types/diagramStyles';
import { cn } from '@/lib/utils';

interface DiagramDocument {
  verjson: string;
  type: 'sequence' | 'flowchart';
  info?: any;
  data: SequenceDiagramData;
  styles?: DiagramStyles;
  selectedTheme?: string;
}

interface DiagramContentRendererProps {
  document: DiagramDocument;
  theme?: 'light' | 'dark';
  className?: string;
}

/**
 * A read-only renderer for diagram documents.
 * Wraps the SequenceDiagramRenderer in a read-only facade.
 */
export const DiagramContentRenderer: React.FC<DiagramContentRendererProps> = ({
  document,
  theme,
  className,
}) => {
  const selectedTheme = theme || document.selectedTheme || 'light';
  
  // Get the appropriate styles theme
  const styles: DiagramStyles = document.styles || {
    themes: {
      light: defaultLightTheme,
      dark: defaultDarkTheme,
    },
  };

  // Only sequence diagrams are supported currently
  if (document.type !== 'sequence') {
    return (
      <div className={cn("flex items-center justify-center p-8 text-muted-foreground", className)}>
        <p>Diagram type "{document.type}" is not yet supported in preview mode.</p>
      </div>
    );
  }

  return (
    <div className={cn("diagram-content-renderer h-[400px] min-h-[300px]", className)}>
      <ReactFlowProvider>
        <SequenceDiagramRenderer
          data={document.data}
          styles={styles}
          theme={selectedTheme}
          readOnly={true}
        />
      </ReactFlowProvider>
    </div>
  );
};
