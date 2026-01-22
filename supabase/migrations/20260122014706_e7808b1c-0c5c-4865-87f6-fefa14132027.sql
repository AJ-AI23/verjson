-- Create table to track markdown PDF renders
CREATE TABLE IF NOT EXISTS public.markdown_renders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  style_theme TEXT NOT NULL DEFAULT 'light',
  storage_path TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.markdown_renders ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_markdown_renders_document_id ON public.markdown_renders(document_id);

-- RLS Policies
-- Anyone can view renders for public documents
CREATE POLICY "Anyone can view renders for public documents"
ON public.markdown_renders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM documents d 
    WHERE d.id = markdown_renders.document_id 
    AND d.is_public = true
  )
);

-- Document owners and collaborators can view renders
CREATE POLICY "Document collaborators can view renders"
ON public.markdown_renders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM document_permissions dp 
    WHERE dp.document_id = markdown_renders.document_id 
    AND dp.user_id = auth.uid() 
    AND dp.status = 'accepted'
  )
);

-- Authenticated users can create renders for documents they have access to
CREATE POLICY "Collaborators can create renders"
ON public.markdown_renders FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM document_permissions dp 
    WHERE dp.document_id = markdown_renders.document_id 
    AND dp.user_id = auth.uid() 
    AND dp.status = 'accepted'
  )
);

-- Users can delete their own renders
CREATE POLICY "Users can delete their own renders"
ON public.markdown_renders FOR DELETE
USING (created_by = auth.uid());