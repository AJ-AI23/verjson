export interface TranslationEntry {
  key: string;
  value: string;
  path: string[];
}

export interface ConsistencyIssue {
  type: string;
  path: string;
  value?: string;
  suggestedEnum?: string[];
  suggestedName?: string;
  message: string;
  suggestion?: string;
  severity?: 'error' | 'warning' | 'info';
  rule?: string;
  parameterType?: string;
  convention?: string;
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

  // Exclude parameter names in OpenAPI specs - these are literal identifiers
  if (key === 'name' && path.some(pathSegment => pathSegment === 'parameters')) {
    return false;
  }

  // Get appropriate keyword set based on schema type
  const keywords = schemaType === 'openapi' ? OPENAPI_KEYWORDS : JSON_SCHEMA_KEYWORDS;
  
  // Exclude known schema keywords
  if (keywords.has(key)) {
    return false;
  }

  // Special handling for example/examples properties - exclude if same object has enum array
  if ((key === 'example' || key === 'examples') && parentObj && typeof parentObj === 'object') {
    // Check if the parent object (which should contain both example and enum) has an enum property
    if (Array.isArray(parentObj.enum) && parentObj.enum.length > 0) {
      return false;
    }
  }

  // Special handling for enum values - these are usually not translatable
  if (path.some(pathSegment => pathSegment === 'enum')) {
    return false;
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

export function extractStringValues(obj: any, prefix = 'root', path: string[] = [], schemaType?: SchemaType, rootObj?: any, parentObj?: any): TranslationEntry[] {
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
    
    if (isTranslatableProperty(key, obj, path, schemaType, rootObj, parentObj)) {
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
      entries.push(...extractStringValues(item, newPrefix, newPath, schemaType, rootObj, obj));
    });
  } else if (typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      const newPrefix = `${prefix}.${key}`;
      const newPath = [...path, key];
      entries.push(...extractStringValues(obj[key], newPrefix, newPath, schemaType, rootObj, obj));
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

// Extract API base paths from translation keys (e.g., root.paths./v1/parcels -> /v1/parcels)
export function extractApiPathsFromTranslationKeys(translationData: Record<string, string>): string[] {
  const pathSet = new Set<string>();
  const pathRegex = /root\.paths\.([^.]+)/;
  
  Object.keys(translationData).forEach(key => {
    const match = key.match(pathRegex);
    if (match) {
      const fullPath = match[1];
      // Extract base path (first resource after version)
      // e.g., /v1/delivery-options/zones -> /v1/delivery-options
      const basePathMatch = fullPath.match(/^(\/v\d+\/[^/]+)/);
      if (basePathMatch) {
        pathSet.add(basePathMatch[1]);
      }
    }
  });
  
  return Array.from(pathSet).sort();
}

// Split translation data by API base paths
export function splitTranslationDataByApiPaths(translationData: Record<string, string>): Record<string, Record<string, string>> {
  const apiPaths = extractApiPathsFromTranslationKeys(translationData);
  const result: Record<string, Record<string, string>> = {};
  
  // Initialize containers for each API path
  apiPaths.forEach(path => {
    result[path] = {};
  });
  
  // Add entries that don't belong to any API path to a 'general' container
  result['general'] = {};
  
  // Group translation entries by their API path
  Object.entries(translationData).forEach(([key, value]) => {
    const pathMatch = key.match(/root\.paths\.([^.]+)/);
    
    if (pathMatch) {
      const fullPath = pathMatch[1];
      const basePathMatch = fullPath.match(/^(\/v\d+\/[^/]+)/);
      
      if (basePathMatch) {
        const basePath = basePathMatch[1];
        result[basePath][key] = value;
      } else {
        result['general'][key] = value;
      }
    } else {
      result['general'][key] = value;
    }
  });
  
  // Remove empty containers
  Object.keys(result).forEach(path => {
    if (Object.keys(result[path]).length === 0) {
      delete result[path];
    }
  });
  
  return result;
}

// Generate filenames for split files
export function generateSplitFilenames(baseFilename: string, apiPaths: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const baseName = baseFilename.replace(/\.[^/.]+$/, ''); // Remove extension
  const extension = baseFilename.includes('.') ? baseFilename.split('.').pop() : 'json';
  
  apiPaths.forEach(path => {
    if (path === 'general') {
      result[path] = `${baseName}-general.${extension}`;
    } else {
      // Sanitize path for filename (replace slashes and special chars)
      const sanitizedPath = path.replace(/^\//, '').replace(/\//g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
      result[path] = `${baseName}-${sanitizedPath}.${extension}`;
    }
  });
  
  return result;
}

// Generate preview data for export files
export interface ExportPreviewFile {
  path: string;
  filename: string;
  entryCount: number;
  sampleKeys: string[];
}

export function previewExportFiles(
  translationData: Record<string, string>, 
  baseFilename: string, 
  splitByApiPaths: boolean
): ExportPreviewFile[] {
  if (!splitByApiPaths) {
    // Single file export
    return [{
      path: 'single',
      filename: baseFilename,
      entryCount: Object.keys(translationData).length,
      sampleKeys: Object.keys(translationData).slice(0, 3)
    }];
  }
  
  // Multi-file export
  const splitData = splitTranslationDataByApiPaths(translationData);
  const filenames = generateSplitFilenames(baseFilename, Object.keys(splitData));
  
  return Object.entries(splitData).map(([path, data]) => ({
    path,
    filename: filenames[path],
    entryCount: Object.keys(data).length,
    sampleKeys: Object.keys(data).slice(0, 3)
  })).sort((a, b) => {
    // Sort with 'general' last
    if (a.path === 'general') return 1;
    if (b.path === 'general') return -1;
    return a.path.localeCompare(b.path);
  });
}

// Collect all enum values from the schema for consistency checking
export function collectEnumValues(obj: any, path: string[] = []): Record<string, string[]> {
  const enumMap: Record<string, string[]> = {};
  
  if (obj === null || obj === undefined) {
    return enumMap;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const newPath = [...path, index.toString()];
      Object.assign(enumMap, collectEnumValues(item, newPath));
    });
  } else if (typeof obj === 'object') {
    // Check if current object has an enum property
    if (Array.isArray(obj.enum) && obj.enum.length > 0) {
      const pathStr = path.join('.');
      enumMap[pathStr] = obj.enum.filter(val => typeof val === 'string');
    }
    
    Object.keys(obj).forEach(key => {
      const newPath = [...path, key];
      Object.assign(enumMap, collectEnumValues(obj[key], newPath));
    });
  }

  return enumMap;
}

// Check for consistency issues in the schema with configurable rules
export function checkSchemaConsistency(obj: any, config?: any): ConsistencyIssue[] {
  console.log('=== checkSchemaConsistency CALLED ===');
  console.log('Config received:', JSON.stringify(config, null, 2));
  
  // Always start with a fresh issues array to avoid stale data
  const issues: ConsistencyIssue[] = [];
  
  if (!obj || typeof obj !== 'object') {
    console.log('Invalid schema object, returning empty issues');
    return issues;
  }
  const enumMap = collectEnumValues(obj);
  const allEnumValues = new Set<string>();
  
  // Flatten all enum values for quick lookup
  Object.values(enumMap).forEach(enumArray => {
    enumArray.forEach(val => allEnumValues.add(val));
  });

  // Helper function to validate naming convention
  function validateNamingConvention(name: string, convention: any): { isValid: boolean; suggestion?: string } {
    console.log('validateNamingConvention called with:', { name, convention });
    
    if (!convention || convention.exclusions?.includes(name)) {
      console.log('Convention not defined or name in exclusions, returning valid');
      return { isValid: true };
    }

    // Only validate if caseType is explicitly defined
    if (!convention.caseType) {
      console.log('No caseType defined, returning valid');
      return { isValid: true };
    }

    const caseType = convention.caseType;
    let pattern: RegExp;
    let suggestion = '';

    switch (caseType) {
      case 'kebab-case':
        pattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
        suggestion = name.replace(/[A-Z]/g, (match, offset) => 
          offset > 0 ? `-${match.toLowerCase()}` : match.toLowerCase()
        ).replace(/[_]/g, '-').replace(/[^a-z0-9-]/g, '');
        break;
      case 'camelCase':
        pattern = /^[a-z][a-zA-Z0-9]*$/;
        suggestion = name.replace(/[-_]/g, ' ').replace(/\b\w/g, (match, offset) =>
          offset === 0 ? match.toLowerCase() : match.toUpperCase()
        ).replace(/\s/g, '');
        break;
      case 'snake_case':
        pattern = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
        suggestion = name.replace(/[A-Z]/g, (match, offset) => 
          offset > 0 ? `_${match.toLowerCase()}` : match.toLowerCase()
        ).replace(/[-]/g, '_').replace(/[^a-z0-9_]/g, '');
        break;
      case 'PascalCase':
        pattern = /^[A-Z][a-zA-Z0-9]*$/;
        suggestion = name.replace(/[-_]/g, ' ').replace(/\b\w/g, match => 
          match.toUpperCase()
        ).replace(/\s/g, '');
        break;
      case 'custom':
        if (convention.customPattern) {
          pattern = new RegExp(convention.customPattern);
        } else {
          return { isValid: true };
        }
        break;
      default:
        return { isValid: true };
    }

    const isValid = pattern.test(name);
    console.log('Pattern test result:', { 
      caseType, 
      pattern: pattern.source, 
      name, 
      isValid, 
      suggestion 
    });
    
    return { isValid, suggestion: isValid ? undefined : suggestion };
  }

  // Check for parameter naming consistency
  function checkParameterNaming(currentObj: any, path: string[] = []) {
    if (currentObj === null || currentObj === undefined) {
      return;
    }

    if (Array.isArray(currentObj)) {
      currentObj.forEach((item, index) => {
        checkParameterNaming(item, [...path, index.toString()]);
      });
    } else if (typeof currentObj === 'object') {
      // Check if this is a parameter object with a name property
      if (path.includes('parameters') && currentObj.name && typeof currentObj.name === 'string') {
        const paramName = currentObj.name;
        const paramType = currentObj.in || 'query'; // 'query', 'path', 'header', 'cookie'
        
        // Use different config based on parameter type
        let paramConfig;
        if (paramType === 'path') {
          paramConfig = config?.pathParameterNaming; // Path parameters have their own config
        } else {
          paramConfig = config?.queryParameterNaming; // Query, header, cookie parameters
        }
        
        // Only check if we have a configuration defined and it's enabled
        if (paramConfig && paramConfig.enabled) {
          console.log('Parameter validation:', {
            paramName,
            paramType,
            configType: paramConfig.caseType,
            config: paramConfig
          });
          
          const validation = validateNamingConvention(paramName, paramConfig);
          
          console.log('Validation result:', validation);
          
          if (!validation.isValid) {
            issues.push({
              type: 'parameter-naming',
              path: [...path, 'name'].join('.'),
              value: paramName,
              suggestedName: validation.suggestion,
              parameterType: paramType,
              convention: paramConfig.caseType,
              message: `${paramType === 'path' ? 'Path' : 'Query'} parameter name "${paramName}" should follow ${paramConfig.caseType} convention${validation.suggestion ? `. Suggested: "${validation.suggestion}"` : ''}`,
              severity: 'warning',
              rule: `${paramType === 'path' ? 'Path' : 'Query'} Parameter Naming Convention`
            });
          }
        }
      }
      
      Object.keys(currentObj).forEach(key => {
        checkParameterNaming(currentObj[key], [...path, key]);
      });
    }
  }

  // Recursively check for example values that match known enums but lack enum definition
  function checkExamples(currentObj: any, path: string[] = []) {
    if (currentObj === null || currentObj === undefined) {
      return;
    }

    if (Array.isArray(currentObj)) {
      currentObj.forEach((item, index) => {
        checkExamples(item, [...path, index.toString()]);
      });
    } else if (typeof currentObj === 'object') {
      Object.keys(currentObj).forEach(key => {
        const newPath = [...path, key];
        
        // Check if this is an example property
        if ((key === 'example' || key === 'examples') && typeof currentObj[key] === 'string') {
          const exampleValue = currentObj[key];
          const parentPath = path.join('.');
          
          // Check if example value matches known enum values but parent doesn't have enum
          if (allEnumValues.has(exampleValue) && !Array.isArray(currentObj.enum)) {
            // Find which enum(s) contain this value
            const matchingEnums: string[] = [];
            Object.entries(enumMap).forEach(([enumPath, enumValues]) => {
              if (enumValues.includes(exampleValue)) {
                matchingEnums.push(...enumValues);
              }
            });
            
            if (matchingEnums.length > 0) {
              const uniqueEnums = [...new Set(matchingEnums)];
              issues.push({
                type: 'missing-enum',
                path: newPath.join('.'),
                value: exampleValue,
                suggestedEnum: uniqueEnums,
                message: `Example value "${exampleValue}" matches known enum values but parent object lacks enum definition. Consider adding: "enum": [${uniqueEnums.map(v => `"${v}"`).join(', ')}]`
              });
            }
          }
        }
        
        checkExamples(currentObj[key], newPath);
      });
    }
  }
  
  // Add semantic rule checking based on configuration
  function checkSemanticRules(currentObj: any, path: string[] = []) {
    if (!config?.semanticRules) return;

    config.semanticRules.forEach(rule => {
      if (!rule.enabled) return;

      switch (rule.id) {
        case 'required-description':
          if (currentObj && typeof currentObj === 'object') {
            // Check for missing descriptions in various contexts
            if (path.includes('paths') && currentObj.get && !currentObj.get.description) {
              issues.push({
                type: 'semantic-rule',
                message: rule.message || 'Missing description field',
                path: [...path, 'get', 'description'].join('.'),
                severity: rule.severity,
                rule: rule.name
              });
            }
            if (path.includes('components') && path.includes('schemas') && currentObj.type && !currentObj.description) {
              issues.push({
                type: 'semantic-rule',
                message: rule.message || 'Missing description field',
                path: [...path, 'description'].join('.'),
                severity: rule.severity,
                rule: rule.name
              });
            }
          }
          break;
          
        case 'description-min-length':
          if (currentObj && typeof currentObj === 'object' && currentObj.description && typeof currentObj.description === 'string') {
            const pattern = rule.pattern ? new RegExp(rule.pattern) : /.{10,}/;
            if (!pattern.test(currentObj.description)) {
              issues.push({
                type: 'semantic-rule',
                message: rule.message || 'Description should be at least 10 characters',
                path: [...path, 'description'].join('.'),
                severity: rule.severity,
                rule: rule.name
              });
            }
          }
          break;
          
        case 'version-format':
          if (path.includes('info') && path[path.length - 1] === 'version' && typeof currentObj === 'string') {
            const pattern = rule.pattern ? new RegExp(rule.pattern) : /^\d+\.\d+\.\d+$/;
            if (!pattern.test(currentObj)) {
              issues.push({
                type: 'semantic-rule',
                message: rule.message || 'Version should follow semantic versioning (e.g., 1.0.0)',
                path: path.join('.'),
                suggestion: '1.0.0',
                severity: rule.severity,
                rule: rule.name
              });
            }
          }
          break;
          
        case 'operationid-required':
          if (currentObj && typeof currentObj === 'object' && path.includes('paths')) {
            const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
            httpMethods.forEach(method => {
              if (currentObj[method] && !currentObj[method].operationId) {
                issues.push({
                  type: 'semantic-rule',
                  message: rule.message || 'Missing operationId field',
                  path: [...path, method, 'operationId'].join('.'),
                  severity: rule.severity,
                  rule: rule.name
                });
              }
            });
          }
          break;
          
        case 'http-status-codes':
          if (path.includes('responses') && /^\d{3}$/.test(path[path.length - 1])) {
            const statusCode = parseInt(path[path.length - 1]);
            const validCodes = [200, 201, 202, 204, 300, 301, 302, 304, 400, 401, 403, 404, 409, 422, 429, 500, 501, 502, 503];
            if (!validCodes.includes(statusCode)) {
              issues.push({
                type: 'semantic-rule',
                message: rule.message || 'Non-standard HTTP status code',
                path: path.join('.'),
                severity: rule.severity,
                rule: rule.name
              });
            }
          }
          break;
      }
    });

    // Recursively check nested objects
    if (currentObj && typeof currentObj === 'object') {
      Object.keys(currentObj).forEach(key => {
        checkSemanticRules(currentObj[key], [...path, key]);
      });
    }
  }
  
  // Check for component naming consistency
  function checkComponentNaming(currentObj: any, path: string[] = []) {
    if (currentObj === null || currentObj === undefined) {
      return;
    }

    if (Array.isArray(currentObj)) {
      currentObj.forEach((item, index) => {
        checkComponentNaming(item, [...path, index.toString()]);
      });
    } else if (typeof currentObj === 'object') {
      // Check component names in OpenAPI schemas
      if (path.includes('components') && path.includes('schemas') && path.length >= 3) {
        const componentName = path[path.indexOf('schemas') + 1];
        if (componentName && config?.componentNaming?.enabled) {
          console.log('Component validation:', {
            componentName,
            config: config.componentNaming
          });
          
          const validation = validateNamingConvention(componentName, config.componentNaming);
          
          console.log('Component validation result:', validation);
          
          if (!validation.isValid) {
            issues.push({
              type: 'component-naming',
              path: path.slice(0, path.indexOf('schemas') + 2).join('.'),
              value: componentName,
              suggestedName: validation.suggestion,
              convention: config.componentNaming.caseType,
              message: `Component name "${componentName}" should follow ${config.componentNaming.caseType} convention${validation.suggestion ? `. Suggested: "${validation.suggestion}"` : ''}`,
              severity: 'warning',
              rule: 'Component Naming Convention'
            });
          }
        }
      }
      
      Object.keys(currentObj).forEach(key => {
        checkComponentNaming(currentObj[key], [...path, key]);
      });
    }
  }

  // Check for endpoint path naming consistency
  function checkEndpointNaming(currentObj: any, path: string[] = []) {
    if (currentObj === null || currentObj === undefined) {
      return;
    }

    if (Array.isArray(currentObj)) {
      currentObj.forEach((item, index) => {
        checkEndpointNaming(item, [...path, index.toString()]);
      });
    } else if (typeof currentObj === 'object') {
      // Check endpoint paths
      if (path.includes('paths') && path.length === 2 && path[0] === 'paths') {
        const endpointPath = path[1];
        if (endpointPath && config?.endpointNaming?.enabled) {
          // Extract path segments (excluding parameters like {id})
          const pathSegments = endpointPath.split('/').filter(segment => 
            segment && !segment.startsWith('{') && !segment.endsWith('}')
          );
          
          pathSegments.forEach(segment => {
            console.log('Endpoint validation:', {
              segment,
              endpointPath,
              config: config.endpointNaming
            });
            
            const validation = validateNamingConvention(segment, config.endpointNaming);
            
            console.log('Endpoint validation result:', validation);
            
            if (!validation.isValid) {
              issues.push({
                type: 'endpoint-naming',
                path: path.join('.'),
                value: segment,
                suggestedName: validation.suggestion,
                convention: config.endpointNaming.caseType,
                message: `Endpoint path segment "${segment}" in "${endpointPath}" should follow ${config.endpointNaming.caseType} convention${validation.suggestion ? `. Suggested: "${validation.suggestion}"` : ''}`,
                severity: 'warning',
                rule: 'Endpoint Naming Convention'
              });
            }
          });
        }
      }
      
      Object.keys(currentObj).forEach(key => {
        checkEndpointNaming(currentObj[key], [...path, key]);
      });
    }
  }

  // Check for property naming consistency
  function checkPropertyNaming(currentObj: any, path: string[] = []) {
    if (currentObj === null || currentObj === undefined) {
      return;
    }

    if (Array.isArray(currentObj)) {
      currentObj.forEach((item, index) => {
        checkPropertyNaming(item, [...path, index.toString()]);
      });
    } else if (typeof currentObj === 'object') {
      // Check properties within schema objects
      if (path.includes('properties') && path.length >= 2) {
        const propertyName = path[path.length - 1];
        // Make sure we're actually looking at a property name, not a nested object key
        if (path[path.length - 2] === 'properties' && config?.propertyNaming?.enabled) {
          console.log('Property validation:', {
            propertyName,
            path: path.join('.'),
            config: config.propertyNaming
          });
          
          const validation = validateNamingConvention(propertyName, config.propertyNaming);
          
          console.log('Property validation result:', validation);
          
          if (!validation.isValid) {
            issues.push({
              type: 'property-naming',
              path: path.join('.'),
              value: propertyName,
              suggestedName: validation.suggestion,
              convention: config.propertyNaming.caseType,
              message: `Property name "${propertyName}" should follow ${config.propertyNaming.caseType} convention${validation.suggestion ? `. Suggested: "${validation.suggestion}"` : ''}`,
              severity: 'warning',
              rule: 'Property Naming Convention'
            });
          }
        }
      }
      
      Object.keys(currentObj).forEach(key => {
        checkPropertyNaming(currentObj[key], [...path, key]);
      });
    }
  }
  
  // Run all checks
  console.log('Running all consistency checks with config:', config);
  checkParameterNaming(obj);
  checkComponentNaming(obj);
  checkEndpointNaming(obj);
  checkPropertyNaming(obj);
  checkExamples(obj);
  checkSemanticRules(obj);
  
  console.log('Total issues found:', issues.length);
  
  return issues;
}