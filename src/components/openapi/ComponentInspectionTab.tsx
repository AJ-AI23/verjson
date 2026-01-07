import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Box, Link2, Hash, Type, List, ToggleLeft, Calendar, FileText } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
  isArrayItem = false 
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

  return (
    <div className="select-none">
      <div 
        className="flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
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
        
        <Badge 
          variant={isRef ? "default" : "secondary"} 
          className={cn(
            "text-xs font-normal ml-auto",
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
}

const ComponentTree: React.FC<ComponentTreeProps> = ({ component, allSchemas }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const properties = component.schema?.properties || {};
  const hasProperties = Object.keys(properties).length > 0;

  return (
    <div className="border rounded-lg overflow-hidden">
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
            <PropertyNode
              key={propName}
              name={propName}
              schema={propSchema as any}
              allSchemas={allSchemas}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const ComponentInspectionTab: React.FC<ComponentInspectionTabProps> = ({
  components,
  allSchemas
}) => {
  const [filter, setFilter] = useState<'all' | 'top-level'>('all');
  
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
      
      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-4">
          {filteredComponents.map((component) => (
            <ComponentTree 
              key={component.name} 
              component={component} 
              allSchemas={allSchemas}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
