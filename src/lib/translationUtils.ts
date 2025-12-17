import type { ConsistencyIssue } from '@/types/consistency';

export interface TranslationEntry {
  key: string;
  value: string;
  path: string[];
}

// Re-export ConsistencyIssue for backward compatibility
export type { ConsistencyIssue };

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

// Merge multiple translation files back into a single translation index
export function mergeTranslationFiles(translationFiles: Record<string, Record<string, string>>): Record<string, string> {
  const mergedTranslations: Record<string, string> = {};
  
  Object.values(translationFiles).forEach(fileTranslations => {
    Object.entries(fileTranslations).forEach(([key, value]) => {
      mergedTranslations[key] = value;
    });
  });
  
  return mergedTranslations;
}

// Apply merged translations to original document content
export function applyTranslationsToDocument(originalDocument: any, mergedTranslations: Record<string, string>): any {
  const result = JSON.parse(JSON.stringify(originalDocument)); // Deep clone
  
  Object.entries(mergedTranslations).forEach(([keyPath, translatedValue]) => {
    // Convert dot notation path back to nested object access
    const pathParts = keyPath.split('.');
    let current = result;
    
    // Navigate to the parent of the final property
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        // Path doesn't exist in the original document, skip this translation
        return;
      }
    }
    
    // Set the translated value
    const finalProperty = pathParts[pathParts.length - 1];
    if (current && typeof current === 'object' && finalProperty in current) {
      current[finalProperty] = translatedValue;
    }
  });
  
  return result;
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
  function validateNamingConvention(name: string, convention: any, actualMethod?: string): { isValid: boolean; suggestion?: string } {
    console.log('validateNamingConvention called with:', { name, convention, actualMethod });
    
    if (!convention || convention.exclusions?.includes(name)) {
      console.log('Convention not defined or name in exclusions, returning valid');
      return { isValid: true };
    }

    // Only validate if caseType is explicitly defined
    if (!convention.caseType) {
      console.log('No caseType defined, returning valid');
      return { isValid: true };
    }

    // If alternatives are defined, check if name matches any alternative
    if (convention.alternatives && convention.alternatives.length > 0) {
      // Filter alternatives by method if provided
      const matchingAlternatives = convention.alternatives.filter((alt: any) => 
        !alt.method || !actualMethod || alt.method.toUpperCase() === actualMethod.toUpperCase()
      );

      for (const alternative of matchingAlternatives) {
        const altConvention = {
          ...convention,
          prefix: alternative.prefix,
          suffix: alternative.suffix,
          // pass through all alternatives so trimming can remove any known prefix/suffix
          alternatives: convention.alternatives,
        };
        const result = validateNamingConventionSingle(name, altConvention);
        if (result.isValid) {
          return { isValid: true };
        }
      }
      
      // If no alternatives matched, return the suggestion for the best matching alternative
      const bestAlternative = matchingAlternatives.length > 0 ? matchingAlternatives[0] : convention.alternatives[0];
      const bestAltConvention = {
        ...convention,
        prefix: bestAlternative.prefix,
        suffix: bestAlternative.suffix,
        alternatives: convention.alternatives,
      };
      return validateNamingConventionSingle(name, bestAltConvention);
    }

    return validateNamingConventionSingle(name, convention);
  }

  // Helper function to validate naming convention for a single prefix/suffix combination
  function validateNamingConventionSingle(name: string, convention: any): { isValid: boolean; suggestion?: string } {

    // Helper function to trim prefix/suffix case-insensitively
    function trimPrefixSuffix(inputName: string, prefix?: string, suffix?: string, allPrefixes?: string[], allSuffixes?: string[]): string {
      let trimmed = inputName;

      // Remove any known prefix (longest match first) case-insensitively
      if (allPrefixes && allPrefixes.length > 0) {
        const sorted = [...allPrefixes].filter(Boolean).sort((a, b) => b.length - a.length);
        for (const p of sorted) {
          const regex = new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, 'i');
          if (regex.test(trimmed)) {
            trimmed = trimmed.substring(p.length);
            break;
          }
        }
      }
      
      // Fallback: remove specific prefix if still present
      if (prefix) {
        const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, 'i');
        if (regex.test(trimmed)) {
          trimmed = trimmed.substring(prefix.length);
        }
      }
      
      // Remove any known suffix (longest match first) case-insensitively
      if (allSuffixes && allSuffixes.length > 0) {
        const sorted = [...allSuffixes].filter(Boolean).sort((a, b) => b.length - a.length);
        for (const s of sorted) {
          const regex = new RegExp(`${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, 'i');
          if (regex.test(trimmed)) {
            trimmed = trimmed.substring(0, trimmed.length - s.length);
            break;
          }
        }
      }
      
      // Fallback: remove specific suffix if still present
      if (suffix) {
        const regex = new RegExp(`${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, 'i');
        if (regex.test(trimmed)) {
          trimmed = trimmed.substring(0, trimmed.length - suffix.length);
        }
      }
      
      return trimmed;
    }

    // Extract base name for case conversion, trimming any existing prefix/suffix
    const allPrefixes: string[] | undefined = convention.alternatives?.map((a: any) => a.prefix).filter(Boolean);
    const allSuffixes: string[] | undefined = convention.alternatives?.map((a: any) => a.suffix).filter(Boolean);
    let baseName = trimPrefixSuffix(name, convention.prefix, convention.suffix, allPrefixes, allSuffixes);

    const caseType = convention.caseType;
    let pattern: RegExp;
    let suggestion = '';

    switch (caseType) {
      case 'kebab-case':
        pattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
        suggestion = baseName.replace(/[A-Z]/g, (match, offset) => 
          offset > 0 ? `-${match.toLowerCase()}` : match.toLowerCase()
        ).replace(/[_]/g, '-').replace(/[^a-z0-9-]/g, '');
        break;
      case 'camelCase':
        pattern = /^[a-z][a-zA-Z0-9]*$/;
        suggestion = baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, (match, offset) =>
          offset === 0 ? match.toLowerCase() : match.toUpperCase()
        ).replace(/\s/g, '');
        break;
      case 'snake_case':
        pattern = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
        suggestion = baseName.replace(/[A-Z]/g, (match, offset) => 
          offset > 0 ? `_${match.toLowerCase()}` : match.toLowerCase()
        ).replace(/[-]/g, '_').replace(/[^a-z0-9_]/g, '');
        break;
      case 'PascalCase':
        pattern = /^[A-Z][a-zA-Z0-9]*$/;
        suggestion = baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, match => 
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

    // Check if current name (after proper trimming) meets the case pattern
    const currentBaseName = trimPrefixSuffix(name, convention.prefix, convention.suffix);
    let isValidCase = true;
    let hasCorrectPrefixSuffix = true;

    // For camelCase and snake_case, be lenient with the first character after prefix removal
    // Allow it to be uppercase if there's a prefix, since patterns like "createUser" are common
    let testBaseName = currentBaseName;
    if ((caseType === 'camelCase' || caseType === 'snake_case') && convention.prefix && currentBaseName.length > 0) {
      // Convert first char to lowercase for the pattern test
      testBaseName = currentBaseName.charAt(0).toLowerCase() + currentBaseName.slice(1);
    }

    // Check case pattern
    if (pattern && !pattern.test(testBaseName)) {
      isValidCase = false;
    }

    // Check prefix requirement (case-sensitive)
    if (convention.prefix && !name.startsWith(convention.prefix)) {
      hasCorrectPrefixSuffix = false;
    }

    // Check suffix requirement (case-sensitive)
    if (convention.suffix && !name.endsWith(convention.suffix)) {
      hasCorrectPrefixSuffix = false;
    }

    const isValid = isValidCase && hasCorrectPrefixSuffix;
    
    // Always generate suggestion when invalid
    if (!isValid) {
      suggestion = (convention.prefix || '') + suggestion + (convention.suffix || '');
    }
    
    console.log('Pattern test result:', { 
      caseType, 
      pattern: pattern?.source, 
      name, 
      baseName,
      currentBaseName,
      testBaseName,
      isValidCase,
      hasCorrectPrefixSuffix,
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
        
        // Skip header parameters - they should not be checked for naming conventions
        if (paramType === 'header') {
          return;
        }
        
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
                message: `Example value "${exampleValue}" matches known enum values but parent object lacks enum definition. Consider adding: "enum": [${uniqueEnums.map(v => `"${v}"`).join(', ')}]`,
                severity: 'info'
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

  // Check for operationId naming consistency
  function checkOperationIdNaming(currentObj: any, path: string[] = [], httpMethod?: string) {
    if (currentObj === null || currentObj === undefined) {
      return;
    }

    if (Array.isArray(currentObj)) {
      currentObj.forEach((item, index) => {
        checkOperationIdNaming(item, [...path, index.toString()], httpMethod);
      });
    } else if (typeof currentObj === 'object') {
      // Check if this is an operation object with an operationId
      if (currentObj.operationId && typeof currentObj.operationId === 'string' && 
          config?.operationIdNaming?.enabled) {
        const operationId = currentObj.operationId;
        
        console.log('OperationId validation:', {
          operationId,
          httpMethod,
          config: config.operationIdNaming
        });
        
        const validation = validateNamingConvention(operationId, config.operationIdNaming, httpMethod);
        
        console.log('OperationId validation result:', validation);
        
        if (!validation.isValid) {
          const methodInfo = httpMethod ? ` for ${httpMethod}` : '';
          const altCount = config.operationIdNaming.alternatives?.length || 0;
          issues.push({
            type: 'operationid-naming',
            path: [...path, 'operationId'].join('.'),
            value: operationId,
            suggestedName: validation.suggestion,
            convention: config.operationIdNaming.caseType,
            message: `OperationId "${operationId}" should follow ${config.operationIdNaming.caseType} convention${methodInfo}${validation.suggestion ? `. Suggested: "${validation.suggestion}"` : ''}${altCount > 0 ? ` (checking against ${altCount} alternative(s))` : ''}`,
            severity: 'warning',
            rule: 'OperationId Naming Convention'
          });
        }
      }
      
      // Check if we're in a paths object - extract HTTP method
      const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];
      Object.keys(currentObj).forEach(key => {
        const newHttpMethod = httpMethods.includes(key.toLowerCase()) ? key.toUpperCase() : httpMethod;
        checkOperationIdNaming(currentObj[key], [...path, key], newHttpMethod);
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

  // Generate a structural hash of an object (based on property names and types)
  // Similar to the approach used in documentMergeEngine for consistency
  function structureHash(obj: any, depth: number = 0, maxDepth: number = 3): string {
    if (depth > maxDepth || !obj || typeof obj !== 'object') {
      return typeof obj;
    }
    
    // Handle $ref - we don't hash references
    if (obj.$ref) {
      return `$ref:${obj.$ref}`;
    }
    
    if (Array.isArray(obj)) {
      // For arrays, hash the structure of first few items
      const samples = obj.slice(0, 3).map(item => structureHash(item, depth + 1, maxDepth));
      return `[${samples.join(',')}]`;
    }
    
    const keys = Object.keys(obj).sort();
    const signature = keys.map(key => {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        // Recursively hash nested objects
        return `${key}:{${structureHash(value, depth + 1, maxDepth)}}`;
      }
      return `${key}:${typeof value}`;
    }).join('|');
    
    return signature;
  }

  // Check for broken component references
  function checkBrokenReferences(currentObj: any, path: string[] = []) {
    if (currentObj === null || currentObj === undefined) {
      return;
    }

    // Collect all available component definitions
    const availableComponents = new Set<string>();
    
    // OpenAPI 3.x components
    if (obj.components?.schemas) {
      Object.keys(obj.components.schemas).forEach(name => {
        availableComponents.add(`#/components/schemas/${name}`);
      });
    }
    
    // JSON Schema definitions (older OpenAPI 2.x and JSON Schema)
    if (obj.definitions) {
      Object.keys(obj.definitions).forEach(name => {
        availableComponents.add(`#/definitions/${name}`);
      });
    }

    // JSON Schema $defs (newer JSON Schema)
    if (obj.$defs) {
      Object.keys(obj.$defs).forEach(name => {
        availableComponents.add(`#/$defs/${name}`);
      });
    }

    // Recursively find all $ref properties
    function findReferences(currentObj: any, path: string[] = []) {
      if (currentObj === null || currentObj === undefined) {
        return;
      }

      if (Array.isArray(currentObj)) {
        currentObj.forEach((item, index) => {
          findReferences(item, [...path, index.toString()]);
        });
      } else if (typeof currentObj === 'object') {
        Object.keys(currentObj).forEach(key => {
          if (key === '$ref' && typeof currentObj[key] === 'string') {
            const refValue = currentObj[key];
            
            // Only validate internal references (starting with #/)
            if (refValue.startsWith('#/')) {
              if (!availableComponents.has(refValue)) {
                issues.push({
                  type: 'broken-reference',
                  path: [...path, '$ref'].join('.'),
                  value: refValue,
                  message: `Reference "${refValue}" points to a non-existent component`,
                  severity: 'error',
                  rule: 'Broken Component Reference'
                });
              }
            }
          } else {
            findReferences(currentObj[key], [...path, key]);
          }
        });
      }
    }

    findReferences(currentObj, path);
  }

  // Format structure for display
  function formatStructureDisplay(schema: any, indent = 0): string {
    if (!schema || typeof schema !== 'object') {
      return '';
    }

    const indentation = '  '.repeat(indent);
    let result = '';

    if (schema.type === 'object' && schema.properties) {
      result += `${indentation}type: object\n`;
      if (schema.required && schema.required.length > 0) {
        result += `${indentation}required: [${schema.required.join(', ')}]\n`;
      }
      result += `${indentation}properties:\n`;
      Object.keys(schema.properties).forEach(propName => {
        const prop = schema.properties[propName];
        result += `${indentation}  ${propName}:\n`;
        if (prop.type === 'object') {
          result += formatStructureDisplay(prop, indent + 2);
        } else if (prop.type === 'array') {
          result += `${indentation}    type: array\n`;
          if (prop.items?.type) {
            result += `${indentation}    items: ${prop.items.type}${prop.items.format ? ` (${prop.items.format})` : ''}\n`;
          }
        } else {
          result += `${indentation}    type: ${prop.type}${prop.format ? ` (${prop.format})` : ''}${prop.enum ? ` [${prop.enum.join(', ')}]` : ''}\n`;
        }
      });
    } else if (schema.type === 'array' && schema.items) {
      result += `${indentation}type: array\n`;
      result += `${indentation}items:\n`;
      result += formatStructureDisplay(schema.items, indent + 1);
    } else {
      result += `${indentation}type: ${schema.type}${schema.format ? ` (${schema.format})` : ''}${schema.enum ? ` [${schema.enum.join(', ')}]` : ''}\n`;
    }

    return result;
  }

  // Check for duplicate components using two-pass hash-based approach
  function checkDuplicateComponents() {
    // Pass 1: Calculate hash for all components and group by hash
    const componentsByHash = new Map<string, Array<{ path: string; name: string; schema: any }>>();
    
    const componentSources = [
      { path: 'components.schemas', data: obj.components?.schemas },
      { path: 'definitions', data: obj.definitions },
      { path: '$defs', data: obj.$defs }
    ];

    componentSources.forEach(({ path, data }) => {
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(componentName => {
          const schema = data[componentName];
          const hash = structureHash(schema, 0, 4); // Use depth 4 for more accuracy
          
          if (!hash) return; // Skip if can't generate hash
          
          if (!componentsByHash.has(hash)) {
            componentsByHash.set(hash, []);
          }
          
          componentsByHash.get(hash)!.push({
            path: `${path}.${componentName}`,
            name: componentName,
            schema
          });
        });
      }
    });

    // Pass 2: Report duplicates (only once per group)
    componentsByHash.forEach((components, hash) => {
      if (components.length > 1) {
        // Sort by path to have consistent ordering
        components.sort((a, b) => a.path.localeCompare(b.path));
        
        // Use first component as the "canonical" one
        const [first, ...duplicates] = components;
        const structureDisplay = formatStructureDisplay(first.schema);
        
        // Report each duplicate only once (pointing to the first one)
        duplicates.forEach(duplicate => {
          issues.push({
            type: 'duplicate-component',
            path: duplicate.path,
            message: `Component has identical structure to "${first.path}"`,
            details: `Duplicate structure:\n\`\`\`\n${structureDisplay}\`\`\``,
            suggestion: `Consider removing this duplicate and using a $ref to "${first.path}" instead`,
            severity: 'warning',
            rule: 'Duplicate Component Structure'
          });
        });
      }
    });
  }

  // Check for inline structures that could be component references (using hash-based matching)
  function checkInlineStructures() {
    // Pass 1: Build hash map of all existing components
    const componentHashMap = new Map<string, { ref: string; schema: any }>();
    
    const componentSources = [
      { prefix: '#/components/schemas/', data: obj.components?.schemas },
      { prefix: '#/definitions/', data: obj.definitions },
      { prefix: '#/$defs/', data: obj.$defs }
    ];

    componentSources.forEach(({ prefix, data }) => {
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(componentName => {
          const schema = data[componentName];
          const hash = structureHash(schema, 0, 4);
          if (hash) {
            // Only keep first occurrence of each hash
            if (!componentHashMap.has(hash)) {
              componentHashMap.set(hash, {
                ref: `${prefix}${componentName}`,
                schema
              });
            }
          }
        });
      }
    });

    // Pass 2: Recursively find inline object definitions and check against hash map
    function findInlineObjects(currentObj: any, path: string[] = []) {
      if (!currentObj || typeof currentObj !== 'object') {
        return;
      }

      // Skip if this is a reference
      if (currentObj.$ref) {
        return;
      }

      // Check if this is an inline object with properties (at least 3 properties to be meaningful)
      if (currentObj.type === 'object' && currentObj.properties && Object.keys(currentObj.properties).length >= 3) {
        const currentPath = path.join('.');
        
        // Don't report if we're inside the component definitions themselves
        if (!currentPath.startsWith('components.schemas') && 
            !currentPath.startsWith('definitions') && 
            !currentPath.startsWith('$defs')) {
          
          const inlineHash = structureHash(currentObj, 0, 4);
          if (inlineHash && componentHashMap.has(inlineHash)) {
            const { ref, schema } = componentHashMap.get(inlineHash)!;
            const structureDisplay = formatStructureDisplay(schema);
            
            issues.push({
              type: 'inline-structure',
              path: currentPath,
              message: `Inline structure matches existing component "${ref}"`,
              details: `Matching structure:\n\`\`\`\n${structureDisplay}\`\`\``,
              suggestion: `Replace with $ref: "${ref}"`,
              severity: 'info',
              rule: 'Reusable Inline Structure'
            });
          }
        }
      }

      // Recurse into nested structures
      if (Array.isArray(currentObj)) {
        currentObj.forEach((item, index) => {
          findInlineObjects(item, [...path, index.toString()]);
        });
      } else {
        Object.keys(currentObj).forEach(key => {
          findInlineObjects(currentObj[key], [...path, key]);
        });
      }
    }

    findInlineObjects(obj);
  }
  
  // Check for missing examples in properties (excluding object types)
  function checkMissingExamples(currentObj: any, path: string[] = []) {
    if (currentObj === null || currentObj === undefined) {
      return;
    }

    if (Array.isArray(currentObj)) {
      currentObj.forEach((item, index) => {
        checkMissingExamples(item, [...path, index.toString()]);
      });
    } else if (typeof currentObj === 'object') {
      // Check if this is a schema property definition with a type that should have an example
      const isSchemaProperty = currentObj.type && typeof currentObj.type === 'string';
      const hasExample = currentObj.example !== undefined || currentObj.examples !== undefined;
      const isObjectType = currentObj.type === 'object';
      const isArrayOfObjects = currentObj.type === 'array' && currentObj.items?.type === 'object';
      const hasRef = currentObj.$ref !== undefined;
      const hasEnum = Array.isArray(currentObj.enum) && currentObj.enum.length > 0;
      
      // Only check properties that are not objects, not references, and don't have enums (which serve as implicit examples)
      if (isSchemaProperty && !hasExample && !isObjectType && !isArrayOfObjects && !hasRef && !hasEnum) {
        // Only report if we're in a meaningful context (properties, parameters, requestBody, response content)
        const pathStr = path.join('.');
        const isInProperties = path.includes('properties');
        const isParameter = path.includes('parameters');
        const isRequestBody = path.includes('requestBody');
        const isResponse = path.includes('responses');
        
        if (isInProperties || isParameter || isRequestBody || isResponse) {
          const propertyName = path[path.length - 1];
          const typeInfo = currentObj.format ? `${currentObj.type} (${currentObj.format})` : currentObj.type;
          
          issues.push({
            type: 'missing-example',
            path: pathStr,
            value: propertyName,
            message: `Property "${propertyName}" of type "${typeInfo}" is missing an example value`,
            severity: 'info',
            rule: 'Missing Example'
          });
        }
      }
      
      Object.keys(currentObj).forEach(key => {
        checkMissingExamples(currentObj[key], [...path, key]);
      });
    }
  }

  // Run all checks
  console.log('Running all consistency checks with config:', config);
  checkParameterNaming(obj);
  checkComponentNaming(obj);
  checkEndpointNaming(obj);
  checkOperationIdNaming(obj);
  checkPropertyNaming(obj);
  checkExamples(obj);
  checkMissingExamples(obj);
  checkSemanticRules(obj);
  checkBrokenReferences(obj);
  checkDuplicateComponents();
  checkInlineStructures();
  
  console.log('Total issues found before deduplication:', issues.length);
  
  // Deduplicate issues based on path, type, and message to avoid showing duplicates
  const uniqueIssues = issues.filter((issue, index, self) => 
    index === self.findIndex(other => 
      other.path === issue.path && 
      other.type === issue.type && 
      other.message === issue.message
    )
  );
  
  console.log('Total issues found after deduplication:', uniqueIssues.length);
  
  return uniqueIssues;
}