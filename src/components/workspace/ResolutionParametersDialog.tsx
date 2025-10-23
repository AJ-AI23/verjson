import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ResolutionParameters, DEFAULT_RESOLUTION_PARAMETERS } from '@/lib/documentMergeEngine';
import { Settings, List, Type, GitMerge, Shield } from 'lucide-react';

interface ResolutionParametersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameters: ResolutionParameters;
  onParametersChange: (parameters: ResolutionParameters) => void;
}

export const ResolutionParametersDialog: React.FC<ResolutionParametersDialogProps> = ({
  open,
  onOpenChange,
  parameters,
  onParametersChange
}) => {
  const updateParameter = <K extends keyof ResolutionParameters>(
    key: K,
    value: ResolutionParameters[K]
  ) => {
    onParametersChange({ ...parameters, [key]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <DialogTitle>Resolution Parameters</DialogTitle>
          </div>
          <DialogDescription>
            Configure how conflicts are automatically resolved when using Combine, Intersection, or Difference modes.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Array Handling */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Array Handling</h3>
            </div>
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Order Preference</Label>
                <Select 
                  value={parameters.arrayOrderPreference || DEFAULT_RESOLUTION_PARAMETERS.arrayOrderPreference} 
                  onValueChange={(v: any) => updateParameter('arrayOrderPreference', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintain_current">Maintain Current Order</SelectItem>
                    <SelectItem value="use_incoming">Use Incoming Order</SelectItem>
                    <SelectItem value="sort_alphabetical">Sort Alphabetically</SelectItem>
                    <SelectItem value="sort_numeric">Sort Numerically</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Duplicate Handling</Label>
                <Select 
                  value={parameters.arrayDuplicateHandling || DEFAULT_RESOLUTION_PARAMETERS.arrayDuplicateHandling} 
                  onValueChange={(v: any) => updateParameter('arrayDuplicateHandling', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep_all">Keep All Duplicates</SelectItem>
                    <SelectItem value="keep_first">Keep First Occurrence</SelectItem>
                    <SelectItem value="keep_last">Keep Last Occurrence</SelectItem>
                    <SelectItem value="remove_duplicates">Remove Duplicates</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Merge Strategy</Label>
                <Select 
                  value={parameters.arrayMergeStrategy || DEFAULT_RESOLUTION_PARAMETERS.arrayMergeStrategy} 
                  onValueChange={(v: any) => updateParameter('arrayMergeStrategy', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">Append (Current + Incoming)</SelectItem>
                    <SelectItem value="prepend">Prepend (Incoming + Current)</SelectItem>
                    <SelectItem value="interleave">Interleave Items</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* String Handling */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">String Handling</h3>
            </div>
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Merge Strategy</Label>
                <Select 
                  value={parameters.stringMergeStrategy || DEFAULT_RESOLUTION_PARAMETERS.stringMergeStrategy} 
                  onValueChange={(v: any) => updateParameter('stringMergeStrategy', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concatenate">Concatenate</SelectItem>
                    <SelectItem value="choose_longer">Choose Longer</SelectItem>
                    <SelectItem value="choose_shorter">Choose Shorter</SelectItem>
                    <SelectItem value="manual">Manual Selection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {parameters.stringMergeStrategy === 'concatenate' && (
                <div className="space-y-2">
                  <Label className="text-xs">Concatenation Separator</Label>
                  <Input
                    className="h-9"
                    value={parameters.stringConcatenationSeparator || DEFAULT_RESOLUTION_PARAMETERS.stringConcatenationSeparator}
                    onChange={(e) => updateParameter('stringConcatenationSeparator', e.target.value)}
                    placeholder=" | "
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Object Handling */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <GitMerge className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Object Handling</h3>
            </div>
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Property Conflict Resolution</Label>
                <Select 
                  value={parameters.objectPropertyConflict || DEFAULT_RESOLUTION_PARAMETERS.objectPropertyConflict} 
                  onValueChange={(v: any) => updateParameter('objectPropertyConflict', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="merge_recursive">Merge Recursively</SelectItem>
                    <SelectItem value="prefer_current">Prefer Current</SelectItem>
                    <SelectItem value="prefer_incoming">Prefer Incoming</SelectItem>
                    <SelectItem value="manual">Manual Selection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Merge Depth (-1 = infinite)</Label>
                <Input
                  type="number"
                  className="h-9"
                  value={parameters.objectMergeDepth ?? DEFAULT_RESOLUTION_PARAMETERS.objectMergeDepth}
                  onChange={(e) => updateParameter('objectMergeDepth', parseInt(e.target.value))}
                  placeholder="-1"
                />
              </div>
            </div>
          </div>
          
          {/* Schema-Specific Handling */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Schema-Specific Rules</h3>
            </div>
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Enum Strategy</Label>
                <Select 
                  value={parameters.enumStrategy || DEFAULT_RESOLUTION_PARAMETERS.enumStrategy} 
                  onValueChange={(v: any) => updateParameter('enumStrategy', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="union">Union (All Values)</SelectItem>
                    <SelectItem value="intersection">Intersection (Shared Only)</SelectItem>
                    <SelectItem value="prefer_current">Prefer Current</SelectItem>
                    <SelectItem value="prefer_incoming">Prefer Incoming</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Constraint Strategy</Label>
                <Select 
                  value={parameters.constraintStrategy || DEFAULT_RESOLUTION_PARAMETERS.constraintStrategy} 
                  onValueChange={(v: any) => updateParameter('constraintStrategy', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="most_restrictive">Most Restrictive</SelectItem>
                    <SelectItem value="least_restrictive">Least Restrictive</SelectItem>
                    <SelectItem value="prefer_current">Prefer Current</SelectItem>
                    <SelectItem value="prefer_incoming">Prefer Incoming</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Description Strategy</Label>
                <Select 
                  value={parameters.descriptionStrategy || DEFAULT_RESOLUTION_PARAMETERS.descriptionStrategy} 
                  onValueChange={(v: any) => updateParameter('descriptionStrategy', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prefer_current">Prefer Current</SelectItem>
                    <SelectItem value="prefer_incoming">Prefer Incoming</SelectItem>
                    <SelectItem value="concatenate">Concatenate</SelectItem>
                    <SelectItem value="prefer_longer">Prefer Longer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
