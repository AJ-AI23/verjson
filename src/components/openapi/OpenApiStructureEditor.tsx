import React, { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, Box, Link2, Hash, Type, List, ToggleLeft, Calendar, FileText, Server, Info, Route, Shield, Tag, Pencil, Check, X } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPENAPI_TYPES = [
  'string',
  'integer', 
  'number',
  'boolean',
  'array',
  'object',
  'null'
];

const STRING_FORMATS = [
  'date',
  'date-time',
  'email',
  'uri',
  'uuid',
  'hostname',
  'ipv4',
  'ipv6',
  'byte',
  'binary',
  'password'
];

interface OpenApiStructureEditorProps {
  schema: any;
  onSchemaChange: (schema: any) => void;
}

interface EditablePropertyNodeProps {
  name: string;
  propertySchema: any;
  path: string[];
  allSchemas: Record<string, any>;
  depth?: number;
  isArrayItem?: boolean;
  onPropertyChange: (path: string[], updates: { name?: string; schema?: any }) => void;
  onPropertyRename: (path: string[], oldName: string, newName: string) => void;
}

const getTypeIcon = (schema: any) => {
  if (schema?.$ref) return <Link2 className="h-3.5 w-3.5 text-blue-500" />;
  
  const types = schema?.types || schema?.type;
  const typeValue = Array.isArray(types) ? types[0] : types;
  
  switch (typeValue) {
    case 'string':
      if (schema?.format === 'date' || schema?.format === 'date-time') {
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
  if (schema?.$ref) {
    const refPath = schema.$ref;
    const refName = refPath.split('/').pop();
    return refName;
  }
  
  const types = schema?.types || schema?.type;
  const typeValue = Array.isArray(types) ? types[0] : types;
  
  if (typeValue === 'array' && schema?.items) {
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

// Type selector dropdown with filtering
const TypeSelector: React.FC<{
  currentType: string;
  availableRefs: string[];
  onTypeSelect: (type: string, isRef: boolean) => void;
}> = ({ currentType, availableRefs, onTypeSelect }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTypes = OPENAPI_TYPES.filter(t => 
    t.toLowerCase().includes(search.toLowerCase())
  );
  
  const filteredRefs = availableRefs.filter(r => 
    r.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 px-2 text-xs font-normal gap-1"
        >
          {currentType}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search types..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No type found.</CommandEmpty>
            <CommandGroup heading="Primitive Types">
              {filteredTypes.map((type) => (
                <CommandItem
                  key={type}
                  value={type}
                  onSelect={() => {
                    onTypeSelect(type, false);
                    setOpen(false);
                  }}
                >
                  {type}
                </CommandItem>
              ))}
            </CommandGroup>
            {filteredRefs.length > 0 && (
              <CommandGroup heading="Components">
                {filteredRefs.map((ref) => (
                  <CommandItem
                    key={ref}
                    value={ref}
                    onSelect={() => {
                      onTypeSelect(ref, true);
                      setOpen(false);
                    }}
                  >
                    <Link2 className="h-3 w-3 mr-2 text-blue-500" />
                    {ref}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const EditablePropertyNode: React.FC<EditablePropertyNodeProps> = ({ 
  name, 
  propertySchema, 
  path,
  allSchemas, 
  depth = 0,
  isArrayItem = false,
  onPropertyChange,
  onPropertyRename
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);
  
  const availableRefs = useMemo(() => Object.keys(allSchemas), [allSchemas]);
  
  const hasChildren = useMemo(() => {
    if (propertySchema?.$ref) return true;
    
    const types = propertySchema?.types || propertySchema?.type;
    const typeValue = Array.isArray(types) ? types[0] : types;
    
    if (typeValue === 'object' && propertySchema?.properties) {
      return Object.keys(propertySchema.properties).length > 0;
    }
    if (typeValue === 'array' && propertySchema?.items) {
      if (propertySchema.items.$ref) return true;
      const itemTypes = propertySchema.items.types || propertySchema.items.type;
      const itemType = Array.isArray(itemTypes) ? itemTypes[0] : itemTypes;
      if (itemType === 'object' && propertySchema.items.properties) {
        return Object.keys(propertySchema.items.properties).length > 0;
      }
    }
    return false;
  }, [propertySchema]);

  const getResolvedSchema = (ref: string) => {
    const refName = ref.split('/').pop();
    return refName ? allSchemas[refName] : null;
  };

  const childProperties = useMemo(() => {
    if (!isExpanded) return null;
    
    if (propertySchema?.$ref) {
      const resolved = getResolvedSchema(propertySchema.$ref);
      if (resolved?.properties) {
        return resolved.properties;
      }
      return null;
    }
    
    const types = propertySchema?.types || propertySchema?.type;
    const typeValue = Array.isArray(types) ? types[0] : types;
    
    if (typeValue === 'object' && propertySchema?.properties) {
      return propertySchema.properties;
    }
    
    if (typeValue === 'array' && propertySchema?.items) {
      if (propertySchema.items.$ref) {
        const resolved = getResolvedSchema(propertySchema.items.$ref);
        if (resolved?.properties) {
          return resolved.properties;
        }
      }
      if (propertySchema.items.properties) {
        return propertySchema.items.properties;
      }
    }
    
    return null;
  }, [isExpanded, propertySchema, allSchemas]);

  const typeLabel = getTypeLabel(propertySchema);
  const isRef = !!propertySchema?.$ref || !!(propertySchema?.items?.$ref);

  const handleNameSubmit = () => {
    if (editedName && editedName !== name) {
      onPropertyRename(path, name, editedName);
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setEditedName(name);
    setIsEditingName(false);
  };

  const handleTypeChange = (newType: string, isRefType: boolean) => {
    let newSchema: any;
    if (isRefType) {
      newSchema = { $ref: `#/components/schemas/${newType}` };
    } else {
      newSchema = { ...propertySchema };
      delete newSchema.$ref;
      newSchema.type = newType;
      // Clean up incompatible properties when type changes
      if (newType !== 'array') delete newSchema.items;
      if (newType !== 'object') delete newSchema.properties;
    }
    onPropertyChange(path, { schema: newSchema });
  };

  return (
    <div className="select-none">
      <div 
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors group",
          depth > 0 && "ml-4"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span 
          className="cursor-pointer"
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
        </span>
        
        {getTypeIcon(propertySchema)}
        
        {isEditingName ? (
          <div className="flex items-center gap-1">
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="h-6 w-32 text-sm px-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') handleNameCancel();
              }}
            />
            <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleNameSubmit}>
              <Check className="h-3 w-3 text-green-500" />
            </Button>
            <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleNameCancel}>
              <X className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ) : (
          <span 
            className={cn(
              "font-medium text-sm cursor-pointer hover:underline",
              isArrayItem && "text-muted-foreground italic"
            )}
            onClick={() => setIsEditingName(true)}
          >
            {isArrayItem ? `[${name}]` : name}
            <Pencil className="h-3 w-3 ml-1 inline opacity-0 group-hover:opacity-50" />
          </span>
        )}
        
        <div className="ml-auto">
          <TypeSelector
            currentType={typeLabel}
            availableRefs={availableRefs}
            onTypeSelect={handleTypeChange}
          />
        </div>
      </div>
      
      {isExpanded && childProperties && (
        <div className="border-l border-border/50 ml-4" style={{ marginLeft: `${depth * 16 + 20}px` }}>
          {Object.entries(childProperties).map(([propName, propSchema]) => (
            <EditablePropertyNode
              key={propName}
              name={propName}
              propertySchema={propSchema as any}
              path={[...path, propName]}
              allSchemas={allSchemas}
              depth={depth + 1}
              onPropertyChange={onPropertyChange}
              onPropertyRename={onPropertyRename}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface SectionTreeProps {
  title: string;
  icon: React.ReactNode;
  data: any;
  path: string[];
  allSchemas: Record<string, any>;
  onPropertyChange: (path: string[], updates: { name?: string; schema?: any }) => void;
  onPropertyRename: (path: string[], oldName: string, newName: string) => void;
}

const SectionTree: React.FC<SectionTreeProps> = ({ 
  title, 
  icon, 
  data,
  path,
  allSchemas,
  onPropertyChange,
  onPropertyRename
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return null;
  }

  const renderContent = () => {
    if (typeof data !== 'object' || data === null) {
      return (
        <div className="pl-6 py-1 text-sm text-muted-foreground">
          {String(data)}
        </div>
      );
    }

    if (Array.isArray(data)) {
      return (
        <div className="pl-6 space-y-1">
          {data.map((item, index) => (
            <div key={index} className="text-sm">
              {typeof item === 'object' ? (
                <SectionTree
                  title={`[${index}]`}
                  icon={<List className="h-3.5 w-3.5 text-cyan-500" />}
                  data={item}
                  path={[...path, String(index)]}
                  allSchemas={allSchemas}
                  onPropertyChange={onPropertyChange}
                  onPropertyRename={onPropertyRename}
                />
              ) : (
                <span className="text-muted-foreground">{String(item)}</span>
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-0.5">
        {Object.entries(data).map(([key, value]) => (
          <EditablePropertyNode
            key={key}
            name={key}
            propertySchema={value as any}
            path={[...path, key]}
            allSchemas={allSchemas}
            onPropertyChange={onPropertyChange}
            onPropertyRename={onPropertyRename}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div 
        className={cn(
          "flex items-center gap-3 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors",
          isExpanded && "border-b"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {icon}
        <span className="font-semibold text-sm">{title}</span>
        <Badge variant="secondary" className="text-xs ml-auto">
          {Array.isArray(data) ? data.length : Object.keys(data).length} items
        </Badge>
      </div>
      {isExpanded && (
        <div className="p-2 bg-background">
          {renderContent()}
        </div>
      )}
    </div>
  );
};

export const OpenApiStructureEditor: React.FC<OpenApiStructureEditorProps> = ({
  schema,
  onSchemaChange
}) => {
  const allSchemas = useMemo(() => {
    return schema?.components?.schemas || {};
  }, [schema]);

  const handlePropertyChange = useCallback((path: string[], updates: { name?: string; schema?: any }) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    
    // Navigate to the property location
    let current = newSchema;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    const lastKey = path[path.length - 1];
    if (updates.schema !== undefined) {
      current[lastKey] = updates.schema;
    }
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  const handlePropertyRename = useCallback((path: string[], oldName: string, newName: string) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    
    // Navigate to parent
    let parent = newSchema;
    for (let i = 0; i < path.length - 1; i++) {
      parent = parent[path[i]];
    }
    
    // Rename the property
    if (parent && typeof parent === 'object') {
      const value = parent[oldName];
      delete parent[oldName];
      parent[newName] = value;
    }
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  const components = useMemo(() => {
    const schemas = schema?.components?.schemas || {};
    return Object.entries(schemas).map(([name, componentSchema]: [string, any]) => ({
      name,
      schema: componentSchema,
      description: componentSchema?.description,
      isTopLevel: true
    }));
  }, [schema]);

  const rootSections = useMemo(() => {
    const sections: { key: string; title: string; icon: React.ReactNode; data: any }[] = [];
    
    if (schema?.info) {
      sections.push({ key: 'info', title: 'Info', icon: <Info className="h-4 w-4 text-blue-500" />, data: schema.info });
    }
    if (schema?.servers) {
      sections.push({ key: 'servers', title: 'Servers', icon: <Server className="h-4 w-4 text-green-500" />, data: schema.servers });
    }
    if (schema?.paths) {
      sections.push({ key: 'paths', title: 'Paths', icon: <Route className="h-4 w-4 text-orange-500" />, data: schema.paths });
    }
    if (schema?.security) {
      sections.push({ key: 'security', title: 'Security', icon: <Shield className="h-4 w-4 text-red-500" />, data: schema.security });
    }
    if (schema?.tags) {
      sections.push({ key: 'tags', title: 'Tags', icon: <Tag className="h-4 w-4 text-purple-500" />, data: schema.tags });
    }
    
    return sections;
  }, [schema]);

  if (!schema || typeof schema !== 'object') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Invalid schema</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="structure" className="h-full flex flex-col">
      <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-2">
        <TabsTrigger value="structure" className="data-[state=active]:bg-muted">
          Structure
        </TabsTrigger>
        <TabsTrigger value="components" className="data-[state=active]:bg-muted">
          Components
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="structure" className="flex-1 mt-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-3 p-4">
            {rootSections.map((section) => (
              <SectionTree
                key={section.key}
                title={section.title}
                icon={section.icon}
                data={section.data}
                path={[section.key]}
                allSchemas={allSchemas}
                onPropertyChange={handlePropertyChange}
                onPropertyRename={handlePropertyRename}
              />
            ))}
            {rootSections.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Info className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No root sections found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
      
      <TabsContent value="components" className="flex-1 mt-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-3 p-4">
            {components.length > 0 ? (
              components.map((component) => (
                <div key={component.name} className="border rounded-lg overflow-hidden">
                  <ComponentTreeEditable
                    component={component}
                    allSchemas={allSchemas}
                    basePath={['components', 'schemas', component.name]}
                    onPropertyChange={handlePropertyChange}
                    onPropertyRename={handlePropertyRename}
                  />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Box className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No components found</p>
                <p className="text-sm text-muted-foreground/70">
                  Make sure your schema contains a "components.schemas" section
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
};

interface ComponentTreeEditableProps {
  component: { name: string; schema: any; description?: string; isTopLevel: boolean };
  allSchemas: Record<string, any>;
  basePath: string[];
  onPropertyChange: (path: string[], updates: { name?: string; schema?: any }) => void;
  onPropertyRename: (path: string[], oldName: string, newName: string) => void;
}

const ComponentTreeEditable: React.FC<ComponentTreeEditableProps> = ({ 
  component, 
  allSchemas,
  basePath,
  onPropertyChange,
  onPropertyRename
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const properties = component.schema?.properties || {};
  const hasProperties = Object.keys(properties).length > 0;

  return (
    <>
      <div 
        className={cn(
          "flex items-center gap-3 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors",
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
        
        <Badge variant="secondary" className="text-xs shrink-0">
          {Object.keys(properties).length} properties
        </Badge>
      </div>
      
      {isExpanded && hasProperties && (
        <div className="p-2 bg-background">
          {Object.entries(properties).map(([propName, propSchema]) => (
            <EditablePropertyNode
              key={propName}
              name={propName}
              propertySchema={propSchema as any}
              path={[...basePath, 'properties', propName]}
              allSchemas={allSchemas}
              onPropertyChange={onPropertyChange}
              onPropertyRename={onPropertyRename}
            />
          ))}
        </div>
      )}
    </>
  );
};
