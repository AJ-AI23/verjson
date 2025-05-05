
import React from 'react';
import { Editor } from '@/components/Editor';

const Index = () => {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b py-3 px-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">JSON Schema Visual Blueprint</h1>
          <div className="text-sm text-slate-500">
            Edit and visualize JSON Schema and OpenAPI 3.1 schemas in real-time
          </div>
        </div>
      </header>
      
      <main className="flex-1 p-4">
        <Editor />
      </main>
      
      <footer className="py-2 px-6 border-t text-center text-xs text-slate-500">
        Schema Editor - Supporting JSON Schema and OpenAPI 3.1
      </footer>
    </div>
  );
};

export default Index;
