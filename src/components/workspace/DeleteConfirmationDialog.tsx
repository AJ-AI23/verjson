import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
  documentName: string;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirmDelete,
  documentName,
}: DeleteConfirmationDialogProps) {
  const [pin, setPin] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [error, setError] = useState('');

  // Generate a new 6-digit PIN when dialog opens
  useEffect(() => {
    if (open) {
      const newPin = Math.floor(100000 + Math.random() * 900000).toString();
      setPin(newPin);
      setEnteredPin('');
      setError('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (enteredPin === pin) {
      onConfirmDelete();
      onOpenChange(false);
      setError('');
    } else {
      setError('PIN does not match. Please try again.');
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setEnteredPin('');
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Confirm Document Deletion
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You are about to permanently delete the document:
          </p>
          
          <div className="p-3 bg-muted rounded-md">
            <p className="font-medium text-sm">{documentName}</p>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
              Safety PIN Required
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
              To prevent accidental deletion, please enter the PIN shown below:
            </p>
            
            <div className="text-center mb-3">
              <div className="inline-block px-4 py-2 bg-white dark:bg-gray-800 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
                <span className="text-2xl font-mono font-bold text-amber-800 dark:text-amber-300 tracking-wider">
                  {pin}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin-input" className="text-xs font-medium">
                Enter the PIN above:
              </Label>
              <Input
                id="pin-input"
                type="text"
                placeholder="Enter 6-digit PIN"
                value={enteredPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setEnteredPin(value);
                  setError('');
                }}
                className="text-center font-mono text-lg tracking-wider"
                maxLength={6}
                autoFocus
              />
              {error && (
                <p className="text-xs text-destructive font-medium">{error}</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            This action cannot be undone. The document and all its data will be permanently deleted.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={enteredPin.length !== 6}
          >
            Delete Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}