import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';

interface DiagramSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DiagramSettingsDialog: React.FC<DiagramSettingsDialogProps> = ({
  open,
  onOpenChange
}) => {
  const { settings, updateMaxIndividualProperties, updateMaxIndividualArrayItems, updateTruncateAncestralBoxes } = useEditorSettings();

  const handleMaxIndividualPropertiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 250) {
      updateMaxIndividualProperties(value);
    }
  };

  const handleMaxIndividualArrayItemsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 250) {
      updateMaxIndividualArrayItems(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Diagram Settings</DialogTitle>
          <DialogDescription>
            Configure how properties are displayed in the diagram
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="max-individual-properties">
              Max Individual Properties
            </Label>
            <Input
              id="max-individual-properties"
              type="number"
              min="0"
              max="250"
              value={settings.maxIndividualProperties}
              onChange={handleMaxIndividualPropertiesChange}
            />
            <p className="text-sm text-muted-foreground">
              Maximum number of properties to show individually before grouping them. 
              When exceeded, remaining properties are grouped into a single "More Properties" box. 
              Range: 0-250, default: 5
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="max-individual-array-items">
              Max Individual Array Items
            </Label>
            <Input
              id="max-individual-array-items"
              type="number"
              min="0"
              max="250"
              value={settings.maxIndividualArrayItems}
              onChange={handleMaxIndividualArrayItemsChange}
            />
            <p className="text-sm text-muted-foreground">
              Maximum number of array items to show individually before grouping them. 
              When exceeded, remaining items are grouped into a single "More Items" box. 
              Range: 0-250, default: 4
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="truncate-ancestral-boxes">Truncate Ancestral Boxes</Label>
              <Switch
                id="truncate-ancestral-boxes"
                checked={settings.truncateAncestralBoxes}
                onCheckedChange={updateTruncateAncestralBoxes}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Simplify diagrams by removing intermediate boxes that only connect one parent to one child. 
              The truncated properties will be listed in a consolidated box.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
