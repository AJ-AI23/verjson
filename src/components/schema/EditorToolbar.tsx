
import React, { useState } from 'react';
import { Save, MessageCircle, FileText, Calendar, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
  toggleVersionHistory: (isOpen?: boolean) => void;
  setSchema: (schema: string) => void;
  setSavedSchema: (schema: string) => void;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  documentName?: string;
  selectedDocument?: any;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  schema,
  schemaType,
  groupProperties,
  maxDepth,
  onSchemaTypeChange,
  onGroupPropertiesChange,
  toggleVersionHistory,
  setSchema,
  setSavedSchema,
  onAddNotation,
  documentName,
  selectedDocument,
}) => {
  const { updateMaxDepth } = useEditorSettings();
  const [isNotationsPanelOpen, setIsNotationsPanelOpen] = useState(false);
  const { groupedNotations, activeNotationCount } = useNotationsManager(schema);
  
  const handleAddNotation = (nodeId: string, user: string, message: string) => {
    if (onAddNotation) {
      onAddNotation(nodeId, user, message);
    }
  };

  const handleReplyToNotation = (nodeId: string, user: string, message: string) => {
    // For now, treat replies as new notations
    handleAddNotation(nodeId, user, message);
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileTypeIcon = (fileType: string) => {
    return <FileText className="h-4 w-4" />;
  };

  const getFileTypeLabel = (fileType: string) => {
    return fileType === 'openapi' ? 'OpenAPI' : 'JSON Schema';
  };

  return (
    <div className="mb-4">
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-3">
          {/* Document Information Section */}
          {selectedDocument ? (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileTypeIcon(selectedDocument.file_type)}
                    <h3 className="font-semibold text-foreground truncate">
                      {selectedDocument.name}
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      ID: <code className="bg-muted px-1 rounded text-xs">{selectedDocument.id}</code>
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {getFileTypeLabel(selectedDocument.file_type)}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Created: {formatDate(selectedDocument.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Updated: {formatDate(selectedDocument.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground">No document selected</h3>
                <span className="text-xs text-muted-foreground">— Select a document from the workspace panel</span>
              </div>
            </div>
          )}

          <Separator className="my-3" />

          {/* Controls Section */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => toggleVersionHistory(true)}
                className="gap-2 h-8"
                disabled={!selectedDocument}
              >
                <Save className="h-4 w-4" />
                <span>History</span>
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsNotationsPanelOpen(true)}
                className="gap-2 relative h-8"
                disabled={!selectedDocument}
              >
                <MessageCircle className="h-4 w-4" />
                <span>Notations</span>
                {activeNotationCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-xs">
                    {activeNotationCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Hierarchy Depth Control */}
            <div className="flex items-center gap-3">
              <Label htmlFor="max-depth" className="text-xs text-muted-foreground whitespace-nowrap">
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
                className="w-28"
                disabled={!selectedDocument}
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
