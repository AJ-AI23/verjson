import { Button } from '@/components/ui/button';
import { Plus, Trash2, Download, Upload } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DiagramNodeType } from '@/types/diagram';

interface DiagramToolbarProps {
  onAddNode: (type: DiagramNodeType) => void;
  onClearSelection: () => void;
  onExport?: () => void;
  onImportOpenApi?: () => void;
  hasSelection: boolean;
}

export const DiagramToolbar: React.FC<DiagramToolbarProps> = ({
  onAddNode,
  onClearSelection,
  onExport,
  onImportOpenApi,
  hasSelection
}) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-white border-b border-slate-200">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add Node
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onAddNode('endpoint')}>
            🔌 API Endpoint
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddNode('process')}>
            ⚙️ Process
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddNode('decision')}>
            ❓ Decision
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddNode('data')}>
            💾 Data Store
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddNode('custom')}>
            📦 Custom
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasSelection && (
        <Button
          size="sm"
          variant="outline"
          onClick={onClearSelection}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Clear Selection
        </Button>
      )}

      <div className="flex-1" />

      {onImportOpenApi && (
        <Button size="sm" variant="outline" onClick={onImportOpenApi}>
          <Upload className="h-4 w-4 mr-1" />
          Import from OpenAPI
        </Button>
      )}

      {onExport && (
        <Button size="sm" variant="outline" onClick={onExport}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      )}
    </div>
  );
};
