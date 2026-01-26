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
import { Lock, AlertCircle, ShieldAlert } from 'lucide-react';
import { useDocumentPinSecurity } from '@/hooks/useDocumentPinSecurity';

interface DocumentPinEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  onPinVerified: () => void;
}

const MAX_ATTEMPTS = 4;

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
  const [isBricked, setIsBricked] = useState(false);
  const { verifyDocumentPin } = useDocumentPinSecurity();

  const handleSubmit = async () => {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return;
    }

    setIsVerifying(true);
    const result = await verifyDocumentPin(documentId, pin);
    
    if (result.success) {
      onPinVerified();
      onOpenChange(false);
      resetForm();
    } else {
      if (result.isBricked) {
        setIsBricked(true);
      }
      setAttempts(prev => prev + 1);
      setPin('');
    }
    
    setIsVerifying(false);
  };

  const resetForm = () => {
    setPin('');
    setAttempts(0);
    setIsBricked(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 6 && !isVerifying && !isBricked) {
      handleSubmit();
    }
  };

  const isValid = pin.length === 6 && /^\d{6}$/.test(pin);
  const remainingAttempts = MAX_ATTEMPTS - attempts;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBricked ? (
              <ShieldAlert className="h-5 w-5 text-red-600" />
            ) : (
              <Lock className="h-5 w-5" />
            )}
            {isBricked ? 'Document Locked' : 'Document Access Required'}
          </DialogTitle>
          <DialogDescription>
            {isBricked 
              ? `"${documentName}" has been locked due to too many failed PIN attempts. Contact the document owner to unlock it.`
              : `This document is PIN protected. Enter the 6-digit PIN to access "${documentName}".`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {isBricked ? (
            <div className="flex flex-col gap-2 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                <p className="text-sm font-medium text-red-800">
                  Document Locked
                </p>
              </div>
              <p className="text-sm text-red-700">
                This document has been locked after {MAX_ATTEMPTS} failed PIN attempts. The document owner has been notified and can unlock it from the Document Security settings.
              </p>
            </div>
          ) : (
            <>
              {attempts > 0 && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-sm text-red-800">
                    Incorrect PIN. {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining.
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
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isVerifying}>
            {isBricked ? 'Close' : 'Cancel'}
          </Button>
          {!isBricked && (
            <Button 
              onClick={handleSubmit} 
              disabled={!isValid || isVerifying}
            >
              {isVerifying ? 'Verifying...' : 'Access Document'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}