import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  authenticated: boolean;
  user: any | null;
  client: any | null;
  error: string | null;
  authMethod: 'jwt' | 'api_key' | null;
}

export interface AuthOptions {
  requireAuth?: boolean;
  allowApiKey?: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

/**
 * Centralized authentication handler for edge functions.
 * Supports JWT tokens and can be extended to support API keys.
 */
export async function authenticateRequest(
  req: Request,
  options: AuthOptions = { requireAuth: true, allowApiKey: false }
): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization');
  const apiKeyHeader = req.headers.get('x-api-key');

  // Check for API key authentication (for future extension)
  if (options.allowApiKey && apiKeyHeader) {
    const apiKeyResult = await validateApiKey(apiKeyHeader);
    if (apiKeyResult.authenticated) {
      return apiKeyResult;
    }
  }

  // JWT authentication
  if (!authHeader) {
    if (options.requireAuth) {
      return {
        authenticated: false,
        user: null,
        client: null,
        error: 'Missing authorization header',
        authMethod: null,
      };
    }
    // Create anonymous client for non-required auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    return {
      authenticated: false,
      user: null,
      client: supabaseClient,
      error: null,
      authMethod: null,
    };
  }

  // Create authenticated client
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );

  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error || !user) {
      if (options.requireAuth) {
        return {
          authenticated: false,
          user: null,
          client: null,
          error: error?.message || 'Invalid or expired token',
          authMethod: null,
        };
      }
      return {
        authenticated: false,
        user: null,
        client: supabaseClient,
        error: null,
        authMethod: null,
      };
    }

    return {
      authenticated: true,
      user,
      client: supabaseClient,
      error: null,
      authMethod: 'jwt',
    };
  } catch (error) {
    return {
      authenticated: false,
      user: null,
      client: null,
      error: error instanceof Error ? error.message : 'Authentication failed',
      authMethod: null,
    };
  }
}

/**
 * Placeholder for API key validation.
 * Can be extended to validate against a database table of API keys.
 */
async function validateApiKey(apiKey: string): Promise<AuthResult> {
  // TODO: Implement API key validation against database
  // Example implementation:
  // const supabaseAdmin = createClient(
  //   Deno.env.get('SUPABASE_URL') ?? '',
  //   Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  // );
  // const { data, error } = await supabaseAdmin
  //   .from('api_keys')
  //   .select('user_id, scopes, expires_at')
  //   .eq('key_hash', hashApiKey(apiKey))
  //   .eq('is_active', true)
  //   .single();
  
  return {
    authenticated: false,
    user: null,
    client: null,
    error: 'API key authentication not yet implemented',
    authMethod: null,
  };
}

/**
 * Creates a service role client for admin operations.
 */
export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

/**
 * Standard CORS headers for edge functions.
 */
export { corsHeaders };

/**
 * Creates an unauthorized response with proper CORS headers.
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Creates an error response with proper CORS headers.
 */
export function errorResponse(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Creates a success response with proper CORS headers.
 */
export function successResponse(data: any, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Handles CORS preflight requests.
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}
