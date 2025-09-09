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

  // Check if document has PIN protection
  const checkDocumentPinStatus = async (documentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('document-security', {
        body: {
          action: 'checkDocumentPinStatus',
          documentId
        }
      });

      if (error) throw error;
      
      // Add client-side verification check
      const needsPin = data.needsPin && !verifiedPins[documentId];

      return { ...data, needsPin };
    } catch (error) {
      console.error('Error checking document PIN status:', error);
      return { hasPin: false, isOwner: false, needsPin: false };
    }
  };

  // Set or update PIN for document
  const setDocumentPin = async (documentId: string, pin: string) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.functions.invoke('document-security', {
        body: {
          action: 'setDocumentPin',
          documentId,
          pin
        }
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error);
        return false;
      }

      toast.success(data.message);
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
      const { data, error } = await supabase.functions.invoke('document-security', {
        body: {
          action: 'removeDocumentPin',
          documentId
        }
      });

      if (error) throw error;

      toast.success(data.message);
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
      const { data, error } = await supabase.functions.invoke('document-security', {
        body: {
          action: 'verifyDocumentPin',
          documentId,
          pin
        }
      });

      if (error) throw error;

      if (data.verified) {
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

        toast.success(data.message);
        return true;
      } else {
        toast.error(data.error);
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