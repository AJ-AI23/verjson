-- Fix infinite recursion in RLS policies by simplifying document access control

-- Drop all existing policies that cause circular references
DROP POLICY IF EXISTS "Users can view their own documents and documents they have perm" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents and documents they have ed" ON public.documents;
DROP POLICY IF EXISTS "Users can view permissions for their documents" ON public.document_permissions;
DROP POLICY IF EXISTS "Document owners can manage all permissions" ON public.document_permissions;

-- Create simplified document policies based on workspace access
CREATE POLICY "Users can view documents in their workspaces" 
ON public.documents 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM workspace_permissions wp 
    WHERE wp.workspace_id = documents.workspace_id 
    AND wp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update documents they own or have edit access to" 
ON public.documents 
FOR UPDATE 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM workspace_permissions wp 
    WHERE wp.workspace_id = documents.workspace_id 
    AND wp.user_id = auth.uid() 
    AND wp.role IN ('owner', 'editor')
  )
);

-- Simplified document permissions policies
CREATE POLICY "Document owners can manage permissions" 
ON public.document_permissions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM documents d 
    WHERE d.id = document_permissions.document_id 
    AND d.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own document permissions" 
ON public.document_permissions 
FOR SELECT 
USING (auth.uid() = user_id);