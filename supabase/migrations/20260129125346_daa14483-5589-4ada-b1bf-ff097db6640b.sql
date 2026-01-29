-- Drop the existing check constraint and add a new one that includes 'manifest'
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_file_type_check;

ALTER TABLE public.documents ADD CONSTRAINT documents_file_type_check 
CHECK (file_type IN ('json-schema', 'openapi', 'diagram', 'markdown', 'manifest'));