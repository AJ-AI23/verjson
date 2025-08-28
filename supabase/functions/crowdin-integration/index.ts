import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CROWDIN_API_BASE = 'https://api.crowdin.com/api/v2';

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
    return new Response(null, { headers: corsHeaders });
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

    const url = new URL(req.url);
    let requestBody: any = null;

    // Parse request body for POST requests only
    if (req.method === 'POST') {
      try {
        const bodyText = await req.text();
        console.log('Raw request body:', bodyText);
        
        if (bodyText.trim() === '') {
          console.error('Empty request body received');
          return new Response(JSON.stringify({ error: 'Request body is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        requestBody = JSON.parse(bodyText);
        console.log('Parsed request body:', { 
          action: requestBody.action, 
          hasWorkspaceId: !!requestBody.workspaceId,
          hasApiToken: !!requestBody.apiToken,
          bodyKeys: Object.keys(requestBody || {})
        });
      } catch (error) {
        console.error('Failed to parse request body:', error);
        console.error('Request body was:', await req.text().catch(() => 'Could not read body'));
        return new Response(JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: error.message 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.log('Non-POST request, skipping body parsing');
      return new Response(JSON.stringify({ error: 'Only POST requests are supported' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const action = requestBody.action;
    const workspaceId = requestBody.workspaceId;

    if (!workspaceId) {
      console.error('Missing workspaceId in request body');
      return new Response(JSON.stringify({ error: 'Workspace ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    if (action === 'saveToken') {
      const { apiToken } = requestBody;
      
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

      // Save encrypted token to database
      const { error: saveError } = await supabaseClient
        .from('workspace_crowdin_settings')
        .upsert({
          workspace_id: workspaceId,
          encrypted_api_token: apiToken, // Note: In production, this should be encrypted
          created_by: user.id,
        });

      if (saveError) {
        console.error('Error saving Crowdin settings:', saveError);
        return new Response(JSON.stringify({ error: 'Failed to save API token' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get stored API token for other actions
    const { data: crowdinSettings, error: settingsError } = await supabaseClient
      .from('workspace_crowdin_settings')
      .select('encrypted_api_token')
      .eq('workspace_id', workspaceId)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Error fetching Crowdin settings:', settingsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch settings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiToken = crowdinSettings?.encrypted_api_token;

    if (!apiToken) {
      return new Response(JSON.stringify({ error: 'No API token configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'listProjects') {
      const response = await fetch(`${CROWDIN_API_BASE}/projects`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Crowdin projects fetch failed:', response.status, await response.text());
        return new Response(JSON.stringify({ error: 'Failed to fetch projects' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      const projects: CrowdinProject[] = data.data.map((item: any) => ({
        id: item.data.id,
        name: item.data.name,
        identifier: item.data.identifier,
        description: item.data.description,
      }));

      return new Response(JSON.stringify({ projects }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'export') {
      const { projectId, filename, translationData } = requestBody;

      if (!projectId || !filename || !translationData) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 1: Create storage
      const jsonContent = JSON.stringify(translationData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const formData = new FormData();
      formData.append('file', blob, filename);

      const storageResponse = await fetch(`${CROWDIN_API_BASE}/storages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
        body: formData,
      });

      if (!storageResponse.ok) {
        console.error('Crowdin storage creation failed:', storageResponse.status, await storageResponse.text());
        return new Response(JSON.stringify({ error: 'Failed to create storage in Crowdin' }), {
          status: storageResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const storageData = await storageResponse.json();
      const storageId = storageData.data.id;

      // Step 2: Add file to project
      const fileResponse = await fetch(`${CROWDIN_API_BASE}/projects/${projectId}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storageId: storageId,
          name: filename,
          type: 'json',
        }),
      });

      if (!fileResponse.ok) {
        console.error('Crowdin file creation failed:', fileResponse.status, await fileResponse.text());
        return new Response(JSON.stringify({ error: 'Failed to add file to Crowdin project' }), {
          status: fileResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const fileData = await fileResponse.json();
      
      return new Response(JSON.stringify({ 
        success: true, 
        fileId: fileData.data.id,
        fileName: fileData.data.name 
      }), {
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