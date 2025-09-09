-- Add new columns to documents table to support multiple Crowdin files
ALTER TABLE public.documents 
ADD COLUMN crowdin_file_ids jsonb,
ADD COLUMN crowdin_filenames jsonb,
ADD COLUMN crowdin_split_by_paths boolean DEFAULT false;