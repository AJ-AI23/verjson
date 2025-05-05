
import React, { useState, useRef, useEffect } from 'react';
import { SplitPane } from '@/components/SplitPane';
import { JsonEditor } from '@/components/JsonEditor';
import { SchemaDiagram } from '@/components/SchemaDiagram';
import { toast } from 'sonner';
import { defaultSchema } from '@/lib/defaultSchema';
import { parseJsonSchema, validateJsonSchema } from '@/lib/schemaUtils';

export const Editor = () => {
  const [schema, setSchema] = useState(defaultSchema);
  const [parsedSchema, setParsedSchema] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Parse and validate the schema
      const parsed = validateJsonSchema(schema);
      setParsedSchema(parsed);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      toast.error('Invalid JSON Schema', {
        description: (err as Error).message,
      });
    }
  }, [schema]);

  const handleEditorChange = (value: string) => {
    setSchema(value);
  };

  return (
    <div className="json-schema-editor">
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
