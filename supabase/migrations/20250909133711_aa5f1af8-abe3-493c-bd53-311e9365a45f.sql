-- Remove old Crowdin columns from documents table (cleanup step)
ALTER TABLE public.documents 
DROP COLUMN IF EXISTS crowdin_project_id,
DROP COLUMN IF EXISTS crowdin_file_id,
DROP COLUMN IF EXISTS crowdin_file_ids,
DROP COLUMN IF EXISTS crowdin_filename,
DROP COLUMN IF EXISTS crowdin_filenames,
DROP COLUMN IF EXISTS crowdin_split_by_paths;