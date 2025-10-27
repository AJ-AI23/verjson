import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResolutionParameters, DEFAULT_RESOLUTION_PARAMETERS } from '@/lib/documentMergeEngine';
import { conflictRegistry, mergeModeLoader, type MergeModeName } from '@/lib/config';
import { Settings, List, Type, GitMerge, Shield, Sliders } from 'lucide-react';

interface ResolutionParametersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameters: ResolutionParameters;
  onParametersChange: (parameters: ResolutionParameters) => void;
  selectedMode?: MergeModeName;
  onModeChange?: (mode: MergeModeName) => void;
}

export const ResolutionParametersDialog: React.FC<ResolutionParametersDialogProps> = ({
  open,
  onOpenChange,
  parameters,
  onParametersChange,
  selectedMode,
  onModeChange
}) => {
  const updateParameter = <K extends keyof ResolutionParameters>(
    key: K,
    value: ResolutionParameters[K]
  ) => {
    onParametersChange({ ...parameters, [key]: value });
  };

  // Group preferences by category
  const preferencesByCategory = useMemo(() => {
    const allPrefs = conflictRegistry.getAllPreferences();
    const categories: Record<string, Array<[string, any]>> = {
      'Array Handling': [],
      'String Handling': [],
      'Object Handling': [],
      'Schema-Specific': [],
      'Advanced': []
    };

    Object.entries(allPrefs).forEach(([key, def]) => {
      if (key.startsWith('array')) {
        categories['Array Handling'].push([key, def]);
      } else if (key.startsWith('string')) {
        categories['String Handling'].push([key, def]);
      } else if (key.startsWith('object') || key.includes('Property')) {
        categories['Object Handling'].push([key, def]);
      } else if (['enumStrategy', 'constraintStrategy', 'formatStrategy', 'descriptionStrategy', 'examplesStrategy', 'deprecationStrategy'].includes(key)) {
        categories['Schema-Specific'].push([key, def]);
      } else {
        categories['Advanced'].push([key, def]);
      }
    });

    return categories;
  }, []);

  const formatLabel = (key: string) => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  };

  const formatEnumValue = (val: string) => {
    return val.split(/[-_]/).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const renderPreferenceInput = (prefKey: string, prefDef: any) => {
    const value = parameters[prefKey as keyof ResolutionParameters];
    const label = formatLabel(prefKey);

    if (prefDef.type === 'integer' || prefDef.type === 'number') {
      return (
        <div key={prefKey} className="space-y-2">
          <Label className="text-xs">{label}</Label>
          <Input
            type="number"
            min={prefDef.minimum}
            max={prefDef.maximum}
            className="h-9"
            value={value ?? prefDef.default}
            onChange={(e) => {
              const numValue = prefDef.type === 'integer' 
                ? parseInt(e.target.value) 
                : parseFloat(e.target.value);
              updateParameter(prefKey as any, isNaN(numValue) ? prefDef.default : numValue);
            }}
          />
          {prefDef.description && (
            <p className="text-xs text-muted-foreground">{prefDef.description}</p>
          )}
        </div>
      );
    }

    if (prefDef.type === 'string' && !prefDef.values) {
      return (
        <div key={prefKey} className="space-y-2">
          <Label className="text-xs">{label}</Label>
          <Input
            className="h-9"
            value={value || prefDef.default}
            onChange={(e) => updateParameter(prefKey as any, e.target.value)}
          />
          {prefDef.description && (
            <p className="text-xs text-muted-foreground">{prefDef.description}</p>
          )}
        </div>
      );
    }

    if (prefDef.type === 'boolean') {
      return (
        <div key={prefKey} className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={value ?? prefDef.default}
              onCheckedChange={(checked) => updateParameter(prefKey as any, checked)}
            />
            <Label className="text-xs">{label}</Label>
          </div>
          {prefDef.description && (
            <p className="text-xs text-muted-foreground">{prefDef.description}</p>
          )}
        </div>
      );
    }

    if (prefDef.type === 'enum' && prefDef.values) {
      return (
        <div key={prefKey} className="space-y-2">
          <Label className="text-xs">{label}</Label>
          <Select 
            value={value || prefDef.default} 
            onValueChange={(v: any) => updateParameter(prefKey as any, v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {prefDef.values.map((val: string) => (
                <SelectItem key={val} value={val}>
                  {formatEnumValue(val)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {prefDef.description && (
            <p className="text-xs text-muted-foreground">{prefDef.description}</p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <DialogTitle>Resolution Configuration</DialogTitle>
          </div>
          <DialogDescription>
            Select a merge mode or configure custom preferences for conflict resolution.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="modes" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="modes">Merge Modes</TabsTrigger>
            <TabsTrigger value="preferences">Custom Preferences</TabsTrigger>
          </TabsList>
          
          <TabsContent value="modes" className="flex-1 overflow-y-auto space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Choose a predefined merge mode that applies optimal settings for your use case.
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mergeModeLoader.getModeNames().map((modeName) => {
                const mode = mergeModeLoader.getMode(modeName);
                const isSelected = selectedMode === modeName;
                
                return (
                  <div
                    key={modeName}
                    onClick={() => {
                      if (onModeChange) {
                        onModeChange(modeName);
                        // Apply mode defaults
                        const modeDefaults = mergeModeLoader.getDefaultPreferences(modeName);
                        onParametersChange({ ...parameters, ...modeDefaults });
                      }
                    }}
                    className={`cursor-pointer border rounded-lg p-4 transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold capitalize">{modeName}</h3>
                      {isSelected && (
                        <div className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                          Active
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {mode?.description}
                    </p>
                    <div className="mt-3 pt-3 border-t text-xs space-y-1">
                      <div><strong>Resolution Order:</strong></div>
                      <div className="flex flex-wrap gap-1">
                        {mode?.preferredResolutionOrder.map((res, idx) => (
                          <span key={res} className="text-xs bg-muted px-2 py-0.5 rounded">
                            {idx + 1}. {res}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
          
          <TabsContent value="preferences" className="flex-1 overflow-y-auto">
            <div className="space-y-6">
              {Object.entries(preferencesByCategory).map(([category, prefs]) => {
                if (prefs.length === 0) return null;
                
                const getCategoryIcon = () => {
                  switch (category) {
                    case 'Array Handling': return <List className="h-4 w-4" />;
                    case 'String Handling': return <Type className="h-4 w-4" />;
                    case 'Object Handling': return <GitMerge className="h-4 w-4" />;
                    case 'Schema-Specific': return <Shield className="h-4 w-4" />;
                    default: return <Sliders className="h-4 w-4" />;
                  }
                };
                
                return (
                  <div key={category} className="space-y-4">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon()}
                      <h3 className="font-semibold text-sm">{category}</h3>
                    </div>
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {prefs.map(([key, def]) => renderPreferenceInput(key, def))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
