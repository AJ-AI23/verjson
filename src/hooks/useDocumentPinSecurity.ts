import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PinVerificationState {
  [documentId: string]: boolean;
}

export function useDocumentPinSecurity() {
  const { user } = useAuth();
  const [verifiedPins, setVerifiedPins] = useState<PinVerificationState>({});

  // Simple hash function for PIN (in production, use proper crypto)
  const hashPin = (pin: string): string => {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const char = pin.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  };

  // Check if document has PIN protection
  const checkDocumentPinStatus = async (documentId: string) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('pin_enabled, user_id')
        .eq('id', documentId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        return { hasPin: false, isOwner: false, needsPin: false };
      }

      const isOwner = data.user_id === user?.id;
      const hasPin = data.pin_enabled;
      const needsPin = hasPin && !isOwner && !verifiedPins[documentId];

      return { hasPin, isOwner, needsPin };
    } catch (error) {
      console.error('Error checking document PIN status:', error);
      return { hasPin: false, isOwner: false, needsPin: false };
    }
  };

  // Set or update PIN for document
  const setDocumentPin = async (documentId: string, pin: string) => {
    if (!user) return false;

    try {
      const hashedPin = hashPin(pin);
      
      const { error } = await supabase
        .from('documents')
        .update({
          pin_code: hashedPin,
          pin_enabled: true
        })
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Document PIN set successfully');
      return true;
    } catch (error) {
      console.error('Error setting document PIN:', error);
      toast.error('Failed to set document PIN');
      return false;
    }
  };

  // Remove PIN protection from document
  const removeDocumentPin = async (documentId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('documents')
        .update({
          pin_code: null,
          pin_enabled: false
        })
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Document PIN removed successfully');
      return true;
    } catch (error) {
      console.error('Error removing document PIN:', error);
      toast.error('Failed to remove document PIN');
      return false;
    }
  };

  // Verify PIN for document access
  const verifyDocumentPin = async (documentId: string, pin: string) => {
    try {
      const hashedPin = hashPin(pin);
      
      const { data, error } = await supabase
        .from('documents')
        .select('pin_code')
        .eq('id', documentId)
        .eq('pin_code', hashedPin)
        .eq('pin_enabled', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Store verification in session
        setVerifiedPins(prev => ({
          ...prev,
          [documentId]: true
        }));
        
        // Also store in sessionStorage for persistence across page reloads
        const sessionData = sessionStorage.getItem('verifiedPins');
        const existingVerifications = sessionData ? JSON.parse(sessionData) : {};
        sessionStorage.setItem('verifiedPins', JSON.stringify({
          ...existingVerifications,
          [documentId]: true
        }));

        toast.success('PIN verified successfully');
        return true;
      } else {
        toast.error('Incorrect PIN');
        return false;
      }
    } catch (error) {
      console.error('Error verifying document PIN:', error);
      toast.error('Failed to verify PIN');
      return false;
    }
  };

  // Clear PIN verification for document
  const clearDocumentPinVerification = (documentId: string) => {
    setVerifiedPins(prev => {
      const updated = { ...prev };
      delete updated[documentId];
      return updated;
    });

    // Also remove from sessionStorage
    const sessionData = sessionStorage.getItem('verifiedPins');
    if (sessionData) {
      const existingVerifications = JSON.parse(sessionData);
      delete existingVerifications[documentId];
      sessionStorage.setItem('verifiedPins', JSON.stringify(existingVerifications));
    }
  };

  // Load verified PINs from sessionStorage on mount
  useEffect(() => {
    const sessionData = sessionStorage.getItem('verifiedPins');
    if (sessionData) {
      try {
        const verifications = JSON.parse(sessionData);
        setVerifiedPins(verifications);
      } catch (error) {
        console.error('Error loading PIN verifications from session:', error);
        sessionStorage.removeItem('verifiedPins');
      }
    }
  }, []);

  // Clear all verifications when user logs out
  useEffect(() => {
    if (!user) {
      setVerifiedPins({});
      sessionStorage.removeItem('verifiedPins');
    }
  }, [user]);

  return {
    checkDocumentPinStatus,
    setDocumentPin,
    removeDocumentPin,
    verifyDocumentPin,
    clearDocumentPinVerification,
    isDocumentPinVerified: (documentId: string) => !!verifiedPins[documentId]
  };
}