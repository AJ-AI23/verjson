import React, { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Type } from 'lucide-react';

interface FontSizePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}

// Parse various font size formats to pixels for the slider
const parseFontSize = (value: string): number => {
  if (!value) return 16;
  
  const numMatch = value.match(/^([\d.]+)/);
  if (!numMatch) return 16;
  
  const num = parseFloat(numMatch[1]);
  const unit = value.replace(numMatch[1], '').trim().toLowerCase();
  
  switch (unit) {
    case 'px':
      return num;
    case 'rem':
    case 'em':
      return num * 16;
    case 'pt':
      return num * 1.333;
    case '%':
      return (num / 100) * 16;
    default:
      return num * 16; // Assume rem if no unit
  }
};

// Format pixels back to the original unit
const formatFontSize = (pixels: number, originalValue: string): string => {
  if (!originalValue) return `${(pixels / 16).toFixed(2)}rem`;
  
  const unit = originalValue.replace(/[\d.]+/, '').trim().toLowerCase() || 'rem';
  
  switch (unit) {
    case 'px':
      return `${Math.round(pixels)}px`;
    case 'rem':
    case 'em':
      return `${(pixels / 16).toFixed(2)}${unit}`;
    case 'pt':
      return `${(pixels / 1.333).toFixed(1)}pt`;
    case '%':
      return `${Math.round((pixels / 16) * 100)}%`;
    default:
      return `${(pixels / 16).toFixed(2)}rem`;
  }
};

export const FontSizePicker: React.FC<FontSizePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = '1rem',
  min = 8,
  max = 72,
}) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState(() => parseFontSize(value));
  
  useEffect(() => {
    setLocalValue(value || '');
    setSliderValue(parseFontSize(value));
  }, [value]);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);
  
  const handleInputBlur = useCallback(() => {
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);
  
  const handleSliderChange = useCallback((values: number[]) => {
    const pixels = values[0];
    setSliderValue(pixels);
    const formatted = formatFontSize(pixels, localValue || 'rem');
    setLocalValue(formatted);
    onChange(formatted);
  }, [localValue, onChange]);
  
  // Calculate display size for the "A" preview (clamped between 12px and 48px for UI)
  const previewSize = Math.max(12, Math.min(48, sliderValue));
  
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-16 h-10 p-0 flex items-center justify-center overflow-hidden"
              title="Adjust font size visually"
            >
              <span 
                style={{ 
                  fontSize: `${previewSize}px`,
                  lineHeight: 1,
                  fontWeight: 500,
                }}
                className="text-foreground"
              >
                A
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-center h-20 bg-muted rounded-md">
                <span 
                  style={{ 
                    fontSize: `${Math.max(12, Math.min(64, sliderValue))}px`,
                    lineHeight: 1,
                    fontWeight: 500,
                    transition: 'font-size 0.1s ease-out',
                  }}
                  className="text-foreground"
                >
                  Aa
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{min}px</span>
                  <span className="font-medium text-foreground">{Math.round(sliderValue)}px</span>
                  <span>{max}px</span>
                </div>
                <Slider
                  value={[sliderValue]}
                  onValueChange={handleSliderChange}
                  min={min}
                  max={max}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Input
          type="text"
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          className="flex-1 font-mono text-xs"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
};
