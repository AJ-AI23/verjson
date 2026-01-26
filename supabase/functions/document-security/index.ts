import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EdgeFunctionLogger } from '../_shared/logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_FAILED_ATTEMPTS = 4;

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

    // Create service role client for attempt tracking (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
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
        result = await handleCheckDocumentPinStatus(supabaseClient, supabaseAdmin, requestData, user, logger);
        break;
      case 'setDocumentPin':
        result = await handleSetDocumentPin(supabaseClient, requestData, user, logger);
        break;
      case 'removeDocumentPin':
        result = await handleRemoveDocumentPin(supabaseClient, requestData, user, logger);
        break;
      case 'verifyDocumentPin':
        result = await handleVerifyDocumentPin(supabaseClient, supabaseAdmin, requestData, user, logger);
        break;
      case 'unbrickDocument':
        result = await handleUnbrickDocument(supabaseClient, supabaseAdmin, requestData, user, logger);
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

// Get recent failed attempts count for a document
async function getFailedAttemptCount(supabaseAdmin: any, documentId: string, logger: EdgeFunctionLogger): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('pin_verification_attempts')
    .select('id')
    .eq('document_id', documentId)
    .eq('success', false)
    .gte('attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    logger.error('Error getting failed attempts', error);
    return 0;
  }

  return data?.length || 0;
}

// Record a PIN verification attempt
async function recordAttempt(supabaseAdmin: any, documentId: string, success: boolean, logger: EdgeFunctionLogger): Promise<void> {
  const { error } = await supabaseAdmin
    .from('pin_verification_attempts')
    .insert({
      document_id: documentId,
      success,
      attempted_at: new Date().toISOString()
    });

  if (error) {
    logger.error('Error recording attempt', error);
  }
}

// Brick a document after too many failed attempts
async function brickDocument(supabaseAdmin: any, documentId: string, logger: EdgeFunctionLogger): Promise<void> {
  const { error } = await supabaseAdmin
    .from('documents')
    .update({
      pin_bricked: true,
      pin_bricked_at: new Date().toISOString()
    })
    .eq('id', documentId);

  if (error) {
    logger.error('Error bricking document', error);
  } else {
    logger.info('Document bricked due to too many failed PIN attempts', { documentId });
  }
}

// Create notification for document owner when document is bricked
async function notifyOwnerOfBricking(supabaseAdmin: any, documentId: string, logger: EdgeFunctionLogger): Promise<void> {
  // Get document info
  const { data: document, error: docError } = await supabaseAdmin
    .from('documents')
    .select('name, user_id, workspace_id')
    .eq('id', documentId)
    .single();

  if (docError || !document) {
    logger.error('Error getting document for bricking notification', docError);
    return;
  }

  // Create notification
  const { error: notifError } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: document.user_id,
      document_id: documentId,
      workspace_id: document.workspace_id,
      type: 'security_alert',
      title: `⚠️ Document "${document.name}" has been locked`,
      message: `Your document has been locked due to ${MAX_FAILED_ATTEMPTS} failed PIN attempts. Go to Document Security settings to unlock it.`
    });

  if (notifError) {
    logger.error('Error creating bricking notification', notifError);
  } else {
    logger.info('Bricking notification created for document owner', { documentId, ownerId: document.user_id });
  }
}

async function handleCheckDocumentPinStatus(supabaseClient: any, supabaseAdmin: any, data: any, user: any, logger: EdgeFunctionLogger) {
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
    .select('pin_enabled, pin_bricked, pin_bricked_at, user_id')
    .eq('id', documentId)
    .maybeSingle();

  if (document) {
    // Double-check if user is owner from document table
    if (document.user_id === user.id) {
      isOwner = true;
    }
    
    const hasPin = document.pin_enabled;
    const isBricked = document.pin_bricked;
    const needsPin = hasPin && !isOwner && !isBricked;

    // Get failed attempt count for non-owners
    let failedAttempts = 0;
    if (!isOwner) {
      failedAttempts = await getFailedAttemptCount(supabaseAdmin, documentId, logger);
    }

    logger.info('Document PIN status checked', { 
      documentId, 
      hasPin, 
      isOwner, 
      needsPin,
      isBricked,
      failedAttempts
    });
    
    return { hasPin, isOwner, needsPin, isBricked, failedAttempts, brickedAt: document.pin_bricked_at };
  }

  // If we can't access the document directly but have permissions, check via RPC
  if (docPermissions) {
    // Use RPC to get document permissions which includes document info
    const { data: anyPermissions, error: rpcError } = await supabaseClient
      .rpc('get_document_permissions', { doc_id: documentId });

    if (rpcError || !anyPermissions || anyPermissions.length === 0) {
      logger.warn('Document not found via RPC', { documentId, error: rpcError });
      return { hasPin: false, isOwner: false, needsPin: false, isBricked: false, failedAttempts: 0 };
    }

    // For now, assume no PIN if we can't access document table directly
    const hasPin = false;
    const needsPin = false;

    logger.info('Document PIN status checked via permissions', { 
      documentId, 
      hasPin, 
      isOwner, 
      needsPin 
    });
    
    return { hasPin, isOwner, needsPin, isBricked: false, failedAttempts: 0 };
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
        .select('pin_enabled, pin_bricked, pin_bricked_at, user_id')
        .eq('id', documentId)
        .eq('workspace_id', wp.workspace_id)
        .maybeSingle();
      
      if (workspaceDoc) {
        const hasPin = workspaceDoc.pin_enabled;
        const isDocOwner = workspaceDoc.user_id === user.id;
        const isBricked = workspaceDoc.pin_bricked;
        const needsPin = hasPin && !isDocOwner && !isBricked;

        let failedAttempts = 0;
        if (!isDocOwner) {
          failedAttempts = await getFailedAttemptCount(supabaseAdmin, documentId, logger);
        }

        logger.info('Document PIN status checked via workspace', { 
          documentId, 
          hasPin, 
          isOwner: isDocOwner, 
          needsPin,
          isBricked,
          failedAttempts
        });
        
        return { hasPin, isOwner: isDocOwner, needsPin, isBricked, failedAttempts, brickedAt: workspaceDoc.pin_bricked_at };
      }
    }
  }
  
  logger.warn('Document not found', { documentId });
  return { hasPin: false, isOwner: false, needsPin: false, isBricked: false, failedAttempts: 0 };
}

async function handleSetDocumentPin(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId, pin } = data;
  logger.debug('Setting document PIN', { documentId, userId: user.id });

  // Validate PIN format - must be 6 digits
  if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    logger.warn('Invalid PIN format', { documentId, pinLength: pin?.length });
    return { success: false, error: 'PIN must be exactly 6 digits' };
  }

  const hashedPin = await hashPin(pin);
  
  const { error } = await supabaseClient
    .from('documents')
    .update({
      pin_code: hashedPin,
      pin_enabled: true,
      pin_bricked: false,
      pin_bricked_at: null
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
      pin_enabled: false,
      pin_bricked: false,
      pin_bricked_at: null
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

async function handleVerifyDocumentPin(supabaseClient: any, supabaseAdmin: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId, pin } = data;
  logger.debug('Verifying document PIN', { documentId, userId: user.id });

  // Check if document is bricked first
  const { data: document, error: docError } = await supabaseAdmin
    .from('documents')
    .select('pin_bricked, pin_code, pin_enabled')
    .eq('id', documentId)
    .single();

  if (docError) {
    logger.error('Failed to check document status', docError);
    return { success: false, verified: false, error: 'Failed to verify PIN' };
  }

  if (document.pin_bricked) {
    logger.warn('Attempt to verify PIN on bricked document', { documentId, userId: user.id });
    return { 
      success: false, 
      verified: false, 
      error: 'Document is locked due to too many failed attempts. Contact the owner.',
      isBricked: true
    };
  }

  // Check current failed attempt count
  const failedAttempts = await getFailedAttemptCount(supabaseAdmin, documentId, logger);
  
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    // Document should already be bricked, but double-check
    await brickDocument(supabaseAdmin, documentId, logger);
    return { 
      success: false, 
      verified: false, 
      error: 'Document is locked due to too many failed attempts. Contact the owner.',
      isBricked: true,
      failedAttempts
    };
  }

  const hashedPin = await hashPin(pin);
  
  // Verify PIN matches
  const isCorrect = document.pin_enabled && document.pin_code === hashedPin;

  if (isCorrect) {
    // Record successful attempt
    await recordAttempt(supabaseAdmin, documentId, true, logger);
    
    logger.info('Document PIN verified successfully', { documentId, userId: user.id });
    return { success: true, verified: true, message: 'PIN verified successfully' };
  } else {
    // Record failed attempt
    await recordAttempt(supabaseAdmin, documentId, false, logger);
    
    const newFailedCount = failedAttempts + 1;
    const remainingAttempts = MAX_FAILED_ATTEMPTS - newFailedCount;
    
    logger.warn('Incorrect PIN provided', { documentId, userId: user.id, failedAttempts: newFailedCount });

    // Check if we need to brick the document now
    if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
      await brickDocument(supabaseAdmin, documentId, logger);
      await notifyOwnerOfBricking(supabaseAdmin, documentId, logger);
      
      return { 
        success: false, 
        verified: false, 
        error: 'Document has been locked due to too many failed attempts. Contact the owner.',
        isBricked: true,
        failedAttempts: newFailedCount
      };
    }

    return { 
      success: false, 
      verified: false, 
      error: `Incorrect PIN. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
      failedAttempts: newFailedCount,
      remainingAttempts
    };
  }
}

async function handleUnbrickDocument(supabaseClient: any, supabaseAdmin: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId } = data;
  logger.debug('Unbricking document', { documentId, userId: user.id });

  // Verify user is the document owner
  const { data: document, error: docError } = await supabaseClient
    .from('documents')
    .select('user_id, name')
    .eq('id', documentId)
    .single();

  if (docError || !document) {
    logger.error('Document not found', docError);
    return { success: false, error: 'Document not found' };
  }

  if (document.user_id !== user.id) {
    logger.warn('Non-owner attempted to unbrick document', { documentId, userId: user.id, ownerId: document.user_id });
    return { success: false, error: 'Only the document owner can unlock a locked document' };
  }

  // Unbrick the document using service role (bypasses RLS for attempt cleanup)
  const { error: updateError } = await supabaseAdmin
    .from('documents')
    .update({
      pin_bricked: false,
      pin_bricked_at: null
    })
    .eq('id', documentId);

  if (updateError) {
    logger.error('Failed to unbrick document', updateError);
    return { success: false, error: 'Failed to unlock document' };
  }

  // Clear all failed attempts for this document
  const { error: clearError } = await supabaseAdmin
    .from('pin_verification_attempts')
    .delete()
    .eq('document_id', documentId);

  if (clearError) {
    logger.error('Failed to clear attempts', clearError);
    // Don't fail the unbrick operation if clearing attempts fails
  }

  logger.info('Successfully unbricked document', { documentId, userId: user.id });
  
  return { success: true, message: `Document "${document.name}" has been unlocked successfully` };
}