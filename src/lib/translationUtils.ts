export interface TranslationEntry {
  key: string;
  value: string;
  path: string[];
}

// Schema type detection
export type SchemaType = 'openapi' | 'json-schema' | 'unknown';

export function detectSchemaType(obj: any): SchemaType {
  if (!obj || typeof obj !== 'object') return 'unknown';
  
  // Check for OpenAPI indicators
  if (obj.openapi || obj.swagger || obj.info || obj.paths) {
    return 'openapi';
  }
  
  // Check for JSON Schema indicators
  if (obj.$schema || obj.type || obj.properties || obj.definitions || obj.$defs) {
    return 'json-schema';
  }
  
  return 'unknown';
}

// Properties that start with $ and should be excluded (JSON Schema references, etc.)
const EXCLUDED_DOLLAR_PROPS = /^\$/;

// OpenAPI-specific keyword properties that should not be translated
const OPENAPI_KEYWORDS = new Set([
  'type', 'format', 'enum', 'const', 'default', 'multipleOf', 'maximum', 'exclusiveMaximum',
  'minimum', 'exclusiveMinimum', 'maxLength', 'minLength', 'pattern', 'maxItems', 'minItems',
  'uniqueItems', 'maxProperties', 'minProperties', 'required', 'additionalProperties',
  'additionalItems', 'items', 'properties', 'patternProperties', 'dependencies', 'allOf',
  'anyOf', 'oneOf', 'not', 'definitions', '$ref', '$schema', '$id', '$comment', 'if', 'then',
  'else', 'readOnly', 'writeOnly', 'examples', 'contentMediaType', 'contentEncoding',
  // OpenAPI specific
  'operationId', 'tags', 'consumes', 'produces', 'schemes', 'deprecated', 'security',
  'responses', 'parameters', 'requestBody', 'callbacks', 'links', 'components', 'servers',
  'paths', 'webhooks', 'method', 'in', 'style', 'explode', 'allowReserved', 'schema',
  'content', 'headers', 'encoding', 'discriminator', 'xml', 'externalDocs', 'openapi',
  'swagger', 'host', 'basePath', 'securityDefinitions'
]);

// JSON Schema-specific keyword properties  
const JSON_SCHEMA_KEYWORDS = new Set([
  'type', 'format', 'enum', 'const', 'default', 'multipleOf', 'maximum', 'exclusiveMaximum',
  'minimum', 'exclusiveMinimum', 'maxLength', 'minLength', 'pattern', 'maxItems', 'minItems',
  'uniqueItems', 'maxProperties', 'minProperties', 'required', 'additionalProperties',
  'additionalItems', 'items', 'properties', 'patternProperties', 'dependencies', 'allOf',
  'anyOf', 'oneOf', 'not', 'definitions', '$defs', '$ref', '$schema', '$id', '$comment', 
  'if', 'then', 'else', 'readOnly', 'writeOnly', 'examples', 'contentMediaType', 
  'contentEncoding', '$vocabulary', '$anchor', '$dynamicRef', '$dynamicAnchor'
]);

// Context-aware check for translatable properties
function isTranslatableProperty(
  key: string, 
  value: string, 
  path: string[], 
  schemaType: SchemaType,
  rootObj?: any,
  parentObj?: any
): boolean {
  // Exclude properties starting with $ and any nested properties under them
  if (EXCLUDED_DOLLAR_PROPS.test(key)) {
    return false;
  }
  
  // Check if any parent in the path starts with $ - if so, exclude this property too
  if (path.some(pathSegment => typeof pathSegment === 'string' && EXCLUDED_DOLLAR_PROPS.test(pathSegment))) {
    return false;
  }

  // Exclude values inside "required" arrays - these are property references, not translatable text
  if (path.some(pathSegment => pathSegment === 'required')) {
    return false;
  }
  
  // Exclude version strings - these are technical metadata
  if (key === 'version' || path.some(pathSegment => pathSegment === 'version')) {
    return false;
  }

  // Get appropriate keyword set based on schema type
  const keywords = schemaType === 'openapi' ? OPENAPI_KEYWORDS : JSON_SCHEMA_KEYWORDS;
  
  // Exclude known schema keywords
  if (keywords.has(key)) {
    return false;
  }

  // Special handling for enum values - these are usually not translatable
  if (path.some(pathSegment => pathSegment === 'enum')) {
    return false;
  }

  // Special handling for example properties that correspond to enum schema properties
  if (rootObj && path.includes('example')) {
    const exampleIndex = path.indexOf('example');
    if (exampleIndex > 0) {
      // Construct path to the corresponding schema property (everything before 'example')
      const schemaPath = path.slice(0, exampleIndex);
      
      // Navigate to the schema property in the root object
      let schemaProperty = rootObj;
      for (const pathSegment of schemaPath) {
        if (schemaProperty && typeof schemaProperty === 'object') {
          schemaProperty = schemaProperty[pathSegment];
        } else {
          schemaProperty = null;
          break;
        }
      }
      
      // Check if this schema property has an enum array
      if (schemaProperty && typeof schemaProperty === 'object' && Array.isArray(schemaProperty.enum)) {
        return false;
      }
    }
  }

  // Special handling for 'type' values - these have predefined values
  if (key === 'type' && typeof value === 'string') {
    const validTypes = [
      'null', 'boolean', 'object', 'array', 'number', 'string', 'integer',
      // OpenAPI types
      'file', 'password', 'byte', 'binary', 'date', 'date-time', 'email', 'hostname', 
      'ipv4', 'ipv6', 'uri', 'uuid'
    ];
    if (validTypes.includes(value.toLowerCase())) {
      return false;
    }
  }

  // Special handling for 'format' values - these are predefined
  if (key === 'format' && typeof value === 'string') {
    const validFormats = [
      'date', 'date-time', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uuid',
      'byte', 'binary', 'password', 'int32', 'int64', 'float', 'double'
    ];
    if (validFormats.includes(value.toLowerCase())) {
      return false;
    }
  }

  // Special handling for HTTP methods and status codes
  if (schemaType === 'openapi') {
    const httpMethods = ['get', 'post', 'put', 'delete', 'options', 'head', 'patch', 'trace'];
    if (httpMethods.includes(key.toLowerCase())) {
      return false;
    }

    // HTTP status codes
    if (/^\d{3}$/.test(key)) {
      return false;
    }
  }

  // URL patterns and technical identifiers are usually not translatable
  if (typeof value === 'string') {
    // URLs, email patterns, UUIDs, etc.
    if (
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('mailto:') ||
      value.startsWith('ftp://') ||
      /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(value) ||
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value) ||
      /^\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;={}]*$/.test(value) // Path patterns
    ) {
      return false;
    }
  }

  return true;
}

export function extractStringValues(obj: any, prefix = 'root', path: string[] = [], schemaType?: SchemaType, rootObj?: any): TranslationEntry[] {
  const entries: TranslationEntry[] = [];
  
  // Detect schema type on first call and set rootObj
  if (schemaType === undefined) {
    schemaType = detectSchemaType(obj);
    rootObj = obj; // Set root object on first call
  }
  
  if (obj === null || obj === undefined) {
    return entries;
  }

  if (typeof obj === 'string') {
    // Only add if it's a translatable property
    const key = path.length > 0 ? path[path.length - 1] : 'root';
    if (isTranslatableProperty(key, obj, path, schemaType, rootObj)) {
      entries.push({
        key: prefix,
        value: obj,
        path: [...path]
      });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const newPrefix = `${prefix}.${index}`;
      const newPath = [...path, index.toString()];
      entries.push(...extractStringValues(item, newPrefix, newPath, schemaType, rootObj));
    });
  } else if (typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      const newPrefix = `${prefix}.${key}`;
      const newPath = [...path, key];
      entries.push(...extractStringValues(obj[key], newPrefix, newPath, schemaType, rootObj));
    });
  }

  return entries;
}

export function createTranslationIndex(entries: TranslationEntry[]): Record<string, string> {
  const index: Record<string, string> = {};
  entries.forEach(entry => {
    index[entry.key] = entry.value;
  });
  return index;
}

export function downloadJsonFile(data: any, filename: string) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}