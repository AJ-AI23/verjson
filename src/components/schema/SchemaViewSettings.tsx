
import React from 'react';
import { toast } from 'sonner';
import { BoxSelect, Rows3 } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ViewSettingsProps {
  groupProperties: boolean;
  onGroupPropertiesChange: (checked: boolean) => void;
}

export const SchemaViewSettings: React.FC<ViewSettingsProps> = ({
  groupProperties,
  onGroupPropertiesChange
}) => {
  const handleGroupPropertiesChange = (checked: boolean) => {
    onGroupPropertiesChange(checked);
    toast.success(`${checked ? 'Grouped' : 'Expanded'} properties view`);
  };
  
  return (
    <div className="flex items-center space-x-2">
      <Switch 
        id="group-properties" 
        checked={groupProperties}
        onCheckedChange={handleGroupPropertiesChange}
      />
      <Label htmlFor="group-properties" className="flex items-center gap-2 cursor-pointer">
        {groupProperties ? <BoxSelect className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
        <span>Group Properties</span>
      </Label>
    </div>
  );
};
