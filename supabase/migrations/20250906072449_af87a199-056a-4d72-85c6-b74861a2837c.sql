-- Create table for Yjs document state
CREATE TABLE public.yjs_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL,
  user_id uuid NOT NULL,
  yjs_state bytea NOT NULL,
  yjs_vector_clock jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.yjs_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for yjs_documents
CREATE POLICY "Users can view yjs documents they have access to" 
ON public.yjs_documents 
FOR SELECT 
USING (
  -- Document owner
  (EXISTS (
    SELECT 1 FROM documents d 
    WHERE d.id = yjs_documents.document_id AND d.user_id = auth.uid()
  )) OR
  -- Workspace member
  (EXISTS (
    SELECT 1 FROM documents d
    JOIN workspace_permissions wp ON d.workspace_id = wp.workspace_id
    WHERE d.id = yjs_documents.document_id AND wp.user_id = auth.uid()
  ))
);

CREATE POLICY "Users can insert yjs documents they have access to" 
ON public.yjs_documents 
FOR INSERT 
WITH CHECK (
  -- Document owner
  (EXISTS (
    SELECT 1 FROM documents d 
    WHERE d.id = yjs_documents.document_id AND d.user_id = auth.uid()
  )) OR
  -- Workspace member with edit access
  (EXISTS (
    SELECT 1 FROM documents d
    JOIN workspace_permissions wp ON d.workspace_id = wp.workspace_id
    WHERE d.id = yjs_documents.document_id 
    AND wp.user_id = auth.uid() 
    AND wp.role IN ('owner', 'editor')
  ))
);

CREATE POLICY "Users can update yjs documents they have access to" 
ON public.yjs_documents 
FOR UPDATE 
USING (
  -- Document owner
  (EXISTS (
    SELECT 1 FROM documents d 
    WHERE d.id = yjs_documents.document_id AND d.user_id = auth.uid()
  )) OR
  -- Workspace member with edit access
  (EXISTS (
    SELECT 1 FROM documents d
    JOIN workspace_permissions wp ON d.workspace_id = wp.workspace_id
    WHERE d.id = yjs_documents.document_id 
    AND wp.user_id = auth.uid() 
    AND wp.role IN ('owner', 'editor')
  ))
);

-- Create table for active collaborative sessions
CREATE TABLE public.collaboration_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_name text,
  user_avatar text,
  cursor_position jsonb,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for collaboration sessions
ALTER TABLE public.collaboration_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for collaboration sessions
CREATE POLICY "Users can view collaboration sessions for documents they have access to" 
ON public.collaboration_sessions 
FOR SELECT 
USING (
  (EXISTS (
    SELECT 1 FROM documents d 
    WHERE d.id = collaboration_sessions.document_id AND d.user_id = auth.uid()
  )) OR
  (EXISTS (
    SELECT 1 FROM documents d
    JOIN workspace_permissions wp ON d.workspace_id = wp.workspace_id
    WHERE d.id = collaboration_sessions.document_id AND wp.user_id = auth.uid()
  ))
);

CREATE POLICY "Users can manage their own collaboration sessions" 
ON public.collaboration_sessions 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_yjs_documents_document_id ON public.yjs_documents(document_id);
CREATE INDEX idx_yjs_documents_updated_at ON public.yjs_documents(updated_at DESC);
CREATE INDEX idx_collaboration_sessions_document_id ON public.collaboration_sessions(document_id);
CREATE INDEX idx_collaboration_sessions_last_seen ON public.collaboration_sessions(last_seen DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_yjs_documents_updated_at
  BEFORE UPDATE ON public.yjs_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to clean up old collaboration sessions
CREATE OR REPLACE FUNCTION public.cleanup_old_collaboration_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Remove sessions older than 1 hour
  DELETE FROM public.collaboration_sessions 
  WHERE last_seen < (now() - interval '1 hour');
END;
$function$;