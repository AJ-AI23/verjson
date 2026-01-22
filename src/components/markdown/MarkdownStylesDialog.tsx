import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownStyles, MarkdownStyleTheme, MarkdownElementStyle } from '@/types/markdownStyles';
import { Palette, Sun, Moon, Type, Heading, Code, Quote, Table } from 'lucide-react';
import { ColorInput, StyleTextInput } from './StyleInputs';

interface MarkdownStylesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  styles: MarkdownStyles;
  onStylesChange: (styles: MarkdownStyles) => void;
}

export const MarkdownStylesDialog: React.FC<MarkdownStylesDialogProps> = ({
  isOpen,
  onClose,
  styles,
  onStylesChange,
}) => {
  const [activeTab, setActiveTab] = useState<string>('light');
  const currentTheme = styles.themes[activeTab] || styles.themes.light;

  const handleColorChange = useCallback((key: keyof MarkdownStyleTheme['colors'], value: string) => {
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
  }, [currentTheme, styles, activeTab, onStylesChange]);

  const handleElementStyleChange = useCallback((
    element: keyof MarkdownStyleTheme['elements'],
    styleKey: keyof MarkdownElementStyle,
    value: string
  ) => {
    const updatedTheme = {
      ...currentTheme,
      elements: {
        ...currentTheme.elements,
        [element]: {
          ...currentTheme.elements[element],
          [styleKey]: value
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
  }, [currentTheme, styles, activeTab, onStylesChange]);

  const handleFontChange = useCallback((key: keyof MarkdownStyleTheme['fonts'], value: string) => {
    const updatedTheme = {
      ...currentTheme,
      fonts: {
        ...currentTheme.fonts,
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
  }, [currentTheme, styles, activeTab, onStylesChange]);

  const ElementStyleEditor = ({ 
    element, 
    label,
    showColor = true,
    showBackground = false,
    showFont = true,
    showBorder = false,
    showFontSize = false
  }: { 
    element: keyof MarkdownStyleTheme['elements']; 
    label: string;
    showColor?: boolean;
    showBackground?: boolean;
    showFont?: boolean;
    showBorder?: boolean;
    showFontSize?: boolean;
  }) => {
    const elementStyle = currentTheme.elements[element];
    
    return (
      <div className="space-y-3 pb-4 border-b last:border-b-0">
        <div className="font-medium text-sm">{label}</div>
        <div className="grid grid-cols-2 gap-3">
          {showColor && (
            <ColorInput
              label="Color"
              value={elementStyle?.color || currentTheme.colors.text}
              onChange={(v) => handleElementStyleChange(element, 'color', v)}
            />
          )}
          {showBackground && (
            <ColorInput
              label="Background"
              value={elementStyle?.backgroundColor || 'transparent'}
              onChange={(v) => handleElementStyleChange(element, 'backgroundColor', v)}
            />
          )}
          {showFont && (
            <>
              <StyleTextInput
                label="Font Size"
                value={elementStyle?.fontSize || ''}
                onChange={(v) => handleElementStyleChange(element, 'fontSize', v)}
                placeholder="1rem"
              />
              <StyleTextInput
                label="Font Weight"
                value={elementStyle?.fontWeight || ''}
                onChange={(v) => handleElementStyleChange(element, 'fontWeight', v)}
                placeholder="400"
              />
            </>
          )}
          {showFontSize && !showFont && (
            <StyleTextInput
              label="Font Size"
              value={elementStyle?.fontSize || ''}
              onChange={(v) => handleElementStyleChange(element, 'fontSize', v)}
              placeholder="1rem"
            />
          )}
          {showBorder && (
            <ColorInput
              label="Border Color"
              value={elementStyle?.borderColor || currentTheme.colors.tableBorder}
              onChange={(v) => handleElementStyleChange(element, 'borderColor', v)}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Markdown Styles
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0">
          <ScrollArea className="h-[450px]">
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
                  <Accordion type="multiple" defaultValue={['general']} className="w-full">
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
                            label="Text"
                            value={currentTheme.colors.text}
                            onChange={(v) => handleColorChange('text', v)}
                          />
                          <ColorInput
                            label="Link"
                            value={currentTheme.colors.link}
                            onChange={(v) => handleColorChange('link', v)}
                          />
                          <ColorInput
                            label="Link Hover"
                            value={currentTheme.colors.linkHover}
                            onChange={(v) => handleColorChange('linkHover', v)}
                          />
                          <ColorInput
                            label="Code Background"
                            value={currentTheme.colors.codeBackground}
                            onChange={(v) => handleColorChange('codeBackground', v)}
                          />
                          <ColorInput
                            label="Code Text"
                            value={currentTheme.colors.codeText}
                            onChange={(v) => handleColorChange('codeText', v)}
                          />
                          <ColorInput
                            label="Blockquote Border"
                            value={currentTheme.colors.blockquoteBorder}
                            onChange={(v) => handleColorChange('blockquoteBorder', v)}
                          />
                          <ColorInput
                            label="Blockquote Background"
                            value={currentTheme.colors.blockquoteBackground}
                            onChange={(v) => handleColorChange('blockquoteBackground', v)}
                          />
                          <ColorInput
                            label="Table Border"
                            value={currentTheme.colors.tableBorder}
                            onChange={(v) => handleColorChange('tableBorder', v)}
                          />
                          <ColorInput
                            label="Table Header Background"
                            value={currentTheme.colors.tableHeaderBackground}
                            onChange={(v) => handleColorChange('tableHeaderBackground', v)}
                          />
                          <ColorInput
                            label="Horizontal Rule"
                            value={currentTheme.colors.hrColor}
                            onChange={(v) => handleColorChange('hrColor', v)}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Headings */}
                    <AccordionItem value="headings">
                      <AccordionTrigger className="text-sm font-semibold">
                        <div className="flex items-center gap-2">
                          <Heading className="h-4 w-4" />
                          Headings
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 p-2">
                          <ElementStyleEditor element="h1" label="Heading 1 (H1)" />
                          <ElementStyleEditor element="h2" label="Heading 2 (H2)" />
                          <ElementStyleEditor element="h3" label="Heading 3 (H3)" />
                          <ElementStyleEditor element="h4" label="Heading 4 (H4)" />
                          <ElementStyleEditor element="h5" label="Heading 5 (H5)" />
                          <ElementStyleEditor element="h6" label="Heading 6 (H6)" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Text Elements */}
                    <AccordionItem value="text">
                      <AccordionTrigger className="text-sm font-semibold">
                        <div className="flex items-center gap-2">
                          <Type className="h-4 w-4" />
                          Text Elements
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 p-2">
                          <ElementStyleEditor element="paragraph" label="Paragraph" showFontSize={true} />
                          <ElementStyleEditor element="bold" label="Bold" showColor={false} showFont={true} />
                          <ElementStyleEditor element="italic" label="Italic" showColor={false} showFont={true} />
                          <ElementStyleEditor element="link" label="Links" showFontSize={true} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Code */}
                    <AccordionItem value="code">
                      <AccordionTrigger className="text-sm font-semibold">
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4" />
                          Code
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 p-2">
                          <ElementStyleEditor element="code" label="Inline Code" showBackground={true} showFontSize={true} />
                          <ElementStyleEditor element="codeBlock" label="Code Block" showBackground={true} showFontSize={true} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Block Elements */}
                    <AccordionItem value="blocks">
                      <AccordionTrigger className="text-sm font-semibold">
                        <div className="flex items-center gap-2">
                          <Quote className="h-4 w-4" />
                          Block Elements
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 p-2">
                          <ElementStyleEditor element="blockquote" label="Blockquote" showBackground={true} showBorder={true} showFontSize={true} />
                          <ElementStyleEditor element="listItem" label="List Items" showFontSize={true} />
                          <ElementStyleEditor element="hr" label="Horizontal Rule" showColor={false} showFont={false} showBorder={true} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Tables */}
                    <AccordionItem value="tables">
                      <AccordionTrigger className="text-sm font-semibold">
                        <div className="flex items-center gap-2">
                          <Table className="h-4 w-4" />
                          Tables
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 p-2">
                          <ElementStyleEditor element="table" label="Table" showColor={false} showFont={false} showBorder={true} />
                          <ElementStyleEditor element="tableHeader" label="Table Header" showBackground={true} showFontSize={true} />
                          <ElementStyleEditor element="tableCell" label="Table Cell" showBorder={true} showFontSize={true} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Fonts */}
                    <AccordionItem value="fonts">
                      <AccordionTrigger className="text-sm font-semibold">
                        Typography
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-4 p-2">
                          <StyleTextInput
                            label="Body Font"
                            value={currentTheme.fonts.bodyFont}
                            onChange={(v) => handleFontChange('bodyFont', v)}
                            placeholder="system-ui, sans-serif"
                          />
                          <StyleTextInput
                            label="Heading Font"
                            value={currentTheme.fonts.headingFont}
                            onChange={(v) => handleFontChange('headingFont', v)}
                            placeholder="system-ui, sans-serif"
                          />
                          <StyleTextInput
                            label="Code Font"
                            value={currentTheme.fonts.codeFont}
                            onChange={(v) => handleFontChange('codeFont', v)}
                            placeholder="ui-monospace, monospace"
                          />
                          <StyleTextInput
                            label="Base Font Size"
                            value={currentTheme.fonts.baseFontSize}
                            onChange={(v) => handleFontChange('baseFontSize', v)}
                            placeholder="16px"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
