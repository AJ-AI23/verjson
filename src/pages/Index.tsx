import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Editor } from '@/components/Editor';
import { AuthButton } from '@/components/AuthButton';
import { NotificationsButton } from '@/components/NotificationsButton';
import { WorkspaceSidebar } from '@/components/workspace/WorkspaceSidebar';
import { DocumentPinEntryDialog } from '@/components/workspace/DocumentPinEntryDialog';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Document } from '@/types/workspace';
import { useDocuments } from '@/hooks/useDocuments';
import { useDocumentContent } from '@/hooks/useDocumentContent';
import { useDocumentPinSecurity } from '@/hooks/useDocumentPinSecurity';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
const Index = () => {
  const { user, loading } = useAuth();
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [clearEditorRequest, setClearEditorRequest] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pendingDocument, setPendingDocument] = useState<Document | null>(null);
  const { updateDocument } = useDocuments(undefined); // Only for updates, no fetching
  const { content: documentContent, loading: contentLoading } = useDocumentContent(selectedDocument?.id);
  const { checkDocumentPinStatus } = useDocumentPinSecurity();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/auth';
    }
  }, [user, loading]);

  const handleDocumentSelect = async (document: Document) => {
    console.log('🔍 Index: Document selected with full data:', {
      id: document.id,
      name: document.name,
      crowdin_integration_id: document.crowdin_integration_id,
      crowdin_integration: document.crowdin_integration,
      hasIntegration: !!document.crowdin_integration_id
    });
    console.log('🔍 Index: Full document object:', document);
    
    // Check if document requires PIN
    const pinStatus = await checkDocumentPinStatus(document.id);
    
    if (pinStatus.needsPin) {
      // Document requires PIN verification
      setPendingDocument(document);
      setShowPinDialog(true);
    } else {
      // Document can be accessed directly
      setSelectedDocument(document);
      // Reset clear request when selecting a new document
      setClearEditorRequest(false);
    }
  };

  const handlePinVerified = () => {
    if (pendingDocument) {
      setSelectedDocument(pendingDocument);
      setPendingDocument(null);
      setClearEditorRequest(false);
    }
    setShowPinDialog(false);
  };

  const handleDocumentDeleted = (deletedDocumentId: string) => {
    console.log('🗑️ Index: Document deleted:', deletedDocumentId);
    
    // If the deleted document is currently selected, clear everything
    if (selectedDocument?.id === deletedDocumentId) {
      console.log('🧹 Index: Clearing editor state for deleted document');
      setSelectedDocument(null);
      setClearEditorRequest(true);
      
      // Reset the clear request after a short delay
      setTimeout(() => setClearEditorRequest(false), 100);
      
      toast.success('Document deleted and editor cleared');
    }
  };

  const handleDocumentSave = async (content: any) => {
    if (!selectedDocument) return;
    
    try {
      await updateDocument(selectedDocument.id, { content });
      toast.success('Document saved successfully');
    } catch (err) {
      toast.error('Failed to save document');
    }
  };

  const handleCloseDocument = () => {
    setSelectedDocument(null);
    setClearEditorRequest(true);
    // Reset the clear request after a short delay
    setTimeout(() => setClearEditorRequest(false), 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <SidebarProvider 
      defaultOpen={true} 
      style={{ 
        '--sidebar-width': '24rem',
        '--sidebar-width-mobile': '24rem' 
      } as React.CSSProperties}
    >
      <div className="min-h-screen bg-background flex w-full">
        <WorkspaceSidebar 
          onDocumentSelect={handleDocumentSelect}
          onDocumentDeleted={handleDocumentDeleted}
          selectedDocument={selectedDocument}
        />
        
        <div className="flex flex-col flex-1 min-w-0">
          <header className="bg-card border-b py-3 px-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="animate-fade-in" />
                <img 
                  src="/lovable-uploads/7294f82f-d904-40c7-afc7-fdf654d21170.png" 
                  alt="VerJSON" 
                  className="h-8"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Version, edit and render all your JSON files in collaboration!
                </div>
                <NotificationsButton />
                <AuthButton />
              </div>
            </div>
          </header>
          
          <main className="flex-1 p-4 min-h-0">
            {selectedDocument ? (
              contentLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">Loading document content...</div>
                </div>
              ) : (
                <div className="h-full animate-fade-in">
                  <Editor 
                    initialSchema={documentContent}
                    onSave={handleDocumentSave}
                    documentName={selectedDocument?.name}
                    selectedDocument={selectedDocument}
                    onClearRequest={clearEditorRequest}
                    onClose={handleCloseDocument}
                  />
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center bg-muted/30 rounded-lg">
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <FileText className="h-16 w-16" />
                  <div className="text-xl font-medium">Select a document to start...</div>
                  <div className="text-sm">Choose a document from the workspace panel to begin editing</div>
                </div>
              </div>
            )}
          </main>
        </div>

        <DocumentPinEntryDialog
          open={showPinDialog}
          onOpenChange={setShowPinDialog}
          documentId={pendingDocument?.id || ''}
          documentName={pendingDocument?.name || ''}
          onPinVerified={handlePinVerified}
        />
      </div>
    </SidebarProvider>
  );
};
export default Index;