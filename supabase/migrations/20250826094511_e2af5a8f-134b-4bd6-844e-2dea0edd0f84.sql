-- Create document_versions table for persisting document history
CREATE TABLE public.document_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  version_major INTEGER NOT NULL DEFAULT 0,
  version_minor INTEGER NOT NULL DEFAULT 0,
  version_patch INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('major', 'minor', 'patch')),
  is_released BOOLEAN NOT NULL DEFAULT false,
  is_selected BOOLEAN NOT NULL DEFAULT true,
  patches JSONB,
  full_document JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraint to documents table
ALTER TABLE public.document_versions 
ADD CONSTRAINT fk_document_versions_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their document versions"
ON public.document_versions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create versions for their documents"
ON public.document_versions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND 
  EXISTS (
    SELECT 1 FROM public.documents 
    WHERE documents.id = document_versions.document_id 
    AND documents.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their document versions"
ON public.document_versions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their document versions"
ON public.document_versions
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_document_versions_document_id ON public.document_versions(document_id);
CREATE INDEX idx_document_versions_user_id ON public.document_versions(user_id);
CREATE INDEX idx_document_versions_created_at ON public.document_versions(created_at);

-- Create trigger for updated_at
CREATE TRIGGER update_document_versions_updated_at
  BEFORE UPDATE ON public.document_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();