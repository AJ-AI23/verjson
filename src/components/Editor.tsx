
import React, { useState, useEffect } from 'react';
import { SplitPane } from '@/components/SplitPane';
import { JsonEditor } from '@/components/JsonEditor';
import { SchemaDiagram } from '@/components/SchemaDiagram';
import { toast } from 'sonner';
import { defaultSchema } from '@/lib/defaultSchema';
import { defaultOasSchema } from '@/lib/defaultOasSchema';
import { 
  parseJsonSchema, 
  validateJsonSchema, 
  extractSchemaComponents, 
  SchemaType 
} from '@/lib/schemaUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileJson, FileCode } from 'lucide-react';

export const Editor = () => {
  const [schema, setSchema] = useState(defaultSchema);
  const [parsedSchema, setParsedSchema] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [schemaType, setSchemaType] = useState<SchemaType>('json-schema');

  useEffect(() => {
    try {
      // Parse and validate the schema based on the selected type
      const parsed = validateJsonSchema(schema, schemaType);
      // Extract the relevant schema components for visualization
      const schemaForDiagram = extractSchemaComponents(parsed, schemaType);
      setParsedSchema(schemaForDiagram);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      toast.error('Invalid Schema', {
        description: (err as Error).message,
      });
    }
  }, [schema, schemaType]);

  const handleEditorChange = (value: string) => {
    setSchema(value);
  };

  const handleSchemaTypeChange = (value: SchemaType) => {
    setSchemaType(value);
    // Update the schema content with the default for the selected type
    if (value === 'json-schema') {
      setSchema(defaultSchema);
    } else if (value === 'oas-3.1') {
      setSchema(defaultOasSchema);
    }
    toast.success(`Switched to ${value === 'json-schema' ? 'JSON Schema' : 'OpenAPI 3.1'} mode`);
  };

  return (
    <div className="json-schema-editor">
      <div className="mb-4 flex items-center gap-4">
        <Select value={schemaType} onValueChange={(value) => handleSchemaTypeChange(value as SchemaType)}>
          <SelectTrigger className="w-[200px]">
            <div className="flex items-center gap-2">
              {schemaType === 'json-schema' ? (
                <FileJson className="h-4 w-4" />
              ) : (
                <FileCode className="h-4 w-4" />
              )}
              <SelectValue placeholder="Select schema type" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json-schema">JSON Schema</SelectItem>
            <SelectItem value="oas-3.1">OpenAPI 3.1</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">
          {schemaType === 'json-schema' 
            ? 'Standard JSON Schema format'
            : 'OpenAPI 3.1 specification format with JSON Schema components'}
        </span>
      </div>
      <SplitPane>
        <JsonEditor 
          value={schema} 
          onChange={handleEditorChange} 
          error={error}
        />
        <SchemaDiagram 
          schema={parsedSchema}
          error={error !== null}
        />
      </SplitPane>
    </div>
  );
};
