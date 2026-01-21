import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Editor } from '@/components/Editor';
import { AuthButton } from '@/components/AuthButton';
import { NotificationsButton } from '@/components/NotificationsButton';
import { DemoSessionRibbon } from '@/components/DemoSessionRibbon';
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
  const indexInstanceId = useRef(Math.random().toString(36).slice(2, 8)).current;
  const { user, loading } = useAuth();
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [clearEditorRequest, setClearEditorRequest] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pendingDocument, setPendingDocument] = useState<Document | null>(null);
  const { updateDocument } = useDocuments(undefined); // Only for updates, no fetching
  const { content: documentContent, loading: contentLoading } = useDocumentContent(selectedDocument?.id);
  const { checkDocumentPinStatus } = useDocumentPinSecurity();

  // Debug tracing for editor reset issues
  useEffect(() => {
    console.log(`[Index ${indexInstanceId}] selectedDocument change`, {
      id: selectedDocument?.id,
      file_type: selectedDocument?.file_type,
      name: selectedDocument?.name,
    });
  }, [selectedDocument?.id]);

  useEffect(() => {
    console.log(`[Index ${indexInstanceId}] documentContent update`, {
      id: documentContent?.id,
      hasContent: !!documentContent?.content,
      contentType: typeof documentContent?.content,
      contentKeys:
        documentContent?.content && typeof documentContent.content === 'object'
          ? Object.keys(documentContent.content).slice(0, 12)
          : undefined,
    });
  }, [documentContent]);

  useEffect(() => {
    console.log(`[Index ${indexInstanceId}] contentLoading`, {
      contentLoading,
      willRenderEditor: !!selectedDocument && !!documentContent?.content,
    });
  }, [contentLoading, selectedDocument, documentContent]);

  // Merge documentContent metadata (like is_public) into selectedDocument when loaded
  useEffect(() => {
    if (documentContent && selectedDocument && documentContent.id === selectedDocument.id) {
      // Update selectedDocument with fresh data from documentContent (excludes content itself)
      const { content, ...metadata } = documentContent;
      setSelectedDocument(prev => prev ? { ...prev, ...metadata } : null);
    }
  }, [documentContent]);
  // Redirect to auth if not logged in - with delay to prevent race conditions
  useEffect(() => {
    if (!loading && !user) {
      // Add a small delay to ensure auth state is fully settled
      const timer = setTimeout(() => {
        console.log('[Index] Redirecting to auth - no user found');
        window.location.href = '/auth';
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  // Listen for access revocation events to clear selections
  useEffect(() => {
    const handleClearWorkspaceSelection = (event: CustomEvent) => {
      console.log('[Index] 🔒 Clearing workspace selection due to access revocation:', event.detail);
      
      const { documentId, workspaceId, type } = event.detail;
      
      // Clear selected document if it matches the revoked document
      if (selectedDocument && documentId && selectedDocument.id === documentId) {
        console.log('[Index] 🔒 Clearing selected document:', selectedDocument.id);
        setSelectedDocument(null);
        setClearEditorRequest(true);
        setTimeout(() => setClearEditorRequest(false), 100);
        toast.info('Document closed due to access revocation');
      }
      
      // Dispatch event to clear workspace selection in WorkspacePanel
      window.dispatchEvent(new CustomEvent('clearWorkspacePanelSelection', {
        detail: { workspaceId, type }
      }));
    };

    window.addEventListener('clearWorkspaceSelection', handleClearWorkspaceSelection as EventListener);
    return () => window.removeEventListener('clearWorkspaceSelection', handleClearWorkspaceSelection as EventListener);
  }, [selectedDocument]);

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
    <>
      <DemoSessionRibbon />
      <SidebarProvider 
        defaultOpen={true}
        style={{ 
          '--sidebar-width': '20rem',
          '--sidebar-width-mobile': '18rem' 
        } as React.CSSProperties}
      >
        <div className="min-h-screen bg-background flex w-full relative">
        <WorkspaceSidebar 
          onDocumentSelect={handleDocumentSelect}
          onDocumentDeleted={handleDocumentDeleted}
          selectedDocument={selectedDocument}
        />
        
        <div className="flex flex-col flex-1 min-w-0 w-full">
          <header className="bg-card border-b py-2 px-3 md:py-3 md:px-6 shadow-sm sticky z-10" style={{ top: 0 }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4">
                <SidebarTrigger className="animate-fade-in shrink-0" />
                <img 
                  src="/lovable-uploads/7294f82f-d904-40c7-afc7-fdf654d21170.png" 
                  alt="VerJSON" 
                  className="h-6 md:h-8 shrink-0"
                />
              </div>
              <div className="flex items-center gap-2 md:gap-4">
                <div className="hidden lg:block text-sm text-muted-foreground whitespace-nowrap">
                  Version, edit and render all your JSON files in collaboration!
                </div>
                <NotificationsButton />
                <AuthButton />
              </div>
            </div>
          </header>
          
          <main className="flex-1 p-2 md:p-4 min-h-0">
            {selectedDocument ? (
              // Only render Editor once we have content for the first time.
              // After initial load, keep it mounted during refetches to preserve internal state.
              documentContent?.content && documentContent.id === selectedDocument.id ? (
                <div className="h-full animate-fade-in relative">
                  <Editor 
                    initialSchema={documentContent.content}
                    onSave={handleDocumentSave}
                    documentName={selectedDocument?.name}
                    selectedDocument={selectedDocument}
                    onClearRequest={clearEditorRequest}
                    onClose={handleCloseDocument}
                    onDocumentUpdate={(updates) => {
                      setSelectedDocument(prev => prev ? { ...prev, ...updates } : null);
                    }}
                  />

                  {contentLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
                      <div className="animate-pulse text-muted-foreground">Refreshing...</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">Loading document content...</div>
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
    </>
  );
};
export default Index;