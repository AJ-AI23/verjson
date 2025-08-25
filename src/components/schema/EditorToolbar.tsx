
import React from 'react';
import { Save } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SchemaTypeSelector } from './SchemaTypeSelector';
import { SchemaViewSettings } from './SchemaViewSettings';
import { SchemaActions } from '@/components/SchemaActions';
import { SchemaType } from '@/lib/schemaUtils';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';

interface EditorToolbarProps {
  schema: string;
  schemaType: SchemaType;
  groupProperties: boolean;
  maxDepth: number;
  onSchemaTypeChange: (type: SchemaType) => void;
  onGroupPropertiesChange: (checked: boolean) => void;
  onImport: (importedSchema: string, detectedType?: SchemaType) => void;
  toggleVersionHistory: (isOpen?: boolean) => void;
  setSchema: (schema: string) => void;
  setSavedSchema: (schema: string) => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  schema,
  schemaType,
  groupProperties,
  maxDepth,
  onSchemaTypeChange,
  onGroupPropertiesChange,
  onImport,
  toggleVersionHistory,
  setSchema,
  setSavedSchema,
}) => {
  const { updateMaxDepth } = useEditorSettings();
  return (
    <div className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <SchemaTypeSelector 
              schemaType={schemaType}
              onSchemaTypeChange={onSchemaTypeChange}
              setSchema={setSchema}
              setSavedSchema={setSavedSchema}
            />
            
            <SchemaActions 
              currentSchema={schema} 
              schemaType={schemaType}
              onImport={onImport}
            />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Label htmlFor="max-depth" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Depth: {maxDepth}
              </Label>
              <Slider
                id="max-depth"
                min={1}
                max={10}
                step={1}
                value={[maxDepth]}
                onValueChange={([value]) => {
                  updateMaxDepth(value);
                }}
                className="w-32"
              />
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => toggleVersionHistory(true)}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </Button>
            
            <SchemaViewSettings 
              groupProperties={groupProperties} 
              onGroupPropertiesChange={onGroupPropertiesChange} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};
