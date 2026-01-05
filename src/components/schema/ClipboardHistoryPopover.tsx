import React from 'react';
import { Clipboard, Trash2, Scissors, Copy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ClipboardItem } from '@/hooks/usePropertyClipboard';

interface ClipboardHistoryPopoverProps {
  clipboard: ClipboardItem | null;
  history: ClipboardItem[];
  onPaste: (item?: ClipboardItem) => void;
  onSelectFromHistory: (item: ClipboardItem) => void;
  onClearHistory: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const ClipboardHistoryPopover: React.FC<ClipboardHistoryPopoverProps> = ({
  clipboard,
  history,
  onPaste,
  onSelectFromHistory,
  onClearHistory,
  disabled = false,
  children
}) => {
  const [open, setOpen] = React.useState(false);

  const handlePaste = (item?: ClipboardItem) => {
    onPaste(item);
    setOpen(false);
  };

  const handleSelectAndPaste = (item: ClipboardItem) => {
    onSelectFromHistory(item);
    onPaste(item);
    setOpen(false);
  };

  // Filter history to not include current clipboard item
  const historyWithoutCurrent = history.filter(
    h => h.timestamp !== clipboard?.timestamp
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            {children || (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                disabled={disabled}
              >
                <Clipboard className="h-3 w-3" />
              </Button>
            )}
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Paste (Ctrl+V)</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <span className="text-sm font-medium">Clipboard</span>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearHistory();
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Current clipboard item */}
          {clipboard ? (
            <div
              className="px-3 py-2 border-b bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => handlePaste()}
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {clipboard.isCut ? (
                    <Scissors className="h-3 w-3 text-orange-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-blue-500" />
                  )}
                  <span className="text-sm font-medium truncate max-w-[180px]">
                    {clipboard.name}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs ml-auto">
                  Current
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {clipboard.isCut ? 'Cut' : 'Copied'} • Click to paste
              </p>
            </div>
          ) : (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Clipboard is empty
            </div>
          )}

          {/* History */}
          {historyWithoutCurrent.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b bg-muted/20">
                History ({historyWithoutCurrent.length})
              </div>
              <ScrollArea className="max-h-[200px]">
                <div className="py-1">
                  {historyWithoutCurrent.map((item) => (
                    <div
                      key={item.timestamp}
                      className={cn(
                        "px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors",
                        item.isCut && "opacity-75"
                      )}
                      onClick={() => handleSelectAndPaste(item)}
                    >
                      <div className="flex items-center gap-2">
                        {item.isCut ? (
                          <Scissors className="h-3 w-3 text-orange-500 shrink-0" />
                        ) : (
                          <Copy className="h-3 w-3 text-blue-500 shrink-0" />
                        )}
                        <span className="text-sm truncate">
                          {item.name}
                        </span>
                        {item.isCut && (
                          <Badge variant="outline" className="text-xs ml-auto shrink-0">
                            Cut
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {!clipboard && historyWithoutCurrent.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t">
              Copy or cut items to see them here
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
