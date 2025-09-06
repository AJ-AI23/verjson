-- Enable real-time for tables that need it for permission revocation
ALTER TABLE public.workspace_permissions REPLICA IDENTITY FULL;
ALTER TABLE public.document_permissions REPLICA IDENTITY FULL;

-- Add tables to realtime publication  
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_permissions;