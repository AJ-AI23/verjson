import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, Filter, ListFilter } from 'lucide-react';

interface ConsistencyExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalIssues: number;
  filteredIssues: number;
  hasActiveFilters: boolean;
  activeFilterTypes: string[];
  onExport: (useFilter: boolean) => void;
}

export const ConsistencyExportDialog: React.FC<ConsistencyExportDialogProps> = ({
  open,
  onOpenChange,
  totalIssues,
  filteredIssues,
  hasActiveFilters,
  activeFilterTypes,
  onExport,
}) => {
  const [exportOption, setExportOption] = useState<'all' | 'filtered'>(
    hasActiveFilters ? 'filtered' : 'all'
  );

  const handleExport = () => {
    onExport(exportOption === 'filtered');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Consistency Results
          </DialogTitle>
          <DialogDescription>
            Choose which issues to include in the export.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={exportOption}
            onValueChange={(value) => setExportOption(value as 'all' | 'filtered')}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="all" id="export-all" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="export-all" className="flex items-center gap-2 cursor-pointer font-medium">
                  <ListFilter className="h-4 w-4" />
                  Export All Issues
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Include all {totalIssues} issue{totalIssues !== 1 ? 's' : ''} regardless of filters.
                </p>
              </div>
              <Badge variant="secondary">{totalIssues}</Badge>
            </div>

            <div 
              className={`flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer ${
                !hasActiveFilters ? 'opacity-50' : ''
              }`}
            >
              <RadioGroupItem 
                value="filtered" 
                id="export-filtered" 
                className="mt-0.5"
                disabled={!hasActiveFilters}
              />
              <div className="flex-1">
                <Label 
                  htmlFor="export-filtered" 
                  className={`flex items-center gap-2 font-medium ${
                    !hasActiveFilters ? 'cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  Export Filtered Issues
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {hasActiveFilters ? (
                    <>
                      Include only {filteredIssues} issue{filteredIssues !== 1 ? 's' : ''} matching current filters.
                    </>
                  ) : (
                    'No filters are currently active.'
                  )}
                </p>
                {hasActiveFilters && activeFilterTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {activeFilterTypes.map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type.replace(/-/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {hasActiveFilters && <Badge variant="secondary">{filteredIssues}</Badge>}
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
