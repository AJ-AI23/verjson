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
import { GripVertical, AlertTriangle, CheckCircle, Link2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SortableConflictItemProps {
  id: string;
  conflict: MergeConflict;
  conflictIndex: number;
  path: string;
  onConflictResolve: (path: string, conflictIndex: number, resolution: MergeConflict['resolution']) => void;
  onCustomValue: (path: string, conflictIndex: number, customValue: string) => void;
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

              <div className="text-sm text-muted-foreground">
                {conflict.description}
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
                <Select
                  value={conflict.resolution || 'unresolved'}
                  onValueChange={handleResolutionChange}
                >
                  <SelectTrigger className="w-auto">
                    <SelectValue placeholder="Choose resolution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unresolved">Unresolved</SelectItem>
                    <SelectItem value="current">Keep Current</SelectItem>
                    <SelectItem value="incoming">Use Incoming</SelectItem>
                    <SelectItem value="combine">Combine (Union)</SelectItem>
                    <SelectItem value="interpolate">Intersection</SelectItem>
                    <SelectItem value="extrapolate">Difference</SelectItem>
                    <SelectItem value="custom">Custom Value</SelectItem>
                  </SelectContent>
                </Select>

                {conflict.resolution === 'custom' && (
                  <Input
                    placeholder="Enter custom value"
                    value={conflict.customValue || ''}
                    onChange={(e) => onCustomValue(path, conflictIndex, e.target.value)}
                    className="flex-1 min-w-48"
                  />
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};