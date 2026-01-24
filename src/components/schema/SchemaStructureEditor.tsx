import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Box, Link2, Hash, Type, List, ToggleLeft, FileText, Plus, Trash2, Pencil, Check, X, Copy, Scissors, Clipboard, AlignLeft, FileCode } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SortablePropertyList, SortableItem, reorderObjectProperties, reorderArrayItems } from './SortablePropertyList';
import { usePropertyClipboard, ClipboardItem } from '@/hooks/usePropertyClipboard';
import { ClipboardHistoryPopover } from './ClipboardHistoryPopover';
import { RefTargetConfirmDialog, RefTargetInfo } from '@/components/openapi/RefTargetConfirmDialog';
import { ConsistencyIndicator } from './ConsistencyIndicator';
import { ConsistencyIssue } from '@/types/consistency';
import { useStructureSearch } from '@/hooks/useStructureSearch';
import { StructureSearchBar } from './StructureSearchBar';
import { getDiagramSchemaDefinitions, getDiagramArrayItemSchema, getDiagramArrayItemTypeName } from '@/lib/schemas/diagramSchema';
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

import { CollapsedState } from '@/lib/diagram/types';

interface SchemaStructureEditorProps {
  schema: any;
  onSchemaChange: (schema: any) => void;
  schemaType: 'json-schema' | 'diagram' | 'markdown';
  consistencyIssues?: ConsistencyIssue[];
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  selectedNodePath?: string | null;
}

interface EditablePropertyNodeProps {
  name: string;
  propertySchema: any;
  path: string[];
  definitions: Record<string, any>;
  depth?: number;
  isArrayItem?: boolean;
  parentIsArray?: boolean;
  diagramArrayPath?: string; // e.g., 'data.lifelines', 'data.nodes', 'data.processes'
  fixedItemType?: string; // Fixed type name for array items constrained by schema (e.g., via items.$ref)
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
  
  const types = schema?.type;
  const typeValue = Array.isArray(types) ? types[0] : types;
  
  switch (typeValue) {
    case 'string':
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

// Get the diagram schema type for a property within an array item
const getDiagramItemPropertyType = (propertyName: string, diagramArrayPath: string | undefined): string | null => {
  if (!diagramArrayPath) return null;
  
  const itemSchema = getDiagramArrayItemSchema(diagramArrayPath);
  if (!itemSchema?.properties?.[propertyName]) return null;
  
  const propSchema = itemSchema.properties[propertyName];
  
  // Handle $ref
  if (propSchema.$ref) {
    return propSchema.$ref.split('/').pop() || null;
  }
  
  // Handle enum types - show as the enum type
  if (propSchema.enum && Array.isArray(propSchema.enum)) {
    return `enum(${propSchema.enum.join('|')})`;
  }
  
  // Handle const values
  if (propSchema.const !== undefined) {
    return `const(${propSchema.const})`;
  }
  
  // Handle array types
  if (propSchema.type === 'array') {
    if (propSchema.items?.$ref) {
      return `${propSchema.items.$ref.split('/').pop() || 'any'}[]`;
    }
    return `${propSchema.items?.type || 'any'}[]`;
  }
  
  return propSchema.type || null;
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

// Helper to extract fixed item type from a schema with items.$ref
const getFixedItemTypeFromSchema = (parentSchema: any): string | null => {
  if (!parentSchema) return null;
  
  // Check for array with items.$ref
  if (parentSchema.type === 'array' && parentSchema.items?.$ref) {
    const ref = parentSchema.items.$ref;
    // Extract the type name from the ref path
    return ref.split('/').pop() || null;
  }
  
  return null;
};

const EditablePropertyNode: React.FC<EditablePropertyNodeProps> = ({
  name, 
  propertySchema, 
  path,
  definitions, 
  depth = 0,
  isArrayItem = false,
  parentIsArray = false,
  diagramArrayPath,
  fixedItemType,
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
    
    // Array items that are objects should always be expandable
    if (isArrayItem && typeof propertySchema === 'object' && propertySchema !== null) {
      return true;
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
  }, [propertySchema, isSchemaWithType, isPrimitive, isArrayItem]);

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
    
    // Array items that are objects should show their properties directly
    // (e.g., diagram nodes, lifelines, processes - they have a 'type' field but aren't JSON Schema types)
    if (isArrayItem && typeof propertySchema === 'object' && propertySchema !== null) {
      return propertySchema;
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
  }, [isExpanded, propertySchema, definitions, isSchemaWithType, isArrayItem]);

  // Get type label - check diagram schema first for properties within diagram array items
  const typeLabel = useMemo(() => {
    // If we're inside a diagram array item, check if the diagram schema has type info for this property
    if (diagramArrayPath && !isArrayItem) {
      const diagramType = getDiagramItemPropertyType(name, diagramArrayPath);
      if (diagramType) {
        return diagramType;
      }
    }
    return getTypeLabel(propertySchema);
  }, [name, propertySchema, diagramArrayPath, isArrayItem]);

  // Check if this item has a fixed type (either from diagram schema or from parent array's items.$ref)
  const fixedType = useMemo(() => {
    // First check if explicitly passed from parent
    if (fixedItemType && isArrayItem) {
      return fixedItemType;
    }
    // Then check diagram-specific fixed types
    if (isArrayItem && diagramArrayPath) {
      return getDiagramArrayItemTypeName(diagramArrayPath);
    }
    return null;
  }, [isArrayItem, diagramArrayPath, fixedItemType]);

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
      // Only add to 'properties' if this is a JSON Schema object with type: 'object'
      const isJsonSchemaObject = propertySchema?.type === 'object';
      const addPath = isJsonSchemaObject ? [...path, 'properties'] : path;
      onAddProperty(addPath, childName, childSchema);
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
      // Only add 'properties' if this is a JSON Schema object with type: 'object'
      // For plain objects (no type field), paste directly into the object
      const isJsonSchemaObject = propertySchema?.type === 'object';
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
    // Compare paths - the source path already includes the property name as last element
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
          {isPrimitive ? (
            <EditableValue value={propertySchema} onValueChange={handleValueChange} />
          ) : fixedType ? (
            // Fixed type - display as static badge (no dropdown)
            <Badge variant="secondary" className="text-xs font-normal">
              {fixedType}
            </Badge>
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
          
          {/* Description button - only for schema properties with type */}
          {isSchemaWithType && !isPrimitive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "h-5 w-5 p-0 opacity-0 group-hover:opacity-100",
                    propertySchema?.description && "opacity-100 text-blue-500 hover:text-blue-600"
                  )}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (propertySchema?.description) {
                      // Remove description
                      const { description, ...rest } = propertySchema;
                      onPropertyChange(path, { schema: rest });
                    } else {
                      // Add description
                      onPropertyChange(path, { schema: { ...propertySchema, description: '' } });
                    }
                  }}
                >
                  <AlignLeft className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {propertySchema?.description ? 'Remove description' : 'Add description'}
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Example button - only for schema properties with type */}
          {isSchemaWithType && !isPrimitive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "h-5 w-5 p-0 opacity-0 group-hover:opacity-100",
                    propertySchema?.example !== undefined && "opacity-100 text-green-500 hover:text-green-600"
                  )}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (propertySchema?.example !== undefined) {
                      // Remove example
                      const { example, ...rest } = propertySchema;
                      onPropertyChange(path, { schema: rest });
                    } else {
                      // Add example based on type
                      let exampleValue: any = '';
                      const typeValue = propertySchema?.type;
                      if (typeValue === 'integer' || typeValue === 'number') exampleValue = 0;
                      else if (typeValue === 'boolean') exampleValue = true;
                      else if (typeValue === 'array') exampleValue = [];
                      else if (typeValue === 'object') exampleValue = {};
                      onPropertyChange(path, { schema: { ...propertySchema, example: exampleValue } });
                    }
                  }}
                >
                  <FileCode className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {propertySchema?.example !== undefined ? 'Remove example' : 'Add example'}
              </TooltipContent>
            </Tooltip>
          )}
          
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
        <div className="border-l border-border/50">
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
              {Object.entries(childProperties).map(([propName, propSchema]) => {
                // For array children, check if items have a fixed type
                const childFixedItemType = Array.isArray(propertySchema) 
                  ? getFixedItemTypeFromSchema(propertySchema) 
                  : undefined;
                return (
                <SortableItem key={propName} id={propName} indentPx={16}>
                  <EditablePropertyNode
                    name={propName}
                    propertySchema={propSchema as any}
                    path={[...path, propName]}
                    definitions={definitions}
                    depth={depth + 1}
                    isArrayItem={Array.isArray(propertySchema)}
                    parentIsArray={Array.isArray(propertySchema)}
                    diagramArrayPath={diagramArrayPath}
                    fixedItemType={childFixedItemType}
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
                    externalCollapsedPaths={externalCollapsedPaths}
                    onExternalToggleCollapse={onExternalToggleCollapse}
                  />
                </SortableItem>
              )})}
            </SortablePropertyList>
          )}
          
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
  definitions: Record<string, any>;
  diagramArrayPath?: string; // For diagram sections: 'data.lifelines', 'data.nodes', etc.
  parentSchema?: any; // Schema definition for this section (to detect items.$ref)
  isEmptyDiagramArray?: boolean; // Flag for empty diagram arrays that should still show +Add
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
  externalCollapsedPaths?: CollapsedState;
  onExternalToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}
const SectionTree: React.FC<SectionTreeProps> = ({ 
  title, 
  icon, 
  data,
  path,
  definitions,
  diagramArrayPath,
  parentSchema,
  isEmptyDiagramArray,
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
  
  // Sync with external collapsed state - default to expanded (true) if not set
  const externalExpanded = externalCollapsedPaths ? externalCollapsedPaths[pathKey] === false : undefined;
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(externalExpanded ?? true);
  
  // Sync local state with external when it changes
  useEffect(() => {
    if (externalExpanded !== undefined) {
      setIsManuallyExpanded(externalExpanded);
    }
  }, [externalExpanded]);
  
  const isExpanded = isManuallyExpanded || isForceExpanded;
  const availableRefs = useMemo(() => Object.keys(definitions), [definitions]);
  
  // Handle toggle and notify external
  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isManuallyExpanded;
    setIsManuallyExpanded(newExpanded);
    onExternalToggleCollapse?.(pathKey, !newExpanded);
  }, [isManuallyExpanded, onExternalToggleCollapse, pathKey]);
  
  // Determine if array items have a fixed type from parent schema's items.$ref
  const fixedItemType = useMemo(() => {
    return getFixedItemTypeFromSchema(parentSchema);
  }, [parentSchema]);
  
  // Allow empty diagram arrays to still render (for +Add button)
  if (!isEmptyDiagramArray && (!data || (typeof data === 'object' && Object.keys(data).length === 0))) {
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
      
      // Create proper template for diagram array items
      const getNewItemTemplate = (): any => {
        if (diagramArrayPath === 'data.lifelines') {
          return {
            id: `lifeline-${data.length + 1}`,
            name: `Lifeline ${data.length + 1}`,
            order: data.length
          };
        } else if (diagramArrayPath === 'data.nodes') {
          return {
            id: `node-${data.length + 1}`,
            type: 'endpoint',
            label: `Node ${data.length + 1}`,
            anchors: []
          };
        } else if (diagramArrayPath === 'data.processes') {
          return {
            id: `process-${data.length + 1}`,
            type: 'lifelineProcess',
            lifelineId: '',
            anchorIds: [],
            description: `Process ${data.length + 1}`
          };
        } else if (diagramArrayPath === 'data.edges') {
          return {
            id: `edge-${data.length + 1}`,
            source: '',
            target: ''
          };
        }
        // Default: use first item type or empty object
        return (data.length > 0 && typeof data[0] === 'object') ? {} : '';
      };
      
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
                    definitions={definitions}
                    isArrayItem={true}
                    parentIsArray={true}
                    diagramArrayPath={diagramArrayPath}
                    fixedItemType={fixedItemType || undefined}
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
                    externalCollapsedPaths={externalCollapsedPaths}
                    onExternalToggleCollapse={onExternalToggleCollapse}
                  />
                </SortableItem>
              ))}
          </SortablePropertyList>
          <div className="py-1 px-2 pl-6 flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs gap-1"
              onClick={() => onAddArrayItem(path, getNewItemTemplate())}
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
                clipboard={clipboard}
                clipboardHistory={clipboardHistory}
                onSelectFromHistory={onSelectFromHistory}
                onClearHistory={onClearHistory}
                onClearClipboard={onClearClipboard}
                hasClipboard={hasClipboard}
                consistencyIssues={consistencyIssues}
                forceExpandedPaths={forceExpandedPaths}
                externalCollapsedPaths={externalCollapsedPaths}
                onExternalToggleCollapse={onExternalToggleCollapse}
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
        onClick={handleToggleExpand}
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
  schemaType,
  consistencyIssues = [],
  collapsedPaths: rawExternalCollapsedPaths,
  onToggleCollapse: rawExternalOnToggleCollapse,
  selectedNodePath
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize collapsed paths: the diagram uses 'root.X' paths, but structure editor uses 'X'
  // Transform external state so structure editor can read it correctly
  const normalizedCollapsedPaths = useMemo((): CollapsedState => {
    if (!rawExternalCollapsedPaths) return {};
    const normalized: CollapsedState = {};
    for (const [key, value] of Object.entries(rawExternalCollapsedPaths)) {
      // Strip 'root.' prefix for structure editor paths
      if (key.startsWith('root.')) {
        normalized[key.slice(5)] = value;
      }
      // Also keep original key for direct matches
      normalized[key] = value;
    }
    return normalized;
  }, [rawExternalCollapsedPaths]);

  // Wrapper to add 'root.' prefix when toggling collapse state
  const handleExternalToggleCollapse = useCallback((path: string, isCollapsed: boolean) => {
    if (!rawExternalOnToggleCollapse) return;
    // Add 'root.' prefix to match diagram paths
    const normalizedPath = path.startsWith('root.') ? path : `root.${path}`;
    rawExternalOnToggleCollapse(normalizedPath, isCollapsed);
  }, [rawExternalOnToggleCollapse]);

  // Search functionality
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
  } = useStructureSearch({ schema, containerRef });

  useEffect(() => {
    const match = matches[currentMatchIndex];
    if (!match) return;
    scrollToPath(match.path);
  }, [matches, currentMatchIndex, scrollToPath]);

  // Handle external node selection from diagram
  useEffect(() => {
    if (!selectedNodePath) return;
    
    // Convert diagram path (root.properties.x) to structure editor path array
    // Strip 'root.' prefix and split by '.'
    const pathWithoutRoot = selectedNodePath.startsWith('root.') 
      ? selectedNodePath.slice(5) 
      : selectedNodePath;
    
    if (!pathWithoutRoot) return;
    
    const pathArray = pathWithoutRoot.split('.');
    scrollToPath(pathArray);
  }, [selectedNodePath, scrollToPath]);


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

  // Get definitions based on schema type
  const definitions = useMemo(() => {
    if (schemaType === 'json-schema') {
      return schema?.$defs || schema?.definitions || {};
    }
    return {};
  }, [schema, schemaType]);

  // Helper to resolve a path and detect if it leads through a $ref
  const resolvePathThroughRefs = useCallback((path: string[]): { resolvedPath: string[]; targetComponentName: string | null } => {
    let current = schema;
    const resolvedPath: string[] = [];
    
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      
      // Check if current level has a $ref
      if (current?.$ref && typeof current.$ref === 'string') {
        // This is a reference - resolve it
        if (current.$ref.startsWith('#/$defs/')) {
          const refName = current.$ref.split('/').pop();
          if (refName) {
            const remainingPath = path.slice(i);
            return {
              resolvedPath: ['$defs', refName, ...remainingPath],
              targetComponentName: refName
            };
          }
        } else if (current.$ref.startsWith('#/definitions/')) {
          const refName = current.$ref.split('/').pop();
          if (refName) {
            const remainingPath = path.slice(i);
            return {
              resolvedPath: ['definitions', refName, ...remainingPath],
              targetComponentName: refName
            };
          }
        }
      }
      
      // Check items.$ref for arrays
      if (current?.items?.$ref && typeof current.items.$ref === 'string') {
        if (current.items.$ref.startsWith('#/$defs/')) {
          const refName = current.items.$ref.split('/').pop();
          if (refName && key !== 'items') {
            const remainingPath = path.slice(i);
            return {
              resolvedPath: ['$defs', refName, ...remainingPath],
              targetComponentName: refName
            };
          }
        } else if (current.items.$ref.startsWith('#/definitions/')) {
          const refName = current.items.$ref.split('/').pop();
          if (refName && key !== 'items') {
            const remainingPath = path.slice(i);
            return {
              resolvedPath: ['definitions', refName, ...remainingPath],
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
      if (current.$ref.startsWith('#/$defs/')) {
        const refName = current.$ref.split('/').pop();
        if (refName) {
          return {
            resolvedPath: ['$defs', refName, 'properties'],
            targetComponentName: refName
          };
        }
      } else if (current.$ref.startsWith('#/definitions/')) {
        const refName = current.$ref.split('/').pop();
        if (refName) {
          return {
            resolvedPath: ['definitions', refName, 'properties'],
            targetComponentName: refName
          };
        }
      }
    }
    
    // Also check if the destination is an array with items.$ref
    if (current?.items?.$ref && typeof current.items.$ref === 'string') {
      if (current.items.$ref.startsWith('#/$defs/')) {
        const refName = current.items.$ref.split('/').pop();
        if (refName) {
          return {
            resolvedPath: ['$defs', refName, 'properties'],
            targetComponentName: refName
          };
        }
      } else if (current.items.$ref.startsWith('#/definitions/')) {
        const refName = current.items.$ref.split('/').pop();
        if (refName) {
          return {
            resolvedPath: ['definitions', refName, 'properties'],
            targetComponentName: refName
          };
        }
      }
    }
    
    return { resolvedPath, targetComponentName: null };
  }, [schema]);

  // Keyboard shortcuts for undo/redo are handled by the parent component via shared history

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

  // Internal function that actually performs the add operation
  const executeAddProperty = useCallback((path: string[], name: string, propSchema: any) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    
    let current = newSchema;
    for (const key of path) {
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    
    current[name] = propSchema;
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

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
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

  const handleAddArrayItem = useCallback((path: string[], item: any) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    
    // Navigate to the target, creating arrays along the way if needed
    let current = newSchema;
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      if (current[key] === undefined) {
        // Create array at the target path, object for intermediate paths
        current[key] = (i === path.length - 1) ? [] : {};
      }
      current = current[key];
    }
    
    if (Array.isArray(current)) {
      current.push(item);
    }
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

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
        onSchemaChange({ ...newSchema, ...reordered });
        return;
      }
      let parent = newSchema;
      for (let i = 0; i < path.length - 1; i++) {
        parent = parent[path[i]];
      }
      parent[path[path.length - 1]] = reordered;
    }
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

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
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

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
    
    onSchemaChange(newSchema);
  }, [schema, onSchemaChange]);

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

  // Build sections based on schema type
  const rootSections = useMemo(() => {
    const sections: { key: string; title: string; icon: React.ReactNode; data: any; diagramArrayPath?: string; isEmptyDiagramArray?: boolean }[] = [];
    
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
      // VerjSON Diagram sections - check for new verjson structure
      const isVerjsonFormat = schema?.verjson !== undefined;
      
      if (isVerjsonFormat) {
        // New verjson format: data contains lifelines, nodes, etc.
        // Always show Lifelines, Nodes, Processes sections even if empty/missing
        const diagramData = schema.data || {};
        const diagramType = schema.type;
        
        // For sequence diagrams, always show Lifelines, Nodes, Processes
        if (diagramType === 'sequence') {
          sections.push({ key: 'data.lifelines', title: 'Lifelines', icon: <List className="h-4 w-4 text-green-500" />, data: diagramData.lifelines || [], diagramArrayPath: 'data.lifelines', isEmptyDiagramArray: !diagramData.lifelines || diagramData.lifelines.length === 0 });
          sections.push({ key: 'data.nodes', title: 'Nodes', icon: <Box className="h-4 w-4 text-primary" />, data: diagramData.nodes || [], diagramArrayPath: 'data.nodes', isEmptyDiagramArray: !diagramData.nodes || diagramData.nodes.length === 0 });
          sections.push({ key: 'data.processes', title: 'Processes', icon: <Box className="h-4 w-4 text-purple-500" />, data: diagramData.processes || [], diagramArrayPath: 'data.processes', isEmptyDiagramArray: !diagramData.processes || diagramData.processes.length === 0 });
        } else {
          // For flowcharts, show Nodes and Edges
          sections.push({ key: 'data.nodes', title: 'Nodes', icon: <Box className="h-4 w-4 text-primary" />, data: diagramData.nodes || [], diagramArrayPath: 'data.nodes', isEmptyDiagramArray: !diagramData.nodes || diagramData.nodes.length === 0 });
          if (diagramData?.edges || diagramType === 'flowchart') {
            sections.push({ key: 'data.edges', title: 'Edges', icon: <Link2 className="h-4 w-4 text-blue-500" />, data: diagramData.edges || [], diagramArrayPath: 'data.edges', isEmptyDiagramArray: !diagramData.edges || diagramData.edges.length === 0 });
          }
        }
      } else {
        // Legacy flat diagram format - always show sections
        sections.push({ key: 'lifelines', title: 'Lifelines', icon: <List className="h-4 w-4 text-green-500" />, data: schema?.lifelines || [], isEmptyDiagramArray: !schema?.lifelines || schema.lifelines.length === 0 });
        sections.push({ key: 'nodes', title: 'Nodes', icon: <Box className="h-4 w-4 text-primary" />, data: schema?.nodes || [], isEmptyDiagramArray: !schema?.nodes || schema.nodes.length === 0 });
        sections.push({ key: 'processes', title: 'Processes', icon: <Box className="h-4 w-4 text-purple-500" />, data: schema?.processes || [], isEmptyDiagramArray: !schema?.processes || schema.processes.length === 0 });
        if (schema?.edges) {
          sections.push({ key: 'edges', title: 'Edges', icon: <Link2 className="h-4 w-4 text-blue-500" />, data: schema.edges });
        }
        if (schema?.viewport) {
          sections.push({ key: 'viewport', title: 'Viewport', icon: <Box className="h-4 w-4 text-muted-foreground" />, data: schema.viewport });
        }
      }
    } else if (schemaType === 'markdown') {
      // VerjSON Markdown sections
      const markdownData = schema?.data;
      if (markdownData?.pages) {
        sections.push({ key: 'data.pages', title: 'Pages', icon: <FileText className="h-4 w-4 text-primary" />, data: markdownData.pages, diagramArrayPath: 'data.pages' });
      }
      if (markdownData?.embeds) {
        sections.push({ key: 'data.embeds', title: 'Embeds', icon: <Link2 className="h-4 w-4 text-blue-500" />, data: markdownData.embeds, diagramArrayPath: 'data.embeds' });
      }
    }
    
    return sections;
  }, [schema, schemaType]);

  // Document section - shows root-level document/format fields
  const documentFields = useMemo(() => {
    const fields: { key: string; value: any; path: string[] }[] = [];
    
    // Check if this is a verjson format document (diagram or markdown)
    const isVerjsonFormat = (schemaType === 'diagram' || schemaType === 'markdown') && schema?.verjson !== undefined;
    
    if (isVerjsonFormat) {
      // VerjSON Document section: verjson, type, selectedTheme
      if (schema.verjson !== undefined) {
        fields.push({ key: 'verjson', value: schema.verjson, path: ['verjson'] });
      }
      if (schema.type !== undefined) {
        fields.push({ key: 'type', value: schema.type, path: ['type'] });
      }
      if (schema.selectedTheme !== undefined) {
        fields.push({ key: 'selectedTheme', value: schema.selectedTheme, path: ['selectedTheme'] });
      }
    } else {
      // JSON Schema Document section: $schema, $id, type
      const docKeys = ['$schema', '$id', 'type'];
      for (const key of docKeys) {
        if (schema?.[key] !== undefined) {
          fields.push({ key, value: schema[key], path: [key] });
        }
      }
    }
    
    return fields;
  }, [schema, schemaType]);

  // Metadata section - shows descriptive fields (title, description, etc.)
  const metadataFields = useMemo(() => {
    const fields: { key: string; value: any; path: string[] }[] = [];
    
    const isVerjsonFormat = (schemaType === 'diagram' || schemaType === 'markdown') && schema?.verjson !== undefined;
    
    if (!isVerjsonFormat) {
      // JSON Schema or legacy diagram: title, description, name, version
      const metaKeys = ['title', 'description', 'name', 'version'];
      for (const key of metaKeys) {
        if (schema?.[key] !== undefined) {
          fields.push({ key, value: schema[key], path: [key] });
        }
      }
    }
    
    return fields;
  }, [schema, schemaType]);

  // Info section for verjson documents (version, title, description, etc.)
  const infoFields = useMemo(() => {
    const fields: { key: string; value: any; path: string[] }[] = [];
    
    const isVerjsonFormat = (schemaType === 'diagram' || schemaType === 'markdown') && schema?.verjson !== undefined;
    
    if (isVerjsonFormat && schema.info) {
      const infoKeys = ['version', 'title', 'description', 'author', 'created', 'modified'];
      for (const key of infoKeys) {
        if (schema.info[key] !== undefined) {
          fields.push({ key, value: schema.info[key], path: ['info', key] });
        }
      }
    }
    
    return fields;
  }, [schema, schemaType]);

  // Styles section for verjson documents
  const hasStyles = useMemo(() => {
    return (schemaType === 'diagram' || schemaType === 'markdown') && schema?.verjson !== undefined && schema?.styles;
  }, [schema, schemaType]);

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
      {/* Search bar */}
      <div className="border-b bg-muted/30 py-1">
        <StructureSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={matches.length}
          currentMatchIndex={currentMatchIndex}
          onNextMatch={goToNextMatch}
          onPrevMatch={goToPrevMatch}
          onClear={clearSearch}
          inputRef={searchInputRef}
        />
      </div>
      
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {/* Document section for verjson formats (diagram/markdown) or Metadata section (JSON Schema) */}
          {documentFields.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 p-3 bg-muted/30 border-b">
                <FileCode className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">
                  {(schemaType === 'diagram' || schemaType === 'markdown') && schema?.verjson ? 'Document' : 'Metadata'}
                </span>
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

          {/* Info section for verjson diagrams */}
          {infoFields.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 p-3 bg-muted/30 border-b">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="font-semibold text-sm">Info</span>
              </div>
              <div className="p-3 bg-background space-y-2">
                {infoFields.map(({ key, value, path }) => (
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

          {/* Metadata section for JSON Schema (title, description, etc.) */}
          {metadataFields.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 p-3 bg-muted/30 border-b">
                <FileText className="h-4 w-4 text-purple-500" />
                <span className="font-semibold text-sm">Metadata</span>
              </div>
              <div className="p-3 bg-background space-y-2">
                {metadataFields.map(({ key, value, path }) => (
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

          {/* Styles section for verjson diagrams */}
          {hasStyles && (
            <SectionTree
              key="styles"
              title="Styles"
              icon={<Box className="h-4 w-4 text-amber-500" />}
              data={schema.styles}
              path={['styles']}
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
              clipboard={clipboard}
              clipboardHistory={clipboardHistory}
              onSelectFromHistory={selectFromHistory}
              onClearHistory={clearHistory}
              onClearClipboard={clearClipboard}
              hasClipboard={hasClipboard}
              consistencyIssues={consistencyIssues}
              forceExpandedPaths={searchExpandedPaths}
              externalCollapsedPaths={normalizedCollapsedPaths}
              onExternalToggleCollapse={handleExternalToggleCollapse}
            />
          )}
          
          {/* Main sections (Data for diagrams, Properties/Definitions for JSON Schema) */}
          {rootSections.map((section) => (
            <SectionTree
              key={section.key}
              title={section.title}
              icon={section.icon}
              data={section.data}
              path={section.key.includes('.') ? section.key.split('.') : [section.key]}
              definitions={definitions}
              diagramArrayPath={section.diagramArrayPath}
              isEmptyDiagramArray={section.isEmptyDiagramArray}
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
              externalCollapsedPaths={normalizedCollapsedPaths}
              onExternalToggleCollapse={handleExternalToggleCollapse}
            />
          ))}
          
          {rootSections.length === 0 && documentFields.length === 0 && infoFields.length === 0 && metadataFields.length === 0 && (
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
