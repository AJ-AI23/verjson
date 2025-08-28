import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CROWDIN_API_BASE = 'https://api.crowdin.com/api/v2';

// Proper encryption/decryption functions using AES-GCM
const getEncryptionKey = async (): Promise<CryptoKey> => {
  const keyString = Deno.env.get('CROWDIN_ENCRYPTION_KEY');
  if (!keyString) {
    throw new Error('Encryption key not configured');
  }
  
  const keyData = new TextEncoder().encode(keyString.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
};

const encryptToken = async (token: string): Promise<string> => {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
};

const decryptToken = async (encryptedToken: string): Promise<string> => {
  try {
    const key = await getEncryptionKey();
    const combined = new Uint8Array([...atob(encryptedToken)].map(char => char.charCodeAt(0)));
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('AES decryption failed, trying legacy base64 decode:', error);
    
    // Fallback for legacy base64-encoded tokens
    try {
      const decoded = atob(encryptedToken);
      const decoder = new TextDecoder();
      const result = decoder.decode(new Uint8Array([...decoded].map(char => char.charCodeAt(0))));
      console.log('✅ Successfully decoded legacy base64 token');
      return result;
    } catch (legacyError) {
      console.error('Legacy base64 decode also failed:', legacyError);
      throw new Error('Failed to decrypt token - token may be corrupted');
    }
  }
};

interface CrowdinProject {
  id: number;
  name: string;
  identifier: string;
  description?: string;
}

interface CrowdinStorage {
  id: number;
  fileName: string;
}

serve(async (req) => {
  console.log('🚀 Crowdin integration function called');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Only POST allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Ensure we have the correct content type
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return new Response(
      JSON.stringify({ error: 'Content-Type must be application/json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Parse request body using req.json() - works better with supabase.functions.invoke()
  let payload: any;
  try {
    payload = await req.json();
    console.log('✅ Successfully parsed request body:', {
      action: payload?.action,
      hasWorkspaceId: !!payload?.workspaceId,
      bodyKeys: Object.keys(payload || {})
    });
  } catch (e) {
    console.error('❌ Invalid JSON payload:', e);
    return new Response(
      JSON.stringify({ error: 'Invalid JSON payload', details: `${e}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Validate required fields
  const action = payload?.action;
  const workspaceId = payload?.workspaceId;

  if (!action) {
    return new Response(
      JSON.stringify({ error: 'Action is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!workspaceId) {
    return new Response(
      JSON.stringify({ error: 'Workspace ID is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ User authenticated:', user.id);

    // Verify user has access to workspace
    const { data: workspace, error: workspaceError } = await supabaseClient
      .from('workspaces')
      .select('id, name, user_id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (workspaceError || !workspace) {
      console.error('Workspace access error:', workspaceError);
      return new Response(JSON.stringify({ error: 'Workspace not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'checkToken') {
      console.log('CheckToken action started. WorkspaceId:', workspaceId);
      
      try {
        // Check if token exists in database
        const { data: settings, error: fetchError } = await supabaseClient
          .from('workspace_crowdin_settings')
          .select('encrypted_api_token')
          .eq('workspace_id', workspaceId)
          .single();

        if (fetchError || !settings) {
          console.log('❌ No token found for workspace:', workspaceId);
          return new Response(JSON.stringify({ 
            hasToken: false,
            error: 'No API token configured' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Return simple confirmation that token exists
        console.log('✅ Token found for workspace:', workspaceId);
        
        return new Response(JSON.stringify({ 
          hasToken: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('❌ Error checking token:', error);
        return new Response(JSON.stringify({ 
          hasToken: false,
          error: 'Failed to check token' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'saveToken') {
      const { apiToken } = payload;
      
      console.log('SaveToken action started. WorkspaceId:', workspaceId, 'Has apiToken:', !!apiToken);
      
      if (!apiToken) {
        console.error('Missing apiToken in request body');
        return new Response(JSON.stringify({ error: 'API token is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Test the API token by fetching user projects
      const testResponse = await fetch(`${CROWDIN_API_BASE}/projects`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!testResponse.ok) {
        console.error('Crowdin API test failed:', testResponse.status, await testResponse.text());
        return new Response(JSON.stringify({ error: 'Invalid Crowdin API token' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Encrypt and save token to database
      const encryptedToken = await encryptToken(apiToken);
      const { error: saveError } = await supabaseClient
        .from('workspace_crowdin_settings')
        .upsert({
          workspace_id: workspaceId,
          encrypted_api_token: encryptedToken,
          created_by: user.id,
        }, {
          onConflict: 'workspace_id'
        });

      if (saveError) {
        console.error('Error saving Crowdin settings:', saveError);
        return new Response(JSON.stringify({ error: 'Failed to save API token' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('✅ Successfully saved/updated Crowdin settings for workspace:', workspaceId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get stored API token for other actions
    const { data: crowdinSettings, error: settingsError } = await supabaseClient
      .from('workspace_crowdin_settings')
      .select('encrypted_api_token')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching Crowdin settings:', settingsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch settings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const encryptedApiToken = crowdinSettings?.encrypted_api_token;

    if (!encryptedApiToken) {
      console.log('No API token found for workspace:', workspaceId);
      return new Response(JSON.stringify({ error: 'No API token configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decrypt the token for API calls
    let apiToken: string;
    try {
      apiToken = await decryptToken(encryptedApiToken);
    } catch (error) {
      console.error('Failed to decrypt API token:', error);
      return new Response(JSON.stringify({ error: 'Invalid token configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'listProjects') {
      console.log('🔍 ListProjects action started');
      console.log('🔑 Attempting to decrypt token...');
      console.log('🌐 Making Crowdin API request to fetch projects...');
      const response = await fetch(`${CROWDIN_API_BASE}/projects`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📊 Crowdin API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Crowdin projects fetch failed:', response.status, errorText);
        return new Response(JSON.stringify({ error: 'Failed to fetch projects from Crowdin API' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      console.log('📋 Raw Crowdin API response:', JSON.stringify(data, null, 2));
      
      const projects: CrowdinProject[] = data.data.map((item: any) => ({
        id: item.data.id,
        name: item.data.name,
        identifier: item.data.identifier,
        description: item.data.description,
      }));

      console.log('✅ Successfully processed projects:', projects.length, 'projects found');

      return new Response(JSON.stringify({ projects }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'export') {
      const { projectId, filename, translationData, branchId, folderId } = payload;

      if (!projectId || !filename || !translationData) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 1: Create storage - try raw binary upload instead of FormData
      console.log('🔍 Raw translation data keys:', Object.keys(translationData || {}));
      console.log('🔍 Translation data sample:', JSON.stringify(translationData).substring(0, 200));

      if (!translationData || typeof translationData !== 'object' || Object.keys(translationData).length === 0) {
        return new Response(JSON.stringify({ error: 'Translation data is empty or invalid' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const jsonContent = JSON.stringify(translationData, null, 2);
      console.log('📄 JSON content length:', jsonContent.length);
      console.log('🔍 Filename:', filename);
      
      if (!jsonContent || jsonContent.length === 0 || jsonContent === '{}') {
        return new Response(JSON.stringify({ error: 'Generated JSON content is empty' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Send raw binary data with Crowdin-API-FileName header (not multipart/form-data)
      const encoder = new TextEncoder();
      const bodyData = encoder.encode(jsonContent);
      console.log('🔍 Binary file data size:', bodyData.length);
      console.log('🔍 Sending filename in header:', filename);

      const storageResponse = await fetch(`${CROWDIN_API_BASE}/storages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/octet-stream',
          'Crowdin-API-FileName': filename,
        },
        body: bodyData,
      });

      console.log('🔍 Storage response status:', storageResponse.status);
      console.log('🔍 Storage response headers:', Object.fromEntries(storageResponse.headers.entries()));

      if (!storageResponse.ok) {
        console.error('Crowdin storage creation failed:', storageResponse.status, await storageResponse.text());
        return new Response(JSON.stringify({ error: 'Failed to create storage in Crowdin' }), {
          status: storageResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const storageData = await storageResponse.json();
      const storageId = storageData.data.id;

      // Step 2: Add file to project with optional branch and folder
      const fileRequestBody: any = {
        storageId: storageId,
        name: filename,
        type: 'json',
      };

      // Add branch and folder if specified
      if (branchId) {
        fileRequestBody.branchId = parseInt(branchId);
      }
      if (folderId) {
        fileRequestBody.directoryId = parseInt(folderId);
      }

      const fileResponse = await fetch(`${CROWDIN_API_BASE}/projects/${projectId}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fileRequestBody),
      });

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        console.error('Crowdin file creation failed:', fileResponse.status, errorText);
        return new Response(JSON.stringify({ 
          error: 'Failed to add file to Crowdin project',
          details: errorText 
        }), {
          status: fileResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const fileResponseData = await fileResponse.json();
      
      return new Response(JSON.stringify({ 
        success: true, 
        fileId: fileResponseData.data.id,
        fileName: fileResponseData.data.name 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Import file from Crowdin
    if (action === 'import') {
      console.log('🔍 Import action started');
      
      const { fileId, documentId, projectId } = payload;
      
      if (!fileId) {
        return new Response(JSON.stringify({ error: 'File ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!documentId) {
        return new Response(JSON.stringify({ error: 'Document ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!projectId) {
        return new Response(JSON.stringify({ error: 'Project ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        // Step 1: Get download URL from Crowdin
        console.log('🔍 Getting download URL from Crowdin project:', projectId, 'file:', fileId);
        
        const downloadUrlResponse = await fetch(`${CROWDIN_API_BASE}/projects/${projectId}/files/${fileId}/download`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
          }
        });

        if (!downloadUrlResponse.ok) {
          console.error('❌ Failed to get download URL from Crowdin:', downloadUrlResponse.status, downloadUrlResponse.statusText);
          const errorText = await downloadUrlResponse.text();
          console.error('❌ Crowdin error response:', errorText);
          return new Response(JSON.stringify({ 
            error: `Failed to get download URL from Crowdin: ${downloadUrlResponse.statusText}` 
          }), {
            status: downloadUrlResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const downloadUrlData = await downloadUrlResponse.json();
        console.log('✅ Got download URL from Crowdin:', downloadUrlData.data?.url ? 'URL received' : 'No URL');

        // Step 2: Download actual file content from the URL
        const fileUrl = downloadUrlData.data?.url;
        if (!fileUrl) {
          console.error('❌ No download URL received from Crowdin');
          return new Response(JSON.stringify({ 
            error: 'No download URL received from Crowdin' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('🔍 Downloading actual file content from URL...');
        const fileContentResponse = await fetch(fileUrl);

        if (!fileContentResponse.ok) {
          console.error('❌ Failed to download file from URL:', fileContentResponse.status, fileContentResponse.statusText);
          return new Response(JSON.stringify({ 
            error: `Failed to download file content: ${fileContentResponse.statusText}` 
          }), {
            status: fileContentResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const fileContent = await fileContentResponse.text();
        console.log('✅ Downloaded file content, length:', fileContent.length);

        try {
          const parsedContent = JSON.parse(fileContent);
          console.log('✅ Successfully parsed downloaded content');
          
          return new Response(JSON.stringify({
            success: true,
            content: parsedContent,
            message: 'File imported successfully from Crowdin'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (parseError) {
          console.error('❌ Failed to parse downloaded content as JSON:', parseError);
          return new Response(JSON.stringify({ 
            error: 'Downloaded file is not valid JSON' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (error) {
        console.error('❌ Error importing from Crowdin:', error);
        return new Response(JSON.stringify({ 
          error: `Import failed: ${error.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'listBranches') {
      const { projectId } = payload;

      if (!projectId) {
        return new Response(JSON.stringify({ error: 'Project ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await fetch(`${CROWDIN_API_BASE}/projects/${projectId}/branches`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Crowdin branches fetch failed:', response.status, errorText);
        return new Response(JSON.stringify({ error: 'Failed to fetch branches from Crowdin API' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      const branches = data.data.map((item: any) => ({
        id: item.data.id,
        name: item.data.name,
        title: item.data.title,
        createdAt: item.data.createdAt,
      }));

      return new Response(JSON.stringify({ branches }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'listFolders') {
      const { projectId, branchId } = payload;

      if (!projectId) {
        return new Response(JSON.stringify({ error: 'Project ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let url = `${CROWDIN_API_BASE}/projects/${projectId}/directories`;
      if (branchId) {
        url += `?branchId=${branchId}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Crowdin folders fetch failed:', response.status, errorText);
        return new Response(JSON.stringify({ error: 'Failed to fetch folders from Crowdin API' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      const folders = data.data.map((item: any) => ({
        id: item.data.id,
        name: item.data.name,
        path: item.data.path,
        createdAt: item.data.createdAt,
      }));

      return new Response(JSON.stringify({ folders }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Error in crowdin-integration function:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});