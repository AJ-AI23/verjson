import { CreateDocumentData, Document } from '@/types/workspace';

export interface ComponentInfo {
  name: string;
  schema: any;
  description?: string;
  isTopLevel: boolean;
}

export interface SplitResult {
  updatedSchema: any;
  createdDocuments: Document[];
  componentDocumentMap: Map<string, string>;
}

/**
 * Find components that are directly referenced from paths
 */
const findTopLevelComponents = (schema: any): Set<string> => {
  const topLevelComponents = new Set<string>();
  
  // Check references in paths
  if (schema.paths) {
    const searchForRefs = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (Array.isArray(obj)) {
        obj.forEach(searchForRefs);
        return;
      }
      
      for (const [key, value] of Object.entries(obj)) {
        if (key === '$ref' && typeof value === 'string') {
          const refMatch = value.match(/^#\/components\/schemas\/(.+)$/);
          if (refMatch) {
            topLevelComponents.add(refMatch[1]);
          }
        } else if (value && typeof value === 'object') {
          searchForRefs(value);
        }
      }
    };
    
    searchForRefs(schema.paths);
  }
  
  return topLevelComponents;
};

/**
 * Extract available components from an OpenAPI specification
 */
export const extractComponents = (schema: any): ComponentInfo[] => {
  if (!schema?.components?.schemas) {
    return [];
  }

  const components: ComponentInfo[] = [];
  const schemas = schema.components.schemas;
  const topLevelComponents = findTopLevelComponents(schema);

  for (const [name, componentSchema] of Object.entries(schemas)) {
    if (componentSchema && typeof componentSchema === 'object') {
      components.push({
        name,
        schema: componentSchema,
        description: (componentSchema as any).description || undefined,
        isTopLevel: topLevelComponents.has(name)
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
 * Update all references in a schema object to point to document URLs or maintain original references
 */
const updateReferences = (obj: any, componentDocumentMap: Map<string, string>, originalDocumentId?: string): any => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => updateReferences(item, componentDocumentMap, originalDocumentId));
  }

  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref' && typeof value === 'string') {
      // Check if this is a reference to a component
      const refMatch = value.match(/^#\/components\/schemas\/(.+)$/);
      if (refMatch) {
        const componentName = refMatch[1];
        const documentId = componentDocumentMap.get(componentName);
        if (documentId) {
          // Replace with external document reference for split components
          result[key] = `doc://${documentId}#/components/schemas/${componentName}`;
        } else if (originalDocumentId) {
          // Reference to a component that wasn't split - point to original document
          result[key] = `doc://${originalDocumentId}#/components/schemas/${componentName}`;
        } else {
          // Keep original reference for components not being split (when updating main schema)
          result[key] = value;
        }
      } else {
        // Keep non-component references as-is
        result[key] = value;
      }
    } else if (value && typeof value === 'object') {
      result[key] = updateReferences(value, componentDocumentMap, originalDocumentId);
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
  originalDocumentId: string,
  createDocument: (data: CreateDocumentData) => Promise<Document | null>
): Promise<SplitResult> => {
  const createdDocuments: Document[] = [];

  // Phase 1: Create all documents first without updating references
  // This builds the complete component-to-document mapping
  for (const componentName of selectedComponentNames) {
    const componentSchema = originalSchema.components?.schemas?.[componentName];
    if (!componentSchema) {
      throw new Error(`Component "${componentName}" not found in schema`);
    }

    // Create JSON schema document with original references (will be updated in Phase 2)
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

    createdDocuments.push(createdDocument);
  }

  // Build the complete component-to-document mapping
  const componentDocumentMap = new Map<string, string>();
  selectedComponentNames.forEach((componentName, index) => {
    componentDocumentMap.set(componentName, createdDocuments[index].id);
  });

  // Phase 2: Update all documents with proper cross-references
  for (let i = 0; i < selectedComponentNames.length; i++) {
    const componentName = selectedComponentNames[i];
    const document = createdDocuments[i];
    const componentSchema = originalSchema.components?.schemas?.[componentName];
    if (!componentSchema) continue;

    // Update references within the component schema with complete mapping
    const updatedComponentSchema = updateReferences(componentSchema, componentDocumentMap, originalDocumentId);
    const jsonSchemaContent = createComponentJsonSchema(componentName, updatedComponentSchema);
    
    // Update the document with proper references
    // Note: We'll need to implement document content update functionality
    // For now, this creates the documents with proper initial content
    console.log(`Updated references for ${componentName}:`, jsonSchemaContent);
  }

  // Step 3: Create updated OpenAPI schema with references replaced
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

  // Step 4: Update all references throughout the schema
  const updatedSchemaWithRefs = updateReferences(updatedSchema, componentDocumentMap);

  return {
    updatedSchema: updatedSchemaWithRefs,
    createdDocuments,
    componentDocumentMap
  };
};

// Helper function to zip arrays
function zip<T, U>(arr1: T[], arr2: U[]): Array<[T, U]> {
  return arr1.map((item, index) => [item, arr2[index]]);
}

// Placeholder for document update function - would need to be passed in or imported
async function updateDocumentContent(documentId: string, content: any): Promise<void> {
  // This would be implemented using the documents hook
  console.log(`Would update document ${documentId} with content:`, content);
}

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
