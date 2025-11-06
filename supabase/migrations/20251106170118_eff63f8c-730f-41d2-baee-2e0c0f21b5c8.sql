-- Add 'diagram' as a valid file type to documents table
ALTER TABLE public.documents 
DROP CONSTRAINT IF EXISTS documents_file_type_check;

ALTER TABLE public.documents 
ADD CONSTRAINT documents_file_type_check 
CHECK (file_type IN ('json-schema', 'openapi', 'diagram'));