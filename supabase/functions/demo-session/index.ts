import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { action } = await req.json()

    if (action === 'createDemoSession') {
      // First, cleanup expired demo sessions
      console.log('Cleaning up expired demo sessions before creating new one')
      const { error: cleanupError } = await supabaseAdmin.rpc('cleanup_expired_demo_sessions')
      
      if (cleanupError) {
        console.error('Error during cleanup:', cleanupError)
        // Don't fail if cleanup fails, just log it
      }

      // Generate random credentials for demo user
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const demoEmail = `demo_${timestamp}_${randomSuffix}@demo.temp`
      const demoPassword = `Demo${timestamp}${randomSuffix}!`
      
      console.log('Creating demo user:', demoEmail)

      // Create demo user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: demoEmail,
        password: demoPassword,
        email_confirm: true,
        user_metadata: {
          full_name: 'Demo User',
          is_demo: true
        }
      })

      if (authError) {
        console.error('Error creating demo user:', authError)
        throw authError
      }

      console.log('Demo user created:', authData.user.id)

      // Create demo session record
      const { error: sessionError } = await supabaseAdmin
        .from('demo_sessions')
        .insert({
          user_id: authData.user.id,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        })

      if (sessionError) {
        console.error('Error creating demo session:', sessionError)
        // Clean up the user if session creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        throw sessionError
      }

      console.log('Demo session created successfully')

      return new Response(
        JSON.stringify({
          email: demoEmail,
          password: demoPassword,
          userId: authData.user.id,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'cleanupExpiredSessions') {
      console.log('Starting cleanup of expired demo sessions')
      
      // Call the database function to cleanup expired sessions
      const { error: cleanupError } = await supabaseAdmin.rpc('cleanup_expired_demo_sessions')

      if (cleanupError) {
        console.error('Error cleaning up demo sessions:', cleanupError)
        throw cleanupError
      }

      console.log('Cleanup completed successfully')

      return new Response(
        JSON.stringify({ success: true, message: 'Cleanup completed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Demo session error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
