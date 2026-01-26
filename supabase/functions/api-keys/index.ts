import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EdgeFunctionLogger } from '../_shared/logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate a cryptographically secure random API key
function generateApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generate SHA-256 hash of the API key
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new EdgeFunctionLogger('api-keys', 'handler');
  logger.logRequest(req.method, req.url);

  try {
    // Check for Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logger.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authentication token' }),
        { status: 401, headers: corsHeaders }
      )
    }
    
    // Create authenticated Supabase client for user operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Create service role client for secure operations (storing hashes)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      logger.error('Authentication failed', { error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or expired token' }),
        { status: 401, headers: corsHeaders }
      )
    }

    logger.logAuth(user);

    const { action, ...requestData } = await req.json()
    logger.debug('Parsed request body', { action });

    let result;

    switch (action) {
      case 'listApiKeys':
        result = await handleListApiKeys(supabaseClient, user, logger);
        break;
      case 'createApiKey':
        result = await handleCreateApiKey(supabaseClient, serviceClient, requestData, user, logger);
        break;
      case 'updateApiKey':
        result = await handleUpdateApiKey(supabaseClient, requestData, user, logger);
        break;
      case 'deleteApiKey':
        result = await handleDeleteApiKey(supabaseClient, requestData, user, logger);
        break;
      case 'revokeApiKey':
        result = await handleRevokeApiKey(supabaseClient, requestData, user, logger);
        break;
      default:
        logger.warn('Unknown action requested', { action });
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: corsHeaders }
        )
    }

    logger.logResponse(200, result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    logger.logError('Request processing failed', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: corsHeaders }
    )
  }
})

async function handleListApiKeys(supabaseClient: any, user: any, logger: EdgeFunctionLogger) {
  logger.debug('Listing API keys', { userId: user.id });

  // Note: key_hash is no longer in api_keys table - it's in the secure api_key_secrets table
  const { data: apiKeys, error } = await supabaseClient
    .from('api_keys')
    .select('id, name, key_prefix, scopes, last_used_at, expires_at, created_at, is_active')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to list API keys', error);
    throw error;
  }

  logger.info('Successfully retrieved API keys', { count: apiKeys?.length || 0 });
  return { apiKeys };
}

async function handleCreateApiKey(
  supabaseClient: any, 
  serviceClient: any, 
  data: any, 
  user: any, 
  logger: EdgeFunctionLogger
) {
  const { name, scopes, expiresAt } = data;
  logger.debug('Creating API key', { name, scopes, userId: user.id });

  if (!name || name.trim().length === 0) {
    throw new Error('API key name is required');
  }

  if (name.length > 100) {
    throw new Error('API key name must be less than 100 characters');
  }

  // Validate scopes
  const validScopes = ['read', 'write', 'admin'];
  const requestedScopes = scopes || ['read'];
  for (const scope of requestedScopes) {
    if (!validScopes.includes(scope)) {
      throw new Error(`Invalid scope: ${scope}. Valid scopes are: ${validScopes.join(', ')}`);
    }
  }

  // Generate the API key
  const rawKey = generateApiKey();
  const keyPrefix = rawKey.substring(0, 8);
  const keyHash = await hashApiKey(rawKey);

  // Format the key for display: prefix_rest
  const displayKey = `vj_${rawKey}`;

  // Step 1: Insert metadata into api_keys table (user can see this)
  const apiKeyData = {
    user_id: user.id,
    name: name.trim(),
    key_prefix: keyPrefix,
    scopes: requestedScopes,
    expires_at: expiresAt || null,
    is_active: true,
  };

  const { data: apiKey, error } = await supabaseClient
    .from('api_keys')
    .insert(apiKeyData)
    .select('id, name, key_prefix, scopes, expires_at, created_at, is_active')
    .single();

  if (error) {
    logger.error('Failed to create API key', error);
    throw error;
  }

  // Step 2: Store hash in secure table using SECURITY DEFINER function
  // This uses service role to call the function that inserts into api_key_secrets
  const { error: hashError } = await serviceClient.rpc('store_api_key_hash', {
    p_api_key_id: apiKey.id,
    p_key_hash: keyHash
  });

  if (hashError) {
    logger.error('Failed to store API key hash', hashError);
    // Rollback: delete the api_key record
    await supabaseClient.from('api_keys').delete().eq('id', apiKey.id);
    throw new Error('Failed to create API key securely');
  }

  logger.info('Successfully created API key', { keyId: apiKey.id, name });

  // Return the full key only once - it won't be retrievable again
  return { 
    apiKey: {
      ...apiKey,
      key: displayKey, // Only returned on creation
    },
    warning: 'Save this API key now. You won\'t be able to see it again!'
  };
}

async function handleUpdateApiKey(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { keyId, name, scopes, expiresAt } = data;
  logger.debug('Updating API key', { keyId, userId: user.id });

  if (!keyId) {
    throw new Error('API key ID is required');
  }

  const updates: any = { updated_at: new Date().toISOString() };
  
  if (name !== undefined) {
    if (name.trim().length === 0) {
      throw new Error('API key name cannot be empty');
    }
    if (name.length > 100) {
      throw new Error('API key name must be less than 100 characters');
    }
    updates.name = name.trim();
  }

  if (scopes !== undefined) {
    const validScopes = ['read', 'write', 'admin'];
    for (const scope of scopes) {
      if (!validScopes.includes(scope)) {
        throw new Error(`Invalid scope: ${scope}. Valid scopes are: ${validScopes.join(', ')}`);
      }
    }
    updates.scopes = scopes;
  }

  if (expiresAt !== undefined) {
    updates.expires_at = expiresAt;
  }

  const { data: apiKey, error } = await supabaseClient
    .from('api_keys')
    .update(updates)
    .eq('id', keyId)
    .eq('user_id', user.id)
    .select('id, name, key_prefix, scopes, last_used_at, expires_at, created_at, is_active')
    .single();

  if (error) {
    logger.error('Failed to update API key', error);
    throw error;
  }

  logger.info('Successfully updated API key', { keyId });
  return { apiKey };
}

async function handleRevokeApiKey(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { keyId } = data;
  logger.debug('Revoking API key', { keyId, userId: user.id });

  if (!keyId) {
    throw new Error('API key ID is required');
  }

  const { data: apiKey, error } = await supabaseClient
    .from('api_keys')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', user.id)
    .select('id, name, is_active')
    .single();

  if (error) {
    logger.error('Failed to revoke API key', error);
    throw error;
  }

  logger.info('Successfully revoked API key', { keyId });
  return { apiKey, message: 'API key revoked successfully' };
}

async function handleDeleteApiKey(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { keyId } = data;
  logger.debug('Deleting API key', { keyId, userId: user.id });

  if (!keyId) {
    throw new Error('API key ID is required');
  }

  // The api_key_secrets record will be deleted via CASCADE
  const { error } = await supabaseClient
    .from('api_keys')
    .delete()
    .eq('id', keyId)
    .eq('user_id', user.id);

  if (error) {
    logger.error('Failed to delete API key', error);
    throw error;
  }

  logger.info('Successfully deleted API key', { keyId });
  return { success: true, message: 'API key deleted successfully' };
}
