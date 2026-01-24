import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code2, Smile, Table, Search, Image, Upload, Link, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownEmbed } from '@/types/markdown';

// Common programming languages for syntax highlighting
const LANGUAGES = [
  { value: '', label: 'Plain text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'diff', label: 'Diff' },
];

// Common emojis grouped by category
const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: [
      { code: ':smile:', emoji: '😄' },
      { code: ':grinning:', emoji: '😀' },
      { code: ':laughing:', emoji: '😆' },
      { code: ':blush:', emoji: '😊' },
      { code: ':wink:', emoji: '😉' },
      { code: ':heart_eyes:', emoji: '😍' },
      { code: ':kissing_heart:', emoji: '😘' },
      { code: ':thinking:', emoji: '🤔' },
      { code: ':neutral_face:', emoji: '😐' },
      { code: ':unamused:', emoji: '😒' },
      { code: ':sweat:', emoji: '😓' },
      { code: ':cry:', emoji: '😢' },
      { code: ':sob:', emoji: '😭' },
      { code: ':joy:', emoji: '😂' },
      { code: ':sunglasses:', emoji: '😎' },
      { code: ':confused:', emoji: '😕' },
    ],
  },
  {
    name: 'Gestures',
    emojis: [
      { code: ':thumbsup:', emoji: '👍' },
      { code: ':thumbsdown:', emoji: '👎' },
      { code: ':clap:', emoji: '👏' },
      { code: ':wave:', emoji: '👋' },
      { code: ':raised_hands:', emoji: '🙌' },
      { code: ':pray:', emoji: '🙏' },
      { code: ':point_up:', emoji: '☝️' },
      { code: ':ok_hand:', emoji: '👌' },
      { code: ':muscle:', emoji: '💪' },
      { code: ':fist:', emoji: '✊' },
      { code: ':v:', emoji: '✌️' },
      { code: ':metal:', emoji: '🤘' },
    ],
  },
  {
    name: 'Symbols',
    emojis: [
      { code: ':heart:', emoji: '❤️' },
      { code: ':star:', emoji: '⭐' },
      { code: ':fire:', emoji: '🔥' },
      { code: ':sparkles:', emoji: '✨' },
      { code: ':zap:', emoji: '⚡' },
      { code: ':boom:', emoji: '💥' },
      { code: ':white_check_mark:', emoji: '✅' },
      { code: ':x:', emoji: '❌' },
      { code: ':warning:', emoji: '⚠️' },
      { code: ':question:', emoji: '❓' },
      { code: ':exclamation:', emoji: '❗' },
      { code: ':bulb:', emoji: '💡' },
      { code: ':bell:', emoji: '🔔' },
      { code: ':bookmark:', emoji: '🔖' },
      { code: ':link:', emoji: '🔗' },
      { code: ':lock:', emoji: '🔒' },
    ],
  },
  {
    name: 'Objects',
    emojis: [
      { code: ':rocket:', emoji: '🚀' },
      { code: ':airplane:', emoji: '✈️' },
      { code: ':gift:', emoji: '🎁' },
      { code: ':tada:', emoji: '🎉' },
      { code: ':trophy:', emoji: '🏆' },
      { code: ':medal:', emoji: '🏅' },
      { code: ':gem:', emoji: '💎' },
      { code: ':moneybag:', emoji: '💰' },
      { code: ':chart_with_upwards_trend:', emoji: '📈' },
      { code: ':calendar:', emoji: '📅' },
      { code: ':memo:', emoji: '📝' },
      { code: ':pencil:', emoji: '✏️' },
      { code: ':hammer:', emoji: '🔨' },
      { code: ':wrench:', emoji: '🔧' },
      { code: ':gear:', emoji: '⚙️' },
      { code: ':coffee:', emoji: '☕' },
    ],
  },
];

interface CodeBlockPopoverProps {
  onInsert: (code: string) => void;
  disabled?: boolean;
}

export const CodeBlockPopover: React.FC<CodeBlockPopoverProps> = ({ onInsert, disabled }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredLanguages = LANGUAGES.filter(lang =>
    lang.label.toLowerCase().includes(search.toLowerCase()) ||
    lang.value.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (language: string) => {
    const codeBlock = language 
      ? `\`\`\`${language}\n// Your code here\n\`\`\``
      : '```\n// Your code here\n```';
    onInsert(codeBlock);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          title="Code Block"
          className="h-8 w-8 p-0"
        >
          <Code2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search language..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-sm"
            />
          </div>
          <ScrollArea className="h-48">
            <div className="space-y-0.5">
              {filteredLanguages.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => handleSelect(lang.value)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground focus:outline-none"
                  )}
                >
                  {lang.label}
                  {lang.value && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {lang.value}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface EmojiPickerPopoverProps {
  onInsert: (code: string) => void;
  disabled?: boolean;
}

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({ onInsert, disabled }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredCategories = EMOJI_CATEGORIES.map(category => ({
    ...category,
    emojis: category.emojis.filter(
      e => e.code.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.emojis.length > 0);

  const handleSelect = (code: string) => {
    onInsert(code);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          title="Emoji"
          className="h-8 w-8 p-0"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search emoji..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-sm"
            />
          </div>
          <ScrollArea className="h-56">
            <div className="space-y-3">
              {filteredCategories.map((category) => (
                <div key={category.name}>
                  <Label className="text-xs text-muted-foreground px-1">
                    {category.name}
                  </Label>
                  <div className="grid grid-cols-8 gap-0.5 mt-1">
                    {category.emojis.map((item) => (
                      <button
                        key={item.code}
                        onClick={() => handleSelect(item.code)}
                        title={item.code}
                        className={cn(
                          "w-7 h-7 flex items-center justify-center rounded-sm text-lg",
                          "hover:bg-accent focus:bg-accent focus:outline-none"
                        )}
                      >
                        {item.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface TableConfigPopoverProps {
  onInsert: (markdown: string) => void;
  disabled?: boolean;
}

export const TableConfigPopover: React.FC<TableConfigPopoverProps> = ({ onInsert, disabled }) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);

  const maxRows = 8;
  const maxCols = 8;

  const generateTable = (numRows: number, numCols: number) => {
    const header = '| ' + Array(numCols).fill(0).map((_, i) => `Header ${i + 1}`).join(' | ') + ' |';
    const separator = '| ' + Array(numCols).fill('---').join(' | ') + ' |';
    const bodyRows = Array(numRows - 1).fill(0).map((_, rowIdx) =>
      '| ' + Array(numCols).fill(0).map((_, colIdx) => `Cell ${rowIdx + 1}-${colIdx + 1}`).join(' | ') + ' |'
    );
    return [header, separator, ...bodyRows].join('\n');
  };

  const handleInsert = () => {
    onInsert(generateTable(rows, cols));
    setOpen(false);
    setRows(3);
    setCols(3);
  };

  const handleGridClick = (row: number, col: number) => {
    setRows(row);
    setCols(col);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          title="Table"
          className="h-8 w-8 p-0"
        >
          <Table className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Select table size: {hoverCell ? `${hoverCell.row} × ${hoverCell.col}` : `${rows} × ${cols}`}
          </Label>
          
          {/* Grid selector */}
          <div 
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${maxCols}, 1fr)` }}
            onMouseLeave={() => setHoverCell(null)}
          >
            {Array(maxRows).fill(0).map((_, rowIdx) =>
              Array(maxCols).fill(0).map((_, colIdx) => {
                const cellRow = rowIdx + 1;
                const cellCol = colIdx + 1;
                const isSelected = hoverCell 
                  ? cellRow <= hoverCell.row && cellCol <= hoverCell.col
                  : cellRow <= rows && cellCol <= cols;
                
                return (
                  <button
                    key={`${rowIdx}-${colIdx}`}
                    className={cn(
                      "w-5 h-5 border rounded-sm transition-colors",
                      isSelected 
                        ? "bg-primary border-primary" 
                        : "bg-muted border-border hover:border-primary/50"
                    )}
                    onMouseEnter={() => setHoverCell({ row: cellRow, col: cellCol })}
                    onClick={() => handleGridClick(cellRow, cellCol)}
                  />
                );
              })
            )}
          </div>

          <Button 
            size="sm" 
            className="w-full"
            onClick={handleInsert}
          >
            Insert {rows} × {cols} Table
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ============================================
// Image Popover - URL or File Upload
// ============================================

interface ImagePopoverProps {
  onInsertUrl: (markdown: string) => void;
  onInsertEmbed: (embed: MarkdownEmbed, markdown: string) => void;
  disabled?: boolean;
}

export const ImagePopover: React.FC<ImagePopoverProps> = ({ onInsertUrl, onInsertEmbed, disabled }) => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlInsert = () => {
    if (!url.trim()) return;
    const markdown = `![${alt || 'image'}](${url})`;
    onInsertUrl(markdown);
    setOpen(false);
    setUrl('');
    setAlt('');
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Validate file size (max 5MB for base64 storage)
    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    setIsUploading(true);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        // Extract just the base64 part (remove data:image/xxx;base64, prefix)
        const base64Content = base64Data.split(',')[1];
        
        // Generate unique ID for embed
        const embedId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        // Create embed object
        const embed: MarkdownEmbed = {
          id: embedId,
          type: 'image',
          ref: `embed://${embedId}`,
          alt: alt || file.name.replace(/\.[^/.]+$/, ''),
          mimeType: file.type,
          data: base64Content,
        };

        // Insert markdown reference with embed atomically
        const markdown = `![${embed.alt}](embed://${embedId})`;
        onInsertEmbed(embed, markdown);

        setOpen(false);
        setUrl('');
        setAlt('');
        setIsUploading(false);
      };
      reader.onerror = () => {
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsUploading(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [alt, onInsertEmbed]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          title="Image"
          className="h-8 w-8 p-0"
        >
          <Image className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Tabs defaultValue="url" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="url" className="text-xs">
              <Link className="h-3.5 w-3.5 mr-1.5" />
              URL
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-xs">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="p-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="image-url" className="text-xs">Image URL</Label>
              <Input
                id="image-url"
                placeholder="https://example.com/image.png"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="image-alt-url" className="text-xs">Alt text (optional)</Label>
              <Input
                id="image-alt-url"
                placeholder="Description of image"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <Button 
              size="sm" 
              className="w-full"
              onClick={handleUrlInsert}
              disabled={!url.trim()}
            >
              Insert Image
            </Button>
          </TabsContent>

          <TabsContent value="upload" className="p-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="image-alt-upload" className="text-xs">Alt text (optional)</Label>
              <Input
                id="image-alt-upload"
                placeholder="Description of image"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="image-upload-input"
            />
            
            <Button 
              size="sm" 
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground">
              Max file size: 5MB. Supported formats: PNG, JPG, GIF, WebP
            </p>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};
