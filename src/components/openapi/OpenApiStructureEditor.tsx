import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Box, Link2, Hash, Type, List, ToggleLeft, Calendar, FileText, Server, Info, Route, Shield, Tag, Pencil, Check, X, Plus, Trash2, ExternalLink, Loader2, Copy, Scissors, Clipboard } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SortablePropertyList, SortableItem, reorderObjectProperties, reorderArrayItems } from '@/components/schema/SortablePropertyList';
import { ImportSchemaComponentDialog } from './ImportSchemaComponentDialog';
import { useDocumentRefResolver } from '@/hooks/useDocumentRefResolver';
import { usePropertyClipboard, ClipboardItem } from '@/hooks/usePropertyClipboard';
import { ClipboardHistoryPopover } from '@/components/schema/ClipboardHistoryPopover';
import { RefTargetConfirmDialog, RefTargetInfo } from './RefTargetConfirmDialog';
import { ConsistencyIndicator } from '@/components/schema/ConsistencyIndicator';
import { ConsistencyIssue } from '@/types/consistency';
import { useStructureSearch } from '@/hooks/useStructureSearch';
import { StructureSearchBar } from '@/components/schema/StructureSearchBar';
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

import { CollapsedState } from '@/lib/diagram/types';

interface OpenApiStructureEditorProps {
  schema: any;
  onSchemaChange: (schema: any) => void;
  consistencyIssues?: ConsistencyIssue[];
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
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
  onDuplicateProperty?: (path: string[], name: string, schema: any) => void;
  onAddArrayItem?: (path: string[], item: any) => void;
  onReorderProperties?: (path: string[], oldIndex: number, newIndex: number) => void;
  onCopy?: (name: string, schema: any, path: string[]) => void;
  onCut?: (name: string, schema: any, path: string[]) => void;
  onPaste?: (path: string[], selectedItem?: ClipboardItem) => void;
  clipboard?: ClipboardItem | null;
  clipboardHistory?: ClipboardItem[];
  onSelectFromHistory?: (item: ClipboardItem) => void;
  onClearHistory?: () => void;
  onClearClipboard?: () => void;
  hasClipboard?: boolean;
  consistencyIssues?: ConsistencyIssue[];
  forceExpandedPaths?: Set<string>;
  externalCollapsedPaths?: CollapsedState;
  onExternalToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

const getTypeIcon = (schema: any) => {
  if (schema?.$ref) return <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />;
  
  const types = schema?.types || schema?.type;
  const typeValue = Array.isArray(types) ? types[0] : types;
  
  switch (typeValue) {
    case 'string':
      if (schema?.format === 'date' || schema?.format === 'date-time') {
        return <Calendar className="h-3.5 w-3.5 shrink-0 text-purple-500" />;
      }
      return <Type className="h-3.5 w-3.5 shrink-0 text-green-500" />;
    case 'integer':
    case 'number':
      return <Hash className="h-3.5 w-3.5 shrink-0 text-orange-500" />;
    case 'boolean':
      return <ToggleLeft className="h-3.5 w-3.5 shrink-0 text-pink-500" />;
    case 'array':
      return <List className="h-3.5 w-3.5 shrink-0 text-cyan-500" />;
    case 'object':
      return <Box className="h-3.5 w-3.5 shrink-0 text-yellow-500" />;
    default:
      return <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
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
      className="text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:underline group inline-flex items-center gap-1 max-w-[200px] truncate"
      onClick={() => setIsEditing(true)}
      title={typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
    >
      <span className="truncate">
        {typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
      </span>
      <Pencil className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-50" />
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
  onDuplicateProperty,
  onAddArrayItem,
  onReorderProperties,
  onCopy,
  onCut,
  onPaste,
  clipboard,
  clipboardHistory,
  onSelectFromHistory,
  onClearHistory,
  onClearClipboard,
  hasClipboard,
  consistencyIssues = [],
  forceExpandedPaths,
  externalCollapsedPaths,
  onExternalToggleCollapse
}) => {
  const pathKey = path.join('.');
  const isForceExpanded = forceExpandedPaths?.has(pathKey) ?? false;
  
  // Sync with external collapsed state (from diagram)
  const externalExpanded = externalCollapsedPaths ? externalCollapsedPaths[pathKey] === false : undefined;
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(externalExpanded ?? false);
  
  // Sync local state with external when it changes
  useEffect(() => {
    if (externalExpanded !== undefined) {
      setIsManuallyExpanded(externalExpanded);
    }
  }, [externalExpanded]);
  
  const isExpanded = isManuallyExpanded || isForceExpanded;
  
  // Handle toggle and notify external
  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isManuallyExpanded;
    setIsManuallyExpanded(newExpanded);
    onExternalToggleCollapse?.(pathKey, !newExpanded);
  }, [isManuallyExpanded, onExternalToggleCollapse, pathKey]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);
  
  const availableRefs = useMemo(() => Object.keys(allSchemas), [allSchemas]);
  
  // Check if this property has a schema with type, or is just a primitive value
  const isSchemaWithType = hasSchemaType(propertySchema);
  const isPrimitive = isPrimitiveValue(propertySchema);
  const isValueOnly = isValueOnlyProperty(name);
  
  // Check if this property can have children (for expand/collapse)
  const canHaveChildren = useMemo(() => {
    if (isPrimitive) return false;
    
    if (Array.isArray(propertySchema)) {
      return true;
    }
    
    // Array items that are objects should always be expandable
    if (isArrayItem && typeof propertySchema === 'object' && propertySchema !== null) {
      return true;
    }
    
    if (typeof propertySchema === 'object' && propertySchema !== null && !isSchemaWithType) {
      return true;
    }
    
    if (propertySchema?.$ref) return true;
    
    const types = propertySchema?.types || propertySchema?.type;
    const typeValue = Array.isArray(types) ? types[0] : types;
    
    if (typeValue === 'object') {
      return true;
    }
    if (typeValue === 'array' && propertySchema?.items) {
      if (propertySchema.items.$ref) return true;
      const itemTypes = propertySchema.items.types || propertySchema.items.type;
      const itemType = Array.isArray(itemTypes) ? itemTypes[0] : itemTypes;
      if (itemType === 'object') {
        return true;
      }
    }
    return false;
  }, [propertySchema, isSchemaWithType, isPrimitive, isArrayItem]);

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
      // Only add to 'properties' if this is a JSON Schema object with type: 'object'
      const types = propertySchema?.types || propertySchema?.type;
      const typeValue = Array.isArray(types) ? types[0] : types;
      const isJsonSchemaObject = typeValue === 'object';
      const addPath = isJsonSchemaObject ? [...path, 'properties'] : path;
      onAddProperty(addPath, childName, childSchema);
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
    if (onCopy) {
      onCopy(name, propertySchema, path);
    }
  };

  const handleCut = () => {
    if (onCut) {
      onCut(name, propertySchema, path);
    }
  };

  const handlePaste = (selectedItem?: ClipboardItem) => {
    if (onPaste && canHaveChildren) {
      const types = propertySchema?.types || propertySchema?.type;
      const typeValue = Array.isArray(types) ? types[0] : types;
      // Only add 'properties' if this is a JSON Schema object with explicit type: 'object'
      const isJsonSchemaObject = typeValue === 'object';
      const pastePath = isJsonSchemaObject ? [...path, 'properties'] : path;
      onPaste(pastePath, selectedItem);
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
    // Escape to clear clipboard
    if (e.key === 'Escape') {
      e.preventDefault();
      if (onClearClipboard && hasClipboard) {
        onClearClipboard();
      }
    }
  };

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

  return (
    <div className="select-none" data-search-path={pathKey}>
      <div 
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors group focus:outline-none focus:ring-1 focus:ring-ring",
          isInClipboard === 'cut' && "bg-destructive/10 border border-dashed border-destructive/50",
          isInClipboard === 'copied' && "bg-primary/10 border border-dashed border-primary/50"
        )}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          // Focus this element on click so keyboard shortcuts work
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <span 
          className="cursor-pointer"
          onClick={() => canHaveChildren && handleToggleExpand()}
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
        
        {/* Consistency issues indicator */}
        {consistencyIssues.length > 0 && (
          <ConsistencyIndicator issues={consistencyIssues} path={path} />
        )}
        
        <div className="ml-auto flex items-center gap-1">
          {/* Show editable value for primitives, or type selector for schema properties */}
          {isPrimitive ? (
            <EditableValue value={propertySchema} onValueChange={handleValueChange} />
          ) : typeLabel ? (
            <TypeSelector
              currentType={typeLabel}
              availableRefs={availableRefs}
              onTypeSelect={handleTypeChange}
            />
          ) : isValueOnly && !hasChildren && !isSchemaWithType ? (
            <span className="text-xs text-muted-foreground max-w-[150px] truncate" title={JSON.stringify(propertySchema)}>
              {JSON.stringify(propertySchema).slice(0, 50)}
            </span>
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
          
          {/* Copy button */}
          {onCopy && (
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
          
          {/* Cut button */}
          {onCut && (
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
          {onPaste && canHaveChildren && hasClipboard && clipboard && clipboardHistory && onSelectFromHistory && onClearHistory && (
            <ClipboardHistoryPopover
              clipboard={clipboard}
              history={clipboardHistory}
              onPaste={handlePaste}
              onSelectFromHistory={onSelectFromHistory}
              onClearHistory={onClearHistory}
            >
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <Clipboard className="h-3 w-3" />
              </Button>
            </ClipboardHistoryPopover>
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
      
      {isExpanded && canHaveChildren && childProperties && (
        <div className="border-l border-border/50">
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
              <SortableItem key={propName} id={propName} indentPx={16}>
                <EditablePropertyNode
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
                  onDuplicateProperty={onDuplicateProperty}
                  onAddArrayItem={onAddArrayItem}
                  onReorderProperties={onReorderProperties}
                  onCopy={onCopy}
                  onCut={onCut}
                  onPaste={onPaste}
                  clipboard={clipboard}
                  clipboardHistory={clipboardHistory}
                  onSelectFromHistory={onSelectFromHistory}
                  onClearHistory={onClearHistory}
                  onClearClipboard={onClearClipboard}
                  hasClipboard={hasClipboard}
                  consistencyIssues={consistencyIssues}
                  forceExpandedPaths={forceExpandedPaths}
                />
              </SortableItem>
            ))}
          </SortablePropertyList>
          
          {/* Add property button for objects (both JSON Schema and plain objects) */}
          {!Array.isArray(propertySchema) && canHaveChildren && onAddProperty && (
            <div className="py-1 px-2 flex items-center gap-1 ml-4">
              <AddPropertyButton onAdd={handleAddChildProperty} availableRefs={availableRefs} />
              {hasClipboard && clipboard && clipboardHistory && onSelectFromHistory && onClearHistory && (
                <ClipboardHistoryPopover
                  clipboard={clipboard}
                  history={clipboardHistory}
                  onPaste={handlePaste}
                  onSelectFromHistory={onSelectFromHistory}
                  onClearHistory={onClearHistory}
                >
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                    <Clipboard className="h-3 w-3" />
                    Paste
                  </Button>
                </ClipboardHistoryPopover>
              )}
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
  onDuplicateProperty: (path: string[], name: string, schema: any) => void;
  onAddArrayItem: (path: string[], item: any) => void;
  onReorderProperties: (path: string[], oldIndex: number, newIndex: number) => void;
  onCopy: (name: string, schema: any, path: string[]) => void;
  onCut: (name: string, schema: any, path: string[]) => void;
  onPaste: (path: string[], selectedItem?: ClipboardItem) => void;
  clipboard: ClipboardItem | null;
  clipboardHistory: ClipboardItem[];
  onSelectFromHistory: (item: ClipboardItem) => void;
  onClearHistory: () => void;
  onClearClipboard: () => void;
  hasClipboard: boolean;
  consistencyIssues?: ConsistencyIssue[];
  forceExpandedPaths?: Set<string>;
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
  onDuplicateProperty,
  onAddArrayItem,
  onReorderProperties,
  onCopy,
  onCut,
  onPaste,
  clipboard,
  clipboardHistory,
  onSelectFromHistory,
  onClearHistory,
  onClearClipboard,
  hasClipboard,
  consistencyIssues = [],
  forceExpandedPaths
}) => {
  const pathKey = path.join('.');
  const isForceExpanded = forceExpandedPaths?.has(pathKey) ?? false;
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(true);
  const isExpanded = isManuallyExpanded || isForceExpanded;
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
      const arrayItemIds = data.map((_, index) => String(index));
      return (
        <div className="space-y-0.5">
          <SortablePropertyList
            items={arrayItemIds}
            onReorder={(oldIndex, newIndex) => onReorderProperties(path, oldIndex, newIndex)}
          >
            {data.map((item, index) => (
              <SortableItem key={index} id={String(index)} indentPx={16}>
                <EditablePropertyNode
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
                  onDuplicateProperty={onDuplicateProperty}
                  onAddArrayItem={onAddArrayItem}
                  onReorderProperties={onReorderProperties}
                  onCopy={onCopy}
                  onCut={onCut}
                  onPaste={onPaste}
                  clipboard={clipboard}
                  clipboardHistory={clipboardHistory}
                  onSelectFromHistory={onSelectFromHistory}
                  onClearHistory={onClearHistory}
                  onClearClipboard={onClearClipboard}
                  hasClipboard={hasClipboard}
                  consistencyIssues={consistencyIssues}
                  forceExpandedPaths={forceExpandedPaths}
                />
              </SortableItem>
            ))}
          </SortablePropertyList>
          <div className="py-1 px-2 pl-6 flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs gap-1"
              onClick={() => onAddArrayItem(path, typeof data[0] === 'object' ? {} : '')}
            >
              <Plus className="h-3 w-3" />
              Add Item
            </Button>
            {hasClipboard && clipboard && (
              <ClipboardHistoryPopover
                clipboard={clipboard}
                history={clipboardHistory}
                onPaste={(selectedItem) => {
                  // Paste as new array item
                  const item = selectedItem || clipboard;
                  if (item) {
                    onAddArrayItem(path, item.schema);
                  }
                }}
                onSelectFromHistory={onSelectFromHistory}
                onClearHistory={onClearHistory}
              >
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                  <Clipboard className="h-3 w-3" />
                  Paste Item
                </Button>
              </ClipboardHistoryPopover>
            )}
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
            <SortableItem key={key} id={key} indentPx={16}>
              <EditablePropertyNode
                name={key}
                propertySchema={value as any}
                path={[...path, key]}
                allSchemas={allSchemas}
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
                clipboard={clipboard}
                clipboardHistory={clipboardHistory}
                onSelectFromHistory={onSelectFromHistory}
                onClearHistory={onClearHistory}
                onClearClipboard={onClearClipboard}
                hasClipboard={hasClipboard}
                consistencyIssues={consistencyIssues}
                forceExpandedPaths={forceExpandedPaths}
              />
            </SortableItem>
          ))}
        </SortablePropertyList>
        <div className="py-1 px-2 pl-6 flex items-center gap-1">
          <AddPropertyButton onAdd={handleAddProperty} availableRefs={availableRefs} />
          {hasClipboard && clipboard && (
            <ClipboardHistoryPopover
              clipboard={clipboard}
              history={clipboardHistory}
              onPaste={(selectedItem) => onPaste(path, selectedItem)}
              onSelectFromHistory={onSelectFromHistory}
              onClearHistory={onClearHistory}
            >
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                <Clipboard className="h-3 w-3" />
                Paste
              </Button>
            </ClipboardHistoryPopover>
          )}
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
        onClick={() => setIsManuallyExpanded(!isManuallyExpanded)}
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
  onSchemaChange,
  consistencyIssues = [],
  collapsedPaths: externalCollapsedPaths,
  onToggleCollapse: externalOnToggleCollapse
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'structure' | 'components'>('structure');

  // Search functionality (scoped to the active tab)
  const {
    searchQuery,
    setSearchQuery,
    matches,
    currentMatchIndex,
    goToNextMatch,
    goToPrevMatch,
    clearSearch,
    searchInputRef,
    expandedPaths: searchExpandedPaths,
    scrollToPath,
  } = useStructureSearch({ schema, containerRef, scope: activeTab });

  useEffect(() => {
    if (!searchQuery.trim()) return;
    const match = matches[currentMatchIndex];
    if (!match) return;
    scrollToPath(match.path);
  }, [searchQuery, matches, currentMatchIndex, scrollToPath]);

  // Use the document ref resolver for sideloading referenced documents
  const { getAllResolvedSchemas, resolvedDocuments } = useDocumentRefResolver(schema);

  // History is handled by the parent editor (shared with JSON editor).
  const setSchemaWithHistory = useCallback((nextSchema: any) => {
    onSchemaChange(nextSchema);
  }, [onSchemaChange]);

  // Clipboard for cut/copy/paste
  const { clipboard, history: clipboardHistory, copy, cut, paste, selectFromHistory, hasClipboard, clearHistory, clearClipboard } = usePropertyClipboard();

  // State for ref target confirmation dialog
  const [refConfirmDialogOpen, setRefConfirmDialogOpen] = useState(false);
  const [pendingRefOperation, setPendingRefOperation] = useState<{
    type: 'paste' | 'add';
    path: string[];
    name?: string;
    propSchema?: any;
    selectedItem?: ClipboardItem;
    resolvedPath: string[];
    targetComponentName: string;
  } | null>(null);

  const allSchemas = useMemo(() => {
    // Merge original schemas with resolved document references
    return getAllResolvedSchemas();
  }, [getAllResolvedSchemas]);

  // Helper to resolve a path and detect if it leads through a $ref
  const resolvePathThroughRefs = useCallback((path: string[]): { resolvedPath: string[]; targetComponentName: string | null } => {
    let current = schema;
    const resolvedPath: string[] = [];
    
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      
      // Check if current level has a $ref
      if (current?.$ref && typeof current.$ref === 'string') {
        // This is a reference - resolve it
        if (current.$ref.startsWith('#/components/schemas/')) {
          const refName = current.$ref.split('/').pop();
          if (refName) {
            // Return the resolved path pointing to the component
            const remainingPath = path.slice(i);
            return {
              resolvedPath: ['components', 'schemas', refName, ...remainingPath],
              targetComponentName: refName
            };
          }
        }
      }
      
      // Check items.$ref for arrays
      if (current?.items?.$ref && typeof current.items.$ref === 'string') {
        if (current.items.$ref.startsWith('#/components/schemas/')) {
          const refName = current.items.$ref.split('/').pop();
          if (refName && key !== 'items') {
            const remainingPath = path.slice(i);
            return {
              resolvedPath: ['components', 'schemas', refName, ...remainingPath],
              targetComponentName: refName
            };
          }
        }
      }
      
      resolvedPath.push(key);
      current = current?.[key];
    }
    
    // After traversing the entire path, check if the final destination is itself a $ref
    if (current?.$ref && typeof current.$ref === 'string') {
      if (current.$ref.startsWith('#/components/schemas/')) {
        const refName = current.$ref.split('/').pop();
        if (refName) {
          return {
            resolvedPath: ['components', 'schemas', refName, 'properties'],
            targetComponentName: refName
          };
        }
      }
    }
    
    // Also check if the destination is an array with items.$ref
    if (current?.items?.$ref && typeof current.items.$ref === 'string') {
      if (current.items.$ref.startsWith('#/components/schemas/')) {
        const refName = current.items.$ref.split('/').pop();
        if (refName) {
          return {
            resolvedPath: ['components', 'schemas', refName, 'properties'],
            targetComponentName: refName
          };
        }
      }
    }
    
    return { resolvedPath, targetComponentName: null };
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

  // Internal function that actually performs the add operation
  const executeAddProperty = useCallback((path: string[], name: string, propSchema: any) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    
    let current = newSchema;
    for (const key of path) {
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    
    current[name] = propSchema;
    setSchemaWithHistory(newSchema);
  }, [schema, setSchemaWithHistory]);

  // Public handler that checks for refs first
  const handleAddProperty = useCallback((path: string[], name: string, propSchema: any) => {
    const { resolvedPath, targetComponentName } = resolvePathThroughRefs(path);
    
    if (targetComponentName) {
      // This path goes through a $ref - show confirmation dialog
      setPendingRefOperation({
        type: 'add',
        path,
        name,
        propSchema,
        resolvedPath,
        targetComponentName
      });
      setRefConfirmDialogOpen(true);
    } else {
      // No ref in path, add directly
      executeAddProperty(path, name, propSchema);
    }
  }, [resolvePathThroughRefs, executeAddProperty]);

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

  // Internal function that actually performs the paste operation
  const executePaste = useCallback((path: string[], clipboardItem: ClipboardItem) => {
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
  }, [schema, setSchemaWithHistory]);

  // Handle paste - adds clipboard content to specified path
  const handlePaste = useCallback((path: string[], selectedItem?: ClipboardItem) => {
    const clipboardItem = paste(selectedItem);
    if (!clipboardItem) return;

    const { resolvedPath, targetComponentName } = resolvePathThroughRefs(path);
    
    if (targetComponentName) {
      // This path goes through a $ref - show confirmation dialog
      setPendingRefOperation({
        type: 'paste',
        path,
        selectedItem: clipboardItem,
        resolvedPath,
        targetComponentName
      });
      setRefConfirmDialogOpen(true);
    } else {
      // No ref in path, paste directly
      executePaste(path, clipboardItem);
    }
  }, [paste, resolvePathThroughRefs, executePaste]);

  // Handle confirmation of ref operation
  const handleRefOperationConfirm = useCallback(() => {
    if (!pendingRefOperation) return;
    
    if (pendingRefOperation.type === 'add' && pendingRefOperation.name && pendingRefOperation.propSchema !== undefined) {
      executeAddProperty(pendingRefOperation.resolvedPath, pendingRefOperation.name, pendingRefOperation.propSchema);
    } else if (pendingRefOperation.type === 'paste' && pendingRefOperation.selectedItem) {
      executePaste(pendingRefOperation.resolvedPath, pendingRefOperation.selectedItem);
    }
    
    setPendingRefOperation(null);
    setRefConfirmDialogOpen(false);
  }, [pendingRefOperation, executeAddProperty, executePaste]);

  // Handle cancellation of ref operation
  const handleRefOperationCancel = useCallback(() => {
    setPendingRefOperation(null);
    setRefConfirmDialogOpen(false);
  }, []);

  const handleAddComponent = useCallback((name: string, componentSchema: any) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    if (!newSchema.components) newSchema.components = {};
    if (!newSchema.components.schemas) newSchema.components.schemas = {};
    newSchema.components.schemas[name] = componentSchema;
    setSchemaWithHistory(newSchema);
  }, [schema, setSchemaWithHistory]);

  const handleAddComponentByReference = useCallback((name: string, documentId: string, documentName: string) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    if (!newSchema.components) newSchema.components = {};
    if (!newSchema.components.schemas) newSchema.components.schemas = {};
    // Store a special $ref that points to an external document
    newSchema.components.schemas[name] = {
      $ref: `document://${documentId}`,
      'x-document-name': documentName,
      'x-document-id': documentId
    };
    setSchemaWithHistory(newSchema);
  }, [schema, setSchemaWithHistory]);

  // Count how many times each component is referenced throughout the document
  const componentReferenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    const countRefs = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (Array.isArray(obj)) {
        obj.forEach(item => countRefs(item));
        return;
      }
      
      // Check for $ref to a component
      if (obj.$ref && typeof obj.$ref === 'string' && obj.$ref.startsWith('#/components/schemas/')) {
        const refName = obj.$ref.split('/').pop();
        if (refName) {
          counts[refName] = (counts[refName] || 0) + 1;
        }
      }
      
      // Recurse into all object properties
      Object.values(obj).forEach(value => countRefs(value));
    };
    
    // Count refs in paths, components (other schemas referencing each other), etc.
    countRefs(schema);
    
    return counts;
  }, [schema]);

  const components = useMemo(() => {
    const schemas = schema?.components?.schemas || {};
    return Object.entries(schemas).map(([name, componentSchema]: [string, any]) => ({
      name,
      schema: componentSchema,
      description: componentSchema?.description,
      referenceCount: componentReferenceCounts[name] || 0
    }));
  }, [schema, componentReferenceCounts]);

  // Document section - root-level fields like openapi version
  const documentFields = useMemo(() => {
    const fields: { key: string; value: any; path: string[] }[] = [];
    
    // OpenAPI version
    if (schema?.openapi !== undefined) {
      fields.push({ key: 'openapi', value: schema.openapi, path: ['openapi'] });
    } else if (schema?.swagger !== undefined) {
      fields.push({ key: 'swagger', value: schema.swagger, path: ['swagger'] });
    }
    
    // JSON Schema reference if present
    if (schema?.jsonSchemaDialect !== undefined) {
      fields.push({ key: 'jsonSchemaDialect', value: schema.jsonSchemaDialect, path: ['jsonSchemaDialect'] });
    }
    
    return fields;
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
    <div ref={containerRef} className="h-full flex flex-col" tabIndex={-1}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'structure' | 'components')}
        className="h-full flex flex-col"
      >
        <div className="flex items-center gap-1 border-b bg-muted/30">
          <TabsList className="justify-start rounded-none bg-transparent">
            <TabsTrigger value="structure" className="data-[state=active]:bg-muted">
              Structure
            </TabsTrigger>
            <TabsTrigger value="components" className="data-[state=active]:bg-muted">
              Components
            </TabsTrigger>
          </TabsList>
          <StructureSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            matchCount={matches.length}
            currentMatchIndex={currentMatchIndex}
            onNextMatch={goToNextMatch}
            onPrevMatch={goToPrevMatch}
            onClear={clearSearch}
            inputRef={searchInputRef}
            className="ml-auto"
          />
        </div>
        
        <TabsContent value="structure" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 p-4">
              {/* Document section */}
              {documentFields.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 border-b">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Document</span>
                  </div>
                  <div className="p-3 bg-background space-y-2">
                    {documentFields.map(({ key, value, path }) => (
                      <div key={key} className="flex items-center gap-2 text-sm" data-search-path={path.join('.')}>
                        <span className="font-medium text-muted-foreground w-28">{key}:</span>
                        <EditableValue 
                          value={value} 
                          onValueChange={(v) => handlePropertyChange(path, { schema: v })} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  onDuplicateProperty={handleDuplicateProperty}
                  onAddArrayItem={handleAddArrayItem}
                  onReorderProperties={handleReorderProperties}
                  onCopy={copy}
                  onCut={cut}
                  onPaste={handlePaste}
                  clipboard={clipboard}
                  clipboardHistory={clipboardHistory}
                  onSelectFromHistory={selectFromHistory}
                  onClearHistory={clearHistory}
                  onClearClipboard={clearClipboard}
                  hasClipboard={hasClipboard}
                  consistencyIssues={consistencyIssues}
                  forceExpandedPaths={searchExpandedPaths}
                />
              ))}
              {rootSections.length === 0 && documentFields.length === 0 && (
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
              {/* Add new component and import buttons */}
              <div className="flex justify-end gap-2">
                <ImportSchemaComponentDialog 
                  onImport={handleAddComponent}
                  onImportByReference={handleAddComponentByReference}
                  existingComponentNames={Object.keys(allSchemas)}
                />
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
                      onReorderProperties={handleReorderProperties}
                      onCopy={copy}
                      onCut={cut}
                      onPaste={handlePaste}
                      clipboard={clipboard}
                      clipboardHistory={clipboardHistory}
                      onSelectFromHistory={selectFromHistory}
                      onClearHistory={clearHistory}
                      onClearClipboard={clearClipboard}
                      hasClipboard={hasClipboard}
                      consistencyIssues={consistencyIssues}
                      forceExpandedPaths={searchExpandedPaths}
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
      
      {/* Ref target confirmation dialog */}
      <RefTargetConfirmDialog
        open={refConfirmDialogOpen}
        onOpenChange={setRefConfirmDialogOpen}
        refTargetInfo={pendingRefOperation ? {
          targetComponentName: pendingRefOperation.targetComponentName,
          sourcePropertyPath: pendingRefOperation.path,
          operationType: pendingRefOperation.type,
          propertyName: pendingRefOperation.type === 'add' 
            ? pendingRefOperation.name 
            : pendingRefOperation.selectedItem?.name
        } : null}
        onConfirm={handleRefOperationConfirm}
        onCancel={handleRefOperationCancel}
      />
    </div>
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
  component: { name: string; schema: any; description?: string; referenceCount: number };
  allSchemas: Record<string, any>;
  basePath: string[];
  onPropertyChange: (path: string[], updates: { name?: string; schema?: any }) => void;
  onPropertyRename: (path: string[], oldName: string, newName: string) => void;
  onAddProperty: (path: string[], name: string, schema: any) => void;
  onDeleteProperty: (path: string[]) => void;
  onAddArrayItem: (path: string[], item: any) => void;
  onReorderProperties: (path: string[], oldIndex: number, newIndex: number) => void;
  onCopy?: (name: string, schema: any, path: string[]) => void;
  onCut?: (name: string, schema: any, path: string[]) => void;
  onPaste?: (path: string[], selectedItem?: ClipboardItem) => void;
  clipboard?: ClipboardItem | null;
  clipboardHistory?: ClipboardItem[];
  onSelectFromHistory?: (item: ClipboardItem) => void;
  onClearHistory?: () => void;
  onClearClipboard?: () => void;
  hasClipboard?: boolean;
  consistencyIssues?: ConsistencyIssue[];
  forceExpandedPaths?: Set<string>;
}

const ComponentTreeEditable: React.FC<ComponentTreeEditableProps> = ({ 
  component, 
  allSchemas,
  basePath,
  onPropertyChange,
  onPropertyRename,
  onAddProperty,
  onDeleteProperty,
  onAddArrayItem,
  onReorderProperties,
  onCopy,
  onCut,
  onPaste,
  clipboard,
  clipboardHistory,
  onSelectFromHistory,
  onClearHistory,
  onClearClipboard,
  hasClipboard,
  consistencyIssues = [],
  forceExpandedPaths
}) => {
  const pathKey = basePath.join('.');

  const isForceExpanded = useMemo(() => {
    if (!forceExpandedPaths) return false;
    if (forceExpandedPaths.has(pathKey)) return true;
    // Expand the component container if any expanded path is a descendant
    for (const p of forceExpandedPaths) {
      if (p.startsWith(pathKey + '.')) return true;
    }
    return false;
  }, [forceExpandedPaths, pathKey]);

  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
  const isExpanded = isManuallyExpanded || isForceExpanded;
  const availableRefs = useMemo(() => Object.keys(allSchemas), [allSchemas]);
  
  // Check if this is a document reference
  const isDocumentRef = component.schema?.$ref?.startsWith('document://');
  const documentName = component.schema?.['x-document-name'];
  const isLoading = component.schema?.['x-loading'];
  const hasError = component.schema?.['x-error'];
  
  // For document refs, the resolved content might be in allSchemas
  const resolvedSchema = isDocumentRef ? allSchemas[component.name] : component.schema;
  const properties = resolvedSchema?.properties || {};
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
        onClick={() => setIsManuallyExpanded(!isManuallyExpanded)}
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
        
        {isLoading ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        ) : isDocumentRef ? (
          <ExternalLink className="h-4 w-4 text-blue-500" />
        ) : (
          <Box className="h-4 w-4 text-primary" />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{component.name}</span>
            {consistencyIssues.length > 0 && (
              <ConsistencyIndicator issues={consistencyIssues} path={basePath} />
            )}
            {isDocumentRef && (
              <Badge variant="outline" className="text-xs gap-1 text-blue-600 border-blue-300">
                <Link2 className="h-2.5 w-2.5" />
                Reference
              </Badge>
            )}
            {!isDocumentRef && (
              component.referenceCount === 0 ? (
                <Badge variant="outline" className="text-xs">Top Level</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  {component.referenceCount} ref{component.referenceCount > 1 ? 's' : ''}
                </Badge>
              )
            )}
          </div>
          {isDocumentRef && documentName && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              → {documentName}
            </p>
          )}
          {hasError && (
            <p className="text-xs text-destructive truncate mt-0.5">
              Error: {hasError}
            </p>
          )}
          {component.description && !isDocumentRef && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {component.description}
            </p>
          )}
        </div>
        
        <Badge variant="secondary" className="text-xs shrink-0">
          {isLoading ? 'Loading...' : `${Object.keys(properties).length} properties`}
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
      
      {isExpanded && !isLoading && !hasError && (
        <div className="p-2 bg-background">
          {isDocumentRef && (
            <p className="text-xs text-muted-foreground px-2 py-1 mb-2 bg-blue-50 dark:bg-blue-950/30 rounded">
              Sideloaded from: {documentName}
            </p>
          )}
          <SortablePropertyList
            items={Object.keys(properties)}
            onReorder={(oldIndex, newIndex) => onReorderProperties([...basePath, 'properties'], oldIndex, newIndex)}
            disabled={isDocumentRef}
          >
            {Object.entries(properties).map(([propName, propSchema]) => (
              <SortableItem key={propName} id={propName} indentPx={16}>
                <EditablePropertyNode
                  name={propName}
                  propertySchema={propSchema as any}
                  path={isDocumentRef ? [] : [...basePath, 'properties', propName]}
                  allSchemas={allSchemas}
                  onPropertyChange={isDocumentRef ? () => {} : onPropertyChange}
                  onPropertyRename={isDocumentRef ? () => {} : onPropertyRename}
                  onAddProperty={isDocumentRef ? () => {} : onAddProperty}
                  onDeleteProperty={isDocumentRef ? () => {} : onDeleteProperty}
                  onAddArrayItem={isDocumentRef ? () => {} : onAddArrayItem}
                  onReorderProperties={isDocumentRef ? () => {} : onReorderProperties}
                  onCopy={isDocumentRef ? undefined : onCopy}
                  onCut={isDocumentRef ? undefined : onCut}
                  onPaste={isDocumentRef ? undefined : onPaste}
                  clipboard={clipboard}
                  clipboardHistory={clipboardHistory}
                  onSelectFromHistory={onSelectFromHistory}
                  onClearHistory={onClearHistory}
                  onClearClipboard={onClearClipboard}
                  hasClipboard={hasClipboard}
                  consistencyIssues={consistencyIssues}
                  forceExpandedPaths={forceExpandedPaths}
                />
              </SortableItem>
            ))}
          </SortablePropertyList>
          
          {/* Add property button - disabled for references */}
          {!isDocumentRef && (
            <div className="py-1 px-2 pl-6">
              <AddPropertyButton onAdd={handleAddProperty} availableRefs={availableRefs} />
            </div>
          )}
        </div>
      )}
    </>
  );
};
