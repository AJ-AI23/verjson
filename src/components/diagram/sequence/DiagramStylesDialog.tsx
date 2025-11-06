import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DiagramStyles, DiagramStyleTheme } from '@/types/diagramStyles';
import { Palette, Sun, Moon } from 'lucide-react';

interface DiagramStylesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  styles: DiagramStyles;
  onStylesChange: (styles: DiagramStyles) => void;
}

export const DiagramStylesDialog: React.FC<DiagramStylesDialogProps> = ({
  isOpen,
  onClose,
  styles,
  onStylesChange
}) => {
  const [activeTab, setActiveTab] = useState<string>(styles.activeTheme);
  const currentTheme = styles.themes[activeTab] || styles.themes.light;

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

  const handleSetActiveTheme = (themeId: string) => {
    onStylesChange({
      ...styles,
      activeTheme: themeId
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Diagram Styles
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Active Theme</Label>
            <div className="flex gap-2">
              <Button
                variant={styles.activeTheme === 'light' ? 'default' : 'outline'}
                onClick={() => handleSetActiveTheme('light')}
                className="flex-1"
              >
                <Sun className="h-4 w-4 mr-2" />
                Light Mode
              </Button>
              <Button
                variant={styles.activeTheme === 'dark' ? 'default' : 'outline'}
                onClick={() => handleSetActiveTheme('dark')}
                className="flex-1"
              >
                <Moon className="h-4 w-4 mr-2" />
                Dark Mode
              </Button>
            </div>
          </div>

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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={currentTheme.colors.background}
                      onChange={(e) => handleColorChange('background', e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={currentTheme.colors.background}
                      onChange={(e) => handleColorChange('background', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Swimlane Background</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={currentTheme.colors.swimlaneBackground}
                      onChange={(e) => handleColorChange('swimlaneBackground', e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={currentTheme.colors.swimlaneBackground}
                      onChange={(e) => handleColorChange('swimlaneBackground', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Node Background</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={currentTheme.colors.nodeBackground}
                      onChange={(e) => handleColorChange('nodeBackground', e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={currentTheme.colors.nodeBackground}
                      onChange={(e) => handleColorChange('nodeBackground', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Node Border</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={currentTheme.colors.nodeBorder}
                      onChange={(e) => handleColorChange('nodeBorder', e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={currentTheme.colors.nodeBorder}
                      onChange={(e) => handleColorChange('nodeBorder', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Node Text</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={currentTheme.colors.nodeText}
                      onChange={(e) => handleColorChange('nodeText', e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={currentTheme.colors.nodeText}
                      onChange={(e) => handleColorChange('nodeText', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Edge Stroke</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={currentTheme.colors.edgeStroke}
                      onChange={(e) => handleColorChange('edgeStroke', e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={currentTheme.colors.edgeStroke}
                      onChange={(e) => handleColorChange('edgeStroke', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
