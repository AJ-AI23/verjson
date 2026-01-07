import React, { useEffect } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StructureSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  className?: string;
}

export const StructureSearchBar: React.FC<StructureSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPrevMatch,
  onClear,
  inputRef,
  className,
}) => {
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      // Escape to clear search when focused
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        onClear();
        inputRef.current?.blur();
      }
      // Enter to go to next match
      if (e.key === 'Enter' && document.activeElement === inputRef.current) {
        e.preventDefault();
        if (e.shiftKey) {
          onPrevMatch();
        } else {
          onNextMatch();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [inputRef, onClear, onNextMatch, onPrevMatch]);

  return (
    <div className={cn("flex items-center gap-1 px-2", className)}>
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search (Ctrl+F)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 pl-7 pr-8 text-xs"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 p-0"
            onClick={onClear}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      {searchQuery && (
        <>
          <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[4rem] text-center">
            {matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : 'No results'}
          </span>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onPrevMatch}
              disabled={matchCount === 0}
              title="Previous (Shift+Enter)"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onNextMatch}
              disabled={matchCount === 0}
              title="Next (Enter)"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
