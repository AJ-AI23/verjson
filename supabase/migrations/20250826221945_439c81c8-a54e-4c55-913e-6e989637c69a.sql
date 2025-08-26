-- Enable real-time for document_versions table
ALTER TABLE public.document_versions REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_versions;