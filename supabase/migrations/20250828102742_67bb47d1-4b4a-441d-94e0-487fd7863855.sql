-- Add Crowdin integration fields to documents table
ALTER TABLE public.documents 
ADD COLUMN crowdin_file_id text,
ADD COLUMN crowdin_project_id text,
ADD COLUMN crowdin_filename text;