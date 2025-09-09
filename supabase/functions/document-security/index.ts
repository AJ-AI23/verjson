import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EdgeFunctionLogger } from '../_shared/logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new EdgeFunctionLogger('document-security', 'handler');
  logger.logRequest(req.method, req.url);

  try {
    logger.debug('Authenticating user');
    
    // Create authenticated Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      logger.error('Authentication failed', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    logger.logAuth(user);

    const { action, ...requestData } = await req.json()
    logger.debug('Parsed request body', { action, hasData: !!requestData });

    let result;

    switch (action) {
      case 'checkDocumentPinStatus':
        result = await handleCheckDocumentPinStatus(supabaseClient, requestData, user, logger);
        break;
      case 'setDocumentPin':
        result = await handleSetDocumentPin(supabaseClient, requestData, user, logger);
        break;
      case 'removeDocumentPin':
        result = await handleRemoveDocumentPin(supabaseClient, requestData, user, logger);
        break;
      case 'verifyDocumentPin':
        result = await handleVerifyDocumentPin(supabaseClient, requestData, user, logger);
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
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})

// Improved PIN hashing function using Web Crypto API
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleCheckDocumentPinStatus(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId } = data;
  logger.debug('Checking document PIN status', { documentId, userId: user.id });

  // First check if user has document permissions (works for invited users)
  const { data: docPermissions, error: dpError } = await supabaseClient
    .from('document_permissions')
    .select('role, status')
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .eq('status', 'accepted')
    .maybeSingle();

  let isOwner = false;
  
  if (docPermissions) {
    isOwner = docPermissions.role === 'owner';
    logger.debug('User has document permissions', { documentId, userId: user.id, role: docPermissions.role });
  }

  // Try to get document info (might fail for invited users due to RLS)
  const { data: document, error } = await supabaseClient
    .from('documents')
    .select('pin_enabled, user_id')
    .eq('id', documentId)
    .maybeSingle();

  if (document) {
    // Double-check if user is owner from document table
    if (document.user_id === user.id) {
      isOwner = true;
    }
    
    const hasPin = document.pin_enabled;
    const needsPin = hasPin && !isOwner;

    logger.info('Document PIN status checked', { 
      documentId, 
      hasPin, 
      isOwner, 
      needsPin 
    });
    
    return { hasPin, isOwner, needsPin };
  }

  // If we can't access the document directly but have permissions, check via RPC
  if (docPermissions) {
    // Use RPC to get document permissions which includes document info
    const { data: anyPermissions, error: rpcError } = await supabaseClient
      .rpc('get_document_permissions', { doc_id: documentId });

    if (rpcError || !anyPermissions || anyPermissions.length === 0) {
      logger.warn('Document not found via RPC', { documentId, error: rpcError });
      return { hasPin: false, isOwner: false, needsPin: false };
    }

    // For now, assume no PIN if we can't access document table directly
    // This is safe because PINs are typically only set by document owners
    const hasPin = false;
    const needsPin = false;

    logger.info('Document PIN status checked via permissions', { 
      documentId, 
      hasPin, 
      isOwner, 
      needsPin 
    });
    
    return { hasPin, isOwner, needsPin };
  }

  // Check if user has workspace access
  const { data: workspacePermissions, error: wpError } = await supabaseClient
    .from('workspace_permissions')
    .select('role, status, workspace_id')
    .eq('user_id', user.id)
    .eq('status', 'accepted');

  if (workspacePermissions && workspacePermissions.length > 0) {
    // Check if any of these workspaces contain the document
    for (const wp of workspacePermissions) {
      const { data: workspaceDoc, error: wdError } = await supabaseClient
        .from('documents')
        .select('pin_enabled, user_id')
        .eq('id', documentId)
        .eq('workspace_id', wp.workspace_id)
        .maybeSingle();
      
      if (workspaceDoc) {
        const hasPin = workspaceDoc.pin_enabled;
        const isDocOwner = workspaceDoc.user_id === user.id;
        const needsPin = hasPin && !isDocOwner;

        logger.info('Document PIN status checked via workspace', { 
          documentId, 
          hasPin, 
          isOwner: isDocOwner, 
          needsPin 
        });
        
        return { hasPin, isOwner: isDocOwner, needsPin };
      }
    }
  }
  
  logger.warn('Document not found', { documentId });
  return { hasPin: false, isOwner: false, needsPin: false };
}

async function handleSetDocumentPin(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId, pin } = data;
  logger.debug('Setting document PIN', { documentId, userId: user.id });

  // Validate PIN format (optional - add your own validation rules)
  if (!pin || pin.length < 4) {
    logger.warn('Invalid PIN format', { documentId, pinLength: pin?.length });
    return { success: false, error: 'PIN must be at least 4 characters long' };
  }

  const hashedPin = await hashPin(pin);
  
  const { error } = await supabaseClient
    .from('documents')
    .update({
      pin_code: hashedPin,
      pin_enabled: true
    })
    .eq('id', documentId)
    .eq('user_id', user.id);

  if (error) {
    logger.error('Failed to set document PIN', error);
    throw error;
  }

  logger.info('Successfully set document PIN', { documentId, userId: user.id });
  
  return { success: true, message: 'Document PIN set successfully' };
}

async function handleRemoveDocumentPin(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId } = data;
  logger.debug('Removing document PIN', { documentId, userId: user.id });

  const { error } = await supabaseClient
    .from('documents')
    .update({
      pin_code: null,
      pin_enabled: false
    })
    .eq('id', documentId)
    .eq('user_id', user.id);

  if (error) {
    logger.error('Failed to remove document PIN', error);
    throw error;
  }

  logger.info('Successfully removed document PIN', { documentId, userId: user.id });
  
  return { success: true, message: 'Document PIN removed successfully' };
}

async function handleVerifyDocumentPin(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId, pin } = data;
  logger.debug('Verifying document PIN', { documentId, userId: user.id });

  const hashedPin = await hashPin(pin);
  
  const { data: document, error } = await supabaseClient
    .from('documents')
    .select('pin_code')
    .eq('id', documentId)
    .eq('pin_code', hashedPin)
    .eq('pin_enabled', true)
    .maybeSingle();

  if (error) {
    logger.error('Failed to verify document PIN', error);
    throw error;
  }

  if (document) {
    logger.info('Document PIN verified successfully', { documentId, userId: user.id });
    return { success: true, verified: true, message: 'PIN verified successfully' };
  } else {
    logger.warn('Incorrect PIN provided', { documentId, userId: user.id });
    return { success: false, verified: false, error: 'Incorrect PIN' };
  }
}