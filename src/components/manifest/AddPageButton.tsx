import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TOCEntry } from '@/types/manifest';

interface AddPageButtonProps {
  onAdd: (entry: TOCEntry) => void;
}

export const AddPageButton: React.FC<AddPageButtonProps> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const handleAdd = () => {
    if (!title.trim()) return;
    const id = title.trim().toLowerCase().replace(/\s+/g, '-');
    onAdd({
      id,
      title: title.trim(),
      description: '',
    });
    setTitle('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-3 w-3" />
          Add Page
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="end">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Page Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Getting Started"
              className="h-8 text-sm mt-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
          </div>
          <Button onClick={handleAdd} size="sm" className="w-full">
            Create Page
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
