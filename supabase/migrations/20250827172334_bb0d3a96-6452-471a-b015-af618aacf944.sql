-- Create document access logs table for plugin analytics
CREATE TABLE public.document_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL DEFAULT 'direct',
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for document access logs
CREATE POLICY "Document owners can view access logs" 
ON public.document_access_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.documents d 
    WHERE d.id = document_access_logs.document_id 
    AND d.user_id = auth.uid()
  )
);

-- Create policy for workspace members to view logs
CREATE POLICY "Workspace members can view access logs" 
ON public.document_access_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_permissions wp ON d.workspace_id = wp.workspace_id
    WHERE d.id = document_access_logs.document_id 
    AND wp.user_id = auth.uid()
  )
);

-- Allow service role to insert logs (for public access tracking)
CREATE POLICY "Service role can insert access logs" 
ON public.document_access_logs 
FOR INSERT 
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_document_access_logs_document_id ON public.document_access_logs(document_id);
CREATE INDEX idx_document_access_logs_created_at ON public.document_access_logs(created_at);
CREATE INDEX idx_document_access_logs_access_type ON public.document_access_logs(access_type);