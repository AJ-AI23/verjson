import React from 'react';
import { WorkspacePanel } from './WorkspacePanel';
import {
  Sidebar,
  SidebarContent,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

interface WorkspaceSidebarProps {
  onDocumentSelect: (document: any) => void;
  selectedDocument?: any;
}

export function WorkspaceSidebar({ onDocumentSelect, selectedDocument }: WorkspaceSidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar
      className={`transition-all duration-300 ${isCollapsed ? 'w-14' : 'w-80'}`}
      collapsible="icon"
    >
      <div className="p-2">
        <SidebarTrigger className="mb-2" />
      </div>
      
      <SidebarContent>
        <div className={`transition-all duration-300 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <WorkspacePanel 
            onDocumentSelect={onDocumentSelect}
            selectedDocument={selectedDocument}
            isCollapsed={isCollapsed}
          />
        </div>
        
        {/* Mini state - just show icons */}
        {isCollapsed && (
          <div className="flex flex-col items-center p-2 space-y-4">
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
              <span className="text-xs font-semibold">W</span>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}