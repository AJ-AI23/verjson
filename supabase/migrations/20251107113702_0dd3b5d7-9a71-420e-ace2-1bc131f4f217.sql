-- Update the cleanup function to also remove storage files
CREATE OR REPLACE FUNCTION public.cleanup_expired_demo_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
DECLARE
  expired_user_id UUID;
  bucket_record RECORD;
BEGIN
  -- Loop through expired demo sessions
  FOR expired_user_id IN 
    SELECT user_id 
    FROM demo_sessions 
    WHERE expires_at < now()
  LOOP
    -- Delete all storage files belonging to this user across all buckets
    FOR bucket_record IN 
      SELECT DISTINCT bucket_id 
      FROM storage.objects 
      WHERE owner = expired_user_id
    LOOP
      -- Delete all files in this bucket for this user
      DELETE FROM storage.objects 
      WHERE owner = expired_user_id 
        AND bucket_id = bucket_record.bucket_id;
    END LOOP;
    
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