import { useEffect, useRef, useState } from 'react';
import { loadRedocly, isRedoclyAvailable } from '@/lib/redoclyUtils';
import { Loader2 } from 'lucide-react';

const ApiDocs = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initRedocly = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Loading Redocly library...');
        // Load Redocly library
        await loadRedocly();
        console.log('Redocly library loaded');

        if (!containerRef.current) {
          console.error('Container ref not available');
          return;
        }

        // Fetch and render the OpenAPI spec - use import.meta.url to get correct base path
        console.log('Fetching OpenAPI spec...');
        const response = await fetch(new URL('/api/openapi.json', window.location.origin).href);
        if (!response.ok) {
          throw new Error(`Failed to load OpenAPI specification: ${response.status} ${response.statusText}`);
        }
        const spec = await response.json();
        console.log('OpenAPI spec loaded:', spec.info?.title);

        // Clear container and render
        containerRef.current.innerHTML = '';
        
        if (isRedoclyAvailable() && window.RedocStandalone) {
          console.log('Initializing Redocly...');
          window.RedocStandalone.init(spec, {
            scrollYOffset: 0,
            hideDownloadButton: false,
            hideHostname: false,
            expandResponses: '200,201',
            pathInMiddlePanel: true,
            jsonSampleExpandLevel: 2,
            theme: {
              colors: {
                primary: {
                  main: '#3b82f6'
                }
              },
              typography: {
                fontFamily: 'system-ui, -apple-system, sans-serif',
                headings: {
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }
              },
              sidebar: {
                backgroundColor: '#f8fafc'
              }
            }
          }, containerRef.current);
          console.log('Redocly initialized');
        } else {
          throw new Error('Redocly library not available after loading');
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize Redocly:', err);
        setError(err instanceof Error ? err.message : 'Failed to load API documentation');
        setLoading(false);
      }
    };

    initRedocly();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Documentation</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading API Documentation...</p>
          </div>
        </div>
      )}
      <div ref={containerRef} className="redocly-container" />
    </div>
  );
};

export default ApiDocs;
