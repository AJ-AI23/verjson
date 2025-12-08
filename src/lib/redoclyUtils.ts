// Redocly CDN integration utilities

declare global {
  interface Window {
    RedocStandalone: any;
  }
}

// Cache for loaded Redocly library
let redoclyLoaded = false;
let redoclyPromise: Promise<void> | null = null;

/**
 * Dynamically load the Redocly standalone library from CDN
 */
export const loadRedocly = async (): Promise<void> => {
  if (redoclyLoaded) {
    return Promise.resolve();
  }

  if (redoclyPromise) {
    return redoclyPromise;
  }

  redoclyPromise = new Promise((resolve, reject) => {
    // Create script element for Redocly standalone
    const script = document.createElement('script');
    script.src = 'https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js';
    script.async = true;

    script.onload = () => {
      // Wait for the global to be available
      const checkGlobal = (attempts = 0) => {
        const possibleGlobals = ['Redoc', 'RedocStandalone', 'redoc'];
        let redocGlobal = null;
        
        for (const globalName of possibleGlobals) {
          if ((window as any)[globalName]) {
            redocGlobal = (window as any)[globalName];
            console.log(`Found Redoc global as: ${globalName}`, redocGlobal);
            break;
          }
        }

        if (redocGlobal) {
          (window as any).RedocStandalone = redocGlobal;
          redoclyLoaded = true;
          resolve();
        } else if (attempts < 10) {
          setTimeout(() => checkGlobal(attempts + 1), 100);
        } else {
          const allKeys = Object.keys(window).filter(k => k.toLowerCase().includes('redoc'));
          console.error('Available redoc-related window keys:', allKeys);
          redoclyPromise = null;
          reject(new Error('Redocly library loaded but no global found after 10 attempts'));
        }
      };
      checkGlobal();
    };

    script.onerror = (error) => {
      console.error('Script loading error:', error);
      redoclyPromise = null;
      reject(new Error('Failed to load Redocly library from CDN'));
    };

    document.head.appendChild(script);
  });

  return redoclyPromise;
};

/**
 * Validate if the provided schema is a valid OpenAPI specification
 */
export const validateOpenAPISpec = (schema: any): { isValid: boolean; error?: string } => {
  if (!schema || typeof schema !== 'object') {
    return { isValid: false, error: 'Schema must be a valid JSON object' };
  }

  // Check for OpenAPI version
  if (!schema.openapi && !schema.swagger) {
    return { isValid: false, error: 'Schema must contain "openapi" or "swagger" version field' };
  }

  // Check for required OpenAPI 3.x fields
  if (schema.openapi) {
    if (!schema.info) {
      return { isValid: false, error: 'OpenAPI schema must contain "info" section' };
    }

    if (!schema.info.title) {
      return { isValid: false, error: 'OpenAPI schema must contain "info.title"' };
    }

    if (!schema.info.version) {
      return { isValid: false, error: 'OpenAPI schema must contain "info.version"' };
    }

    // Paths or components are required (can have either)
    if (!schema.paths && !schema.components) {
      return { isValid: false, error: 'OpenAPI schema must contain either "paths" or "components"' };
    }
  }

  // Check for Swagger 2.0 fields
  if (schema.swagger) {
    if (!schema.info || !schema.info.title || !schema.info.version) {
      return { isValid: false, error: 'Swagger schema must contain "info" section with "title" and "version"' };
    }

    if (!schema.paths) {
      return { isValid: false, error: 'Swagger schema must contain "paths" section' };
    }
  }

  return { isValid: true };
};

/**
 * Prepare OpenAPI schema for Redocly rendering
 */
export const prepareSchemaForRedocly = (schema: any): any => {
  // Clone the schema to avoid mutations
  const preparedSchema = JSON.parse(JSON.stringify(schema));

  // Ensure OpenAPI version is set if missing
  if (!preparedSchema.openapi && !preparedSchema.swagger) {
    preparedSchema.openapi = '3.0.0';
  }

  // Ensure minimum required fields for Redocly
  if (!preparedSchema.info) {
    preparedSchema.info = {
      title: 'API Documentation',
      version: '1.0.0',
      description: 'Generated from JSON Schema'
    };
  }

  // Add default paths if missing and only components exist
  if (!preparedSchema.paths && preparedSchema.components) {
    preparedSchema.paths = {};
  }

  return preparedSchema;
};

/**
 * Check if Redocly library is available
 */
export const isRedoclyAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!window.RedocStandalone;
};

/**
 * Clean up Redocly resources (if needed)
 */
export const cleanupRedocly = (): void => {
  // Redocly cleanup is handled automatically by the library
  // This function is provided for future extensibility
};