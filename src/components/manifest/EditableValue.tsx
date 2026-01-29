import React, { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface EditableValueProps {
  value: any;
  onValueChange: (newValue: any) => void;
}

export const EditableValue: React.FC<EditableValueProps> = ({ value, onValueChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState(String(value));

  const handleSubmit = () => {
    let parsedValue: any = editedValue;
    if (typeof value === 'number') {
      const num = parseFloat(editedValue);
      if (!isNaN(num)) parsedValue = num;
    } else if (typeof value === 'boolean') {
      parsedValue = editedValue.toLowerCase() === 'true';
    }
    onValueChange(parsedValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedValue(String(value));
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editedValue}
          onChange={(e) => setEditedValue(e.target.value)}
          className="h-6 w-40 text-xs px-1"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleSubmit}>
          <Check className="h-3 w-3 text-green-500" />
        </Button>
        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleCancel}>
          <X className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <span 
      className="text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:underline group inline-flex items-center gap-1 max-w-[200px] truncate"
      onClick={() => setIsEditing(true)}
      title={typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
    >
      <span className="truncate">
        {typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
      </span>
      <Pencil className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-50" />
    </span>
  );
};
