import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from 'lucide-react';
import { NamingAlternative } from '@/types/consistency';

interface AlternativesEditorProps {
  alternatives: NamingAlternative[];
  onChange: (alternatives: NamingAlternative[]) => void;
}

export function AlternativesEditor({ alternatives, onChange }: AlternativesEditorProps) {
  const addAlternative = () => {
    onChange([...(alternatives || []), { prefix: '', suffix: '' }]);
  };

  const removeAlternative = (index: number) => {
    const newAlternatives = alternatives.filter((_, i) => i !== index);
    onChange(newAlternatives.length > 0 ? newAlternatives : []);
  };

  const updateAlternative = (index: number, updates: Partial<NamingAlternative>) => {
    const newAlternatives = alternatives.map((alt, i) => 
      i === index ? { ...alt, ...updates } : alt
    );
    onChange(newAlternatives);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Alternatives (prefix/suffix combinations)</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addAlternative}
          className="h-8"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Alternative
        </Button>
      </div>
      
      {alternatives && alternatives.length > 0 ? (
        <div className="space-y-2">
          {alternatives.map((alternative, index) => (
            <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
              <span className="text-sm text-muted-foreground min-w-[80px]">
                Alternative {index + 1}:
              </span>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  placeholder="Prefix"
                  value={alternative.prefix || ''}
                  onChange={(e) => updateAlternative(index, { prefix: e.target.value || undefined })}
                  className="h-8"
                />
                <Input
                  placeholder="Suffix"
                  value={alternative.suffix || ''}
                  onChange={(e) => updateAlternative(index, { suffix: e.target.value || undefined })}
                  className="h-8"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAlternative(index)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No alternatives defined. Click "Add Alternative" to add prefix/suffix combinations.</p>
      )}
    </div>
  );
}
