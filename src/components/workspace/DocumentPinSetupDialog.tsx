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
import { Switch } from '@/components/ui/switch';
import { Shield, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { useDocumentPinSecurity } from '@/hooks/useDocumentPinSecurity';

interface DocumentPinSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  currentlyHasPin: boolean;
  currentlyIsBricked?: boolean;
  onPinStatusChange: () => void;
}

export function DocumentPinSetupDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  currentlyHasPin,
  currentlyIsBricked = false,
  onPinStatusChange,
}: DocumentPinSetupDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [enablePin, setEnablePin] = useState(currentlyHasPin);
  const [isProcessing, setIsProcessing] = useState(false);
  const { setDocumentPin, removeDocumentPin, unbrickDocument } = useDocumentPinSecurity();

  const handleSubmit = async () => {
    if (enablePin && !currentlyHasPin) {
      // Setting new PIN
      if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
        return;
      }
      
      if (pin !== confirmPin) {
        return;
      }

      setIsProcessing(true);
      const success = await setDocumentPin(documentId, pin);
      
      if (success) {
        onPinStatusChange();
        onOpenChange(false);
        resetForm();
      }
      
      setIsProcessing(false);
    } else if (!enablePin && currentlyHasPin) {
      // Removing PIN
      setIsProcessing(true);
      const success = await removeDocumentPin(documentId);
      
      if (success) {
        onPinStatusChange();
        onOpenChange(false);
        resetForm();
      }
      
      setIsProcessing(false);
    } else {
      // No changes needed
      onOpenChange(false);
      resetForm();
    }
  };

  const handleUnbrick = async () => {
    setIsProcessing(true);
    const success = await unbrickDocument(documentId);
    
    if (success) {
      onPinStatusChange();
      onOpenChange(false);
      resetForm();
    }
    
    setIsProcessing(false);
  };

  const resetForm = () => {
    setPin('');
    setConfirmPin('');
    setEnablePin(currentlyHasPin);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const isValid = !enablePin || (pin.length === 6 && /^\d{6}$/.test(pin) && pin === confirmPin);
  const hasChanges = enablePin !== currentlyHasPin;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className={`h-5 w-5 ${currentlyIsBricked ? 'text-red-600' : ''}`} />
            Document Security
          </DialogTitle>
          <DialogDescription>
            {currentlyIsBricked 
              ? `"${documentName}" is currently locked due to too many failed PIN attempts.`
              : `Set up PIN protection for "${documentName}". Collaborators will need to enter the PIN to access this document.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Bricked document warning and unlock option */}
          {currentlyIsBricked && (
            <div className="flex flex-col gap-3 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <p className="text-sm font-medium text-red-800">
                  Document Locked
                </p>
              </div>
              <p className="text-sm text-red-700">
                This document has been locked after 4 failed PIN attempts. You can unlock it to allow PIN verification again.
              </p>
              <Button 
                onClick={handleUnbrick}
                disabled={isProcessing}
                variant="destructive"
                className="w-full"
              >
                {isProcessing ? 'Unlocking...' : 'Unlock Document'}
              </Button>
            </div>
          )}

          {/* Only show PIN management if not bricked */}
          {!currentlyIsBricked && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">
                    Enable PIN Protection
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Require a 6-digit PIN to access this document
                  </p>
                </div>
                <Switch
                  checked={enablePin}
                  onCheckedChange={setEnablePin}
                />
              </div>

              {enablePin && !currentlyHasPin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="pin">6-Digit PIN</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="pin"
                        type="password"
                        placeholder="123456"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="pl-10 text-center text-lg tracking-widest"
                        disabled={isProcessing}
                      />
                    </div>
                    {pin && (pin.length !== 6 || !/^\d{6}$/.test(pin)) && (
                      <p className="text-sm text-red-600">PIN must be exactly 6 digits</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPin">Confirm PIN</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPin"
                        type="password"
                        placeholder="123456"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="pl-10 text-center text-lg tracking-widest"
                        disabled={isProcessing}
                      />
                    </div>
                    {confirmPin && pin !== confirmPin && (
                      <p className="text-sm text-red-600">PINs do not match</p>
                    )}
                  </div>
                </>
              )}

              {!enablePin && currentlyHasPin && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <Unlock className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm text-yellow-800">
                    This will remove PIN protection from the document. Collaborators will no longer need a PIN to access it.
                  </p>
                </div>
              )}

              {currentlyHasPin && enablePin && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                  <Shield className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-800">
                    This document is currently PIN protected.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            {currentlyIsBricked ? 'Close' : 'Cancel'}
          </Button>
          {!currentlyIsBricked && (
            <Button 
              onClick={handleSubmit} 
              disabled={!isValid || !hasChanges || isProcessing}
            >
              {isProcessing ? 'Processing...' : hasChanges ? 'Apply Changes' : 'No Changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}