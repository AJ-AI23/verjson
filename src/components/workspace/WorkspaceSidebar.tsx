import React from 'react';
import { WorkspacePanel } from './WorkspacePanel';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Sidebar,
  SidebarContent,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkspaceSidebarProps {
  onDocumentSelect: (document: any) => void;
  onDocumentDeleted: (deletedDocumentId: string) => void;
  selectedDocument?: any;
}

export function WorkspaceSidebar({ onDocumentSelect, onDocumentDeleted, selectedDocument }: WorkspaceSidebarProps) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleDocumentSelect = (document: any) => {
    onDocumentSelect(document);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // Mobile: Use Drawer
  if (isMobile) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
          <DrawerContent className="h-[85vh]">
            <WorkspacePanel 
              onDocumentSelect={handleDocumentSelect}
              onDocumentDeleted={onDocumentDeleted}
              selectedDocument={selectedDocument}
            />
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: Use Sidebar
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar
      className="transition-all duration-300 border-r"
      collapsible="icon"
      side="left"
    >
      <SidebarContent className="flex flex-col h-full bg-card">
        {!isCollapsed ? (
          <WorkspacePanel 
            onDocumentSelect={onDocumentSelect}
            onDocumentDeleted={onDocumentDeleted}
            selectedDocument={selectedDocument}
          />
        ) : (
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