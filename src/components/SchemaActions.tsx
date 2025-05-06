
import React, { useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ImportIcon, ExportIcon, FileJson } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SchemaType } from '@/lib/schemaUtils';
import { defaultSchema } from '@/lib/defaultSchema';
import { defaultOasSchema } from '@/lib/defaultOasSchema';

interface SchemaActionsProps {
  currentSchema: string;
  schemaType: SchemaType;
  onImport: (schema: string, detectedType?: SchemaType) => void;
}

export const SchemaActions: React.FC<SchemaActionsProps> = ({
  currentSchema,
  schemaType,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Handle file selection for import
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedSchema = JSON.parse(content);
        
        // Detect schema type
        let detectedType: SchemaType | undefined = undefined;
        if (parsedSchema.openapi) {
          detectedType = 'oas-3.1';
        } else if (parsedSchema.type) {
          detectedType = 'json-schema';
        }
        
        onImport(content, detectedType);
        toast.success(`Successfully imported schema`);
      } catch (error) {
        toast.error('Failed to import file', {
          description: 'The selected file is not valid JSON',
        });
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsText(file);
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Trigger file input click
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Generate sample schema based on current type
  const handleGenerateSample = () => {
    if (schemaType === 'json-schema') {
      onImport(defaultSchema);
      toast.success('Generated sample JSON Schema');
    } else {
      onImport(defaultOasSchema);
      toast.success('Generated sample OpenAPI 3.1 Schema');
    }
  };
  
  // Export current schema
  const handleExport = () => {
    try {
      const blob = new Blob([currentSchema], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Set filename based on schema type
      const fileName = schemaType === 'json-schema' 
        ? 'schema.json' 
        : 'openapi.json';
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Schema exported as ${fileName}`);
    } catch (error) {
      toast.error('Failed to export schema');
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
        data-testid="schema-file-input"
      />
      
      {/* Import Button with Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-1">
            <ImportIcon className="h-4 w-4" />
            <span>Import</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={handleImportClick}>
            From File
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGenerateSample}>
            <FileJson className="h-4 w-4 mr-2" />
            Generate Sample
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Export Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        className="flex items-center gap-1"
      >
        <ExportIcon className="h-4 w-4" />
        <span>Export</span>
      </Button>
    </div>
  );
};
