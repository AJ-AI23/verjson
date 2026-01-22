-- Add 'markdown' to the file_type constraint for documents table
ALTER TABLE public.documents 
DROP CONSTRAINT IF EXISTS documents_file_type_check;

ALTER TABLE public.documents 
ADD CONSTRAINT documents_file_type_check 
CHECK (file_type IN ('json-schema', 'openapi', 'diagram', 'markdown'));