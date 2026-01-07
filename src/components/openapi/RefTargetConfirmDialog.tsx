import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Link2 } from 'lucide-react';

export interface RefTargetInfo {
  targetComponentName: string;
  sourcePropertyPath: string[];
  operationType: 'paste' | 'add';
  propertyName?: string;
}

interface RefTargetConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refTargetInfo: RefTargetInfo | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RefTargetConfirmDialog: React.FC<RefTargetConfirmDialogProps> = ({
  open,
  onOpenChange,
  refTargetInfo,
  onConfirm,
  onCancel
}) => {
  if (!refTargetInfo) return null;

  const { targetComponentName, sourcePropertyPath, operationType, propertyName } = refTargetInfo;
  const sourcePath = sourcePropertyPath.join(' → ');
  const actionLabel = operationType === 'paste' ? 'Paste' : 'Add';
  const actionLabelLower = operationType === 'paste' ? 'pasted' : 'added';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span>Property Target is a Reference</span>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                The target property <span className="font-mono text-foreground bg-muted px-1 rounded">{sourcePath}</span> references another component schema.
              </p>
              
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
                <Link2 className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-foreground font-medium">
                  Target: <span className="font-mono">{targetComponentName}</span>
                </span>
              </div>

              <p>
                {propertyName ? (
                  <>
                    The property <span className="font-mono text-foreground bg-muted px-1 rounded">{propertyName}</span> will be {actionLabelLower} into the <span className="font-mono text-foreground bg-muted px-1 rounded">{targetComponentName}</span> component schema.
                  </>
                ) : (
                  <>
                    The property will be {actionLabelLower} into the <span className="font-mono text-foreground bg-muted px-1 rounded">{targetComponentName}</span> component schema.
                  </>
                )}
              </p>

              <p className="text-amber-600 dark:text-amber-400">
                <strong>Note:</strong> This will affect all other properties that reference this component.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {actionLabel} into {targetComponentName}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
