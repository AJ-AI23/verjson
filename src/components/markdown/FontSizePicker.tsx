import React, { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface FontSizePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  // Optional font weight support
  fontWeight?: string;
  onFontWeightChange?: (value: string) => void;
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

// Parse font weight to number
const parseFontWeight = (value: string): number => {
  if (!value) return 400;
  const num = parseInt(value, 10);
  return isNaN(num) ? 400 : num;
};

// Font weight labels
const getWeightLabel = (weight: number): string => {
  if (weight <= 100) return 'Thin';
  if (weight <= 200) return 'Extra Light';
  if (weight <= 300) return 'Light';
  if (weight <= 400) return 'Regular';
  if (weight <= 500) return 'Medium';
  if (weight <= 600) return 'Semi Bold';
  if (weight <= 700) return 'Bold';
  if (weight <= 800) return 'Extra Bold';
  return 'Black';
};

export const FontSizePicker: React.FC<FontSizePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = '1rem',
  min = 8,
  max = 72,
  fontWeight,
  onFontWeightChange,
}) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState(() => parseFontSize(value));
  const [localWeight, setLocalWeight] = useState(fontWeight || '400');
  const [weightSliderValue, setWeightSliderValue] = useState(() => parseFontWeight(fontWeight || '400'));
  
  const showWeightSlider = fontWeight !== undefined && onFontWeightChange !== undefined;
  
  useEffect(() => {
    setLocalValue(value || '');
    setSliderValue(parseFontSize(value));
  }, [value]);
  
  useEffect(() => {
    if (fontWeight !== undefined) {
      setLocalWeight(fontWeight || '400');
      setWeightSliderValue(parseFontWeight(fontWeight || '400'));
    }
  }, [fontWeight]);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);
  
  const handleInputBlur = useCallback(() => {
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);
  
  const handleWeightInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalWeight(e.target.value);
  }, []);
  
  const handleWeightInputBlur = useCallback(() => {
    if (localWeight !== fontWeight && onFontWeightChange) {
      onFontWeightChange(localWeight);
    }
  }, [localWeight, fontWeight, onFontWeightChange]);
  
  // Update local state during drag (no parent update)
  const handleSliderChange = useCallback((values: number[]) => {
    const pixels = values[0];
    setSliderValue(pixels);
    const formatted = formatFontSize(pixels, localValue || 'rem');
    setLocalValue(formatted);
  }, [localValue]);
  
  // Only update parent when drag ends
  const handleSliderCommit = useCallback((values: number[]) => {
    const pixels = values[0];
    const formatted = formatFontSize(pixels, localValue || 'rem');
    onChange(formatted);
  }, [localValue, onChange]);
  
  // Font weight slider handlers
  const handleWeightSliderChange = useCallback((values: number[]) => {
    const weight = values[0];
    setWeightSliderValue(weight);
    setLocalWeight(String(weight));
  }, []);
  
  const handleWeightSliderCommit = useCallback((values: number[]) => {
    const weight = values[0];
    if (onFontWeightChange) {
      onFontWeightChange(String(weight));
    }
  }, [onFontWeightChange]);
  
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
                  fontWeight: showWeightSlider ? weightSliderValue : 500,
                }}
                className="text-foreground"
              >
                A
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-72 p-4 pointer-events-auto" 
            align="start"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <div className="space-y-4">
              {/* Preview */}
              <div className="flex items-center justify-center h-20 bg-muted rounded-md">
                <span 
                  style={{ 
                    fontSize: `${Math.max(12, Math.min(64, sliderValue))}px`,
                    lineHeight: 1,
                    fontWeight: showWeightSlider ? weightSliderValue : 500,
                    transition: 'font-size 0.1s ease-out, font-weight 0.1s ease-out',
                  }}
                  className="text-foreground"
                >
                  Aa
                </span>
              </div>
              
              {/* Font Size Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Size</span>
                  <span className="font-medium text-foreground">{Math.round(sliderValue)}px</span>
                </div>
                <Slider
                  value={[sliderValue]}
                  onValueChange={handleSliderChange}
                  onValueCommit={handleSliderCommit}
                  min={min}
                  max={max}
                  step={1}
                  className="w-full"
                />
              </div>
              
              {/* Font Weight Slider (optional) */}
              {showWeightSlider && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Weight</span>
                    <span className="font-medium text-foreground">
                      {weightSliderValue} ({getWeightLabel(weightSliderValue)})
                    </span>
                  </div>
                  <Slider
                    value={[weightSliderValue]}
                    onValueChange={handleWeightSliderChange}
                    onValueCommit={handleWeightSliderCommit}
                    min={100}
                    max={900}
                    step={100}
                    className="w-full"
                  />
                </div>
              )}
              
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full" 
                onClick={() => setIsOpen(false)}
              >
                Done
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex-1 flex gap-2">
          <Input
            type="text"
            value={localValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            className="flex-1 font-mono text-xs"
            placeholder={placeholder}
          />
          {showWeightSlider && (
            <Input
              type="text"
              value={localWeight}
              onChange={handleWeightInputChange}
              onBlur={handleWeightInputBlur}
              className="w-16 font-mono text-xs"
              placeholder="400"
              title="Font weight"
            />
          )}
        </div>
      </div>
    </div>
  );
};
