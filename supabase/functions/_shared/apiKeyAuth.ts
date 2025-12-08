import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface ApiKeyAuthResult {
  isValid: boolean;
  userId?: string;
  scopes?: string[];
  keyId?: string;
  error?: string;
}

// Generate SHA-256 hash of the API key
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate an API key and return user information
 * API keys should be passed in the X-API-Key header with format: vj_<key>
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyAuthResult> {
  // Check key format
  if (!apiKey || !apiKey.startsWith('vj_')) {
    return { isValid: false, error: 'Invalid API key format' };
  }

  // Extract the raw key (remove 'vj_' prefix)
  const rawKey = apiKey.substring(3);
  
  if (rawKey.length !== 64) {
    return { isValid: false, error: 'Invalid API key length' };
  }

  // Get the prefix (first 8 characters of raw key)
  const keyPrefix = rawKey.substring(0, 8);
  
  // Hash the full key for comparison
  const keyHash = await hashApiKey(rawKey);

  // Create service role client to bypass RLS
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Validate the API key using the database function
  const { data, error } = await serviceClient
    .rpc('validate_api_key', {
      p_key_prefix: keyPrefix,
      p_key_hash: keyHash
    });

  if (error) {
    console.error('API key validation error:', error);
    return { isValid: false, error: 'Failed to validate API key' };
  }

  if (!data || data.length === 0) {
    return { isValid: false, error: 'Invalid or expired API key' };
  }

  const keyRecord = data[0];
  
  return {
    isValid: true,
    userId: keyRecord.user_id,
    scopes: keyRecord.scopes,
    keyId: keyRecord.key_id
  };
}

/**
 * Check if the API key has the required scope
 */
export function hasScope(scopes: string[], requiredScope: string): boolean {
  // Admin scope has access to everything
  if (scopes.includes('admin')) {
    return true;
  }
  
  // Write scope includes read access
  if (requiredScope === 'read' && scopes.includes('write')) {
    return true;
  }
  
  return scopes.includes(requiredScope);
}

/**
 * Extract API key from request headers
 */
export function extractApiKey(req: Request): string | null {
  // Check X-API-Key header first
  const apiKeyHeader = req.headers.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }
  
  // Also check Authorization header with Bearer prefix for API keys
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer vj_')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  return null;
}

/**
 * Authenticate request using either session token or API key
 * Returns user ID and scopes if authenticated
 */
export async function authenticateRequest(req: Request): Promise<{
  authenticated: boolean;
  userId?: string;
  scopes?: string[];
  authMethod?: 'session' | 'api_key';
  error?: string;
}> {
  // First try API key authentication
  const apiKey = extractApiKey(req);
  if (apiKey) {
    const result = await validateApiKey(apiKey);
    if (result.isValid) {
      return {
        authenticated: true,
        userId: result.userId,
        scopes: result.scopes,
        authMethod: 'api_key'
      };
    }
    // If API key was provided but invalid, return error
    return {
      authenticated: false,
      error: result.error
    };
  }
  
  // Fall back to session token authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      authenticated: false,
      error: 'No authentication provided'
    };
  }
  
  // Create authenticated Supabase client
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  
  if (authError || !user) {
    return {
      authenticated: false,
      error: 'Invalid or expired session token'
    };
  }
  
  // Session tokens have full access (admin scope)
  return {
    authenticated: true,
    userId: user.id,
    scopes: ['admin'],
    authMethod: 'session'
  };
}
