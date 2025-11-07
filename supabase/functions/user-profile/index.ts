import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EdgeFunctionLogger, checkDemoSessionExpiration } from '../_shared/logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new EdgeFunctionLogger('user-profile', 'handler');
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

    // Check if demo session has expired
    const isExpired = await checkDemoSessionExpiration(supabaseClient, user.id);
    if (isExpired) {
      logger.warn('Demo session expired, denying access');
      return new Response(
        JSON.stringify({ error: 'Demo session expired' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const { action, ...requestData } = await req.json()
    logger.debug('Parsed request body', { action, hasData: !!requestData });

    let result;

    switch (action) {
      case 'getUserProfile':
        result = await handleGetUserProfile(supabaseClient, user, logger);
        break;
      case 'updateUserProfile':
        result = await handleUpdateUserProfile(supabaseClient, requestData, user, logger);
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

async function handleGetUserProfile(supabaseClient: any, user: any, logger: EdgeFunctionLogger) {
  logger.debug('Getting user profile', { userId: user.id });

  // First try to get existing profile
  const { data: existingProfile, error: fetchError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    logger.error('Failed to fetch user profile', fetchError);
    throw fetchError;
  }

  // If profile exists, return it
  if (existingProfile) {
    logger.info('Retrieved existing user profile', { userId: user.id });
    return { profile: existingProfile };
  }

  // No profile exists, create one
  logger.debug('No profile found, creating new profile', { userId: user.id });
  
  const profileData = {
    user_id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || user.email,
    username: user.user_metadata?.username || user.email?.split('@')[0] || 'user'
  };

  const { data: newProfile, error: insertError } = await supabaseClient
    .from('profiles')
    .insert(profileData)
    .select()
    .single();

  if (insertError) {
    // Handle unique constraint errors gracefully
    if (insertError.code === '23505') {
      logger.debug('Profile creation conflict, fetching existing profile');
      
      const { data: conflictProfile, error: conflictFetchError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (conflictFetchError) {
        logger.error('Failed to fetch profile after conflict', conflictFetchError);
        throw conflictFetchError;
      }
      
      logger.info('Retrieved profile after handling conflict', { userId: user.id });
      return { profile: conflictProfile };
    } else {
      logger.error('Failed to create user profile', insertError);
      throw insertError;
    }
  }

  logger.info('Successfully created new user profile', { userId: user.id });
  return { profile: newProfile };
}

async function handleUpdateUserProfile(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { updates } = data;
  logger.debug('Updating user profile', { userId: user.id, updatedFields: Object.keys(updates) });

  // Validate that we only allow certain fields to be updated
  const allowedFields = ['full_name', 'username', 'avatar_url'];
  const filteredUpdates = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = updates[key];
      return obj;
    }, {} as any);

  // Add updated timestamp
  filteredUpdates.updated_at = new Date().toISOString();

  const { data: updatedProfile, error } = await supabaseClient
    .from('profiles')
    .update(filteredUpdates)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    if (error.message?.includes('duplicate key')) {
      logger.warn('Username already taken', { userId: user.id, username: updates.username });
      return { 
        success: false, 
        error: 'Username is already taken. Please choose a different one.' 
      };
    }
    
    logger.error('Failed to update user profile', error);
    throw error;
  }

  logger.info('Successfully updated user profile', { 
    userId: user.id, 
    updatedFields: Object.keys(filteredUpdates) 
  });
  
  return { 
    success: true, 
    profile: updatedProfile,
    message: 'Profile updated successfully' 
  };
}