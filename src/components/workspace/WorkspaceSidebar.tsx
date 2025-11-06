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
  onDocumentDeleted: (deletedDocumentId: string) => void;
  selectedDocument?: any;
}

export function WorkspaceSidebar({ onDocumentSelect, onDocumentDeleted, selectedDocument }: WorkspaceSidebarProps) {
  const { state, isMobile, setOpen } = useSidebar();
  const isCollapsed = state === 'collapsed';

  // On mobile, close sidebar when document is selected
  const handleDocumentSelect = (document: any) => {
    onDocumentSelect(document);
    if (isMobile) {
      setOpen(false);
    }
  };

  return (
    <Sidebar
      className="transition-all duration-300 border-r"
      collapsible="offcanvas"
      side="left"
    >
      <SidebarContent className="flex flex-col h-full bg-card">
        <div className={`transition-all duration-300 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'} flex-1`}>
          <WorkspacePanel 
            onDocumentSelect={handleDocumentSelect}
            onDocumentDeleted={onDocumentDeleted}
            selectedDocument={selectedDocument}
            isCollapsed={isCollapsed}
          />
        </div>
        
        {/* Mini state - just show workspace icon */}
        {isCollapsed && (
          <div className="flex flex-col items-center justify-center flex-1 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">W</span>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}