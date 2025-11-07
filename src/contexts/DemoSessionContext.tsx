import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DemoSessionContextType {
  handleDemoExpiration: () => void;
}

const DemoSessionContext = createContext<DemoSessionContextType | undefined>(undefined);

export function useDemoSession() {
  const context = useContext(DemoSessionContext);
  if (context === undefined) {
    throw new Error('useDemoSession must be used within a DemoSessionProvider');
  }
  return context;
}

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const [showExpiredDialog, setShowExpiredDialog] = useState(false);

  const handleDemoExpiration = useCallback(() => {
    setShowExpiredDialog(true);
    
    // Redirect after 5 seconds
    setTimeout(() => {
      window.location.href = '/auth';
    }, 5000);
  }, []);

  return (
    <DemoSessionContext.Provider value={{ handleDemoExpiration }}>
      {children}
      
      <AlertDialog open={showExpiredDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Demo Session Expired</AlertDialogTitle>
            <AlertDialogDescription>
              Your demo session has expired. You will be redirected to the login page in a moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </DemoSessionContext.Provider>
  );
}
