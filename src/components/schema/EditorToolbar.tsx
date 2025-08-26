
import React, { useState } from 'react';
import { Save, MessageCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { SchemaTypeSelector } from './SchemaTypeSelector';
import { SchemaViewSettings } from './SchemaViewSettings';
import { SchemaActions } from '@/components/SchemaActions';
import { NotationsPanel } from '@/components/notations/NotationsPanel';
import { SchemaType } from '@/lib/schemaUtils';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';
import { useNotationsManager } from '@/hooks/useNotationsManager';

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
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
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
  onAddNotation,
}) => {
  const { updateMaxDepth } = useEditorSettings();
  const [isNotationsPanelOpen, setIsNotationsPanelOpen] = useState(false);
  const { groupedNotations } = useNotationsManager(schema);
  
  const totalNotations = groupedNotations.reduce((sum, group) => sum + group.notations.length, 0);

  const handleAddNotation = (nodeId: string, user: string, message: string) => {
    if (onAddNotation) {
      onAddNotation(nodeId, user, message);
    }
  };

  const handleReplyToNotation = (nodeId: string, user: string, message: string) => {
    // For now, treat replies as new notations
    handleAddNotation(nodeId, user, message);
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <SchemaTypeSelector 
        schemaType={schemaType}
        onSchemaTypeChange={onSchemaTypeChange}
        setSchema={setSchema}
        setSavedSchema={setSavedSchema}
      />
      
      {/* Add Import/Export actions */}
      <SchemaActions 
        currentSchema={schema} 
        schemaType={schemaType}
        onImport={onImport}
      />
      
      <div className="flex items-center space-x-2">
        {/* Hierarchy Depth Control */}
        <div className="flex items-center gap-2">
          <Label htmlFor="max-depth" className="text-xs text-slate-600 whitespace-nowrap">
            Hierarchy Depth: {maxDepth}
          </Label>
          <Slider
            id="max-depth"
            min={1}
            max={10}
            step={1}
            value={[maxDepth]}
            onValueChange={([value]) => {
              console.log('[DEBUG] Slider changed to:', value);
              updateMaxDepth(value);
            }}
            className="w-24"
          />
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => toggleVersionHistory(true)}
          className="gap-1"
        >
          <Save className="h-4 w-4" />
          <span>History</span>
        </Button>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsNotationsPanelOpen(true)}
          className="gap-1 relative"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Notations</span>
          {totalNotations > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs">
              {totalNotations}
            </Badge>
          )}
        </Button>
        
        <SchemaViewSettings 
          groupProperties={groupProperties} 
          onGroupPropertiesChange={onGroupPropertiesChange} 
        />
      </div>

      <NotationsPanel
        isOpen={isNotationsPanelOpen}
        onClose={() => setIsNotationsPanelOpen(false)}
        groupedNotations={groupedNotations}
        onAddNotation={handleAddNotation}
        onReplyToNotation={handleReplyToNotation}
      />
    </div>
  );
};
