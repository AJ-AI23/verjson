import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Box, Link2, Hash, Type, List, ToggleLeft, Calendar, FileText, Copy, Scissors, Info } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePropertyClipboard, ClipboardItem } from '@/hooks/usePropertyClipboard';

interface RequiredFieldInfo {
  path: string;
  type: string;
}

/**
 * Recursively collects all required fields from a schema, including nested objects and refs.
 */
function collectRequiredFields(
  schema: any,
  allSchemas: Record<string, any>,
  currentPath: string = '',
  visited: Set<string> = new Set()
): RequiredFieldInfo[] {
  const results: RequiredFieldInfo[] = [];
  
  if (!schema || typeof schema !== 'object') return results;
  
  // Handle $ref
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    if (refName && !visited.has(refName)) {
      visited.add(refName);
      const resolved = allSchemas[refName];
      if (resolved) {
        return collectRequiredFields(resolved, allSchemas, currentPath, visited);
      }
    }
    return results;
  }
  
  const types = schema.types || schema.type;
  const typeValue = Array.isArray(types) ? types[0] : types;
  
  // Handle object with properties
  if (typeValue === 'object' || schema.properties) {
    const requiredProps: string[] = schema.required || [];
    const properties = schema.properties || {};
    
    for (const [propName, propSchema] of Object.entries(properties)) {
      const propPath = currentPath ? `${currentPath}.${propName}` : propName;
      const prop = propSchema as any;
      
      if (requiredProps.includes(propName)) {
        const propType = getTypeLabel(prop);
        results.push({ path: propPath, type: propType });
      }
      
      // Recurse into nested objects/arrays
      results.push(...collectRequiredFields(prop, allSchemas, propPath, visited));
    }
  }
  
  // Handle arrays
  if (typeValue === 'array' && schema.items) {
    const itemPath = currentPath ? `${currentPath}[]` : '[]';
    results.push(...collectRequiredFields(schema.items, allSchemas, itemPath, visited));
  }
  
  return results;
}

interface ComponentInfo {
  name: string;
  schema: any;
  description?: string;
  isTopLevel: boolean;
}

interface ComponentInspectionTabProps {
  components: ComponentInfo[];
  allSchemas: Record<string, any>;
}

interface PropertyNodeProps {
  name: string;
  schema: any;
  allSchemas: Record<string, any>;
  depth?: number;
  isArrayItem?: boolean;
  path: string[];
  onCopy?: (name: string, schema: any, path: string[]) => void;
  onCut?: (name: string, schema: any, path: string[]) => void;
  clipboard?: ClipboardItem | null;
}

const getTypeIcon = (schema: any) => {
  if (schema.$ref) return <Link2 className="h-3.5 w-3.5 text-blue-500" />;
  
  const types = schema.types || schema.type;
  const typeValue = Array.isArray(types) ? types[0] : types;
  
  switch (typeValue) {
    case 'string':
      if (schema.format === 'date' || schema.format === 'date-time') {
        return <Calendar className="h-3.5 w-3.5 text-purple-500" />;
      }
      return <Type className="h-3.5 w-3.5 text-green-500" />;
    case 'integer':
    case 'number':
      return <Hash className="h-3.5 w-3.5 text-orange-500" />;
    case 'boolean':
      return <ToggleLeft className="h-3.5 w-3.5 text-pink-500" />;
    case 'array':
      return <List className="h-3.5 w-3.5 text-cyan-500" />;
    case 'object':
      return <Box className="h-3.5 w-3.5 text-yellow-500" />;
    default:
      return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
  }
};

const getTypeLabel = (schema: any): string => {
  if (schema.$ref) {
    const refPath = schema.$ref;
    const refName = refPath.split('/').pop();
    return refName;
  }
  
  const types = schema.types || schema.type;
  const typeValue = Array.isArray(types) ? types[0] : types;
  
  if (typeValue === 'array' && schema.items) {
    if (schema.items.$ref) {
      const refName = schema.items.$ref.split('/').pop();
      return `${refName}[]`;
    }
    const itemTypes = schema.items.types || schema.items.type;
    const itemType = Array.isArray(itemTypes) ? itemTypes[0] : itemTypes;
    return `${itemType || 'any'}[]`;
  }
  
  return typeValue || 'unknown';
};

const PropertyNode: React.FC<PropertyNodeProps> = ({ 
  name, 
  schema, 
  allSchemas, 
  depth = 0,
  isArrayItem = false,
  path,
  onCopy,
  onCut,
  clipboard
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const hasChildren = useMemo(() => {
    if (schema.$ref) return true;
    
    const types = schema.types || schema.type;
    const typeValue = Array.isArray(types) ? types[0] : types;
    
    if (typeValue === 'object' && schema.properties) {
      return Object.keys(schema.properties).length > 0;
    }
    if (typeValue === 'array' && schema.items) {
      if (schema.items.$ref) return true;
      const itemTypes = schema.items.types || schema.items.type;
      const itemType = Array.isArray(itemTypes) ? itemTypes[0] : itemTypes;
      if (itemType === 'object' && schema.items.properties) {
        return Object.keys(schema.items.properties).length > 0;
      }
    }
    return false;
  }, [schema]);

  const getResolvedSchema = (ref: string) => {
    const refName = ref.split('/').pop();
    return refName ? allSchemas[refName] : null;
  };

  const childProperties = useMemo(() => {
    if (!isExpanded) return null;
    
    if (schema.$ref) {
      const resolved = getResolvedSchema(schema.$ref);
      if (resolved?.properties) {
        return resolved.properties;
      }
      return null;
    }
    
    const types = schema.types || schema.type;
    const typeValue = Array.isArray(types) ? types[0] : types;
    
    if (typeValue === 'object' && schema.properties) {
      return schema.properties;
    }
    
    if (typeValue === 'array' && schema.items) {
      if (schema.items.$ref) {
        const resolved = getResolvedSchema(schema.items.$ref);
        if (resolved?.properties) {
          return resolved.properties;
        }
      }
      if (schema.items.properties) {
        return schema.items.properties;
      }
    }
    
    return null;
  }, [isExpanded, schema, allSchemas]);

  const typeLabel = getTypeLabel(schema);
  const isRef = !!schema.$ref || !!(schema.items?.$ref);

  // Check if this property is in the clipboard
  const isInClipboard = useMemo(() => {
    if (!clipboard) return null;
    const currentFullPath = path.join('/');
    const clipboardFullPath = clipboard.sourcePath.join('/');
    if (currentFullPath === clipboardFullPath) {
      return clipboard.isCut ? 'cut' : 'copied';
    }
    return null;
  }, [clipboard, path]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCopy) {
      onCopy(name, schema, path);
    }
  };

  const handleCut = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCut) {
      onCut(name, schema, path);
    }
  };

  return (
    <div className="select-none">
      <div 
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors group",
          isInClipboard === 'cut' && "bg-destructive/10 border border-dashed border-destructive/50",
          isInClipboard === 'copied' && "bg-primary/10 border border-dashed border-primary/50"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}
        
        {getTypeIcon(schema)}
        
        <span className={cn(
          "font-medium text-sm",
          isArrayItem && "text-muted-foreground italic"
        )}>
          {isArrayItem ? `[${name}]` : name}
        </span>
        
        {/* Copy/Cut buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
          {onCopy && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={handleCopy}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy (Ctrl+C)</TooltipContent>
            </Tooltip>
          )}
          {onCut && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={handleCut}
                >
                  <Scissors className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Cut (Ctrl+X)</TooltipContent>
            </Tooltip>
          )}
        </div>
        
        <Badge 
          variant={isRef ? "default" : "secondary"} 
          className={cn(
            "text-xs font-normal",
            isRef && "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20"
          )}
        >
          {typeLabel}
        </Badge>
      </div>
      
      {isExpanded && childProperties && (
        <div className="border-l border-border/50 ml-4" style={{ marginLeft: `${depth * 16 + 20}px` }}>
          {Object.entries(childProperties).map(([propName, propSchema]) => (
            <PropertyNode
              key={propName}
              name={propName}
              schema={propSchema as any}
              allSchemas={allSchemas}
              depth={depth + 1}
              path={[...path, 'properties', propName]}
              onCopy={onCopy}
              onCut={onCut}
              clipboard={clipboard}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ComponentTreeProps {
  component: ComponentInfo;
  allSchemas: Record<string, any>;
  onCopy?: (name: string, schema: any, path: string[]) => void;
  onCut?: (name: string, schema: any, path: string[]) => void;
  clipboard?: ClipboardItem | null;
}

const ComponentTree: React.FC<ComponentTreeProps> = ({ component, allSchemas, onCopy, onCut, clipboard }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  
  const properties = component.schema?.properties || {};
  const hasProperties = Object.keys(properties).length > 0;

  // Collect required fields for summary
  const requiredFields = useMemo(() => {
    return collectRequiredFields(component.schema, allSchemas);
  }, [component.schema, allSchemas]);

  // Check if this component is in the clipboard
  const isInClipboard = useMemo(() => {
    if (!clipboard) return null;
    const currentFullPath = ['components', 'schemas', component.name].join('/');
    const clipboardFullPath = clipboard.sourcePath.join('/');
    if (currentFullPath === clipboardFullPath) {
      return clipboard.isCut ? 'cut' : 'copied';
    }
    return null;
  }, [clipboard, component.name]);

  const handleCopyComponent = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCopy) {
      onCopy(component.name, component.schema, ['components', 'schemas', component.name]);
    }
  };

  const handleCutComponent = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCut) {
      onCut(component.name, component.schema, ['components', 'schemas', component.name]);
    }
  };

  const handleShowSummary = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSummary(true);
  };

  return (
    <>
      <div className={cn(
        "border rounded-lg overflow-hidden",
        isInClipboard === 'cut' && "border-dashed border-destructive/50 bg-destructive/5",
        isInClipboard === 'copied' && "border-dashed border-primary/50 bg-primary/5"
      )}>
        <div 
          className={cn(
            "flex items-center gap-3 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors group",
            isExpanded && "border-b"
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {hasProperties ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="w-4" />
          )}
          
          <Box className="h-4 w-4 text-primary" />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{component.name}</span>
              {component.isTopLevel && (
                <Badge variant="outline" className="text-xs">Top Level</Badge>
              )}
            </div>
            {component.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {component.description}
              </p>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Summary button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleShowSummary}
                >
                  <Info className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">View summary</TooltipContent>
            </Tooltip>
            {onCopy && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleCopyComponent}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Copy component</TooltipContent>
              </Tooltip>
            )}
            {onCut && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleCutComponent}
                  >
                    <Scissors className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Cut component</TooltipContent>
              </Tooltip>
            )}
          </div>
          
          <Badge variant="secondary" className="text-xs shrink-0">
            {Object.keys(properties).length} properties
          </Badge>
        </div>
        
        {isExpanded && hasProperties && (
          <div className="p-2 bg-background">
            {Object.entries(properties).map(([propName, propSchema]) => (
              <PropertyNode
                key={propName}
                name={propName}
                schema={propSchema as any}
                allSchemas={allSchemas}
                path={['components', 'schemas', component.name, 'properties', propName]}
                onCopy={onCopy}
                onCut={onCut}
                clipboard={clipboard}
              />
            ))}
          </div>
        )}
      </div>

      {/* Summary Dialog */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Box className="h-5 w-5 text-primary" />
              {component.name} Summary
            </DialogTitle>
            <DialogDescription>
              Overview of required fields in this component
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Stats */}
            <div className="flex gap-4">
              <div className="flex-1 p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-2xl font-bold text-primary">{requiredFields.length}</div>
                <div className="text-xs text-muted-foreground">Required Fields</div>
              </div>
              <div className="flex-1 p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-2xl font-bold">{Object.keys(properties).length}</div>
                <div className="text-xs text-muted-foreground">Total Properties</div>
              </div>
            </div>
            
            {/* Required fields list */}
            {requiredFields.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Required Field Paths:</h4>
                <ScrollArea className="h-[200px] border rounded-md">
                  <div className="p-2 space-y-1">
                    {requiredFields.map((field, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded text-sm hover:bg-muted/50 transition-colors"
                      >
                        <code className="font-mono text-xs text-foreground">{field.path}</code>
                        <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                          {field.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">No required fields in this component</p>
              </div>
            )}
          </div>
          
          <DialogClose asChild>
            <Button variant="outline" className="w-full mt-2">Close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const ComponentInspectionTab: React.FC<ComponentInspectionTabProps> = ({
  components,
  allSchemas
}) => {
  const [filter, setFilter] = useState<'all' | 'top-level'>('all');
  const { clipboard, copy, cut } = usePropertyClipboard();
  
  const filteredComponents = useMemo(() => {
    if (filter === 'top-level') {
      return components.filter(c => c.isTopLevel);
    }
    return components;
  }, [components, filter]);

  if (components.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Box className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No components found</p>
        <p className="text-sm text-muted-foreground/70">
          Make sure your schema contains a "components.schemas" section
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Explore {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''} and their relationships
        </p>
        <div className="flex gap-2">
          <Badge 
            variant={filter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('all')}
          >
            All ({components.length})
          </Badge>
          <Badge 
            variant={filter === 'top-level' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('top-level')}
          >
            Top Level ({components.filter(c => c.isTopLevel).length})
          </Badge>
        </div>
      </div>
      
      {clipboard && (
        <div className="text-xs text-muted-foreground flex items-center gap-2 px-2 py-1 bg-muted/50 rounded">
          <Copy className="h-3 w-3" />
          <span>
            {clipboard.isCut ? 'Cut' : 'Copied'}: <strong>{clipboard.name}</strong>
          </span>
        </div>
      )}
      
      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-4">
          {filteredComponents.map((component) => (
            <ComponentTree 
              key={component.name} 
              component={component} 
              allSchemas={allSchemas}
              onCopy={copy}
              onCut={cut}
              clipboard={clipboard}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
