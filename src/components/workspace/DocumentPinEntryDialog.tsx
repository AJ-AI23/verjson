import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, AlertCircle } from 'lucide-react';
import { useDocumentPinSecurity } from '@/hooks/useDocumentPinSecurity';

interface DocumentPinEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  onPinVerified: () => void;
}

export function DocumentPinEntryDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  onPinVerified,
}: DocumentPinEntryDialogProps) {
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const { verifyDocumentPin } = useDocumentPinSecurity();

  const handleSubmit = async () => {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return;
    }

    setIsVerifying(true);
    const success = await verifyDocumentPin(documentId, pin);
    
    if (success) {
      onPinVerified();
      onOpenChange(false);
      resetForm();
    } else {
      setAttempts(prev => prev + 1);
      setPin('');
    }
    
    setIsVerifying(false);
  };

  const resetForm = () => {
    setPin('');
    setAttempts(0);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 6 && !isVerifying) {
      handleSubmit();
    }
  };

  const isValid = pin.length === 6 && /^\d{6}$/.test(pin);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Document Access Required
          </DialogTitle>
          <DialogDescription>
            This document is PIN protected. Enter the 6-digit PIN to access "{documentName}".
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {attempts > 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-800">
                Incorrect PIN. Please try again. ({attempts} attempt{attempts !== 1 ? 's' : ''})
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="pin">Enter 6-Digit PIN</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="pin"
                type="password"
                placeholder="• • • • • •"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyPress={handleKeyPress}
                className="pl-10 text-center text-xl tracking-[0.5em]"
                disabled={isVerifying}
                autoFocus
              />
            </div>
            {pin && !isValid && (
              <p className="text-sm text-muted-foreground">
                {6 - pin.length} digit{6 - pin.length !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            <p>💡 Contact the document owner if you need the PIN</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isVerifying}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || isVerifying}
          >
            {isVerifying ? 'Verifying...' : 'Access Document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}