import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Loader2, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { loadRedocly, validateOpenAPISpec } from '@/lib/redoclyUtils';
import { parseJsonSchema } from '@/lib/schemaUtils';

interface RedoclyDialogProps {
  schema: string;
  documentName?: string;
  disabled?: boolean;
}

export const RedoclyDialog: React.FC<RedoclyDialogProps> = ({
  schema,
  documentName,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [redoclyReady, setRedoclyReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const renderRedocly = async () => {
    if (!containerRef.current || !schema) return;

    setIsLoading(true);
    setError(null);

    try {
      // Parse and validate the OpenAPI specification
      const parsedSchema = parseJsonSchema(schema);
      if (!parsedSchema) {
        throw new Error('Invalid JSON schema provided');
      }

      const validationResult = validateOpenAPISpec(parsedSchema);
      if (!validationResult.isValid) {
        throw new Error(validationResult.error || 'Invalid OpenAPI specification');
      }

      // Load Redocly library
      await loadRedocly();

      // Clear container
      containerRef.current.innerHTML = '';

      // Create Redocly container
      const redocContainer = document.createElement('div');
      redocContainer.style.height = '100%';
      redocContainer.style.width = '100%';
      containerRef.current.appendChild(redocContainer);

      // Initialize Redocly
      const RedocStandalone = (window as any).RedocStandalone;
      if (!RedocStandalone) {
        console.error('RedocStandalone not found on window object. Available keys:', Object.keys(window).filter(k => k.toLowerCase().includes('redoc')));
        throw new Error('Redocly library failed to load - RedocStandalone not available');
      }

      console.log('Initializing Redocly with schema:', parsedSchema.info?.title || 'Untitled API');

      RedocStandalone.init(parsedSchema, {
        scrollYOffset: 0,
        hideDownloadButton: false,
        disableSearch: false,
        menuToggle: true,
        theme: {
          colors: {
            primary: {
              main: '#3b82f6', // Use a standard blue color instead of CSS variable
            },
          },
          typography: {
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          },
        },
        options: {
          noAutoAuth: true,
          hideHostname: false,
          expandResponses: 'all',
        },
      }, redocContainer);

      setRedoclyReady(true);
    } catch (err) {
      console.error('Failed to render Redocly:', err);
      setError(err instanceof Error ? err.message : 'Failed to render OpenAPI documentation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Small delay to ensure the dialog is fully rendered
      setTimeout(renderRedocly, 100);
    } else {
      setRedoclyReady(false);
      setError(null);
      setIsFullscreen(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2 h-8"
        >
          <BookOpen className="h-4 w-4" />
          <span>API Docs</span>
          <Badge variant="secondary" className="text-xs">
            Redocly
          </Badge>
        </Button>
      </DialogTrigger>
      
      <DialogContent 
        className={`${isFullscreen ? 'max-w-[95vw] h-[95vh]' : 'max-w-6xl h-[80vh]'} p-0 gap-0`}
      >
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                OpenAPI Documentation
                {documentName && (
                  <Badge variant="outline" className="text-xs">
                    {documentName}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Interactive API documentation powered by Redocly
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 w-8 p-0"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 relative overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading Redocly documentation...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 z-10">
              <Alert className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="mt-2">
                  {error}
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div 
            ref={containerRef}
            className="w-full h-full overflow-auto bg-background"
            style={{ display: error ? 'none' : 'block' }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};