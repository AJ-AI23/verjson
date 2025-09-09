-- Create document_crowdin_integrations table
CREATE TABLE public.document_crowdin_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  project_id TEXT,
  file_id TEXT,
  file_ids JSONB,
  filename TEXT,
  filenames JSONB,
  split_by_paths BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_document_crowdin_integrations_document_id 
    FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_document_crowdin_integrations_document_id 
  ON public.document_crowdin_integrations(document_id);

-- Enable RLS
ALTER TABLE public.document_crowdin_integrations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view integrations for documents they have access to"
  ON public.document_crowdin_integrations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_crowdin_integrations.document_id
        AND (
          d.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.workspace_permissions wp
            WHERE wp.workspace_id = d.workspace_id
              AND wp.user_id = auth.uid()
              AND wp.status = 'accepted'
          )
        )
    )
  );

CREATE POLICY "Users can manage integrations for documents they own or have edit access to"
  ON public.document_crowdin_integrations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_crowdin_integrations.document_id
        AND (
          d.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.workspace_permissions wp
            WHERE wp.workspace_id = d.workspace_id
              AND wp.user_id = auth.uid()
              AND wp.role IN ('owner', 'editor')
              AND wp.status = 'accepted'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_crowdin_integrations.document_id
        AND (
          d.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.workspace_permissions wp
            WHERE wp.workspace_id = d.workspace_id
              AND wp.user_id = auth.uid()
              AND wp.role IN ('owner', 'editor')
              AND wp.status = 'accepted'
          )
        )
    )
  );

-- Migrate existing data from documents table
INSERT INTO public.document_crowdin_integrations (
  document_id,
  project_id,
  file_id,
  file_ids,
  filename,
  filenames,
  split_by_paths
)
SELECT 
  id,
  crowdin_project_id,
  crowdin_file_id,
  crowdin_file_ids,
  crowdin_filename,
  crowdin_filenames,
  crowdin_split_by_paths
FROM public.documents
WHERE crowdin_project_id IS NOT NULL
   OR crowdin_file_id IS NOT NULL
   OR crowdin_file_ids IS NOT NULL
   OR crowdin_filename IS NOT NULL
   OR crowdin_filenames IS NOT NULL;

-- Add crowdin_integration_id column to documents table
ALTER TABLE public.documents 
ADD COLUMN crowdin_integration_id UUID REFERENCES public.document_crowdin_integrations(id) ON DELETE SET NULL;

-- Update documents to reference the new integration records
UPDATE public.documents 
SET crowdin_integration_id = dci.id
FROM public.document_crowdin_integrations dci
WHERE dci.document_id = documents.id;

-- Add trigger for updated_at
CREATE TRIGGER update_document_crowdin_integrations_updated_at
  BEFORE UPDATE ON public.document_crowdin_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();