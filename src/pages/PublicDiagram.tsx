import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SequenceDiagramRenderer } from '@/components/diagram/sequence/SequenceDiagramRenderer';
import { DiagramDocument, SequenceDiagramData } from '@/types/diagram';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PublicDiagram: React.FC = () => {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const theme = searchParams.get('theme') || 'light';
  
  const [diagram, setDiagram] = useState<DiagramDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublicDiagram = async () => {
      if (!documentId) {
        setError('No diagram ID provided');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase.functions.invoke('public-diagram', {
          body: { id: documentId, theme }
        });

        if (fetchError) throw fetchError;

        if (data.error) {
          throw new Error(data.error);
        }

        setDiagram(data.content);
      } catch (err) {
        console.error('Error fetching public diagram:', err);
        setError(err instanceof Error ? err.message : 'Failed to load diagram');
      } finally {
        setLoading(false);
      }
    };

    fetchPublicDiagram();
  }, [documentId, theme]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading diagram...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold">Error Loading Diagram</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!diagram) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Diagram not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      {diagram.type === 'sequence' && (
        <SequenceDiagramRenderer
          data={diagram.data as SequenceDiagramData}
          readOnly={true}
        />
      )}
    </div>
  );
};
