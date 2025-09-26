import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { compare } from 'https://esm.sh/fast-json-patch@3.1.1';

// Handle function shutdown gracefully
addEventListener('beforeunload', (ev: any) => {
  console.log('🔄 Function shutdown due to:', ev.detail?.reason);
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CROWDIN_API_BASE = 'https://api.crowdin.com/api/v2';

// Helper function to merge multiple translation files
function mergeTranslations(baseContent: any, downloadedFiles: Record<string, any>): any {
  let mergedContent = { ...baseContent };
  
  for (const [fileId, fileContent] of Object.entries(downloadedFiles)) {
    console.log(`🔄 Merging content from file ${fileId}`);
    
    // If the file content has path-like keys, convert them to nested structure
    const processedContent = pathsToNestedObject(fileContent);
    
    // Recursively merge the content
    mergedContent = deepMerge(mergedContent, processedContent);
  }
  
  return mergedContent;
}

// Helper function to convert path-based keys to nested objects
function pathsToNestedObject(pathsObject: any): any {
  const result: any = {};
  
  for (const [path, value] of Object.entries(pathsObject)) {
    const pathParts = path.split(/[/.]/);
    let current = result;
    
    // Navigate/create the nested structure
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Set the final value
    const lastPart = pathParts[pathParts.length - 1];
    current[lastPart] = value;
  }
  
  return result;
}

// Helper function to deeply merge two objects
function deepMerge(target: any, source: any): any {
  if (!source || typeof source !== 'object') {
    return target;
  }
  
  if (!target || typeof target !== 'object') {
    return source;
  }
  
  const merged = { ...target };
  
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (merged[key] && typeof merged[key] === 'object' && !Array.isArray(merged[key])) {
        merged[key] = deepMerge(merged[key], value);
      } else {
        merged[key] = value;
      }
    } else {
      merged[key] = value;
    }
  }
  
  return merged;
}

// Helper function to compare document versions and generate patches
function compareDocumentVersionsPartial(currentSchema: any, importSchema: any): any {
  console.log('🔍 compareDocumentVersionsPartial called for Crowdin import:');
  
  // Generate patches between current and merged schemas
  const patches = compare(currentSchema, importSchema);
  console.log('Generated patches for partial import:', patches);
  
  // Filter out "remove" operations since we're doing a partial import
  let filteredPatches = patches.filter(patch => patch.op !== 'remove');
  
  // Fix Crowdin path artifacts - convert "/root" to "/"
  filteredPatches = filteredPatches.map(patch => {
    if (patch.path && patch.path.startsWith('/root')) {
      return {
        ...patch,
        path: patch.path.replace('/root', '') || '/'
      };
    }
    return patch;
  });
  
  console.log('Filtered and corrected patches:', filteredPatches);
  
  return {
    patches: filteredPatches,
    conflictCount: 0,
    recommendedVersionTier: 'minor',
    hasBreakingChanges: false,
    mergeConflicts: [],
    mergedSchema: importSchema,
  };
}

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

    // Verify user has access to workspace (owner or has workspace permissions)
    const { data: hasAccess, error: accessError } = await supabaseClient
      .rpc('user_has_workspace_access', {
        workspace_id: workspaceId,
        user_id: user.id
      });

    if (accessError || !hasAccess) {
      console.error('Workspace access error:', accessError);
      return new Response(JSON.stringify({ error: 'Workspace not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'validateCrowdinToken') {
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

    if (action === 'storeCrowdinToken') {
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

    if (action === 'fetchCrowdinProjects') {
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

    if (action === 'fetchCrowdinFiles') {
      const { projectId, branchId, directoryId } = payload;
      
      if (!projectId) {
        return new Response(JSON.stringify({ error: 'Project ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('📂 ListFiles action started for project:', projectId);
      
      try {
        let url = `${CROWDIN_API_BASE}/projects/${projectId}/files`;
        const params = new URLSearchParams();
        
        if (branchId && branchId !== '__main__') {
          params.append('branchId', branchId);
        }
        if (directoryId && directoryId !== '__root__') {
          params.append('directoryId', directoryId);
        }
        
        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Crowdin files fetch failed:', response.status, errorText);
          return new Response(JSON.stringify({ error: 'Failed to fetch files from Crowdin' }), {
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const data = await response.json();
        const files = data.data.map((item: any) => ({
          id: item.data.id,
          name: item.data.name,
          path: item.data.path,
          type: item.data.type,
          createdAt: item.data.createdAt,
        }));

        console.log('✅ Successfully fetched files:', files.length, 'files found');

        return new Response(JSON.stringify({ files }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('❌ Error fetching files:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch files' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'exportDocumentToCrowdin') {
      const { projectId, translationData, splitByApiPaths, branchId, folderId, documentId } = payload;

      if (!projectId || !translationData) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Helper function to check if file exists
      const checkFileExists = async (filename: string, branchId?: string, directoryId?: string) => {
        try {
          let url = `${CROWDIN_API_BASE}/projects/${projectId}/files`;
          const params = new URLSearchParams();
          
          if (branchId && branchId !== '__main__') {
            params.append('branchId', branchId);
          }
          if (directoryId && directoryId !== '__root__') {
            params.append('directoryId', directoryId);
          }
          
          if (params.toString()) {
            url += `?${params.toString()}`;
          }

          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            return null;
          }

          const data = await response.json();
          const existingFile = data.data.find((item: any) => item.data.name === filename);
          return existingFile ? existingFile.data : null;
        } catch (error) {
          console.error('Error checking file existence:', error);
          return null;
        }
      };

      // Helper function to update existing file
      const updateExistingFile = async (fileId: string, storageId: number) => {
        const response = await fetch(`${CROWDIN_API_BASE}/projects/${projectId}/files/${fileId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ storageId }),
        });

        if (response.ok) {
          return await response.json();
        } else {
          throw new Error(`Failed to update file ${fileId}: ${response.status}`);
        }
      };

      try {
        if (splitByApiPaths && translationData.splitFiles) {
          // Handle multiple files export
          console.log('🔍 Exporting multiple files:', translationData.splitFiles.length);
          
          const results = [];
          
          for (const fileData of translationData.splitFiles) {
            const { filename, data } = fileData;
            
            if (!filename || !data || typeof data !== 'object' || Object.keys(data).length === 0) {
              console.warn('⚠️ Skipping empty file:', filename);
              continue;
            }

            const jsonContent = JSON.stringify(data, null, 2);
            const encoder = new TextEncoder();
            const bodyData = encoder.encode(jsonContent);

            // Step 1: Create storage for this file
            const storageResponse = await fetch(`${CROWDIN_API_BASE}/storages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/octet-stream',
                'Crowdin-API-FileName': filename,
              },
              body: bodyData,
            });

            if (!storageResponse.ok) {
              console.error('❌ Storage creation failed for file:', filename, storageResponse.status);
              continue;
            }

            const storageData = await storageResponse.json();
            const storageId = storageData.data.id;

            // Step 2: Check if file exists
            const existingFile = await checkFileExists(filename, branchId, folderId);

            let fileResponse;
            if (existingFile) {
              // Update existing file
              console.log('📝 Updating existing file:', filename);
              try {
                const updateData = await updateExistingFile(existingFile.id, storageId);
                results.push({
                  fileId: updateData.data.id,
                  fileName: updateData.data.name,
                  filename: filename,
                  action: 'updated'
                });
                console.log('✅ Successfully updated file:', filename);
                continue;
              } catch (updateError) {
                console.error('❌ File update failed for:', filename, updateError);
                continue;
              }
            } else {
              // Create new file
              console.log('➕ Creating new file:', filename);
              const fileRequestBody: any = {
                storageId: storageId,
                name: filename,
                type: 'json',
              };

              if (branchId && branchId !== '__main__') {
                fileRequestBody.branchId = parseInt(branchId);
              }
              if (folderId && folderId !== '__root__') {
                fileRequestBody.directoryId = parseInt(folderId);
              }

              fileResponse = await fetch(`${CROWDIN_API_BASE}/projects/${projectId}/files`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(fileRequestBody),
              });

              if (fileResponse.ok) {
                const fileData = await fileResponse.json();
                results.push({
                  fileId: fileData.data.id,
                  fileName: fileData.data.name,
                  filename: filename,
                  action: 'created'
                });
                console.log('✅ Successfully created file:', filename);
              } else {
                console.error('❌ File creation failed for:', filename, fileResponse.status);
              }
            }
          }

          if (results.length === 0) {
            return new Response(JSON.stringify({ error: 'No files were successfully uploaded' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          console.log('✅ Multi-file export completed:', results.length, 'files uploaded');
          
          // Update document with Crowdin file information if documentId provided
          let databaseUpdateResult = null;
          if (documentId) {
            try {
              const updateData = {
                crowdin_project_id: projectId,
                crowdin_file_ids: results.map(r => r.fileId),
                crowdin_filenames: results.map(r => r.fileName),
                crowdin_split_by_paths: true,
              };

              const { error: updateError } = await supabaseClient
                .from('documents')
                .update(updateData)
                .eq('id', documentId);

              if (updateError) {
                console.error('Failed to update document with Crowdin info:', updateError);
                databaseUpdateResult = { error: updateError.message };
              } else {
                console.log('✅ Updated document with Crowdin file info');
                databaseUpdateResult = { success: true };
              }
            } catch (err) {
              console.error('Error updating document:', err);
              databaseUpdateResult = { error: err instanceof Error ? err.message : 'Unknown error' };
            }
          }
          
          return new Response(JSON.stringify({
            success: true,
            fileIds: results.map(r => r.fileId),
            fileNames: results.map(r => r.fileName),
            message: `Successfully uploaded ${results.length} files to Crowdin`,
            databaseUpdate: databaseUpdateResult
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });

        } else {
          // Handle single file export (existing logic)
          const { filename, data } = translationData;
          
          if (!filename || !data) {
            return new Response(JSON.stringify({ error: 'Missing filename or data for single file export' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Step 1: Create storage - try raw binary upload instead of FormData
          console.log('🔍 Raw translation data keys:', Object.keys(data || {}));
          console.log('🔍 Translation data sample:', JSON.stringify(data).substring(0, 200));

          if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            return new Response(JSON.stringify({ error: 'Translation data is empty or invalid' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const jsonContent = JSON.stringify(data, null, 2);
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
            console.error('Crowdin file creation failed:', fileResponse.status, await fileResponse.text());
            return new Response(JSON.stringify({ error: 'Failed to create file in Crowdin project' }), {
              status: fileResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const fileData = await fileResponse.json();
          console.log('✅ File created successfully:', fileData.data.name);

          // Create result object for consistent response
          const result = {
            fileId: fileData.data.id,
            fileName: fileData.data.name,
            action: 'created'
          };

          // Update document with Crowdin file information if documentId provided
          let databaseUpdateResult = null;
          if (documentId) {
            try {
              const updateData = {
                crowdin_project_id: projectId,
                crowdin_file_id: result.fileId,
                crowdin_filename: filename,
                crowdin_split_by_paths: false,
              };

              const { error: updateError } = await supabaseClient
                .from('documents')
                .update(updateData)
                .eq('id', documentId);

              if (updateError) {
                console.error('Failed to update document with Crowdin info:', updateError);
                databaseUpdateResult = { error: updateError.message };
              } else {
                console.log('✅ Updated document with Crowdin file info');
                databaseUpdateResult = { success: true };
              }
            } catch (err) {
              console.error('Error updating document:', err);
              databaseUpdateResult = { error: err instanceof Error ? err.message : 'Unknown error' };
            }
          }

          return new Response(JSON.stringify({
            success: true,
            fileId: result.fileId,
            fileName: result.fileName,
            message: `File ${result.action} successfully in Crowdin`,
            databaseUpdate: databaseUpdateResult
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

      } catch (error) {
        console.error('❌ Export error:', error);
        return new Response(JSON.stringify({ 
          error: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Import file from Crowdin
    if (action === 'importTranslationsFromCrowdin') {
      console.log('🔍 Import action started');
      
      const { fileId, fileIds, documentId, projectId } = payload;
      
      // Support both single file and multiple files import
      const filesToImport = fileIds && Array.isArray(fileIds) ? fileIds : (fileId ? [fileId] : []);
      
      if (filesToImport.length === 0) {
        return new Response(JSON.stringify({ error: 'File ID(s) are required' }), {
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

      // For multiple files (>3), use background task to prevent timeout
      if (filesToImport.length > 3) {
        console.log(`🚀 Starting background import for ${filesToImport.length} files`);
        
        // Define the background import task
        const backgroundImportTask = async () => {
          try {
            console.log(`📥 Background task: Importing ${filesToImport.length} file(s) from Crowdin`);
            const downloadedFiles: Record<string, any> = {};
            
            // Download all files
            for (const currentFileId of filesToImport) {
              console.log('🔍 Background task: Getting download URL from Crowdin project:', projectId, 'file:', currentFileId);
              
              const downloadUrlResponse = await fetch(`${CROWDIN_API_BASE}/projects/${projectId}/files/${currentFileId}/download`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${apiToken}`,
                }
              });

              if (!downloadUrlResponse.ok) {
                console.error('❌ Background task: Failed to get download URL from Crowdin:', downloadUrlResponse.status, downloadUrlResponse.statusText);
                continue; // Skip this file and continue with others
              }

              const downloadUrlData = await downloadUrlResponse.json();
              console.log('✅ Background task: Got download URL from Crowdin for file:', currentFileId);

              const fileUrl = downloadUrlData.data?.url;
              if (!fileUrl) {
                console.error('❌ Background task: No download URL received from Crowdin for file:', currentFileId);
                continue; // Skip this file and continue with others
              }

              console.log('🔍 Background task: Downloading actual file content from URL for file:', currentFileId);
              const fileContentResponse = await fetch(fileUrl);

              if (!fileContentResponse.ok) {
                console.error('❌ Background task: Failed to download file from URL:', fileContentResponse.status, fileContentResponse.statusText);
                continue; // Skip this file and continue with others
              }

              const fileContent = await fileContentResponse.text();
              console.log('✅ Background task: Downloaded file content for', currentFileId, 'length:', fileContent.length);

              try {
                const parsedContent = JSON.parse(fileContent);
                downloadedFiles[currentFileId] = parsedContent;
                console.log('✅ Background task: Successfully parsed downloaded content for file:', currentFileId);
              } catch (parseError) {
                console.error('❌ Background task: Failed to parse downloaded content as JSON for file:', currentFileId, parseError);
                continue; // Skip this file and continue with others
              }
            }
            
            const successfulCount = Object.keys(downloadedFiles).length;
            console.log(`✅ Background task completed: Successfully processed ${successfulCount}/${filesToImport.length} files`);
            
            // Create pending version instead of updating document directly
            if (successfulCount > 0) {
              try {
                // Get document base content and info
                const { data: document } = await supabaseClient
                  .from('documents')
                  .select('name, workspace_id, content')
                  .eq('id', documentId)
                  .single();
                
                if (document) {
                  // Merge all downloaded files with base content
                  const mergedContent = mergeTranslations(document.content, downloadedFiles);
                  
                  // Create comparison for patches
                  const comparison = compareDocumentVersionsPartial(document.content, mergedContent);
                  
                  // Create pending version
                  const { data: newVersion, error: versionError } = await supabaseClient
                    .from('document_versions')
                    .insert({
                      document_id: documentId,
                      user_id: user.id,
                      version_major: 0,
                      version_minor: 1,
                      version_patch: 0,
                      description: `Crowdin import - ${successfulCount} file(s) processed`,
                      tier: 'minor',
                      is_released: false,
                      is_selected: false,
                      status: 'pending',
                      import_source: 'crowdin',
                      patches: comparison.patches || []
                    })
                    .select()
                    .single();

                  if (versionError) {
                    console.error('❌ Background task: Failed to create pending version:', versionError);
                    throw versionError;
                  }

                  console.log(`✅ Background task: Created pending version ${newVersion.id} for document ${documentId}`);
                  
                  // Create notification for pending import review
                  await supabaseClient
                    .from('notifications')
                    .insert({
                      user_id: user.id,
                      document_id: documentId,
                      workspace_id: document.workspace_id,
                      type: 'crowdin_import_pending',
                      title: 'Crowdin Import Ready for Review',
                      message: `Imported ${successfulCount} file(s) from Crowdin to "${document.name}" - click to review changes`
                    });
                  
                  console.log('✅ Background task: Notification created for pending import review');
                }
              } catch (error) {
                console.error('❌ Background task: Failed to create pending version:', error);
              }
            }
            
          } catch (error) {
            console.error('❌ Background task error importing from Crowdin:', error);
          }
        };

        // Start the background task
        // EdgeRuntime.waitUntil(backgroundImportTask()); // Note: EdgeRuntime not available in this context
        backgroundImportTask(); // Execute directly for now
        
        // Return immediate response
        return new Response(JSON.stringify({
          success: true,
          message: `Import of ${filesToImport.length} files started in background`,
          background: true,
          filesCount: filesToImport.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // For smaller imports (≤3 files), process synchronously
      try {
        console.log(`🔍 Importing ${filesToImport.length} file(s) from Crowdin`);
        const downloadedFiles: Record<string, any> = {};
        
        // Download all files
        for (const currentFileId of filesToImport) {
          console.log('🔍 Getting download URL from Crowdin project:', projectId, 'file:', currentFileId);
          
          const downloadUrlResponse = await fetch(`${CROWDIN_API_BASE}/projects/${projectId}/files/${currentFileId}/download`, {
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
              error: `Failed to get download URL from Crowdin for file ${currentFileId}: ${downloadUrlResponse.statusText}` 
            }), {
              status: downloadUrlResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const downloadUrlData = await downloadUrlResponse.json();
          console.log('✅ Got download URL from Crowdin for file:', currentFileId);

          const fileUrl = downloadUrlData.data?.url;
          if (!fileUrl) {
            console.error('❌ No download URL received from Crowdin for file:', currentFileId);
            return new Response(JSON.stringify({ 
              error: `No download URL received from Crowdin for file ${currentFileId}` 
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          console.log('🔍 Downloading actual file content from URL for file:', currentFileId);
          const fileContentResponse = await fetch(fileUrl);

          if (!fileContentResponse.ok) {
            console.error('❌ Failed to download file from URL:', fileContentResponse.status, fileContentResponse.statusText);
            return new Response(JSON.stringify({ 
              error: `Failed to download file content for ${currentFileId}: ${fileContentResponse.statusText}` 
            }), {
              status: fileContentResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const fileContent = await fileContentResponse.text();
          console.log('✅ Downloaded file content for', currentFileId, 'length:', fileContent.length);

          try {
            const parsedContent = JSON.parse(fileContent);
            downloadedFiles[currentFileId] = parsedContent;
            console.log('✅ Successfully parsed downloaded content for file:', currentFileId);
          } catch (parseError) {
            console.error('❌ Failed to parse downloaded content as JSON for file:', currentFileId, parseError);
            return new Response(JSON.stringify({ 
              error: `Downloaded file ${currentFileId} is not valid JSON` 
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        
        // Create pending version for synchronous imports
        try {
          const { data: document } = await supabaseClient
            .from('documents')
            .select('name, workspace_id, content')
            .eq('id', documentId)
            .single();
          
          if (document) {
            // Merge all downloaded files with base content
            const mergedContent = mergeTranslations(document.content, downloadedFiles);
            
            // Create comparison for patches
            const comparison = compareDocumentVersionsPartial(document.content, mergedContent);
            
            // Create pending version
            const { data: newVersion, error: versionError } = await supabaseClient
              .from('document_versions')
              .insert({
                document_id: documentId,
                user_id: user.id,
                version_major: 0,
                version_minor: 1,
                version_patch: 0,
                description: `Crowdin import - ${filesToImport.length} file(s) processed`,
                tier: 'minor',
                is_released: false,
                is_selected: false,
                status: 'pending',
                import_source: 'crowdin',
                patches: comparison.patches || []
              })
              .select()
              .single();

            if (versionError) {
              console.error('❌ Failed to create pending version:', versionError);
              throw versionError;
            }

            console.log(`✅ Created pending version ${newVersion.id} for document ${documentId}`);
            
            // Create notification for pending import review
            await supabaseClient
              .from('notifications')
              .insert({
                user_id: user.id,
                document_id: documentId,
                workspace_id: document.workspace_id,
                type: 'crowdin_import_pending',
                title: 'Crowdin Import Ready for Review',
                message: `Imported ${filesToImport.length} file(s) from Crowdin to "${document.name}" - click to review changes`
              });
            
            console.log('✅ Notification created for pending synchronous import review');
            
            // Return success with pending version info
            return new Response(JSON.stringify({
              success: true,
              pendingVersion: true,
              versionId: newVersion.id,
              message: 'Import ready for review - check notifications to preview changes'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (error) {
          console.error('❌ Failed to create pending version:', error);
          return new Response(JSON.stringify({ 
            error: `Failed to create pending version: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (error) {
        console.error('❌ Error importing from Crowdin:', error);
        return new Response(JSON.stringify({ 
          error: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'fetchCrowdinBranches') {
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

    if (action === 'fetchCrowdinFolders') {
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

    if (action === 'validateImportAvailability') {
      const { documentId } = payload;

      if (!documentId) {
        return new Response(JSON.stringify({ error: 'Document ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('📋 Checking import availability for document:', documentId);

      try {
        // Query the document and its Crowdin integration
        const { data: document, error: documentError } = await supabaseClient
          .from('documents')
          .select(`
            id,
            crowdin_integration_id,
            document_crowdin_integrations!inner (
              file_id,
              file_ids,
              filename,
              filenames,
              project_id
            )
          `)
          .eq('id', documentId)
          .single();

        if (documentError || !document) {
          console.log('❌ Document not found or no Crowdin integration:', documentId);
          return new Response(JSON.stringify({ 
            available: false, 
            reason: 'Document not found or no Crowdin integration' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const integration = document.document_crowdin_integrations?.[0]; // Take first element from array
        
        // Check if document has Crowdin file references
        const hasSingleFile = !!integration?.file_id;
        const hasMultipleFiles = integration?.file_ids && Array.isArray(integration.file_ids) && integration.file_ids.length > 0;

        if (!hasSingleFile && !hasMultipleFiles) {
          console.log('❌ No Crowdin file references found for document:', documentId);
          return new Response(JSON.stringify({ 
            available: false, 
            reason: 'No Crowdin files associated with this document' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Determine file type and count
        let fileType: 'single' | 'multiple';
        let fileCount: number;

        if (hasSingleFile) {
          fileType = 'single';
          fileCount = 1;
        } else {
          fileType = 'multiple';
          fileCount = integration?.file_ids?.length || 0;
        }

        console.log('✅ Import available for document:', documentId, 'Type:', fileType, 'Count:', fileCount);

        return new Response(JSON.stringify({ 
          available: true,
          fileType,
          fileCount,
          integration: {
            file_id: integration?.file_id,
            file_ids: integration?.file_ids,
            filename: integration?.filename,
            filenames: integration?.filenames,
            project_id: integration?.project_id
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('❌ Error checking import availability:', error);
        return new Response(JSON.stringify({ 
          available: false, 
          reason: 'Failed to check import availability' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Error in crowdin-integration function:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});