import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// AES-GCM encryption/decryption for credentials
async function encryptCredentials(credentials: string, key: string): Promise<string> {
  // Derive a proper encryption key from the secret
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const credBytes = new TextEncoder().encode(credentials);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    credBytes
  );

  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

async function decryptCredentials(encrypted: string, key: string): Promise<string> {
  // Decode from base64
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

  // Extract salt, iv, and encrypted data
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encryptedData = combined.slice(28);

  // Derive the same key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    encryptedData
  );

  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionKey = Deno.env.get('CREDENTIALS_ENCRYPTION_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, url, authMethod, credentials, documentId } = await req.json();

    if (action === 'fetch') {
      if (!url) {
        return new Response(
          JSON.stringify({ error: 'URL is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prepare auth headers
      const fetchHeaders: Record<string, string> = {
        'Accept': 'application/json',
      };

      if (authMethod && credentials) {
        if (authMethod === 'basic') {
          const [username, password] = credentials.split(':');
          const basicAuth = btoa(`${username}:${password}`);
          fetchHeaders['Authorization'] = `Basic ${basicAuth}`;
        } else if (authMethod === 'bearer') {
          fetchHeaders['Authorization'] = `Bearer ${credentials}`;
        }
      }

      console.log(`[fetch-authenticated-url] Fetching URL: ${url} with auth method: ${authMethod || 'none'}`);

      // Fetch the URL
      const response = await fetch(url, {
        headers: fetchHeaders,
      });

      console.log(`[fetch-authenticated-url] Response status: ${response.status}`);

      if (!response.ok) {
        const requiresAuth = response.status === 401 || response.status === 403;
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch URL',
            status: response.status,
            statusText: response.statusText,
            requiresAuth
          }),
          { 
            status: requiresAuth ? 200 : response.status, // Return 200 for auth errors so client can handle them
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const content = await response.text();
      
      // If documentId is provided and credentials were used, update the document with encrypted credentials
      if (documentId && authMethod && credentials) {
        const encryptedCreds = await encryptCredentials(credentials, encryptionKey);
        
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            import_auth_method: authMethod,
            import_auth_credentials: encryptedCreds,
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('[fetch-authenticated-url] Error updating document credentials:', updateError);
        } else {
          console.log('[fetch-authenticated-url] Document credentials updated successfully');
        }
      }

      return new Response(
        JSON.stringify({ content }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'fetchWithStoredCredentials') {
      if (!documentId) {
        return new Response(
          JSON.stringify({ error: 'Document ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get document with stored credentials
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('import_url, import_auth_method, import_auth_credentials')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single();

      if (docError || !document) {
        return new Response(
          JSON.stringify({ error: 'Document not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!document.import_url) {
        return new Response(
          JSON.stringify({ error: 'Document has no import URL' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prepare auth headers
      const fetchHeaders: Record<string, string> = {
        'Accept': 'application/json',
      };

      if (document.import_auth_method && document.import_auth_credentials) {
        const decryptedCreds = await decryptCredentials(document.import_auth_credentials, encryptionKey);
        
        if (document.import_auth_method === 'basic') {
          const [username, password] = decryptedCreds.split(':');
          const basicAuth = btoa(`${username}:${password}`);
          fetchHeaders['Authorization'] = `Basic ${basicAuth}`;
        } else if (document.import_auth_method === 'bearer') {
          fetchHeaders['Authorization'] = `Bearer ${decryptedCreds}`;
        }
      }

      console.log(`[fetch-authenticated-url] Fetching with stored credentials for document: ${documentId}`);

      // Fetch the URL
      const response = await fetch(document.import_url, {
        headers: fetchHeaders,
      });

      console.log(`[fetch-authenticated-url] Response status: ${response.status}`);

      if (!response.ok) {
        const requiresAuth = response.status === 401 || response.status === 403;
        
        // If auth failed, clear stored credentials
        if (requiresAuth) {
          await supabase
            .from('documents')
            .update({
              import_auth_method: null,
              import_auth_credentials: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', documentId)
            .eq('user_id', user.id);
        }

        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch URL',
            status: response.status,
            statusText: response.statusText,
            requiresAuth
          }),
          { 
            status: requiresAuth ? 200 : response.status, // Return 200 for auth errors so client can handle them
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const content = await response.text();

      return new Response(
        JSON.stringify({ content }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fetch-authenticated-url] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
