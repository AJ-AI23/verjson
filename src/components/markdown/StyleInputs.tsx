import React, { useState, useEffect, useCallback } from 'react';
import { SketchPicker } from 'react-color';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export const ColorInput: React.FC<ColorInputProps> = ({ label, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  
  useEffect(() => {
    if (!isOpen) {
      setLocalValue(value);
    }
  }, [value, isOpen]);
  
  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue);
  }, []);
  
  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);
  
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-2">
        <Popover open={isOpen} onOpenChange={(open) => {
          if (open) {
            setIsOpen(true);
          } else {
            handleClose();
          }
        }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-16 h-10 p-1 cursor-pointer"
              style={{ backgroundColor: localValue }}
            >
              <span className="sr-only">Pick color</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-0" align="start">
            <SketchPicker 
              color={localValue} 
              onChange={(color) => handleChange(color.hex)}
              disableAlpha
            />
          </PopoverContent>
        </Popover>
        <Input
          type="text"
          value={localValue}
          onChange={handleInputChange}
          className="flex-1 font-mono text-xs"
        />
      </div>
    </div>
  );
};

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const StyleTextInput: React.FC<TextInputProps> = ({ label, value, onChange, placeholder }) => {
  const [localValue, setLocalValue] = useState(value || '');
  
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);
  
  const handleBlur = useCallback(() => {
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);
  
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <Input
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className="font-mono text-xs"
        placeholder={placeholder}
      />
    </div>
  );
};
