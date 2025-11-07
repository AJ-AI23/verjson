-- Create storage bucket for diagram renders
INSERT INTO storage.buckets (id, name, public)
VALUES ('diagram-renders', 'diagram-renders', true);

-- Allow public read access
CREATE POLICY "Public read access for diagram renders"
ON storage.objects FOR SELECT
USING (bucket_id = 'diagram-renders');

-- Allow authenticated users to upload diagram renders
CREATE POLICY "Authenticated users can upload diagram renders"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'diagram-renders' 
  AND auth.uid() IS NOT NULL
);

-- Allow users to update their own diagram renders
CREATE POLICY "Users can update their own diagram renders"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'diagram-renders' 
  AND auth.uid() IS NOT NULL
);

-- Create table for render metadata
CREATE TABLE IF NOT EXISTS public.diagram_renders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  style_theme TEXT NOT NULL DEFAULT 'light',
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  UNIQUE(document_id, style_theme)
);

-- Enable RLS
ALTER TABLE public.diagram_renders ENABLE ROW LEVEL SECURITY;

-- Public read access for renders of public documents
CREATE POLICY "Public read access for renders of public documents"
ON public.diagram_renders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = diagram_renders.document_id
    AND documents.is_public = true
  )
);

-- Authenticated users can create renders
CREATE POLICY "Authenticated users can create renders"
ON public.diagram_renders FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update renders they created
CREATE POLICY "Users can update their own renders"
ON public.diagram_renders FOR UPDATE
USING (created_by = auth.uid());

-- Index for faster lookups
CREATE INDEX idx_diagram_renders_document_theme 
ON public.diagram_renders(document_id, style_theme);