
import React, { useState, useCallback } from 'react';
import { JsonEditorPoc } from '@/components/JsonEditorPoc';
import { parseJsonSchema } from '@/lib/schemaUtils';
import { CollapsedState } from '@/lib/diagram/types';
import { defaultSchema } from '@/lib/defaultSchema';
import { toast } from 'sonner';

const JsonEditorPocPage = () => {
  const [schema, setSchema] = useState(defaultSchema);
  const [error, setError] = useState<string | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<CollapsedState>({});
  
  // Handle schema changes
  const handleSchemaChange = (newSchema: string) => {
    setSchema(newSchema);
    
    try {
      // Validate the schema
      parseJsonSchema(newSchema);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  
  // Handle fold/unfold events
  const handleToggleCollapse = useCallback((path: string, isCollapsed: boolean) => {
    console.log(`Toggle collapse: ${path} => ${isCollapsed ? 'collapsed' : 'expanded'}`);
    
    setCollapsedPaths(prev => ({
      ...prev,
      [path]: isCollapsed
    }));
    
    // Show notification
    toast.info(`${isCollapsed ? 'Collapsed' : 'Expanded'}: ${path}`, { 
      duration: 1500 
    });
  }, []);

  // Force collapse of a specific path (for testing)
  const forceCollapse = (path: string) => {
    setCollapsedPaths(prev => ({
      ...prev,
      [path]: true
    }));
    toast.info(`Force collapsed: ${path}`);
  };
  
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b py-3 px-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">JSONEditor Proof of Concept</h1>
          <div className="text-sm text-slate-500">
            Testing fold/unfold synchronization with JSONEditor
          </div>
        </div>
      </header>
      
      <main className="flex-1 p-4 flex flex-col">
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => forceCollapse('root.properties')}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Collapse Properties
          </button>
          <button
            onClick={() => forceCollapse('root.required')}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Collapse Required
          </button>
        </div>
        
        <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          <JsonEditorPoc
            value={schema}
            onChange={handleSchemaChange}
            error={error}
            collapsedPaths={collapsedPaths}
            onToggleCollapse={handleToggleCollapse}
          />
        </div>
        
        <div className="mt-4 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Collapsed Paths:</h3>
          <div className="text-sm">
            {Object.entries(collapsedPaths).map(([path, isCollapsed]) => (
              <div key={path} className="flex justify-between items-center py-1 border-b">
                <span>{path}</span>
                <span className={`px-2 py-0.5 rounded ${isCollapsed ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                  {isCollapsed ? 'Collapsed' : 'Expanded'}
                </span>
              </div>
            ))}
            {Object.keys(collapsedPaths).length === 0 && (
              <div className="text-slate-500 italic">No collapsed paths</div>
            )}
          </div>
        </div>
      </main>
      
      <footer className="py-2 px-6 border-t text-center text-xs text-slate-500">
        JSONEditor Proof of Concept - Testing fold/unfold synchronization
      </footer>
    </div>
  );
};

export default JsonEditorPocPage;
