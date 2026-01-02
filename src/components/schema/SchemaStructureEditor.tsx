import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Box, Link2, Hash, Type, List, ToggleLeft, FileText, Plus, Trash2, Pencil, Check, X, Copy, Undo2, Redo2, Scissors, Clipboard } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SortablePropertyList, SortableItem, reorderObjectProperties, reorderArrayItems } from './SortablePropertyList';
import { useSchemaHistory } from '@/hooks/useSchemaHistory';
import { usePropertyClipboard } from '@/hooks/usePropertyClipboard';
const JSON_SCHEMA_TYPES = [
  'string',
  'integer', 
  'number',
  'boolean',
  'array',
  'object',
  'null'
];

const PRIMITIVE_TYPES = ['string', 'integer', 'number', 'boolean', 'null'];

// Properties that are just metadata/values, not types
const VALUE_ONLY_PROPERTIES = new Set([
  'title', 'description', '$id', '$schema', 'default', 'examples',
  'minimum', 'maximum', 'minLength', 'maxLength', 'pattern',
  'format', 'enum', 'const', 'required', 'deprecated',
  'readOnly', 'writeOnly', 'contentEncoding', 'contentMediaType',
  'name', 'version', 'id', 'label', 'position', 'x', 'y', 'width', 'height'
]);

const isValueOnlyProperty = (name: string): boolean => {
  if (VALUE_ONLY_PROPERTIES.has(name)) return true;
  if (name.startsWith('$')) return true;
  return false;
};

const isPrimitiveValue = (value: any): boolean => {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
};

interface SchemaStructureEditorProps {
  schema: any;
  onSchemaChange: (schema: any) => void;
  schemaType: 'json-schema' | 'diagram';
}

interface EditablePropertyNodeProps {
  name: string;
  propertySchema: any;
  path: string[];
  definitions: Record<string, any>;
  depth?: number;
  isArrayItem?: boolean;
  parentIsArray?: boolean;
  onPropertyChange: (path: string[], updates: { name?: string; schema?: any }) => void;
  onPropertyRename: (path: string[], oldName: string, newName: string) => void;
  onAddProperty?: (path: string[], name: string, schema: any) => void;
  onDeleteProperty?: (path: string[]) => void;
  onDuplicateProperty?: (path: string[], name: string, schema: any) => void;
  onAddArrayItem?: (path: string[], item: any) => void;
  onReorderProperties?: (path: string[], oldIndex: number, newIndex: number) => void;
  onCopy?: (name: string, schema: any, path: string[]) => void;
  onCut?: (name: string, schema: any, path: string[]) => void;
  onPaste?: (path: string[]) => void;
  hasClipboard?: boolean;
}

const getTypeIcon = (schema: any) => {
  if (schema?.$ref) return <Link2 className="h-3.5 w-3.5 text-blue-500" />;
  
  const types = schema?.type;
  const typeValue = Array.isArray(types) ? types[0] : types;
  
  switch (typeValue) {
    case 'string':
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
  
  const types = schema?.type;
  const typeValue = Array.isArray(types) ? types[0] : types;
  
  if (typeValue === 'array' && schema?.items) {
    if (schema.items.$ref) {
      const refName = schema.items.$ref.split('/').pop();
      return `${refName}[]`;
    }
    const itemType = schema.items.type;
    return `${itemType || 'any'}[]`;
  }
  
  return typeValue || null;
};

const hasSchemaType = (schema: any): boolean => {
  if (schema?.$ref) return true;
  return !!schema?.type;
};

// Type selector dropdown with filtering
const TypeSelector: React.FC<{
  currentType: string;
  availableRefs: string[];
  onTypeSelect: (type: string, isRef: boolean) => void;
}> = ({ currentType, availableRefs, onTypeSelect }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTypes = JSON_SCHEMA_TYPES.filter(t => 
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
            <CommandGroup heading="Types">
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
              <CommandGroup heading="Definitions">
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
      schema = { $ref: `#/$defs/${type}` };
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
              <optgroup label="Types">
                {JSON_SCHEMA_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </optgroup>
              {availableRefs.length > 0 && (
                <optgroup label="Definitions">
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
  definitions, 
  depth = 0,
  isArrayItem = false,
  parentIsArray = false,
  onPropertyChange,
  onPropertyRename,
  onAddProperty,
  onDeleteProperty,
  onDuplicateProperty,
  onAddArrayItem,
  onReorderProperties,
  onCopy,
  onCut,
  onPaste,
  hasClipboard
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);
  
  const availableRefs = useMemo(() => Object.keys(definitions), [definitions]);
  
  const isSchemaWithType = hasSchemaType(propertySchema);
  const isPrimitive = isPrimitiveValue(propertySchema);
  const isValueOnly = isValueOnlyProperty(name);
  
  // Check if this property can have children (for expand/collapse)
  const canHaveChildren = useMemo(() => {
    if (isPrimitive) return false;
    
    if (Array.isArray(propertySchema)) {
      return true; // Arrays can always have items added
    }
    
    if (typeof propertySchema === 'object' && propertySchema !== null && !isSchemaWithType) {
      return true; // Plain objects can have properties added
    }
    
    if (propertySchema?.$ref) return true;
    
    const typeValue = propertySchema?.type;
    
    // Object types can always have properties added
    if (typeValue === 'object') {
      return true;
    }
    if (typeValue === 'array' && propertySchema?.items) {
      if (propertySchema.items.$ref) return true;
      if (propertySchema.items.type === 'object') {
        return true;
      }
    }
    return false;
  }, [propertySchema, isSchemaWithType, isPrimitive]);

  const hasChildren = useMemo(() => {
    if (isPrimitive) return false;
    
    if (Array.isArray(propertySchema)) {
      return propertySchema.length > 0;
    }
    
    if (typeof propertySchema === 'object' && propertySchema !== null && !isSchemaWithType) {
      return Object.keys(propertySchema).length > 0;
    }
    
    if (propertySchema?.$ref) return true;
    
    const typeValue = propertySchema?.type;
    
    if (typeValue === 'object' && propertySchema?.properties) {
      return Object.keys(propertySchema.properties).length > 0;
    }
    if (typeValue === 'array' && propertySchema?.items) {
      if (propertySchema.items.$ref) return true;
      if (propertySchema.items.type === 'object' && propertySchema.items.properties) {
        return Object.keys(propertySchema.items.properties).length > 0;
      }
    }
    return false;
  }, [propertySchema, isSchemaWithType, isPrimitive]);

  const getResolvedSchema = (ref: string) => {
    const refName = ref.split('/').pop();
    return refName ? definitions[refName] : null;
  };

  const childProperties = useMemo(() => {
    if (!isExpanded) return null;
    
    if (Array.isArray(propertySchema)) {
      return propertySchema.reduce((acc, item, index) => {
        acc[String(index)] = item;
        return acc;
      }, {} as Record<string, any>);
    }
    
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
    
    const typeValue = propertySchema?.type;
    
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
  }, [isExpanded, propertySchema, definitions, isSchemaWithType]);

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
      newSchema = { $ref: `#/$defs/${newType}` };
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
      const firstItem = propertySchema[0];
      let newItem: any = '';
      if (typeof firstItem === 'number') newItem = 0;
      else if (typeof firstItem === 'boolean') newItem = false;
      else if (typeof firstItem === 'object') newItem = {};
      onAddArrayItem(path, newItem);
    }
  };

  const handleDuplicate = () => {
    if (onDuplicateProperty && !parentIsArray) {
      // Get parent path (remove the property name from the path)
      const parentPath = path.slice(0, -1);
      // Generate a unique name by appending _copy suffix
      const baseName = name.replace(/_copy\d*$/, '');
      const newName = `${baseName}_copy`;
      // Deep clone the schema
      const clonedSchema = JSON.parse(JSON.stringify(propertySchema));
      onDuplicateProperty(parentPath, newName, clonedSchema);
    }
  };

  const handleCopy = () => {
    if (onCopy && !parentIsArray) {
      onCopy(name, propertySchema, path);
    }
  };

  const handleCut = () => {
    if (onCut && !parentIsArray) {
      onCut(name, propertySchema, path);
    }
  };

  const handlePaste = () => {
    if (onPaste && canHaveChildren) {
      // Paste into this node's properties
      const pastePath = propertySchema?.type === 'object' || (!isPrimitive && !isSchemaWithType) 
        ? [...path, 'properties'] 
        : path;
      onPaste(pastePath);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only trigger if not in an input field
    if ((e.target as HTMLElement).tagName === 'INPUT') return;

    // Ctrl+D to duplicate
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      if (onDuplicateProperty && !parentIsArray) {
        handleDuplicate();
      }
    }
    // Ctrl+C to copy
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      handleCopy();
    }
    // Ctrl+X to cut
    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
      e.preventDefault();
      handleCut();
    }
    // Ctrl+V to paste
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      handlePaste();
    }
    // Delete key to remove
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (onDeleteProperty) {
        onDeleteProperty(path);
      }
    }
  };

  return (
    <div className="select-none">
      <div 
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors group focus:outline-none focus:ring-1 focus:ring-ring",
          depth > 0 && "ml-4"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <span 
          className="cursor-pointer"
          onClick={() => canHaveChildren && setIsExpanded(!isExpanded)}
        >
          {canHaveChildren ? (
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
          {isPrimitive ? (
            <EditableValue value={propertySchema} onValueChange={handleValueChange} />
          ) : typeLabel ? (
            <TypeSelector
              currentType={typeLabel}
              availableRefs={availableRefs}
              onTypeSelect={handleTypeChange}
            />
          ) : isValueOnly && !hasChildren && !isSchemaWithType ? (
            <span className="text-xs text-muted-foreground">
              {JSON.stringify(propertySchema).slice(0, 50)}
            </span>
          ) : null}
          
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
          
          {/* Copy button - only for non-array items */}
          {onCopy && !parentIsArray && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy (Ctrl+C)</TooltipContent>
            </Tooltip>
          )}
          
          {/* Cut button - only for non-array items */}
          {onCut && !parentIsArray && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); handleCut(); }}
                >
                  <Scissors className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cut (Ctrl+X)</TooltipContent>
            </Tooltip>
          )}
          
          {/* Paste button - only for expandable items with clipboard */}
          {onPaste && canHaveChildren && hasClipboard && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); handlePaste(); }}
                >
                  <Clipboard className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Paste (Ctrl+V)</TooltipContent>
            </Tooltip>
          )}
          
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
      
      {isExpanded && canHaveChildren && (
        <div className="border-l border-border/50 ml-4" style={{ marginLeft: `${depth * 16 + 20}px` }}>
          {childProperties && Object.keys(childProperties).length > 0 && (
            <SortablePropertyList
              items={Object.keys(childProperties)}
              onReorder={(oldIndex, newIndex) => {
                if (onReorderProperties) {
                  const basePath = Array.isArray(propertySchema) ? path : [...path, 'properties'];
                  onReorderProperties(basePath, oldIndex, newIndex);
                }
              }}
            >
              {Object.entries(childProperties).map(([propName, propSchema]) => (
                <SortableItem key={propName} id={propName}>
                  <EditablePropertyNode
                    name={propName}
                    propertySchema={propSchema as any}
                    path={[...path, propName]}
                    definitions={definitions}
                    depth={depth + 1}
                    isArrayItem={Array.isArray(propertySchema)}
                    parentIsArray={Array.isArray(propertySchema)}
                    onPropertyChange={onPropertyChange}
                    onPropertyRename={onPropertyRename}
                    onAddProperty={onAddProperty}
                    onDeleteProperty={onDeleteProperty}
                    onDuplicateProperty={onDuplicateProperty}
                    onAddArrayItem={onAddArrayItem}
                    onReorderProperties={onReorderProperties}
                    onCopy={onCopy}
                    onCut={onCut}
                    onPaste={onPaste}
                    hasClipboard={hasClipboard}
                  />
                </SortableItem>
              ))}
            </SortablePropertyList>
          )}
          
          {!Array.isArray(propertySchema) && onAddProperty && (
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
  definitions: Record<string, any>;
  onPropertyChange: (path: string[], updates: { name?: string; schema?: any }) => void;
  onPropertyRename: (path: string[], oldName: string, newName: string) => void;
  onAddProperty: (path: string[], name: string, schema: any) => void;
  onDeleteProperty: (path: string[]) => void;
  onDuplicateProperty: (path: string[], name: string, schema: any) => void;
  onAddArrayItem: (path: string[], item: any) => void;
  onReorderProperties: (path: string[], oldIndex: number, newIndex: number) => void;
  onCopy: (name: string, schema: any, path: string[]) => void;
  onCut: (name: string, schema: any, path: string[]) => void;
  onPaste: (path: string[]) => void;
  hasClipboard: boolean;
}

const SectionTree: React.FC<SectionTreeProps> = ({ 
  title, 
  icon, 
  data,
  path,
  definitions,
  onPropertyChange,
  onPropertyRename,
  onAddProperty,
  onDeleteProperty,
  onDuplicateProperty,
  onAddArrayItem,
  onReorderProperties,
  onCopy,
  onCut,
  onPaste,
  hasClipboard
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const availableRefs = useMemo(() => Object.keys(definitions), [definitions]);
  
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
      const arrayItemIds = data.map((_, index) => String(index));
      return (
        <div className="space-y-0.5">
          <SortablePropertyList
            items={arrayItemIds}
            onReorder={(oldIndex, newIndex) => onReorderProperties(path, oldIndex, newIndex)}
          >
            {data.map((item, index) => (
              <SortableItem key={index} id={String(index)}>
                <EditablePropertyNode
                  name={String(index)}
                  propertySchema={item}
                  path={[...path, String(index)]}
                  definitions={definitions}
                  isArrayItem={true}
                  parentIsArray={true}
                  onPropertyChange={onPropertyChange}
                  onPropertyRename={onPropertyRename}
                  onAddProperty={onAddProperty}
                  onDeleteProperty={onDeleteProperty}
                  onDuplicateProperty={onDuplicateProperty}
                  onAddArrayItem={onAddArrayItem}
                  onReorderProperties={onReorderProperties}
                  onCopy={onCopy}
                  onCut={onCut}
                  onPaste={onPaste}
                  hasClipboard={hasClipboard}
                />
              </SortableItem>
            ))}
          </SortablePropertyList>
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

    const objectKeys = Object.keys(data);
    return (
      <div className="space-y-0.5">
        <SortablePropertyList
          items={objectKeys}
          onReorder={(oldIndex, newIndex) => onReorderProperties(path, oldIndex, newIndex)}
        >
          {Object.entries(data).map(([key, value]) => (
            <SortableItem key={key} id={key}>
              <EditablePropertyNode
                name={key}
                propertySchema={value as any}
                path={[...path, key]}
                definitions={definitions}
                onPropertyChange={onPropertyChange}
                onPropertyRename={onPropertyRename}
                onAddProperty={onAddProperty}
                onDeleteProperty={onDeleteProperty}
                onDuplicateProperty={onDuplicateProperty}
                onAddArrayItem={onAddArrayItem}
                onReorderProperties={onReorderProperties}
                onCopy={onCopy}
                onCut={onCut}
                onPaste={onPaste}
                hasClipboard={hasClipboard}
              />
            </SortableItem>
          ))}
        </SortablePropertyList>
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

export const SchemaStructureEditor: React.FC<SchemaStructureEditorProps> = ({
  schema,
  onSchemaChange,
  schemaType
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // History for undo/redo
  const { setSchema: setSchemaWithHistory, undo, redo, canUndo, canRedo } = useSchemaHistory(
    schema,
    onSchemaChange
  );

  // Clipboard for cut/copy/paste
  const { copy, cut, paste, hasClipboard } = usePropertyClipboard();

  // Get definitions based on schema type
  const definitions = useMemo(() => {
    if (schemaType === 'json-schema') {
      return schema?.$defs || schema?.definitions || {};
    }
    return {};
  }, [schema, schemaType]);

  // Global keyboard handler for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if focus is within the container
      if (!containerRef.current?.contains(document.activeElement) && 
          document.activeElement !== containerRef.current) {
        return;
      }
      
      // Ctrl+Z for undo, Ctrl+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

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
    
    setSchemaWithHistory(newSchema);
  }, [schema, setSchemaWithHistory]);

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
    
    setSchemaWithHistory(newSchema);
  }, [schema, setSchemaWithHistory]);

  const handleAddProperty = useCallback((path: string[], name: string, propSchema: any) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    
    let current = newSchema;
    for (const key of path) {
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    
    current[name] = propSchema;
    setSchemaWithHistory(newSchema);
  }, [schema, setSchemaWithHistory]);

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
    
    setSchemaWithHistory(newSchema);
  }, [schema, setSchemaWithHistory]);

  const handleAddArrayItem = useCallback((path: string[], item: any) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    
    let current = newSchema;
    for (const key of path) {
      current = current[key];
    }
    
    if (Array.isArray(current)) {
      current.push(item);
    }
    
    setSchemaWithHistory(newSchema);
  }, [schema, setSchemaWithHistory]);

  const handleReorderProperties = useCallback((path: string[], oldIndex: number, newIndex: number) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    
    let current = newSchema;
    for (const key of path) {
      current = current[key];
    }
    
    if (Array.isArray(current)) {
      // Reorder array items
      const reordered = reorderArrayItems(current, oldIndex, newIndex);
      // Replace array in parent
      let parent = newSchema;
      for (let i = 0; i < path.length - 1; i++) {
        parent = parent[path[i]];
      }
      parent[path[path.length - 1]] = reordered;
    } else if (typeof current === 'object' && current !== null) {
      // Reorder object properties
      const reordered = reorderObjectProperties(current, oldIndex, newIndex);
      // Replace object in parent
      if (path.length === 0) {
        // If at root, handle specially
        setSchemaWithHistory({ ...newSchema, ...reordered });
        return;
      }
      let parent = newSchema;
      for (let i = 0; i < path.length - 1; i++) {
        parent = parent[path[i]];
      }
      parent[path[path.length - 1]] = reordered;
    }
    
    setSchemaWithHistory(newSchema);
  }, [schema, setSchemaWithHistory]);

  const handleDuplicateProperty = useCallback((path: string[], name: string, propSchema: any) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    
    let current = newSchema;
    for (const key of path) {
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    
    // Find a unique name
    let finalName = name;
    let counter = 1;
    while (current[finalName] !== undefined) {
      finalName = `${name.replace(/_copy\d*$/, '')}_copy${counter > 1 ? counter : ''}`;
      counter++;
    }
    
    current[finalName] = propSchema;
    setSchemaWithHistory(newSchema);
  }, [schema, setSchemaWithHistory]);

  // Handle paste - adds clipboard content to specified path
  const handlePaste = useCallback((path: string[]) => {
    const clipboardItem = paste();
    if (!clipboardItem) return;

    const newSchema = JSON.parse(JSON.stringify(schema));
    
    // Navigate to the target path
    let current = newSchema;
    for (const key of path) {
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    
    // Find a unique name
    let finalName = clipboardItem.name;
    let counter = 1;
    while (current[finalName] !== undefined) {
      finalName = `${clipboardItem.name.replace(/_copy\d*$/, '')}_copy${counter > 1 ? counter : ''}`;
      counter++;
    }
    
    current[finalName] = clipboardItem.schema;
    
    // If it was a cut operation, delete the source
    if (clipboardItem.isCut) {
      let parent = newSchema;
      for (let i = 0; i < clipboardItem.sourcePath.length - 1; i++) {
        parent = parent[clipboardItem.sourcePath[i]];
      }
      const sourceKey = clipboardItem.sourcePath[clipboardItem.sourcePath.length - 1];
      if (Array.isArray(parent)) {
        parent.splice(parseInt(sourceKey), 1);
      } else if (parent && typeof parent === 'object') {
        delete parent[sourceKey];
      }
    }
    
    setSchemaWithHistory(newSchema);
  }, [schema, paste, setSchemaWithHistory]);

  // Build sections based on schema type
  const rootSections = useMemo(() => {
    const sections: { key: string; title: string; icon: React.ReactNode; data: any }[] = [];
    
    if (schemaType === 'json-schema') {
      // JSON Schema sections
      if (schema?.properties) {
        sections.push({ key: 'properties', title: 'Properties', icon: <Box className="h-4 w-4 text-primary" />, data: schema.properties });
      }
      if (schema?.$defs) {
        sections.push({ key: '$defs', title: 'Definitions ($defs)', icon: <Link2 className="h-4 w-4 text-blue-500" />, data: schema.$defs });
      }
      if (schema?.definitions) {
        sections.push({ key: 'definitions', title: 'Definitions', icon: <Link2 className="h-4 w-4 text-blue-500" />, data: schema.definitions });
      }
      if (schema?.allOf) {
        sections.push({ key: 'allOf', title: 'All Of', icon: <List className="h-4 w-4 text-purple-500" />, data: schema.allOf });
      }
      if (schema?.anyOf) {
        sections.push({ key: 'anyOf', title: 'Any Of', icon: <List className="h-4 w-4 text-cyan-500" />, data: schema.anyOf });
      }
      if (schema?.oneOf) {
        sections.push({ key: 'oneOf', title: 'One Of', icon: <List className="h-4 w-4 text-orange-500" />, data: schema.oneOf });
      }
    } else if (schemaType === 'diagram') {
      // Diagram sections
      if (schema?.nodes) {
        sections.push({ key: 'nodes', title: 'Nodes', icon: <Box className="h-4 w-4 text-primary" />, data: schema.nodes });
      }
      if (schema?.edges) {
        sections.push({ key: 'edges', title: 'Edges', icon: <Link2 className="h-4 w-4 text-blue-500" />, data: schema.edges });
      }
      if (schema?.lifelines) {
        sections.push({ key: 'lifelines', title: 'Lifelines', icon: <List className="h-4 w-4 text-green-500" />, data: schema.lifelines });
      }
      if (schema?.processes) {
        sections.push({ key: 'processes', title: 'Processes', icon: <Box className="h-4 w-4 text-purple-500" />, data: schema.processes });
      }
      if (schema?.viewport) {
        sections.push({ key: 'viewport', title: 'Viewport', icon: <Box className="h-4 w-4 text-muted-foreground" />, data: schema.viewport });
      }
    }
    
    return sections;
  }, [schema, schemaType]);

  // Metadata section (title, description, etc.)
  const metadataFields = useMemo(() => {
    const fields: { key: string; value: any }[] = [];
    const metaKeys = ['title', 'description', '$id', '$schema', 'type', 'name', 'version'];
    
    for (const key of metaKeys) {
      if (schema?.[key] !== undefined) {
        fields.push({ key, value: schema[key] });
      }
    }
    
    return fields;
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
    <div ref={containerRef} className="h-full flex flex-col" tabIndex={-1}>
      {/* Undo/Redo toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={undo}
              disabled={!canUndo}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={redo}
              disabled={!canRedo}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {/* Metadata section */}
          {metadataFields.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 p-3 bg-muted/30 border-b">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Metadata</span>
              </div>
              <div className="p-3 bg-background space-y-2">
                {metadataFields.map(({ key, value }) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-muted-foreground w-24">{key}:</span>
                    <EditableValue 
                      value={value} 
                      onValueChange={(v) => handlePropertyChange([key], { schema: v })} 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Main sections */}
          {rootSections.map((section) => (
            <SectionTree
              key={section.key}
              title={section.title}
              icon={section.icon}
              data={section.data}
              path={[section.key]}
              definitions={definitions}
              onPropertyChange={handlePropertyChange}
              onPropertyRename={handlePropertyRename}
              onAddProperty={handleAddProperty}
              onDeleteProperty={handleDeleteProperty}
              onDuplicateProperty={handleDuplicateProperty}
              onAddArrayItem={handleAddArrayItem}
              onReorderProperties={handleReorderProperties}
              onCopy={copy}
              onCut={cut}
              onPaste={handlePaste}
              hasClipboard={hasClipboard}
            />
          ))}
          
          {rootSections.length === 0 && metadataFields.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No structure found</p>
              <p className="text-sm text-muted-foreground/70">
                This schema doesn't have recognized sections
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
