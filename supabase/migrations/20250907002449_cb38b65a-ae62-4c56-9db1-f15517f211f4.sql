-- Complete the remaining changes for workspace_permissions realtime
-- Add workspace_permissions table to realtime publication if not already there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'workspace_permissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_permissions;
  END IF;
END $$;

-- Ensure proper replica identity for workspace_permissions
ALTER TABLE public.workspace_permissions REPLICA IDENTITY FULL;