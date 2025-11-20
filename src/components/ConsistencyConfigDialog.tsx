import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Download, Upload, RotateCcw } from 'lucide-react';
import { useConsistencyConfig } from '@/hooks/useConsistencyConfig';
import { ConsistencyConfig, NamingConvention, SemanticRule } from '@/types/consistency';
import { useToast } from '@/hooks/use-toast';
import { AlternativesEditor } from './ConsistencyConfigDialogWithAlternatives';

interface ConsistencyConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConsistencyConfigDialog({ open, onOpenChange }: ConsistencyConfigDialogProps) {
  const { config, updateConfig, applyPreset, resetToDefault, exportConfig, importConfig, presets } = useConsistencyConfig();
  const [localConfig, setLocalConfig] = useState<ConsistencyConfig>(config);
  const [importFile, setImportFile] = useState<File | null>(null);
  const { toast } = useToast();

  // Keep local state in sync with global configuration
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSave = () => {
    console.log('Saving consistency config');
    updateConfig(localConfig);
    toast({
      title: "Configuration Saved",
      description: "Consistency configuration has been updated successfully.",
    });
    console.log('Configuration saved toast should be visible');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalConfig(config);
    onOpenChange(false);
  };

  const updateNamingConvention = (
    type: 'queryParameterNaming' | 'pathParameterNaming' | 'componentNaming' | 'endpointNaming' | 'propertyNaming' | 'operationIdNaming',
    updates: Partial<NamingConvention>
  ) => {
    setLocalConfig(prev => ({
      ...prev,
      [type]: { ...prev[type], ...updates }
    }));
  };

  const updateSemanticRule = (ruleId: string, updates: Partial<SemanticRule>) => {
    setLocalConfig(prev => ({
      ...prev,
      semanticRules: prev.semanticRules.map(rule =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      )
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        await importConfig(file);
        setLocalConfig(config);
      } catch (error) {
        console.error('Failed to import config:', error);
      }
    }
  };

  const renderNamingSection = (
    title: string,
    description: string,
    type: 'queryParameterNaming' | 'pathParameterNaming' | 'componentNaming' | 'endpointNaming' | 'propertyNaming' | 'operationIdNaming',
    convention: NamingConvention
  ) => (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={convention.enabled}
            onCheckedChange={(enabled) => updateNamingConvention(type, { enabled })}
          />
          <Label className="font-medium">{title}</Label>
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground">{description}</p>
      
      {convention.enabled && (
        <div className="space-y-3">
          <div>
            <Label>Case Convention</Label>
            <Select
              value={convention.caseType}
              onValueChange={(value: any) => updateNamingConvention(type, { caseType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kebab-case">kebab-case</SelectItem>
                <SelectItem value="camelCase">camelCase</SelectItem>
                <SelectItem value="snake_case">snake_case</SelectItem>
                <SelectItem value="PascalCase">PascalCase</SelectItem>
                <SelectItem value="custom">Custom Pattern</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {convention.caseType === 'custom' && (
            <div>
              <Label>Custom Pattern (RegEx)</Label>
              <Input
                placeholder="^[a-z]+(-[a-z]+)*$"
                value={convention.customPattern || ''}
                onChange={(e) => updateNamingConvention(type, { customPattern: e.target.value })}
              />
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Required Prefix</Label>
              <Input
                placeholder="api_"
                value={convention.prefix || ''}
                onChange={(e) => updateNamingConvention(type, { prefix: e.target.value || undefined })}
              />
            </div>
            <div>
              <Label>Required Suffix</Label>
              <Input
                placeholder="_v1"
                value={convention.suffix || ''}
                onChange={(e) => updateNamingConvention(type, { suffix: e.target.value || undefined })}
              />
            </div>
          </div>
          
          <div>
            <Label>Exclusions (comma-separated)</Label>
            <Input
              placeholder="id, uuid, api"
              value={convention.exclusions?.join(', ') || ''}
              onChange={(e) => updateNamingConvention(type, { 
                exclusions: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Consistency Configuration
          </DialogTitle>
          <DialogDescription>
            Configure naming conventions and semantic rules for your API consistency checks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Presets */}
          <div className="space-y-3">
            <Label>Quick Presets</Label>
            <div className="flex gap-2 flex-wrap">
              {presets.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    applyPreset(preset);
                    setLocalConfig({ ...preset.config, presetName: preset.name });
                  }}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <Tabs defaultValue="naming" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="naming">Naming Conventions</TabsTrigger>
              <TabsTrigger value="semantic">Semantic Rules</TabsTrigger>
              <TabsTrigger value="import-export">Import/Export</TabsTrigger>
            </TabsList>

            <TabsContent value="naming" className="space-y-4">
              <div className="space-y-4">
                {renderNamingSection('Query Parameters', 'Enforce naming conventions for query parameters in API endpoints', 'queryParameterNaming', localConfig.queryParameterNaming)}
                {renderNamingSection('Path Parameters', 'Enforce naming conventions for path parameters in API endpoints', 'pathParameterNaming', localConfig.pathParameterNaming)}
                {renderNamingSection('Component Names', 'Enforce naming conventions for reusable schema components', 'componentNaming', localConfig.componentNaming)}
                {renderNamingSection('Endpoint Paths', 'Enforce naming conventions for API endpoint path segments', 'endpointNaming', localConfig.endpointNaming)}
                {renderNamingSection('Property Names', 'Enforce naming conventions for object properties in schemas', 'propertyNaming', localConfig.propertyNaming)}
                
                {/* OperationId naming with alternatives support */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={localConfig.operationIdNaming?.enabled || false}
                        onCheckedChange={(enabled) => updateNamingConvention('operationIdNaming', { enabled })}
                      />
                      <Label className="font-medium">OperationId</Label>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Enforce naming conventions for operationId properties with support for multiple alternatives
                  </p>
                  
                  {localConfig.operationIdNaming?.enabled && (
                    <div className="space-y-3">
                      <div>
                        <Label>Case Convention</Label>
                        <Select
                          value={localConfig.operationIdNaming.caseType}
                          onValueChange={(value: any) => updateNamingConvention('operationIdNaming', { caseType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kebab-case">kebab-case</SelectItem>
                            <SelectItem value="camelCase">camelCase</SelectItem>
                            <SelectItem value="snake_case">snake_case</SelectItem>
                            <SelectItem value="PascalCase">PascalCase</SelectItem>
                            <SelectItem value="custom">Custom Pattern</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {localConfig.operationIdNaming.caseType === 'custom' && (
                        <div>
                          <Label>Custom Pattern (RegEx)</Label>
                          <Input
                            placeholder="^[a-z]+(-[a-z]+)*$"
                            value={localConfig.operationIdNaming.customPattern || ''}
                            onChange={(e) => updateNamingConvention('operationIdNaming', { customPattern: e.target.value })}
                          />
                        </div>
                      )}
                      
                      <AlternativesEditor
                        alternatives={localConfig.operationIdNaming.alternatives || []}
                        onChange={(alternatives) => updateNamingConvention('operationIdNaming', { alternatives })}
                      />
                      
                      <div>
                        <Label>Exclusions (comma-separated)</Label>
                        <Input
                          placeholder="health, metrics, status"
                          value={localConfig.operationIdNaming.exclusions?.join(', ') || ''}
                          onChange={(e) => updateNamingConvention('operationIdNaming', { 
                            exclusions: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                          })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="semantic" className="space-y-4">
              <div className="space-y-4">
                {localConfig.semanticRules.map((rule) => (
                  <div key={rule.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(enabled) => updateSemanticRule(rule.id, { enabled })}
                        />
                        <Label className="font-medium">{rule.name}</Label>
                        <Badge variant={rule.severity === 'error' ? 'destructive' : rule.severity === 'warning' ? 'default' : 'secondary'}>
                          {rule.severity}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{rule.description}</p>
                    
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label>Severity</Label>
                        <Select
                          value={rule.severity}
                          onValueChange={(value: 'error' | 'warning' | 'info') => 
                            updateSemanticRule(rule.id, { severity: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="error">Error</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="info">Info</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {rule.pattern !== undefined && (
                        <div>
                          <Label>Pattern (RegEx)</Label>
                          <Input
                            value={rule.pattern || ''}
                            onChange={(e) => updateSemanticRule(rule.id, { pattern: e.target.value })}
                            placeholder="Regular expression pattern"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <Label>Custom Message</Label>
                      <Input
                        value={rule.message || ''}
                        onChange={(e) => updateSemanticRule(rule.id, { message: e.target.value })}
                        placeholder="Custom error message"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="import-export" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Export Configuration</h3>
                  <Button onClick={exportConfig} className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export Config
                  </Button>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Import Configuration</h3>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary file:text-primary-foreground"
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Reset Configuration</h3>
                  <Button 
                    onClick={() => {
                      resetToDefault();
                      setLocalConfig(config);
                    }} 
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset to Default
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}