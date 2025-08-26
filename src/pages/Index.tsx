import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Editor } from '@/components/Editor';
import { AuthButton } from '@/components/AuthButton';
import { WorkspaceSidebar } from '@/components/workspace/WorkspaceSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Document } from '@/types/workspace';
import { useDocuments } from '@/hooks/useDocuments';
import { toast } from 'sonner';
const Index = () => {
  const { user, loading } = useAuth();
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const { updateDocument } = useDocuments();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/auth';
    }
  }, [user, loading]);

  const handleDocumentSelect = (document: Document) => {
    console.log('Document selected:', document);
    console.log('Document ID type:', typeof document?.id);
    console.log('Document ID value:', document?.id);
    console.log('Document structure:', JSON.stringify(document, null, 2));
    setSelectedDocument(document);
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
    <SidebarProvider>
      <div className="min-h-screen bg-background flex w-full">
        <WorkspaceSidebar 
          onDocumentSelect={handleDocumentSelect}
          selectedDocument={selectedDocument}
        />
        
        <div className="flex flex-col flex-1 min-w-0">
          <header className="bg-card border-b py-3 px-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="animate-fade-in" />
                <img 
                  src="/lovable-uploads/ddcae931-0504-44bb-96aa-260e6650c307.png" 
                  alt="VerJSON" 
                  className="h-8"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Edit and visualize JSON Schema and OpenAPI 3.1 schemas in real-time
                </div>
                <AuthButton />
              </div>
            </div>
          </header>
          
          <main className="flex-1 p-4 min-h-0">
            <div className="h-full animate-fade-in">
                <Editor 
                  initialSchema={selectedDocument?.content}
                  onSave={handleDocumentSave}
                  documentName={selectedDocument?.name}
                  selectedDocument={selectedDocument}
                />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
export default Index;