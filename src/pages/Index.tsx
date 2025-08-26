import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Editor } from '@/components/Editor';
import { AuthButton } from '@/components/AuthButton';
const Index = () => {
  const { user, loading } = useAuth();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/auth';
    }
  }, [user, loading]);

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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b py-3 px-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">JSON Schema Visual Blueprint</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Edit and visualize JSON Schema and OpenAPI 3.1 schemas in real-time
            </div>
            <AuthButton />
          </div>
        </div>
      </header>
      
      <main className="flex-1 p-4">
        <Editor />
      </main>
    </div>
  );
};
export default Index;