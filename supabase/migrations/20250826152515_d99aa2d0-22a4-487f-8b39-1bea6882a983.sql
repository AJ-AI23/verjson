-- Create enum for permission roles
CREATE TYPE public.permission_role AS ENUM ('owner', 'editor', 'viewer');

-- Create document_permissions table
CREATE TABLE public.document_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role permission_role NOT NULL DEFAULT 'editor',
  granted_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(document_id, user_id)
);

-- Create workspace_permissions table for future workspace-level permissions
CREATE TABLE public.workspace_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role permission_role NOT NULL DEFAULT 'editor',
  granted_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for document_permissions
CREATE POLICY "Users can view permissions for their documents" 
ON public.document_permissions 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.documents 
    WHERE documents.id = document_permissions.document_id 
    AND documents.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.document_permissions dp2
    WHERE dp2.document_id = document_permissions.document_id 
    AND dp2.user_id = auth.uid()
  )
);

CREATE POLICY "Document owners can manage all permissions" 
ON public.document_permissions 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.documents 
    WHERE documents.id = document_permissions.document_id 
    AND documents.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documents 
    WHERE documents.id = document_permissions.document_id 
    AND documents.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own permissions" 
ON public.document_permissions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create policies for workspace_permissions
CREATE POLICY "Users can view permissions for their workspaces" 
ON public.workspace_permissions 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE workspaces.id = workspace_permissions.workspace_id 
    AND workspaces.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.workspace_permissions wp2
    WHERE wp2.workspace_id = workspace_permissions.workspace_id 
    AND wp2.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owners can manage all permissions" 
ON public.workspace_permissions 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE workspaces.id = workspace_permissions.workspace_id 
    AND workspaces.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE workspaces.id = workspace_permissions.workspace_id 
    AND workspaces.user_id = auth.uid()
  )
);

-- Create triggers for updated_at
CREATE TRIGGER update_document_permissions_updated_at
BEFORE UPDATE ON public.document_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workspace_permissions_updated_at
BEFORE UPDATE ON public.workspace_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update documents table RLS policies to include collaborators
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

CREATE POLICY "Users can view their own documents and documents they have permissions for" 
ON public.documents 
FOR SELECT 
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.document_permissions 
    WHERE document_permissions.document_id = documents.id 
    AND document_permissions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own documents and documents they have editor permissions for" 
ON public.documents 
FOR UPDATE 
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.document_permissions 
    WHERE document_permissions.document_id = documents.id 
    AND document_permissions.user_id = auth.uid()
    AND document_permissions.role IN ('owner', 'editor')
  )
);

CREATE POLICY "Only document owners can delete documents" 
ON public.documents 
FOR DELETE 
USING (auth.uid() = user_id);