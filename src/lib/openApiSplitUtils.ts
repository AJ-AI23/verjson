import { CreateDocumentData, Document } from '@/types/workspace';

export interface ComponentInfo {
  name: string;
  schema: any;
  description?: string;
}

export interface SplitResult {
  updatedSchema: any;
  createdDocuments: Document[];
  componentDocumentMap: Map<string, string>;
}

/**
 * Extract available components from an OpenAPI specification
 */
export const extractComponents = (schema: any): ComponentInfo[] => {
  if (!schema?.components?.schemas) {
    return [];
  }

  const components: ComponentInfo[] = [];
  const schemas = schema.components.schemas;

  for (const [name, componentSchema] of Object.entries(schemas)) {
    if (componentSchema && typeof componentSchema === 'object') {
      components.push({
        name,
        schema: componentSchema,
        description: (componentSchema as any).description || undefined
      });
    }
  }

  return components.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Generate a JSON schema document for a component
 */
const createComponentJsonSchema = (componentName: string, componentSchema: any): any => {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${componentName}.json`,
    title: componentName,
    ...componentSchema
  };
};

/**
 * Update all references in a schema object to point to document URLs
 */
const updateReferences = (obj: any, componentDocumentMap: Map<string, string>): any => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => updateReferences(item, componentDocumentMap));
  }

  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref' && typeof value === 'string') {
      // Check if this is a reference to a component we're splitting
      const refMatch = value.match(/^#\/components\/schemas\/(.+)$/);
      if (refMatch) {
        const componentName = refMatch[1];
        const documentId = componentDocumentMap.get(componentName);
        if (documentId) {
          // Replace with external document reference using a clear format
          result[key] = `doc://${documentId}#/`;
        } else {
          // Keep original reference for components not being split
          result[key] = value;
        }
      } else {
        // Keep non-component references as-is
        result[key] = value;
      }
    } else if (value && typeof value === 'object') {
      result[key] = updateReferences(value, componentDocumentMap);
    } else {
      result[key] = value;
    }
  }

  return result;
};

/**
 * Split an OpenAPI specification by extracting components to separate documents
 */
export const splitOpenAPISpec = async (
  originalSchema: any,
  selectedComponentNames: string[],
  targetWorkspaceId: string,
  createDocument: (data: CreateDocumentData) => Promise<Document | null>
): Promise<SplitResult> => {
  const componentDocumentMap = new Map<string, string>();
  const createdDocuments: Document[] = [];

  // Step 1: Create JSON schema documents for each selected component
  for (const componentName of selectedComponentNames) {
    const componentSchema = originalSchema.components?.schemas?.[componentName];
    if (!componentSchema) {
      throw new Error(`Component "${componentName}" not found in schema`);
    }

    // Create JSON schema document
    const jsonSchemaContent = createComponentJsonSchema(componentName, componentSchema);
    
    const documentData: CreateDocumentData = {
      workspace_id: targetWorkspaceId,
      name: `${componentName}.json`,
      content: jsonSchemaContent,
      file_type: 'json-schema'
    };

    const createdDocument = await createDocument(documentData);
    if (!createdDocument) {
      throw new Error(`Failed to create document for component "${componentName}"`);
    }

    componentDocumentMap.set(componentName, createdDocument.id);
    createdDocuments.push(createdDocument);
  }

  // Step 2: Create updated OpenAPI schema with references replaced
  const updatedSchema = JSON.parse(JSON.stringify(originalSchema));

  // Remove the split components from the components.schemas section
  if (updatedSchema.components?.schemas) {
    for (const componentName of selectedComponentNames) {
      delete updatedSchema.components.schemas[componentName];
    }

    // If no components remain, remove the entire schemas section
    if (Object.keys(updatedSchema.components.schemas).length === 0) {
      delete updatedSchema.components.schemas;
      
      // If no other components sections remain, remove the entire components section
      if (!updatedSchema.components || Object.keys(updatedSchema.components).length === 0) {
        delete updatedSchema.components;
      }
    }
  }

  // Step 3: Update all references throughout the schema
  const updatedSchemaWithRefs = updateReferences(updatedSchema, componentDocumentMap);

  return {
    updatedSchema: updatedSchemaWithRefs,
    createdDocuments,
    componentDocumentMap
  };
};

/**
 * Validate that a schema is a valid OpenAPI specification with components
 */
export const validateOpenAPIForSplit = (schema: any): { isValid: boolean; error?: string } => {
  if (!schema || typeof schema !== 'object') {
    return { isValid: false, error: 'Schema must be a valid JSON object' };
  }

  if (!schema.openapi && !schema.swagger) {
    return { isValid: false, error: 'Schema must be an OpenAPI or Swagger specification' };
  }

  if (!schema.components?.schemas) {
    return { isValid: false, error: 'Schema must contain components.schemas section to split' };
  }

  const componentCount = Object.keys(schema.components.schemas).length;
  if (componentCount === 0) {
    return { isValid: false, error: 'No components found in schemas section' };
  }

  return { isValid: true };
};
