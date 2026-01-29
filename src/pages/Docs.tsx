import React, { useState, useEffect } from 'react';
import { ManifestDocument } from '@/types/manifest';
import { ManifestEditor } from '@/components/manifest/ManifestEditor';
import { Loader2, AlertCircle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const DOCS_MANIFEST_URL = 'https://swghcmyqracwifpdfyap.supabase.co/functions/v1/public-document?id=293bfd86-ed55-4fdb-a09a-fbe71da891ec';

const Docs: React.FC = () => {
  const [manifest, setManifest] = useState<ManifestDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(DOCS_MANIFEST_URL);
        
        if (!response.ok) {
          throw new Error(`Failed to load documentation: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // The public-document endpoint returns the content directly or wrapped
        const content = data.content || data;
        
        // Validate it's a manifest document
        if (content.type !== 'manifest') {
          throw new Error('Invalid documentation format');
        }
        
        setManifest(content as ManifestDocument);
      } catch (err: any) {
        console.error('[Docs] Failed to fetch manifest:', err);
        setError(err.message || 'Failed to load documentation');
      } finally {
        setLoading(false);
      }
    };

    fetchManifest();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Loading documentation...</p>
        </div>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-semibold">Unable to Load Documentation</h1>
          <p className="text-muted-foreground">
            {error || 'The documentation could not be loaded. Please try again later.'}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
            <Button asChild>
              <Link to="/">Go Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="flex h-14 items-center px-4 gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>VerjSON Docs</span>
          </Link>
          <div className="flex-1" />
          <Button variant="outline" size="sm" asChild>
            <Link to="/">Back to App</Link>
          </Button>
        </div>
      </header>

      {/* Manifest Viewer */}
      <main className="flex-1">
        <ManifestEditor
          document={manifest}
          onDocumentChange={() => {}} // Read-only, no changes
          readOnly={true}
        />
      </main>
    </div>
  );
};

export default Docs;
