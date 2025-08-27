import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { DocumentationDialog } from './DocumentationDialog';

export const SupportButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
        title="Documentation and Support"
      >
        <HelpCircle className="h-4 w-4" />
        Support
      </Button>

      <DocumentationDialog 
        open={isOpen} 
        onOpenChange={setIsOpen} 
      />
    </>
  );
};