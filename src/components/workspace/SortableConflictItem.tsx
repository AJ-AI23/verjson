import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { MergeConflict } from '@/lib/documentMergeEngine';
import { GripVertical, AlertTriangle, CheckCircle, Link2, Info, Settings } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getValidResolutions, getResolutionExplanation, getConflictSeverity, requiresManualReview } from '@/lib/conflictResolutionRules';
import { getApplicablePreferences, needsPreferences, getPreferenceLabel, getPreferenceDescription } from '@/lib/conflictPreferenceRules';
import { ResolutionParameters } from '@/lib/documentMergeEngine';

interface SortableConflictItemProps {
  id: string;
  conflict: MergeConflict;
  conflictIndex: number;
  path: string;
  onConflictResolve: (path: string, conflictIndex: number, resolution: MergeConflict['resolution']) => void;
  onCustomValue: (path: string, conflictIndex: number, customValue: string) => void;
  onPreferenceChange?: (path: string, conflictIndex: number, preferences: any) => void;
  globalPreferences?: ResolutionParameters;
  formatJsonValue: (value: any) => string;
  getSeverityColor: (severity: MergeConflict['severity']) => string;
  getSeverityIcon: (severity: MergeConflict['severity']) => React.ReactNode;
  allConflicts?: MergeConflict[];
  onBulkResolve?: (conflicts: MergeConflict[], resolution: MergeConflict['resolution']) => void;
  reviewed?: boolean;
  onReviewedChange?: (path: string, conflictIndex: number, reviewed: boolean) => void;
}

export const SortableConflictItem: React.FC<SortableConflictItemProps> = ({
  id,
  conflict,
  conflictIndex,
  path,
  onConflictResolve,
  onCustomValue,
  onPreferenceChange,
  globalPreferences,
  formatJsonValue,
  getSeverityColor,
  getSeverityIcon,
  allConflicts,
  onBulkResolve,
  reviewed,
  onReviewedChange
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isArrayItemConflict = path.includes('[') && path.includes(']');
  
  // Get valid resolutions for this conflict type
  const validResolutions = getValidResolutions(conflict.type);
  const resolutionExplanation = getResolutionExplanation(conflict.type);
  
  // Get applicable preferences for current resolution
  const applicablePreferences = getApplicablePreferences(conflict.type, conflict.resolution || 'unresolved');
  const showPreferences = needsPreferences(conflict.type, conflict.resolution) && conflict.resolution !== 'unresolved';
  const preferenceDescription = getPreferenceDescription(conflict.type);
  
  // Get preference value with fallback to global
  const getPreferenceValue = (key: string) => {
    return conflict.preferences?.[key as keyof typeof conflict.preferences] 
      || globalPreferences?.[key as keyof ResolutionParameters];
  };
  
  const updatePreference = (key: string, value: any) => {
    if (onPreferenceChange) {
      const updatedPreferences = {
        ...conflict.preferences,
        [key]: value
      };
      onPreferenceChange(path, conflictIndex, updatedPreferences);
    }
  };

  const handleResolutionChange = (resolution: MergeConflict['resolution']) => {
    onConflictResolve(path, conflictIndex, resolution);
    
    // Handle cascading resolution for array item conflicts
    if (isArrayItemConflict && resolution === 'combine' && allConflicts && onBulkResolve) {
      // Find all property-level conflicts within this array item
      const itemPath = path;
      const itemIndexMatch = itemPath.match(/\[(\d+)\]/);
      if (itemIndexMatch) {
        const itemIndex = itemIndexMatch[1];
        const arrayPath = itemPath.replace(/\[(\d+)\]/, '');
        const propertyPathPrefix = `${arrayPath}.${itemIndex}.`;
        
        const relatedPropertyConflicts = allConflicts.filter(c => 
          c.path.startsWith(propertyPathPrefix) && c.path !== itemPath
        );
        
        if (relatedPropertyConflicts.length > 0) {
          console.log('🔄 Auto-resolving related property conflicts for Combine:', relatedPropertyConflicts.map(c => c.path));
          onBulkResolve(relatedPropertyConflicts, 'combine');
        }
      }
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Card className={`${isDragging ? 'shadow-lg' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              {...attributes}
              {...listeners}
              className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            >
              <GripVertical className="h-4 w-4" />
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  {getSeverityIcon(conflict.severity)}
                  <Badge variant={getSeverityColor(conflict.severity) as any} className="text-xs">
                    {conflict.severity} priority
                  </Badge>
                  <Badge variant={conflict.resolution === 'unresolved' ? 'destructive' : 'default'} className="text-xs">
                    {conflict.resolution === 'unresolved' ? 'Unresolved' : 
                     conflict.resolution === 'current' ? 'Keep Current' :
                     conflict.resolution === 'incoming' ? 'Use Incoming' :
                     conflict.resolution === 'combine' ? 'Combine' :
                     conflict.resolution === 'interpolate' ? 'Intersection' :
                     conflict.resolution === 'extrapolate' ? 'Difference' :
                     conflict.resolution === 'custom' ? 'Custom Value' : conflict.resolution}
                  </Badge>
                  {/* Conflict Type Badge */}
                  <Badge variant="outline" className="text-xs font-mono">
                    {conflict.type.replace(/_/g, ' ')}
                  </Badge>
                  {/* Auto-resolvable Indicator */}
                  {conflict.autoResolvable && !conflict.requiresManualReview && (
                    <Badge variant="secondary" className="text-xs">
                      Auto-resolvable
                    </Badge>
                  )}
                  {/* Manual Review Required */}
                  {conflict.requiresManualReview && (
                    <Badge variant="destructive" className="text-xs">
                      Manual Review
                    </Badge>
                  )}
                  {isArrayItemConflict && (
                    <Badge variant="outline" className="text-xs">
                      Array Item
                    </Badge>
                  )}
                  {conflict.linkedConflictPaths && conflict.linkedConflictPaths.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            {conflict.linkedConflictPaths.length} linked
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <div className="text-xs space-y-1">
                            <div className="font-semibold mb-1">Linked child conflicts:</div>
                            {conflict.linkedConflictPaths.map(linkedPath => (
                              <div key={linkedPath} className="font-mono text-xs">• {linkedPath}</div>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <div>{conflict.description}</div>
                {conflict.resolutionRationale && (
                  <div className="text-xs italic text-muted-foreground/80">
                    {conflict.resolutionRationale}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Current Value</div>
                  <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap break-all">
                    {formatJsonValue(conflict.currentValue)}
                  </pre>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Incoming Value</div>
                  <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap break-all">
                    {formatJsonValue(conflict.incomingValue)}
                  </pre>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Select
                    value={conflict.resolution || 'unresolved'}
                    onValueChange={handleResolutionChange}
                  >
                    <SelectTrigger className="w-auto">
                      <SelectValue placeholder="Choose resolution" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unresolved">Unresolved</SelectItem>
                      {validResolutions.includes('current') && (
                        <SelectItem value="current">Keep Current</SelectItem>
                      )}
                      {validResolutions.includes('incoming') && (
                        <SelectItem value="incoming">Use Incoming</SelectItem>
                      )}
                      {validResolutions.includes('combine') && (
                        <SelectItem value="combine">Combine (Union)</SelectItem>
                      )}
                      {validResolutions.includes('interpolate') && (
                        <SelectItem value="interpolate">Intersection</SelectItem>
                      )}
                      {validResolutions.includes('extrapolate') && (
                        <SelectItem value="extrapolate">Difference</SelectItem>
                      )}
                      {validResolutions.includes('custom') && (
                        <SelectItem value="custom">Custom Value</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  
                  {/* Resolution explanation tooltip */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="text-xs space-y-1">
                          <div className="font-semibold">Available Resolutions:</div>
                          <div>{resolutionExplanation}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {conflict.resolution === 'custom' && (
                  <Input
                    placeholder="Enter custom value"
                    value={conflict.customValue || ''}
                    onChange={(e) => onCustomValue(path, conflictIndex, e.target.value)}
                    className="flex-1 min-w-48"
                  />
                )}
              </div>

              {/* Preference Configuration */}
              {showPreferences && applicablePreferences.length > 0 && (
                <div className="space-y-3 bg-muted/50 p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <div className="text-xs font-medium">Resolution Preferences</div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="text-xs">{preferenceDescription}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Leave empty to use global defaults from Resolution Parameters.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {applicablePreferences.map((prefKey) => {
                      const value = getPreferenceValue(prefKey);
                      const label = getPreferenceLabel(prefKey);
                      
                      // Render different inputs based on preference type
                      if (prefKey === 'objectMergeDepth') {
                        return (
                          <div key={prefKey} className="space-y-1">
                            <Label className="text-xs">{label}</Label>
                            <Input
                              type="number"
                              className="h-8 text-xs"
                              value={value ?? ''}
                              onChange={(e) => updatePreference(prefKey, parseInt(e.target.value) || -1)}
                              placeholder={`Global: ${globalPreferences?.objectMergeDepth ?? -1}`}
                            />
                          </div>
                        );
                      }
                      
                      if (prefKey === 'stringConcatenationSeparator') {
                        return (
                          <div key={prefKey} className="space-y-1">
                            <Label className="text-xs">{label}</Label>
                            <Input
                              className="h-8 text-xs"
                              value={value ?? ''}
                              onChange={(e) => updatePreference(prefKey, e.target.value)}
                              placeholder={`Global: ${globalPreferences?.stringConcatenationSeparator || ' | '}`}
                            />
                          </div>
                        );
                      }
                      
                      // For all select-based preferences
                      const getOptions = () => {
                        switch (prefKey) {
                          case 'arrayOrderPreference':
                            return [
                              { value: 'maintain_current', label: 'Maintain Current' },
                              { value: 'use_incoming', label: 'Use Incoming' },
                              { value: 'sort_alphabetical', label: 'Sort Alphabetical' },
                              { value: 'sort_numeric', label: 'Sort Numeric' }
                            ];
                          case 'arrayDuplicateHandling':
                            return [
                              { value: 'keep_all', label: 'Keep All' },
                              { value: 'keep_first', label: 'Keep First' },
                              { value: 'keep_last', label: 'Keep Last' },
                              { value: 'remove_duplicates', label: 'Remove Duplicates' }
                            ];
                          case 'arrayMergeStrategy':
                            return [
                              { value: 'append', label: 'Append' },
                              { value: 'prepend', label: 'Prepend' },
                              { value: 'interleave', label: 'Interleave' }
                            ];
                          case 'stringMergeStrategy':
                            return [
                              { value: 'concatenate', label: 'Concatenate' },
                              { value: 'choose_longer', label: 'Choose Longer' },
                              { value: 'choose_shorter', label: 'Choose Shorter' },
                              { value: 'manual', label: 'Manual' }
                            ];
                          case 'objectPropertyConflict':
                            return [
                              { value: 'merge_recursive', label: 'Merge Recursive' },
                              { value: 'prefer_current', label: 'Prefer Current' },
                              { value: 'prefer_incoming', label: 'Prefer Incoming' },
                              { value: 'manual', label: 'Manual' }
                            ];
                          case 'enumStrategy':
                            return [
                              { value: 'union', label: 'Union (All)' },
                              { value: 'intersection', label: 'Intersection (Shared)' },
                              { value: 'prefer_current', label: 'Prefer Current' },
                              { value: 'prefer_incoming', label: 'Prefer Incoming' }
                            ];
                          case 'constraintStrategy':
                            return [
                              { value: 'most_restrictive', label: 'Most Restrictive' },
                              { value: 'least_restrictive', label: 'Least Restrictive' },
                              { value: 'prefer_current', label: 'Prefer Current' },
                              { value: 'prefer_incoming', label: 'Prefer Incoming' }
                            ];
                          case 'descriptionStrategy':
                            return [
                              { value: 'prefer_current', label: 'Prefer Current' },
                              { value: 'prefer_incoming', label: 'Prefer Incoming' },
                              { value: 'concatenate', label: 'Concatenate' },
                              { value: 'prefer_longer', label: 'Prefer Longer' }
                            ];
                          case 'numericStrategy':
                            return [
                              { value: 'average', label: 'Average' },
                              { value: 'min', label: 'Minimum' },
                              { value: 'max', label: 'Maximum' },
                              { value: 'current', label: 'Current' },
                              { value: 'incoming', label: 'Incoming' }
                            ];
                          case 'booleanStrategy':
                            return [
                              { value: 'and', label: 'AND (Both True)' },
                              { value: 'or', label: 'OR (Either True)' },
                              { value: 'current', label: 'Current' },
                              { value: 'incoming', label: 'Incoming' }
                            ];
                          default:
                            return [];
                        }
                      };
                      
                      const options = getOptions();
                      const globalValue = globalPreferences?.[prefKey as keyof ResolutionParameters];
                      
                      return (
                        <div key={prefKey} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Select
                            value={String(value || '')}
                            onValueChange={(v) => updatePreference(prefKey, v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder={`Global: ${globalValue || 'Default'}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map(opt => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {conflict.severity === 'high' && onReviewedChange && (
                <div className="flex items-center gap-2 ml-auto">
                  <Checkbox
                    id={`review-${id}`}
                    checked={reviewed || false}
                    onCheckedChange={(checked) => onReviewedChange(path, conflictIndex, checked === true)}
                  />
                  <label
                    htmlFor={`review-${id}`}
                    className="text-sm font-medium cursor-pointer select-none"
                  >
                    Reviewed
                  </label>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};