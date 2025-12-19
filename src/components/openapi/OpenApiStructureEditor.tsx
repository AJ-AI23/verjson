import React, { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, Box, Link2, Hash, Type, List, ToggleLeft, Calendar, FileText, Server, Info, Route, Shield, Tag, Pencil, Check, X, Plus, Trash2 } from 'lucide-react';
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

const PRIMITIVE_TYPES = ['string', 'integer', 'number', 'boolean', 'null'];

// Properties that don't have a type in OpenAPI - they are just values
const VALUE_ONLY_PROPERTIES = new Set([
  'title', 'description', 'summary', 'termsOfService', 'name', 'email', 'url',
  'version', 'license', 'contact', 'operationId', 'deprecated', 'example',
  'default', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern',
  'format', 'enum', 'required', 'nullable', 'readOnly', 'writeOnly',
  'externalValue', 'value', 'in', 'scheme', 'bearerFormat', 'openIdConnectUrl',
  'contentType', 'style', 'explode', 'allowReserved', 'allowEmptyValue',
  'x-']
);

const isValueOnlyProperty = (name: string): boolean => {
  if (VALUE_ONLY_PROPERTIES.has(name)) return true;
  if (name.startsWith('x-')) return true;
  return false;
};

const isPrimitiveValue = (value: any): boolean => {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
};

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
  parentIsArray?: boolean;
  onPropertyChange: (path: string[], updates: { name?: string; schema?: any }) => void;
  onPropertyRename: (path: string[], oldName: string, newName: string) => void;
  onAddProperty?: (path: string[], name: string, schema: any) => void;
  onDeleteProperty?: (path: string[]) => void;
  onAddArrayItem?: (path: string[], item: any) => void;
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

const getTypeLabel = (schema: any): string | null => {
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
  
  return typeValue || null;
};

const hasSchemaType = (schema: any): boolean => {
  if (schema?.$ref) return true;
  const types = schema?.types || schema?.type;
  return !!types;
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

// Editable value for primitive types
const EditableValue: React.FC<{
  value: any;
  onValueChange: (newValue: any) => void;
}> = ({ value, onValueChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState(String(value));

  const handleSubmit = () => {
    let parsedValue: any = editedValue;
    // Try to preserve original type
    if (typeof value === 'number') {
      const num = parseFloat(editedValue);
      if (!isNaN(num)) parsedValue = num;
    } else if (typeof value === 'boolean') {
      parsedValue = editedValue.toLowerCase() === 'true';
    }
    onValueChange(parsedValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedValue(String(value));
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editedValue}
          onChange={(e) => setEditedValue(e.target.value)}
          className="h-6 w-40 text-xs px-1"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleSubmit}>
          <Check className="h-3 w-3 text-green-500" />
        </Button>
        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleCancel}>
          <X className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <span 
      className="text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:underline group inline-flex items-center gap-1"
      onClick={() => setIsEditing(true)}
    >
      {typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50" />
    </span>
  );
};

// Add new property dialog
const AddPropertyButton: React.FC<{
  onAdd: (name: string, schema: any) => void;
  availableRefs: string[];
}> = ({ onAdd, availableRefs }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('string');

  const handleAdd = () => {
    if (!name.trim()) return;
    
    let schema: any;
    if (availableRefs.includes(type)) {
      schema = { $ref: `#/components/schemas/${type}` };
    } else {
      schema = { type };
    }
    
    onAdd(name.trim(), schema);
    setName('');
    setType('string');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="start">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Property Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="propertyName"
              className="h-8 text-sm mt-1"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full h-8 text-sm mt-1 border rounded-md px-2 bg-background"
            >
              <optgroup label="Primitive Types">
                {OPENAPI_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </optgroup>
              {availableRefs.length > 0 && (
                <optgroup label="Components">
                  {availableRefs.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <Button onClick={handleAdd} size="sm" className="w-full">
            Add Property
          </Button>
        </div>
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
  parentIsArray = false,
  onPropertyChange,
  onPropertyRename,
  onAddProperty,
  onDeleteProperty,
  onAddArrayItem
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);
  
  const availableRefs = useMemo(() => Object.keys(allSchemas), [allSchemas]);
  
  // Check if this property has a schema with type, or is just a primitive value
  const isSchemaWithType = hasSchemaType(propertySchema);
  const isPrimitive = isPrimitiveValue(propertySchema);
  const isValueOnly = isValueOnlyProperty(name);
  
  const hasChildren = useMemo(() => {
    // Handle primitive values
    if (isPrimitive) return false;
    
    // Handle arrays of primitives
    if (Array.isArray(propertySchema)) {
      return propertySchema.length > 0;
    }
    
    // Handle objects without type (nested structure)
    if (typeof propertySchema === 'object' && propertySchema !== null && !isSchemaWithType) {
      return Object.keys(propertySchema).length > 0;
    }
    
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
  }, [propertySchema, isSchemaWithType, isPrimitive]);

  const isArray = useMemo(() => {
    if (Array.isArray(propertySchema)) return true;
    const types = propertySchema?.types || propertySchema?.type;
    const typeValue = Array.isArray(types) ? types[0] : types;
    return typeValue === 'array';
  }, [propertySchema]);

  const getResolvedSchema = (ref: string) => {
    const refName = ref.split('/').pop();
    return refName ? allSchemas[refName] : null;
  };

  const childProperties = useMemo(() => {
    if (!isExpanded) return null;
    
    // Handle plain arrays (not schema arrays)
    if (Array.isArray(propertySchema)) {
      return propertySchema.reduce((acc, item, index) => {
        acc[String(index)] = item;
        return acc;
      }, {} as Record<string, any>);
    }
    
    // Handle objects without type (nested structure like paths, info, etc.)
    if (typeof propertySchema === 'object' && propertySchema !== null && !isSchemaWithType) {
      return propertySchema;
    }
    
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
  }, [isExpanded, propertySchema, allSchemas, isSchemaWithType]);

  const typeLabel = getTypeLabel(propertySchema);

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
      if (newType !== 'array') delete newSchema.items;
      if (newType !== 'object') delete newSchema.properties;
    }
    onPropertyChange(path, { schema: newSchema });
  };

  const handleValueChange = (newValue: any) => {
    onPropertyChange(path, { schema: newValue });
  };

  const handleAddChildProperty = (childName: string, childSchema: any) => {
    if (onAddProperty) {
      onAddProperty([...path, 'properties'], childName, childSchema);
    }
  };

  const handleAddArrayItem = () => {
    if (onAddArrayItem && Array.isArray(propertySchema)) {
      // Determine type of existing items
      const firstItem = propertySchema[0];
      let newItem: any = '';
      if (typeof firstItem === 'number') newItem = 0;
      else if (typeof firstItem === 'boolean') newItem = false;
      else if (typeof firstItem === 'object') newItem = {};
      onAddArrayItem(path, newItem);
    }
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
            onClick={() => !parentIsArray && setIsEditingName(true)}
          >
            {isArrayItem ? `[${name}]` : name}
            {!parentIsArray && <Pencil className="h-3 w-3 ml-1 inline opacity-0 group-hover:opacity-50" />}
          </span>
        )}
        
        <div className="ml-auto flex items-center gap-1">
          {/* Show editable value for primitives, or type selector for schema properties */}
          {isPrimitive ? (
            <EditableValue value={propertySchema} onValueChange={handleValueChange} />
          ) : isValueOnly && !hasChildren ? (
            <span className="text-xs text-muted-foreground">
              {JSON.stringify(propertySchema).slice(0, 50)}
            </span>
          ) : typeLabel ? (
            <TypeSelector
              currentType={typeLabel}
              availableRefs={availableRefs}
              onTypeSelect={handleTypeChange}
            />
          ) : null}
          
          {/* Add array item button */}
          {Array.isArray(propertySchema) && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); handleAddArrayItem(); }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          
          {/* Delete button */}
          {onDeleteProperty && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDeleteProperty(path); }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
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
              isArrayItem={Array.isArray(propertySchema)}
              parentIsArray={Array.isArray(propertySchema)}
              onPropertyChange={onPropertyChange}
              onPropertyRename={onPropertyRename}
              onAddProperty={onAddProperty}
              onDeleteProperty={onDeleteProperty}
              onAddArrayItem={onAddArrayItem}
            />
          ))}
          
          {/* Add property button for objects */}
          {!Array.isArray(propertySchema) && isSchemaWithType && onAddProperty && (
            <div className="py-1 px-2" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
              <AddPropertyButton onAdd={handleAddChildProperty} availableRefs={availableRefs} />
            </div>
          )}
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
  onAddProperty: (path: string[], name: string, schema: any) => void;
  onDeleteProperty: (path: string[]) => void;
  onAddArrayItem: (path: string[], item: any) => void;
}

const SectionTree: React.FC<SectionTreeProps> = ({ 
  title, 
  icon, 
  data,
  path,
  allSchemas,
  onPropertyChange,
  onPropertyRename,
  onAddProperty,
  onDeleteProperty,
  onAddArrayItem
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const availableRefs = useMemo(() => Object.keys(allSchemas), [allSchemas]);
  
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return null;
  }

  const handleAddProperty = (name: string, schema: any) => {
    onAddProperty(path, name, schema);
  };

  const renderContent = () => {
    if (typeof data !== 'object' || data === null) {
      return (
        <div className="pl-6 py-1 text-sm text-muted-foreground">
          <EditableValue value={data} onValueChange={(v) => onPropertyChange(path, { schema: v })} />
        </div>
      );
    }

    if (Array.isArray(data)) {
      return (
        <div className="space-y-0.5">
          {data.map((item, index) => (
            <EditablePropertyNode
              key={index}
              name={String(index)}
              propertySchema={item}
              path={[...path, String(index)]}
              allSchemas={allSchemas}
              isArrayItem={true}
              parentIsArray={true}
              onPropertyChange={onPropertyChange}
              onPropertyRename={onPropertyRename}
              onAddProperty={onAddProperty}
              onDeleteProperty={onDeleteProperty}
              onAddArrayItem={onAddArrayItem}
            />
          ))}
          <div className="py-1 px-2 pl-6">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs gap-1"
              onClick={() => onAddArrayItem(path, typeof data[0] === 'object' ? {} : '')}
            >
              <Plus className="h-3 w-3" />
              Add Item
            </Button>
          </div>
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
            onAddProperty={onAddProperty}
            onDeleteProperty={onDeleteProperty}
            onAddArrayItem={onAddArrayItem}
          />
        ))}
        <div className="py-1 px-2 pl-6">
          <AddPropertyButton onAdd={handleAddProperty} availableRefs={availableRefs} />
        </div>
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
    
    let parent = newSchema;
    for (let i = 0; i < path.length - 1; i++) {
      parent = parent[path[i]];
    }
    
    if (parent && typeof parent === 'object') {
      const value = parent[oldName];
      delete parent[oldName];
      parent[newName] = value;
    }
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  const handleAddProperty = useCallback((path: string[], name: string, propSchema: any) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    
    let current = newSchema;
    for (const key of path) {
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    
    current[name] = propSchema;
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  const handleDeleteProperty = useCallback((path: string[]) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    
    let parent = newSchema;
    for (let i = 0; i < path.length - 1; i++) {
      parent = parent[path[i]];
    }
    
    const lastKey = path[path.length - 1];
    if (Array.isArray(parent)) {
      parent.splice(parseInt(lastKey), 1);
    } else if (parent && typeof parent === 'object') {
      delete parent[lastKey];
    }
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  const handleAddArrayItem = useCallback((path: string[], item: any) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    
    let current = newSchema;
    for (const key of path) {
      current = current[key];
    }
    
    if (Array.isArray(current)) {
      current.push(item);
    }
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  const handleAddComponent = useCallback((name: string, componentSchema: any) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    if (!newSchema.components) newSchema.components = {};
    if (!newSchema.components.schemas) newSchema.components.schemas = {};
    newSchema.components.schemas[name] = componentSchema;
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
                onAddProperty={handleAddProperty}
                onDeleteProperty={handleDeleteProperty}
                onAddArrayItem={handleAddArrayItem}
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
            {/* Add new component button */}
            <div className="flex justify-end">
              <AddComponentButton onAdd={handleAddComponent} />
            </div>
            
            {components.length > 0 ? (
              components.map((component) => (
                <div key={component.name} className="border rounded-lg overflow-hidden">
                  <ComponentTreeEditable
                    component={component}
                    allSchemas={allSchemas}
                    basePath={['components', 'schemas', component.name]}
                    onPropertyChange={handlePropertyChange}
                    onPropertyRename={handlePropertyRename}
                    onAddProperty={handleAddProperty}
                    onDeleteProperty={handleDeleteProperty}
                    onAddArrayItem={handleAddArrayItem}
                  />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Box className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No components found</p>
                <p className="text-sm text-muted-foreground/70">
                  Click "Add Component" to create a new schema
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
};

// Add component dialog
const AddComponentButton: React.FC<{
  onAdd: (name: string, schema: any) => void;
}> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), { type: 'object', properties: {} });
    setName('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-3 w-3" />
          Add Component
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="end">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Component Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="MyComponent"
              className="h-8 text-sm mt-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
          </div>
          <Button onClick={handleAdd} size="sm" className="w-full">
            Create Component
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface ComponentTreeEditableProps {
  component: { name: string; schema: any; description?: string; isTopLevel: boolean };
  allSchemas: Record<string, any>;
  basePath: string[];
  onPropertyChange: (path: string[], updates: { name?: string; schema?: any }) => void;
  onPropertyRename: (path: string[], oldName: string, newName: string) => void;
  onAddProperty: (path: string[], name: string, schema: any) => void;
  onDeleteProperty: (path: string[]) => void;
  onAddArrayItem: (path: string[], item: any) => void;
}

const ComponentTreeEditable: React.FC<ComponentTreeEditableProps> = ({ 
  component, 
  allSchemas,
  basePath,
  onPropertyChange,
  onPropertyRename,
  onAddProperty,
  onDeleteProperty,
  onAddArrayItem
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const availableRefs = useMemo(() => Object.keys(allSchemas), [allSchemas]);
  
  const properties = component.schema?.properties || {};
  const hasProperties = Object.keys(properties).length > 0;

  const handleAddProperty = (name: string, schema: any) => {
    onAddProperty([...basePath, 'properties'], name, schema);
  };

  return (
    <>
      <div 
        className={cn(
          "flex items-center gap-3 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors group",
          isExpanded && "border-b"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {hasProperties || true ? (
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
        
        {/* Delete component button */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDeleteProperty(basePath); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      
      {isExpanded && (
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
              onAddProperty={onAddProperty}
              onDeleteProperty={onDeleteProperty}
              onAddArrayItem={onAddArrayItem}
            />
          ))}
          
          {/* Add property button */}
          <div className="py-1 px-2 pl-6">
            <AddPropertyButton onAdd={handleAddProperty} availableRefs={availableRefs} />
          </div>
        </div>
      )}
    </>
  );
};
