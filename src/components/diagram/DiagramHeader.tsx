
import React from 'react';
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface DiagramHeaderProps {
  maxDepth: number;
  onMaxDepthChange: (value: number) => void;
}

export const DiagramHeader: React.FC<DiagramHeaderProps> = ({ maxDepth, onMaxDepthChange }) => {
  return (
    <div className="p-2 border-b bg-slate-50">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">Schema Diagram</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 w-64">
            <Label htmlFor="max-depth" className="min-w-24 text-xs text-slate-600">
              Hierarchy Depth: {maxDepth}
            </Label>
            <Slider
              id="max-depth"
              min={1}
              max={10}
              step={1}
              value={[maxDepth]}
              onValueChange={([value]) => onMaxDepthChange(value)}
              className="w-32"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
