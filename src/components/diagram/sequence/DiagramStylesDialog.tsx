import React, { useState } from 'react';
import { SketchPicker } from 'react-color';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DiagramStyles, DiagramStyleTheme } from '@/types/diagramStyles';
import { DiagramNode, Lifeline } from '@/types/diagram';
import { Palette, Sun, Moon, Box, Columns } from 'lucide-react';

interface DiagramStylesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  styles: DiagramStyles;
  onStylesChange: (styles: DiagramStyles) => void;
  nodes?: DiagramNode[];
  lifelines?: Lifeline[];
}

export const DiagramStylesDialog: React.FC<DiagramStylesDialogProps> = ({
  isOpen,
  onClose,
  styles,
  onStylesChange,
  nodes = [],
  lifelines = []
}) => {
  console.log('🎨 DiagramStylesDialog render - isOpen:', isOpen);
  
  const [activeTab, setActiveTab] = useState<string>('light');
  const currentTheme = styles.themes[activeTab] || styles.themes.light;

  // All available node types
  const allNodeTypes: Array<keyof typeof currentTheme.colors.nodeTypes> = [
    'endpoint',
    'process',
    'decision',
    'data',
    'custom'
  ];

  const handleColorChange = (key: keyof DiagramStyleTheme['colors'], value: string) => {
    const updatedTheme = {
      ...currentTheme,
      colors: {
        ...currentTheme.colors,
        [key]: value
      }
    };

    onStylesChange({
      ...styles,
      themes: {
        ...styles.themes,
        [activeTab]: updatedTheme
      }
    });
  };

  const handleNodeTypeColorChange = (
    nodeType: string,
    colorKey: 'background' | 'border' | 'text',
    value: string
  ) => {
    const updatedTheme = {
      ...currentTheme,
      colors: {
        ...currentTheme.colors,
        nodeTypes: {
          ...currentTheme.colors.nodeTypes,
          [nodeType]: {
            ...currentTheme.colors.nodeTypes[nodeType as keyof typeof currentTheme.colors.nodeTypes],
            [colorKey]: value
          }
        }
      }
    };

    onStylesChange({
      ...styles,
      themes: {
        ...styles.themes,
        [activeTab]: updatedTheme
      }
    });
  };

  const handleLifelineColorChange = (lifelineId: string, value: string) => {
    const updatedLifeline = lifelines.find(l => l.id === lifelineId);
    if (!updatedLifeline) return;

    // Color is stored directly on the lifeline object, not in styles
    // We need to trigger an update through the parent component
    // For now, we'll use customNodeStyles as a workaround
    onStylesChange({
      ...styles,
      customNodeStyles: {
        ...styles.customNodeStyles,
        [`lifeline-${lifelineId}`]: {
          backgroundColor: value
        }
      }
    });
  };

  const handleLifelineAnchorColorChange = (lifelineId: string, value: string) => {
    const updatedLifeline = lifelines.find(l => l.id === lifelineId);
    if (!updatedLifeline) return;

    // Store anchor color in customNodeStyles
    onStylesChange({
      ...styles,
      customNodeStyles: {
        ...styles.customNodeStyles,
        [`lifeline-${lifelineId}-anchor`]: {
          backgroundColor: value
        }
      }
    });
  };

  const handleLifelineAnchorBorderColorChange = (lifelineId: string, value: string) => {
    const updatedLifeline = lifelines.find(l => l.id === lifelineId);
    if (!updatedLifeline) return;

    // Store anchor border color in customNodeStyles
    onStylesChange({
      ...styles,
      customNodeStyles: {
        ...styles.customNodeStyles,
        [`lifeline-${lifelineId}-anchor`]: {
          ...styles.customNodeStyles?.[`lifeline-${lifelineId}-anchor`],
          borderColor: value
        }
      }
    });
  };

  const handleSetActiveTab = (themeId: string) => {
    setActiveTab(themeId);
  };

  const ColorInput = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [localValue, setLocalValue] = useState(value);
    
    // Update local value when prop changes (but not during picking)
    React.useEffect(() => {
      if (!isOpen) {
        setLocalValue(value);
      }
    }, [value, isOpen]);
    
    const handleChange = (newValue: string) => {
      setLocalValue(newValue);
    };
    
    const handleClose = () => {
      setIsOpen(false);
      // Only update parent when closing
      if (localValue !== value) {
        onChange(localValue);
      }
    };
    
    return (
      <div className="space-y-2">
        <Label className="text-sm">{label}</Label>
        <div className="flex gap-2">
          <Popover open={isOpen} onOpenChange={(open) => {
            if (open) {
              setIsOpen(true);
            } else {
              handleClose();
            }
          }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-16 h-10 p-1 cursor-pointer"
                style={{ backgroundColor: localValue }}
              >
                <span className="sr-only">Pick color</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-0" align="start">
              <SketchPicker 
                color={localValue} 
                onChange={(color) => handleChange(color.hex)}
                disableAlpha
              />
            </PopoverContent>
          </Popover>
          <Input
            type="text"
            value={localValue}
            onChange={(e) => {
              setLocalValue(e.target.value);
              onChange(e.target.value);
            }}
            className="flex-1 font-mono text-xs"
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Diagram Styles
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-full max-h-[calc(85vh-120px)]">
          <div className="space-y-4 pr-4">

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="light">
                <Sun className="h-4 w-4 mr-2" />
                Light Theme
              </TabsTrigger>
              <TabsTrigger value="dark">
                <Moon className="h-4 w-4 mr-2" />
                Dark Theme
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4 mt-4">
              <Accordion type="multiple" className="w-full">
                {/* General Colors */}
                <AccordionItem value="general">
                  <AccordionTrigger className="text-sm font-semibold">
                    General Colors
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-4 p-2">
                      <ColorInput
                        label="Background"
                        value={currentTheme.colors.background}
                        onChange={(v) => handleColorChange('background', v)}
                      />
                      <ColorInput
                        label="Swimlane Background"
                        value={currentTheme.colors.swimlaneBackground}
                        onChange={(v) => handleColorChange('swimlaneBackground', v)}
                      />
                      <ColorInput
                        label="Default Node Background"
                        value={currentTheme.colors.nodeBackground}
                        onChange={(v) => handleColorChange('nodeBackground', v)}
                      />
                      <ColorInput
                        label="Default Node Border"
                        value={currentTheme.colors.nodeBorder}
                        onChange={(v) => handleColorChange('nodeBorder', v)}
                      />
                      <ColorInput
                        label="Default Node Text"
                        value={currentTheme.colors.nodeText}
                        onChange={(v) => handleColorChange('nodeText', v)}
                      />
                      <ColorInput
                        label="Edge Stroke"
                        value={currentTheme.colors.edgeStroke}
                        onChange={(v) => handleColorChange('edgeStroke', v)}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Node Type Colors */}
                <AccordionItem value="node-types">
                  <AccordionTrigger className="text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      <Box className="h-4 w-4" />
                      Node Type Colors
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 p-2">
                      {allNodeTypes.map((nodeType) => {
                          const typeColors = currentTheme.colors.nodeTypes[nodeType as keyof typeof currentTheme.colors.nodeTypes];
                          return (
                            <div key={nodeType} className="space-y-3 pb-4 border-b last:border-b-0">
                              <div className="font-medium text-sm capitalize">{nodeType}</div>
                              <div className="grid grid-cols-3 gap-3">
                                <ColorInput
                                  label="Background"
                                  value={typeColors?.background || currentTheme.colors.nodeBackground}
                                  onChange={(v) => handleNodeTypeColorChange(nodeType, 'background', v)}
                                />
                                <ColorInput
                                  label="Border"
                                  value={typeColors?.border || currentTheme.colors.nodeBorder}
                                  onChange={(v) => handleNodeTypeColorChange(nodeType, 'border', v)}
                                />
                                <ColorInput
                                  label="Text"
                                  value={typeColors?.text || currentTheme.colors.nodeText}
                                  onChange={(v) => handleNodeTypeColorChange(nodeType, 'text', v)}
                                />
                              </div>
                            </div>
                          );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Lifeline Colors */}
                {lifelines.length > 0 && (
                  <AccordionItem value="lifelines">
                    <AccordionTrigger className="text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        <Columns className="h-4 w-4" />
                        Lifeline Colors ({lifelines.length})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 p-2">
                        {lifelines.map((lifeline) => {
                          const customColor = styles.customNodeStyles?.[`lifeline-${lifeline.id}`]?.backgroundColor;
                          const customAnchorColor = styles.customNodeStyles?.[`lifeline-${lifeline.id}-anchor`]?.backgroundColor;
                          const customAnchorBorderColor = styles.customNodeStyles?.[`lifeline-${lifeline.id}-anchor`]?.borderColor;
                          
                          // Calculate default anchor color as 50% lighter than lifeline background
                          const lifelineColor = customColor || lifeline.color || currentTheme.colors.swimlaneBackground;
                          const defaultAnchorColor = lightenColor(lifelineColor, 50);
                          const defaultAnchorBorderColor = lightenColor(lifelineColor, 30);
                          
                          return (
                            <div key={lifeline.id} className="space-y-3 pb-4 border-b last:border-b-0">
                              <div className="font-medium text-sm">{lifeline.name}</div>
                              <div className="grid grid-cols-1 gap-3">
                                <ColorInput
                                  label="Background"
                                  value={customColor || lifeline.color || currentTheme.colors.swimlaneBackground}
                                  onChange={(v) => handleLifelineColorChange(lifeline.id, v)}
                                />
                                <ColorInput
                                  label="Anchor Color"
                                  value={customAnchorColor || lifeline.anchorColor || defaultAnchorColor}
                                  onChange={(v) => handleLifelineAnchorColorChange(lifeline.id, v)}
                                />
                                <ColorInput
                                  label="Anchor Border"
                                  value={customAnchorBorderColor || defaultAnchorBorderColor}
                                  onChange={(v) => handleLifelineAnchorBorderColorChange(lifeline.id, v)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </TabsContent>
          </Tabs>

        </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Helper function to lighten a color by a percentage
function lightenColor(color: string, percent: number): string {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Lighten by moving toward white (255)
  r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
