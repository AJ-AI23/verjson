import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { EdgeFunctionLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to set a value at a JSON path
function setValueAtPath(obj: any, path: string, value: any): void {
  const parts = path.split('/').filter(p => p !== '');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined) {
      current[part] = {};
    }
    current = current[part];
  }
  
  if (parts.length > 0) {
    current[parts[parts.length - 1]] = value;
  }
}

// Helper function to remove a value at a JSON path
function removeValueAtPath(obj: any, path: string): void {
  const parts = path.split('/').filter(p => p !== '');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined) {
      return;
    }
    current = current[part];
  }
  
  if (parts.length > 0) {
    delete current[parts[parts.length - 1]];
  }
}

const handler = async (req: Request): Promise<Response> => {
  const logger = new EdgeFunctionLogger('document-content', 'handler');
  
  if (req.method === 'OPTIONS') {
    logger.debug('CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.logRequest(req.method, req.url);
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    logger.debug('Authenticating user');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    logger.logAuth(user);
    
    if (userError || !user) {
      logger.error('Authentication failed', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body for action-based routing
    let requestBody: any = {};
    let action = '';
    
    try {
      requestBody = await req.json();
      action = requestBody.action || '';
      logger.debug('Parsed request body', { action, hasData: Object.keys(requestBody).length > 1 });
    } catch (e) {
      logger.error('Invalid JSON in request body', e);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const documentId = requestBody.document_id;

    logger.debug('Processing document content request', { action, documentId, userId: user.id });

    if (action !== 'fetchDocumentWithContent' && action !== 'fetchDocument') {
      logger.warn('Invalid action for document-content', { action });
      return new Response(JSON.stringify({ error: 'Invalid action. Supported actions: "fetchDocumentWithContent", "fetchDocument"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!documentId) {
      logger.warn('Missing document_id parameter');
      return new Response(JSON.stringify({ error: 'document_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get document with Crowdin integration - use service role for backend access
    logger.logDatabaseQuery('documents', 'SELECT with crowdin integration', { documentId });
    
    // Create service role client for version queries (bypass RLS for backend logic)
    const serviceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // First check if user has access to this document using regular client (respects RLS)
    const { data: accessCheck, error: accessError } = await supabaseClient
      .from('documents')
      .select('id, workspace_id, user_id')
      .eq('id', documentId)
      .maybeSingle();

    if (accessError) {
      logger.error('Access check failed', accessError);
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!accessCheck) {
      // Check if user has document permissions directly
      const { data: docPermission } = await supabaseClient
        .from('document_permissions')
        .select('role')
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .maybeSingle();

      if (!docPermission) {
        logger.error('Document not found or no access', { documentId, userId: user.id });
        return new Response(JSON.stringify({ error: 'Document not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Now get the full document using service role client
    const { data: document, error: docError } = await serviceRoleClient
      .from('documents')
      .select(`
        id,
        name,
        content,
        file_type,
        workspace_id,
        user_id,
        created_at,
        updated_at,
        is_public,
        crowdin_integration_id,
        crowdin_integration:document_crowdin_integrations!documents_crowdin_integration_id_fkey(
          id,
          file_id,
          file_ids,
          filename,
          filenames,
          project_id,
          split_by_paths
        )
      `)
      .eq('id', documentId)
      .single();

    logger.logDatabaseResult('documents', 'SELECT with crowdin integration', document ? 1 : 0, docError);
    
    if (docError || !document) {
      logger.error('Document not found or access denied', docError);
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get ALL versions for this document to apply patches correctly
    logger.logDatabaseQuery('document_versions', 'SELECT all versions', { documentId });
    
    const { data: versions, error: versionError } = await serviceRoleClient
      .from('document_versions')
      .select('id, version_major, version_minor, version_patch, is_selected, is_released, full_document, patches, created_at')
      .eq('document_id', documentId)
      .order('version_major', { ascending: true })
      .order('version_minor', { ascending: true })
      .order('version_patch', { ascending: true });

    logger.logDatabaseResult('document_versions', 'SELECT all versions', versions?.length || 0, versionError);
    
    if (versionError) {
      logger.warn('Could not fetch document versions', versionError);
    }

    // Determine effective content by applying all selected patches from last released version
    let effectiveContent = document.content;
    
    if (versions && versions.length > 0) {
      // Find the latest released version as base
      const releasedVersions = versions.filter(v => v.is_released && v.full_document);
      const latestReleased = releasedVersions.length > 0 ? releasedVersions[releasedVersions.length - 1] : null;
      
      if (latestReleased) {
        effectiveContent = latestReleased.full_document;
        logger.debug('Using released version as base', { 
          version: `${latestReleased.version_major}.${latestReleased.version_minor}.${latestReleased.version_patch}` 
        });
        
        // Apply all selected patches that come after the released version
        const laterVersions = versions.filter(v => {
          if (!v.is_selected || !v.patches) return false;
          
          // Compare versions to ensure we only apply patches after the released version
          const vVersion = v.version_major * 10000 + v.version_minor * 100 + v.version_patch;
          const releasedVersion = latestReleased.version_major * 10000 + latestReleased.version_minor * 100 + latestReleased.version_patch;
          
          return vVersion > releasedVersion;
        });
        
        logger.debug('Applying patches from later versions', { count: laterVersions.length });
        
        // Apply patches in order
        for (const version of laterVersions) {
          try {
            const patches = version.patches as any[];
            if (patches && Array.isArray(patches)) {
              for (const patch of patches) {
                // Simple JSON patch application
                if (patch.op === 'add') {
                  setValueAtPath(effectiveContent, patch.path, patch.value);
                } else if (patch.op === 'replace') {
                  setValueAtPath(effectiveContent, patch.path, patch.value);
                } else if (patch.op === 'remove') {
                  removeValueAtPath(effectiveContent, patch.path);
                }
              }
            }
          } catch (patchError) {
            logger.warn('Failed to apply patch', { versionId: version.id, error: patchError });
          }
        }
      } else {
        logger.debug('No released version found, using base document content');
      }
    } else {
      logger.debug('No versions found, using base document content');
    }

    const result = {
      ...document,
      content: effectiveContent
    };

    logger.info('Successfully fetched document content', { 
      documentId, 
      hasVersionContent: versions && versions.length > 0,
      hasCrowdinIntegration: !!document.crowdin_integration_id 
    });
    
    logger.logResponse(200, result);
    return new Response(JSON.stringify({ document: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logger.error('Unhandled error in document-content function', error);
    logger.logResponse(500);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);