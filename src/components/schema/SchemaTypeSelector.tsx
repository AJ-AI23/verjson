
import React from 'react';
import { FileJson, FileCode } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SchemaType } from '@/lib/schemaUtils';
import { defaultSchema } from '@/lib/defaultSchema';
import { defaultOasSchema } from '@/lib/defaultOasSchema';

interface SchemaSelectorProps {
  schemaType: SchemaType;
  onSchemaTypeChange: (type: SchemaType) => void;
  setSchema: (schema: string) => void;
  setSavedSchema: (schema: string) => void;
}

export const SchemaTypeSelector: React.FC<SchemaSelectorProps> = ({
  schemaType,
  onSchemaTypeChange,
  setSchema,
  setSavedSchema,
}) => {
  const handleSchemaTypeChange = (value: SchemaType) => {
    onSchemaTypeChange(value);
    // Update the schema content with the default for the selected type
    if (value === 'json-schema') {
      setSchema(defaultSchema);
      setSavedSchema(defaultSchema);
    } else if (value === 'oas-3.1') {
      setSchema(defaultOasSchema);
      setSavedSchema(defaultOasSchema);
    }
    toast.success(`Switched to ${value === 'json-schema' ? 'JSON Schema' : 'OpenAPI 3.1'} mode`);
  };

  return (
    <div>
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
  );
};
