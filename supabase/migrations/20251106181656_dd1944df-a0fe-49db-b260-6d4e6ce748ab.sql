-- Create demo sessions tracking table
CREATE TABLE IF NOT EXISTS public.demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '10 minutes')
);

-- Enable RLS
ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own demo session
CREATE POLICY "Users can view own demo session"
  ON public.demo_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all demo sessions
CREATE POLICY "Service role can manage demo sessions"
  ON public.demo_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to cleanup expired demo sessions and their data
CREATE OR REPLACE FUNCTION public.cleanup_expired_demo_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_user_id UUID;
BEGIN
  -- Loop through expired demo sessions
  FOR expired_user_id IN 
    SELECT user_id 
    FROM demo_sessions 
    WHERE expires_at < now()
  LOOP
    -- Delete user's documents (cascades to versions, permissions, etc.)
    DELETE FROM documents WHERE user_id = expired_user_id;
    
    -- Delete user's workspaces (cascades to permissions, etc.)
    DELETE FROM workspaces WHERE user_id = expired_user_id;
    
    -- Delete notifications
    DELETE FROM notifications WHERE user_id = expired_user_id;
    
    -- Delete the demo session record
    DELETE FROM demo_sessions WHERE user_id = expired_user_id;
    
    -- Delete the auth user (this will cascade to profile)
    DELETE FROM auth.users WHERE id = expired_user_id;
  END LOOP;
END;
$$;

-- Create index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_demo_sessions_expires_at 
  ON public.demo_sessions(expires_at);
